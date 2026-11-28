// Cookbook Recipe Finder - app shell. Bump VERSION with CACHE in sw.js on release.
const VERSION = "10";

const $ = (id) => document.getElementById(id);
const els = {
  version: $("version"),
  search: $("search"),
  clear: $("clear"),
  kwToggle: $("kw-toggle"),
  results: $("results"),
  meta: $("meta"),
  hint: $("hint"),
  // "My notes" bar on the home screen
  mineBar: $("mine-bar"),
  mineSummary: $("mine-summary"),
  mineList: $("mine-list"),
  exportShare: $("export-share"),
  exportDownload: $("export-download"),
  exportAgain: $("export-again"),
  // Recipe detail dialog
  dlg: $("detail"),
  dClose: $("d-close"),
  dTitle: $("d-title"),
  dSub: $("d-sub"),
  dIndexWrap: $("d-index-wrap"),
  dIndexKw: $("d-index-kw"),
  dIng: $("d-ing"),
  dIngInput: $("d-ing-input"),
  dIngAdd: $("d-ing-add"),
  dKw: $("d-kw"),
  dKwInput: $("d-kw-input"),
  dKwAdd: $("d-kw-add"),
  dNotes: $("d-notes"),
  dStatus: $("d-status")
};

const N = CookingNotes;
let index = []; // flat list of recipe rows (see search.js), each with .mine
let rowsByKey = new Map();
let cookbookCount = 0;
let cookbookTitles = {}; // id -> title, for local entries whose recipe is gone
let additions = N.emptyAdditions(); // permanent, from data/additions.json
let reconcileMsg = "";

// Whether search also looks at keywords (index ingredients/categories, plus
// Matt's own ingredients and keywords). Default off: title-only search.
const KW_KEY = "cooking.includeKeywords";
let includeKeywords = localStorage.getItem(KW_KEY) === "1";
els.kwToggle.checked = includeKeywords;

// Matt's local, not-yet-permanent additions. See notes.js for the lifecycle.
const NOTES_KEY = "cooking.myNotes";
let store = loadStore();

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(NOTES_KEY) || "null");
    if (s && s.entries) return s;
  } catch (e) { console.warn("Bad notes store", e); }
  return N.emptyStore();
}
function saveStore() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(store));
}

els.version.textContent = "v" + VERSION;

