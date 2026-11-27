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

  // Split a query into words; every word must match (AND).
  // By default we only match the recipe TITLE. With opts.includeKeywords, a word
  // may also match the recipe's keywords (the index categories/ingredients), so
  // "tomato" can surface recipes that list tomato as an ingredient even when the
  // title doesn't say it. Keywords are already carried on every row by
  // flattenRecipes, so this is the only place that changes.
  function searchRecipes(index, query, opts) {
    const includeKeywords = !!(opts && opts.includeKeywords);
    const terms = norm(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    const results = index.filter((row) => {
      const title = norm(row.title);
      if (terms.every((t) => title.includes(t))) return true;
      if (!includeKeywords) return false;
      const hay = title + " " + norm((row.keywords || []).join(" "));
      return terms.every((t) => hay.includes(t));
    });
    // Rank: title starts-with query, then title contains all terms, then
    // keyword-only matches last; alphabetical within each tier.
    const q = norm(query);
    function rank(row) {
      const t = norm(row.title);
      if (t.startsWith(q)) return 0;
      if (terms.every((x) => t.includes(x))) return 1;
      return 2; // matched only via keywords
    }
    results.sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
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
