// Cookbook Recipe Finder - app shell. Bump VERSION with CACHE in sw.js on release.
const VERSION = "5";

const els = {
  version: document.getElementById("version"),
  search: document.getElementById("search"),
  clear: document.getElementById("clear"),
  kwToggle: document.getElementById("kw-toggle"),
  results: document.getElementById("results"),
  meta: document.getElementById("meta"),
  hint: document.getElementById("hint")
};

let index = []; // flat list of recipe rows
let cookbookCount = 0;

// Whether search also looks at keywords (index ingredients/categories).
// Persisted so it sticks between visits. Default off: title-only search.
const KW_KEY = "cooking.includeKeywords";
let includeKeywords = localStorage.getItem(KW_KEY) === "1";
els.kwToggle.checked = includeKeywords;

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
    return;
  }

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
      const page = r.page != null ? `<span class="page-pill">p.&nbsp;${esc(String(r.page))}</span>` : "";
      const chapter = r.chapter ? ` &middot; ${esc(r.chapter)}` : "";
      // When a result matched via keywords (its title doesn't contain the
      // query), show which keyword(s) matched so the hit isn't mysterious.
      let kwHint = "";
      if (includeKeywords) {
        const titleN = CookingSearch._norm(r.title);
        const titleHasAll = terms.every((t) => titleN.includes(t));
        if (!titleHasAll) {
          const matched = (r.keywords || []).filter((k) =>
            terms.some((t) => CookingSearch._norm(k).includes(t))
          );
          if (matched.length) {
            kwHint = `<div class="recipe-kw">matches: ${esc(matched.join(", "))}</div>`;
          }
        }
      }
      return `<li class="recipe">
        <div class="recipe-title">${highlight(r.title, q)}</div>
        <div class="recipe-sub"><span class="cookbook">${esc(r.cookbook)}</span>${chapter} ${page}</div>
        ${kwHint}
      </li>`;
    })
    .join("");
}

async function load() {
  try {
    const res = await fetch("./data/recipes.json", { cache: "no-cache" });
    const data = await res.json();
    index = CookingSearch.flattenRecipes(data);
    cookbookCount = (data.cookbooks || []).length;
  } catch (e) {
    els.hint.textContent = "Could not load the recipe list.";
    console.error(e);
    return;
  }
  render(els.search.value);
}

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

load();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW failed", e));
  });
}