// Escape text before inserting as HTML.
function esc(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Bold the matched query terms inside a title.
function highlight(title, query) {
  const terms = CookingSearch._norm(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return esc(title);
  let out = "";
  let i = 0;
  const lower = title.toLowerCase();
  while (i < title.length) {
    let matched = 0;
    for (const t of terms) {
      if (lower.startsWith(t, i)) { matched = t.length; break; }
    }
    if (matched) {
      out += "<mark>" + esc(title.slice(i, i + matched)) + "</mark>";
      i += matched;
    } else {
      out += esc(title[i]);
      i += 1;
    }
  }
  return out;
}

function keyOf(row) {
  return N.recipeKey(row.cookbookId, row.title);
}

// Refresh one row's view of Matt's additions (local if any, else permanent).
function refreshMine(row) {
  row.mine = N.effective(store, additions, keyOf(row));
}

function subLine(row) {
  const page = row.page != null ? `<span class="page-pill">p.&nbsp;${esc(String(row.page))}</span>` : "";
  const chapter = row.chapter ? ` &middot; ${esc(row.chapter)}` : "";
  return `<span class="cookbook">${esc(row.cookbook)}</span>${chapter} ${page}`;
}

// Short summary of Matt's additions for a result card.
function mineLine(row) {
  const m = row.mine;
  if (!m) return "";
  const bits = [].concat(m.ingredients, m.keywords);
  let text = bits.join(", ");
  if (m.notes) text += (text ? " · " : "") + "notes";
  if (!text) return "";
  const dot = m.status === "saved" ? "" : `<span class="dot" title="Only on this phone"></span>`;
  return `<div class="recipe-mine">${dot}${esc(text)}</div>`;
}

function render(query) {
  const q = query.trim();
  els.clear.style.display = q ? "block" : "none";

  if (!q) {
    els.results.innerHTML = "";
    els.meta.textContent = "";
    els.hint.style.display = "block";
    els.hint.textContent =
      cookbookCount > 0
        ? `Type a keyword to search ${index.length} recipes across ${cookbookCount} cookbooks.`
        : "Type a keyword to find which cookbook a recipe is in.";
    renderMineBar();
    return;
  }

  els.mineBar.hidden = true;
  els.hint.style.display = "none";
  const matches = CookingSearch.searchRecipes(index, q, { includeKeywords });
  els.meta.textContent = matches.length
    ? `${matches.length} recipe${matches.length === 1 ? "" : "s"}`
    : "";

  if (!matches.length) {
    els.results.innerHTML = "";
    els.hint.style.display = "block";
    els.hint.textContent = includeKeywords
      ? `No recipes or ingredients match "${q}".`
      : `No recipe titles match "${q}". Turn on "Also search ingredients & categories" to broaden it.`;
    return;
  }

  const terms = CookingSearch._norm(q).split(/\s+/).filter(Boolean);
  els.results.innerHTML = matches
    .map((r) => {
      // When a result matched via keywords (its title doesn't contain the
      // query), show which keyword(s) matched so the hit isn't mysterious.
      let kwHint = "";
      if (includeKeywords) {
        const titleN = CookingSearch._norm(r.title);
        const titleHasAll = terms.every((t) => titleN.includes(t));
        if (!titleHasAll) {
          const matched = CookingSearch.extraTerms(r).filter((k) =>
            terms.some((t) => CookingSearch._norm(k).includes(t))
          );
          if (matched.length) {
            kwHint = `<div class="recipe-kw">matches: ${esc([...new Set(matched)].join(", "))}</div>`;
          }
        }
      }
      return `<li><button class="recipe" data-key="${esc(keyOf(r))}">
        <div class="recipe-title">${highlight(r.title, q)}</div>
        <div class="recipe-sub">${subLine(r)}</div>
        ${kwHint}
        ${mineLine(r)}
      </button></li>`;
    })
    .join("");
}

// ---- "My notes" bar: what's on this phone and the export buttons ----

function renderMineBar() {
  const c = N.counts(store);
  const total = c.pending + c.waiting;
  if (!total && !reconcileMsg) { els.mineBar.hidden = true; return; }
  els.mineBar.hidden = false;

  const parts = [];
  if (c.pending) parts.push(`${c.pending} not exported yet`);
  if (c.waiting) parts.push(`${c.waiting} exported, waiting to be added to the app`);
  els.mineSummary.textContent =
    (reconcileMsg ? reconcileMsg + " " : "") +
    (total ? `Your changes on this phone: ${parts.join("; ")}.` : "");

  const keys = Object.keys(store.entries).sort((a, b) =>
    store.entries[a].title.localeCompare(store.entries[b].title));
  els.mineList.innerHTML = keys.map((k) => {
    const e = store.entries[k];
    const label = e.exportId ? "waiting" : "not exported";
    return `<li><button class="mine-item" data-key="${esc(k)}">
      <span>${esc(e.title)}</span><span class="mine-state">${label}</span></button></li>`;
  }).join("");

  const canExport = c.pending > 0;
  els.exportDownload.hidden = !canExport;
  els.exportShare.hidden = !canExport || !canShareFiles();
  els.exportAgain.hidden = c.waiting === 0;
}

function canShareFiles() {
  try {
    return !!(navigator.canShare &&
      navigator.canShare({ files: [new File(["{}"], "t.json", { type: "application/json" })] }));
  } catch (e) { return false; }
}

// Export, then mark the exported entries so they're not exported again.
// They stay on the phone until a release's additions.json lists the export.
async function doExport(how, includeWaiting) {
  const built = N.buildExport(store, { includeWaiting, appVersion: VERSION });
  if (!built) return;
  const name = `cooking-notes-${built.file.exportId}.json`;
  const json = JSON.stringify(built.file, null, 2) + "\n";
  const file = new File([json], name, { type: "application/json" });

  if (how === "share") {
    try {
      await navigator.share({ files: [file], title: name });
    } catch (e) {
      if (e && e.name === "AbortError") return; // cancelled: nothing exported
      console.warn("Share failed, downloading instead", e);
      download(file);
    }
  } else {
    download(file);
  }
  N.markExported(store, built.keys, built.file.exportId);
  saveStore();
  reconcileMsg = "";
  render(els.search.value);
}

function download(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Recipe detail dialog ----

let current = null; // the row being edited
let draft = null;   // { notes, ingredients, keywords } shown in the dialog

function rowForKey(key) {
  if (rowsByKey.has(key)) return rowsByKey.get(key);
  // A local entry whose recipe isn't in the data any more (e.g. retitled).
  const e = store.entries[key];
  if (!e) return null;
  const row = {
    title: e.title, page: e.page, chapter: null, keywords: [],
    cookbook: cookbookTitles[e.cookbookId] || e.cookbookId, cookbookId: e.cookbookId,
    missing: true
  };
  refreshMine(row);
  return row;
}

function openDetail(row) {
  current = row;
  refreshMine(row);
  const m = row.mine;
  draft = { notes: m.notes, ingredients: m.ingredients.slice(), keywords: m.keywords.slice() };

  els.dTitle.textContent = row.title;
  els.dSub.innerHTML = subLine(row) +
    (row.missing ? `<div class="warn">This recipe isn't in the recipe list any more.</div>` : "");
  els.dIndexWrap.hidden = !row.keywords.length;
  els.dIndexKw.innerHTML = row.keywords.map((k) => `<span class="chip ro">${esc(k)}</span>`).join("");
  els.dNotes.value = draft.notes;
  els.dIngInput.value = "";
  els.dKwInput.value = "";
  renderChips();
  renderStatus();

  history.pushState({ detail: true }, "");
  els.dlg.showModal();
  els.dlg.scrollTop = 0;
}

function renderChips() {
  const chips = (list, field) => list.map((v, i) =>
    `<span class="chip">${esc(v)}<button data-field="${field}" data-i="${i}" aria-label="Remove ${esc(v)}">&times;</button></span>`
  ).join("");
  els.dIng.innerHTML = chips(draft.ingredients, "ingredients");
  els.dKw.innerHTML = chips(draft.keywords, "keywords");
}

function renderStatus() {
  const m = current.mine;
  const has = !N.isEmpty(N.cleanFields(m));
  let text = "";
  if (m.status === "pending") text = "Saved on this phone. Not exported yet.";
  else if (m.status === "waiting") {
    const d = m.exportedAt ? new Date(m.exportedAt).toLocaleDateString() : "";
    text = `Saved on this phone. Exported ${d}, waiting to be added to the app.`;
  } else if (has) text = "Saved in the app.";
  els.dStatus.textContent = text;
}

// Save after every change; the local entry holds the recipe's full state.
function saveDraft() {
  N.setEntry(store, additions, current, draft);
  saveStore();
  refreshMine(current);
  renderStatus();
}

function addFromInput(field, input) {
  const v = input.value.trim();
  if (!v) return;
  draft[field] = N.cleanList(draft[field].concat(v));
  input.value = "";
  renderChips();
  saveDraft();
  input.focus();
}

els.dIngAdd.addEventListener("click", () => addFromInput("ingredients", els.dIngInput));
els.dKwAdd.addEventListener("click", () => addFromInput("keywords", els.dKwInput));
els.dIngInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addFromInput("ingredients", els.dIngInput); }
});
els.dKwInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addFromInput("keywords", els.dKwInput); }
});
function removeChip(e) {
  const b = e.target.closest("button[data-field]");
  if (!b) return;
  draft[b.dataset.field].splice(Number(b.dataset.i), 1);
  renderChips();
  saveDraft();
}
els.dIng.addEventListener("click", removeChip);
els.dKw.addEventListener("click", removeChip);
els.dNotes.addEventListener("input", () => {
  draft.notes = els.dNotes.value;
  saveDraft();
});

