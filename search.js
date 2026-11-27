// Pure search logic, no DOM. Works in the browser (attaches to window) and in
// Node (module.exports) so it can be unit-tested. This is the single seam:
// swap substring matching for fuzzy search, or add chapter/cookbook filters,
// and only this file changes.
(function (global) {
  "use strict";

  // Flatten the nested cookbook data into a flat list of recipe rows that the
  // UI and the search both work from.
  //
  // Dedupe is per-cookbook, keyed by (title + page): an index page lists the
  // same recipe under many categories, so collapse those to one row and merge
  // the keywords. The same title in a DIFFERENT cookbook stays a separate row -
  // showing which cookbook(s) a recipe is in is the whole point of the app.
  function flattenRecipes(data) {
    const cookbooks = (data && data.cookbooks) || [];
    const rows = [];
    const seen = new Map();
    for (const cb of cookbooks) {
      for (const r of cb.recipes || []) {
        const title = r.title || "";
        const page = r.page != null ? r.page : null;
        const keywords = Array.isArray(r.keywords) ? r.keywords.slice() : [];
        const key = (cb.id || cb.title) + "\u0000" + norm(title) + "\u0000" + String(page);
        if (seen.has(key)) {
          const existing = seen.get(key);
          for (const k of keywords) {
            if (!existing.keywords.includes(k)) existing.keywords.push(k);
          }
          if (!existing.chapter && r.chapter) existing.chapter = r.chapter;
          continue;
        }
        const row = {
          title: title,
          page: page, // number or a range string like "112-114"
          chapter: r.chapter || null,
          keywords: keywords, // from index pages; not searched yet (see searchRecipes)
          cookbook: cb.title || "",
          author: cb.author || null,
          cookbookId: cb.id || null,
          source: cb.source || null // "toc" | "index"
        };
        seen.set(key, row);
        rows.push(row);
      }
    }
    return rows;
  }

  // Normalize for matching: lowercase, strip accents, collapse whitespace.
  function norm(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  // Split a query into words. Every word must appear in the title (AND match).
  // For now we only search the recipe title, per the spec. To add ingredient
  // search later, also test row.keywords here - that's the only change needed,
  // because the keywords are already carried on every row by flattenRecipes.
  function searchRecipes(index, query) {
    const terms = norm(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    const results = index.filter((row) => {
      const title = norm(row.title);
      return terms.every((t) => title.includes(t));
    });
    // Sort: exact-ish (title starts with the query) first, then alphabetical.
    const q = norm(query);
    results.sort((a, b) => {
      const as = norm(a.title).startsWith(q) ? 0 : 1;
      const bs = norm(b.title).startsWith(q) ? 0 : 1;
      if (as !== bs) return as - bs;
      return norm(a.title).localeCompare(norm(b.title));
    });
    return results;
  }

  const api = { flattenRecipes, searchRecipes, _norm: norm };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.CookingSearch = api;
  }
})(typeof self !== "undefined" ? self : this);
