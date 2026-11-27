// Cookbook Recipe Finder - app shell. Bump VERSION with CACHE in sw.js on release.
const VERSION = "2";

const els = {
  version: document.getElementById("version"),
  search: document.getElementById("search"),
  clear: document.getElementById("clear"),
  results: document.getElementById("results"),
  meta: document.getElementById("meta"),
  hint: document.getElementById("hint")
};

let index = []; // flat list of recipe rows
let cookbookCount = 0;

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
  const matches = CookingSearch.searchRecipes(index, q);
  els.meta.textContent = matches.length
    ? `${matches.length} recipe${matches.length === 1 ? "" : "s"}`
    : "";

  if (!matches.length) {
    els.results.innerHTML = "";
    els.hint.style.display = "block";
    els.hint.textContent = `No recipe titles match "${q}".`;
    return;
  }

  els.results.innerHTML = matches
    .map((r) => {
      const page = r.page != null ? `<span class="page-pill">p.&nbsp;${esc(String(r.page))}</span>` : "";
      const chapter = r.chapter ? ` &middot; ${esc(r.chapter)}` : "";
      return `<li class="recipe">
        <div class="recipe-title">${highlight(r.title, q)}</div>
        <div class="recipe-sub"><span class="cookbook">${esc(r.cookbook)}</span>${chapter} ${page}</div>
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

load();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW failed", e));
  });
}