// Closing: the x button, Esc, or Android's back button (via history).
els.dClose.addEventListener("click", () => els.dlg.close());
els.dlg.addEventListener("close", () => {
  // Typed into an add box but didn't press Add: keep it rather than lose it.
  if (els.dIngInput.value.trim()) addFromInput("ingredients", els.dIngInput);
  if (els.dKwInput.value.trim()) addFromInput("keywords", els.dKwInput);
  if (history.state && history.state.detail) history.back();
  current = null;
  render(els.search.value);
});
window.addEventListener("popstate", () => {
  if (els.dlg.open) els.dlg.close();
});

// ---- Wiring ----

function onOpenClick(e) {
  const b = e.target.closest("button[data-key]");
  if (!b) return;
  const row = rowForKey(b.dataset.key);
  if (row) openDetail(row);
}
els.results.addEventListener("click", onOpenClick);
els.mineList.addEventListener("click", onOpenClick);
els.exportDownload.addEventListener("click", () => doExport("download", false));
els.exportShare.addEventListener("click", () => doExport("share", false));
els.exportAgain.addEventListener("click", () => {
  const n = N.counts(store);
  const how = canShareFiles() ? "share" : "download";
  if (confirm(`Export all ${n.pending + n.waiting} changes again, including ones already exported? Use this if an earlier export file was lost.`)) {
    doExport(how, true);
  }
});

els.search.addEventListener("input", () => render(els.search.value));
els.clear.addEventListener("click", () => {
  els.search.value = "";
  els.search.focus();
  render("");
});
els.kwToggle.addEventListener("change", () => {
  includeKeywords = els.kwToggle.checked;
  localStorage.setItem(KW_KEY, includeKeywords ? "1" : "0");
  render(els.search.value);
});

async function load() {
  let data;
  try {
    const res = await fetch("./data/recipes.json", { cache: "no-cache" });
    data = await res.json();
  } catch (e) {
    els.hint.textContent = "Could not load the recipe list.";
    console.error(e);
    return;
  }
  try {
    const res = await fetch("./data/additions.json", { cache: "no-cache" });
    if (res.ok) additions = await res.json();
  } catch (e) {
    console.warn("No additions.json", e);
  }
  additions.importedExports = additions.importedExports || [];
  additions.recipes = additions.recipes || {};

  // Clear local entries that a release has made permanent.
  const removed = N.reconcile(store, additions);
  if (removed) {
    saveStore();
    reconcileMsg = `${removed} change${removed === 1 ? " is" : "s are"} now saved in the app and ${removed === 1 ? "was" : "were"} cleared from this phone.`;
  }

  index = CookingSearch.flattenRecipes(data);
  cookbookCount = (data.cookbooks || []).length;
  cookbookTitles = {};
  for (const cb of data.cookbooks || []) cookbookTitles[cb.id] = cb.title;
  rowsByKey = new Map();
  for (const row of index) {
    refreshMine(row);
    rowsByKey.set(keyOf(row), row);
  }
  render(els.search.value);
}

load();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW failed", e));
  });
}
