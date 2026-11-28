// Pure logic for Matt's own additions to a recipe (favorite, notes,
// ingredients, keywords). No DOM, so it runs in the browser (window.CookingNotes) and in
// Node (module.exports) for tests and scripts/import-notes.js.
//
// Two layers:
// - Permanent: data/additions.json, committed. Built by import-notes.js from
//   export files. Shape: { schemaVersion, importedExports: [id, ...],
//   recipes: { key: { cookbookId, title, page, favorite, notes, ingredients, keywords, updatedAt } } }
// - Local: the phone's localStorage. One entry per recipe Matt changed, holding
//   the FULL desired state for that recipe (not a diff), plus exportId.
//
// Lifecycle of a local entry:
//   edited      -> exportId null ("not exported yet")
//   exported    -> exportId set ("exported, waiting to be added")
//   edited again-> exportId null again, so the next export includes it
//   added       -> the shipped additions.json lists its exportId in
//                  importedExports, so reconcile() deletes the local entry
(function (global) {
  "use strict";

  const SCHEMA = 1;

  function recipeKey(cookbookId, title) {
    return String(cookbookId || "") + "::" + String(title || "");
  }

  function emptyStore() {
    return { schemaVersion: SCHEMA, entries: {} };
  }

  function emptyAdditions() {
    return { schemaVersion: SCHEMA, importedExports: [], recipes: {} };
  }

  // Trim, drop blanks, dedupe case-insensitively (first spelling wins).
  function cleanList(list) {
    const out = [];
    const seen = new Set();
    for (const raw of list || []) {
      const v = String(raw || "").replace(/\s+/g, " ").trim();
      if (!v) continue;
      const k = v.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(v);
    }
    return out;
  }

  function cleanFields(f) {
    return {
      favorite: !!(f && f.favorite),
      notes: String((f && f.notes) || "").replace(/\s+$/, ""),
      ingredients: cleanList(f && f.ingredients),
      keywords: cleanList(f && f.keywords)
    };
  }

  function isEmpty(f) {
    return !f.favorite && !f.notes && !f.ingredients.length && !f.keywords.length;
  }

  function sameFields(a, b) {
    const x = cleanFields(a), y = cleanFields(b);
    return x.favorite === y.favorite && x.notes === y.notes &&
      JSON.stringify(x.ingredients) === JSON.stringify(y.ingredients) &&
      JSON.stringify(x.keywords) === JSON.stringify(y.keywords);
  }

  function permanentFields(additions, key) {
    const p = additions && additions.recipes && additions.recipes[key];
    return cleanFields(p || {});
  }

  // What the app shows and searches for one recipe: the local entry if there
  // is one, otherwise the permanent additions.
  //   status: "saved"   (only permanent, or nothing)
  //           "pending" (local, not exported yet)
  //           "waiting" (local, exported, not added yet)
  function effective(store, additions, key) {
    const local = store && store.entries && store.entries[key];
    if (local) {
      return Object.assign(cleanFields(local), {
        status: local.exportId ? "waiting" : "pending",
        exportId: local.exportId || null,
        exportedAt: local.exportedAt || null
      });
    }
    return Object.assign(permanentFields(additions, key), { status: "saved", exportId: null, exportedAt: null });
  }

  // Save Matt's edit. `recipe` is { cookbookId, title, page }.
  // If the edit brings a never-exported entry back to what's already
  // permanent, the local entry is dropped (nothing to export). An entry that
  // was exported is kept, so a revert still reaches the permanent data.
  function setEntry(store, additions, recipe, fields, now) {
    const key = recipeKey(recipe.cookbookId, recipe.title);
    const clean = cleanFields(fields);
    const prev = store.entries[key];
    if (sameFields(clean, permanentFields(additions, key)) && !(prev && prev.exportedAt)) {
      delete store.entries[key];
      return store;
    }
    if (prev && sameFields(clean, prev)) return store; // no real change
    store.entries[key] = Object.assign({
      cookbookId: recipe.cookbookId,
      title: recipe.title,
      page: recipe.page != null ? recipe.page : null
    }, clean, {
      updatedAt: (now || new Date()).toISOString(),
      exportId: null,
      exportedAt: prev ? prev.exportedAt || null : null
    });
    return store;
  }

  function counts(store) {
    let pending = 0, waiting = 0;
    for (const e of Object.values(store.entries)) {
      if (e.exportId) waiting++; else pending++;
    }
    return { pending, waiting };
  }

  // An id that's readable in a file name and unique enough for one person:
  // 2026-11-27-2045-k3f9
  function makeExportId(now, rand) {
    const d = now || new Date();
    const p = (n) => String(n).padStart(2, "0");
    const r = rand || Math.random().toString(36).slice(2, 6);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${r}`;
  }

  // Build the export file. By default only entries not exported yet;
  // { includeWaiting: true } re-exports the waiting ones too (for a lost file).
  // Returns null when there's nothing to export.
  function buildExport(store, opts) {
    const o = opts || {};
    const now = o.now || new Date();
    const keys = Object.keys(store.entries).filter((k) =>
      o.includeWaiting ? true : !store.entries[k].exportId
    ).sort();
    if (!keys.length) return null;
    const exportId = o.exportId || makeExportId(now);
    const entries = keys.map((k) => {
      const e = store.entries[k];
      return {
        key: k, cookbookId: e.cookbookId, title: e.title, page: e.page,
        favorite: !!e.favorite, notes: e.notes, ingredients: e.ingredients, keywords: e.keywords,
        updatedAt: e.updatedAt
      };
    });
    return {
      file: {
        kind: "cooking-app-notes-export",
        schemaVersion: SCHEMA,
        exportId,
        exportedAt: now.toISOString(),
        appVersion: o.appVersion || null,
        entries
      },
      keys
    };
  }

  // Call once the export file has been handed off (downloaded or shared).
  function markExported(store, keys, exportId, now) {
    const at = (now || new Date()).toISOString();
    for (const k of keys) {
      const e = store.entries[k];
      if (e) { e.exportId = exportId; e.exportedAt = at; }
    }
    return store;
  }

  // Drop local entries whose export has been added to the permanent data.
  // An entry edited after its export has exportId null, so it stays.
  // Returns the number removed.
  function reconcile(store, additions) {
    const done = new Set((additions && additions.importedExports) || []);
    let removed = 0;
    for (const [k, e] of Object.entries(store.entries)) {
      if (e.exportId && done.has(e.exportId)) { delete store.entries[k]; removed++; }
    }
    return removed;
  }

  // Merge an export file into the permanent additions (used by
  // scripts/import-notes.js). Each entry replaces that recipe's additions,
  // unless the permanent copy is newer (an older export imported late).
  // An entry with nothing in it removes the recipe's additions.
  // Returns a report of what happened.
  function applyImport(additions, file) {
    if (!file || file.kind !== "cooking-app-notes-export" || !file.exportId) {
      throw new Error("Not a cooking-app notes export file.");
    }
    const report = { exportId: file.exportId, alreadyImported: false, added: [], updated: [], removed: [], skippedOlder: [] };
    if (additions.importedExports.includes(file.exportId)) {
      report.alreadyImported = true;
      return report;
    }
    for (const e of file.entries || []) {
      const key = e.key || recipeKey(e.cookbookId, e.title);
      const prev = additions.recipes[key];
      if (prev && prev.updatedAt && e.updatedAt && prev.updatedAt > e.updatedAt) {
        report.skippedOlder.push(key);
        continue;
      }
      const clean = cleanFields(e);
      if (isEmpty(clean)) {
        if (prev) { delete additions.recipes[key]; report.removed.push(key); }
        continue;
      }
      additions.recipes[key] = Object.assign(
        { cookbookId: e.cookbookId, title: e.title, page: e.page != null ? e.page : null },
        clean,
        { updatedAt: e.updatedAt || file.exportedAt }
      );
      (prev ? report.updated : report.added).push(key);
    }
    additions.importedExports.push(file.exportId);
    return report;
  }

  const api = {
    recipeKey, emptyStore, emptyAdditions, cleanList, cleanFields, isEmpty,
    effective, setEntry, counts, makeExportId, buildExport, markExported,
    reconcile, applyImport
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.CookingNotes = api;
  }
})(typeof self !== "undefined" ? self : this);
