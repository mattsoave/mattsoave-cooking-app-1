#!/usr/bin/env node
// Build one cookbook's recipe list from its raw index transcription.
//
//   node scripts/build-book.js <book-id>            build + print summary, write review.md
//   node scripts/build-book.js <book-id> --compare  also compare against data/recipes.json
//   node scripts/build-book.js <book-id> --write    replace the book in data/recipes.json
//
// Inputs (intake/<book-id>/):
//   book.json       { id, title, author?, source, groupBy? }
//                   groupBy "title" (default): one recipe per (title + page).
//                     For indexes that print a recipe under the same name everywhere.
//                   groupBy "page": one recipe per page span, title chosen from the
//                     entries that share it. For indexes that print a recipe under many
//                     names ("Kimchi" under Carbonara, "Kimchi Carbonara" under Bucatini).
//   index.tsv       one row per printed index line: photo, level, text, pages
//                   (level 0 = flush left, 1 = indented once, ...). A row with
//                   pages is an entry; a row without pages is a heading. Rows are
//                   transcribed exactly as printed, without the comma that separates
//                   the text from the page numbers.
//   overrides.json  decisions made during review:
//                     titles:     { "printed text": "corrected text" }  (applied before anything else)
//                     pageTitles: { "page": "title" | ["title", "title"] }  (groupBy page: pick or split)
//                     pages:      { "title": "page" }   corrected or display page
//                     exclude:    [ "text or title", ... ]  non-recipes
//                     keep:       [ "text or title", ... ]  undo an automatic exclusion
//                     reviewed:   [ "flag key", ... ]       silence a flag after checking it
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const bookId = args.find((a) => !a.startsWith("--"));
const doCompare = args.includes("--compare");
const doWrite = args.includes("--write");

if (!bookId) {
  console.error("usage: node scripts/build-book.js <book-id> [--compare] [--write]");
  process.exit(1);
}

const dir = path.join(ROOT, "intake", bookId);
const book = readJson(path.join(dir, "book.json"));
const groupBy = book.groupBy || "title";
const overrides = Object.assign(
  { titles: {}, pageTitles: {}, pages: {}, exclude: [], excludeChapters: [], keep: [], reviewed: [] },
  fs.existsSync(path.join(dir, "overrides.json")) ? readJson(path.join(dir, "overrides.json")) : {}
);

// toc.tsv (optional): photo, chapter, title, page. One row per recipe the table
// of contents lists, with its start page. Titles are transcribed in normal case
// (TOCs are often all caps), using the index's spelling where it differs.
// When present, the TOC is the list of recipes and the source of titles; the
// index only adds keywords and the page span.
const tocPath = path.join(dir, "toc.tsv");
const hasToc = fs.existsSync(tocPath);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function words(s) {
  return new Set(norm(s).match(/[a-z0-9]+/g) || []);
}

function isSubset(a, b) {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// "19–21" -> "19-21". "68, 69–70, 71–73" -> "68-73": first page to last, per Matt.
// Short ranges are expanded ("102–4" is 102-104). A single page stays a number.
function parsePages(raw) {
  const s = (raw || "").replace(/[–—]/g, "-").trim();
  if (!s) return null;
  const nums = [];
  for (const part of s.split(",")) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return undefined;
    nums.push(Number(m[1]));
    if (m[2]) {
      let b = m[2];
      if (b.length < m[1].length) b = m[1].slice(0, m[1].length - b.length) + b;
      nums.push(Number(b));
    }
  }
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return lo === hi ? lo : `${lo}-${hi}`;
}

// Headings become keywords: "Cheese. See also Parmesan; Pecorino" -> "cheese",
// "Artichoke(s)" -> "artichoke".
function cleanHeading(h) {
  return h.replace(/\.\s*see\b.*$/i, "").replace(/\((e?s)\)$/i, "").trim();
}

// ---- 1. Read rows ----------------------------------------------------------
const lines = fs.readFileSync(path.join(dir, "index.tsv"), "utf8").split(/\r?\n/);
const header = lines.shift().split("\t");
const col = (name) => header.indexOf(name);
const rows = [];
const errors = [];
lines.forEach((line, i) => {
  if (!line.trim()) return;
  const f = line.split("\t");
  const row = {
    line: i + 2, // 1-based, after header
    photo: f[col("photo")],
    level: Number(f[col("level")]),
    text: (f[col("text")] || "").trim(),
    pagesRaw: (f[col("pages")] || "").trim()
  };
  if (overrides.titles[row.text]) row.text = overrides.titles[row.text];
  if (!Number.isInteger(row.level) || row.level < 0) errors.push(`line ${row.line}: bad level "${f[col("level")]}"`);
  if (!row.text) errors.push(`line ${row.line}: empty text`);
  if (row.pagesRaw && parsePages(row.pagesRaw) === undefined) errors.push(`line ${row.line}: can't read pages "${row.pagesRaw}"`);
  rows.push(row);
});
const titleOverridesUsed = Object.keys(overrides.titles).filter((t) =>
  lines.some((l) => l.split("\t")[col("text")] === t)
);

// Photos are taken in page order, so filenames must not go backwards.
for (let i = 1; i < rows.length; i++) {
  if (rows[i].photo < rows[i - 1].photo) {
    errors.push(`line ${rows[i].line}: photo ${rows[i].photo} sorts before the previous row's photo`);
  }
}

// ---- 2. Rebuild hierarchy ----------------------------------------------------
const flags = []; // { key, kind, message }
const info = [];
const stack = []; // stack[level] = heading text (cleaned)
const entries = [];
let prevLevel = -1;
rows.forEach((row, i) => {
  if (row.level > prevLevel + 1) {
    errors.push(`line ${row.line}: level jumps from ${prevLevel} to ${row.level} ("${row.text}")`);
  }
  // A sub-entry at the start of a new photo belongs to the last heading on the
  // previous photo. Note it so the carry-over is visible in review.
  if (i > 0 && row.photo !== rows[i - 1].photo && row.level > 0) {
    info.push(`"${stack.slice(0, row.level).join(" › ")}" carries over from ${rows[i - 1].photo} to ${row.photo}`);
  }
  stack.length = row.level;
  // A sub-heading only makes sense with its parent: "vinegar › white" is
  // "white vinegar", "beans › lima" is "lima beans". Keep the parent too.
  const keywords = stack.map((h, j) => (j === 0 ? h : `${h} ${stack[j - 1]}`).toLowerCase());
  const parent = stack[row.level - 1] || null;
  stack[row.level] = cleanHeading(row.text);
  prevLevel = row.level;
  const next = rows[i + 1];
  if (row.pagesRaw) {
    entries.push({ row, keywords, parent, hasChildren: !!(next && next.level > row.level) });
  }
});

// ---- 3. Drop non-recipes -----------------------------------------------------
const exclude = new Set(overrides.exclude.map(norm));
const keep = new Set(overrides.keep.map(norm));
const reviewed = new Set(overrides.reviewed);
const applied = titleOverridesUsed.map((t) => `title: "${t}" -> "${overrides.titles[t]}"`);
const autoExcluded = [];

function addFlag(key, kind, message) {
  if (reviewed.has(key)) return;
  if (!flags.some((f) => f.key === key)) flags.push({ key, kind, message });
}

const NOTE_RE = /\b(notes? (on|about)|origins? of|creation of|cooking methods?|history of)\b/i;
const PERSON_RE = /^[A-Z][\p{L}'’-]+, [A-Z]\p{L}+$/u;

// With a TOC, matching against it decides what's a recipe, so these
// guesses aren't needed.
const recipeEntries = hasToc ? entries : entries.filter((e) => {
  const t = e.row.text;
  const full = e.parent ? `${e.parent} ${t}` : t;
  if (exclude.has(norm(t)) || exclude.has(norm(full))) {
    applied.push(`excluded: "${t}"`);
    return false;
  }
  if (keep.has(norm(t)) || keep.has(norm(full))) return true;
  let why = null;
  if (e.hasChildren) why = "a heading with its own page";
  else if (NOTE_RE.test(t)) why = "an essay or note";
  else if (PERSON_RE.test(t)) why = "a person's name";
  if (why) {
    autoExcluded.push(`"${e.parent ? e.parent + " › " : ""}${t}, ${e.row.pagesRaw}" (line ${e.row.line}): ${why}`);
    return false;
  }
  return true;
});

// ---- 4. Group into recipes ---------------------------------------------------
const RANK = { exact: 3, derived: 2, "maybe-inverted": 1, fragment: 0 };
const STOP = new Set(["and", "with", "the", "a", "of", "in", "or"]);
let recipes;
const derivedTitles = [];
const tocReport = { excluded: [], notInIndex: [], unmatched: [] };
if (hasToc) recipes = buildWithToc(recipeEntries);
else if (groupBy === "page") recipes = groupByPage(recipeEntries);
else recipes = groupByTitle(recipeEntries);

function readToc() {
  const tl = fs.readFileSync(tocPath, "utf8").split(/\r?\n/);
  const th = tl.shift().split("\t");
  const c = (name) => th.indexOf(name);
  const out = [];
  tl.forEach((line, i) => {
    if (!line.trim()) return;
    const f = line.split("\t");
    const r = { line: i + 2, photo: f[c("photo")], chapter: (f[c("chapter")] || "").trim(), title: (f[c("title")] || "").trim(), page: Number(f[c("page")]) };
    if (!r.title) errors.push(`toc line ${r.line}: empty title`);
    if (!Number.isInteger(r.page)) errors.push(`toc line ${r.line}: can't read page "${f[c("page")]}"`);
    if (out.length && r.photo < out[out.length - 1].photo) errors.push(`toc line ${r.line}: photo ${r.photo} sorts before the previous row's photo`);
    out.push(r);
  });
  return out;
}

function contentWords(s) {
  return new Set([...words(s)].filter((w) => !STOP.has(w)));
}

function buildWithToc(list) {
  const exChapters = new Set(overrides.excludeChapters.map(norm));
  const exTitles = new Set(overrides.exclude.map(norm));
  const toc = readToc();
  const recs = [];
  const excludedPages = new Set();
  for (const t of toc) {
    if (exChapters.has(norm(t.chapter)) || exTitles.has(norm(t.title))) {
      tocReport.excluded.push(`"${t.title}" p.${t.page} (${exChapters.has(norm(t.chapter)) ? `chapter "${t.chapter}"` : "excluded title"})`);
      excludedPages.add(t.page);
      continue;
    }
    recs.push({ title: t.title, tocPage: t.page, chapter: t.chapter || null, keywords: [], spans: new Map() });
  }

  // Group index entries by page span, then give each group to the TOC
  // recipe(s) whose start page falls inside the span.
  const groups = new Map();
  for (const e of list) {
    const span = String(parsePages(e.row.pagesRaw));
    if (!groups.has(span)) groups.set(span, []);
    groups.get(span).push(e);
  }
  for (const [span, members] of groups) {
    const [lo, hi] = span.split("-").map(Number).concat([Number(span)]).slice(0, 2);
    const top = Number.isNaN(hi) ? lo : hi;
    const cands = recs.filter((r) => r.tocPage >= lo && r.tocPage <= top);
    if (!cands.length) {
      let onlyExcluded = false;
      for (const p of excludedPages) if (p >= lo && p <= top) onlyExcluded = true;
      if (!onlyExcluded) {
        const texts = [...new Set(members.map((m) => (m.parent ? `${m.parent} › ` : "") + m.row.text))];
        tocReport.unmatched.push(`p.${span}: ${texts.map((t) => `"${t}"`).join(", ")}`);
      }
      continue;
    }
    for (const m of members) {
      // With more than one recipe in the span, the entry goes to the one whose
      // title shares the most words with the entry (and its heading).
      let target = cands[0];
      if (cands.length > 1) {
        const w = contentWords(`${m.parent || ""} ${m.row.text}`);
        let best = -1;
        for (const r of cands) {
          const score = [...contentWords(r.title)].filter((x) => w.has(x)).length;
          if (score > best) { best = score; target = r; }
        }
      }
      target.spans.set(span, (target.spans.get(span) || 0) + 1);
      mergeKeywords(target, m.keywords);
      // A flush-left entry printed under another name is indexed under its
      // first term ("Pine Nuts, Marinated, ..." is listed under "pine nuts").
      // Skip it when the title already contains every word.
      if (m.row.level === 0 && m.row.text.includes(",")) {
        const term = m.row.text.split(",")[0].replace(/["“”]/g, "").trim().toLowerCase();
        if (!isSubset(words(term), words(target.title))) mergeKeywords(target, [term]);
      }
    }
  }

  for (const r of recs) {
    if (!r.spans.size) {
      r.page = r.tocPage;
      tocReport.notInIndex.push(`"${r.title}" p.${r.tocPage}`);
      addFlag(`not-in-index:${norm(r.title)}`, "not in index", `"${r.title}" (TOC p.${r.tocPage}) matched no index entry, so it has no keywords and uses the TOC page.`);
    } else {
      const spans = [...r.spans.entries()].sort((a, b) => b[1] - a[1]);
      r.page = asPage(spans[0][0]);
      if (spans.length > 1) {
        addFlag(`spans:${norm(r.title)}`, "page spans", `"${r.title}" matched index entries with different page spans: ${spans.map(([s, n]) => `${s} (${n})`).join(", ")}. Using ${spans[0][0]}.`);
      }
    }
    if (overrides.pages[r.title] != null && String(overrides.pages[r.title]) !== String(r.page)) {
      applied.push(`page: "${r.title}" ${r.page} -> ${overrides.pages[r.title]}`);
      r.page = asPage(overrides.pages[r.title]);
    }
  }
  return recs;
}

function groupByTitle(list) {
  const byKey = new Map();
  for (const { row, keywords } of list) {
    const title = row.text;
    let page = parsePages(row.pagesRaw);
    if (overrides.pages[title] != null && String(overrides.pages[title]) !== String(page)) {
      applied.push(`page: "${title}" ${page} -> ${overrides.pages[title]}`);
      page = asPage(overrides.pages[title]);
    }
    const half = title.length / 2;
    if (Number.isInteger(half) && title.slice(0, half) === title.slice(half)) {
      addFlag(`doubled:${norm(title)}`, "typo?", `"${title}" is the same text twice (line ${row.line}).`);
    }
    const key = norm(title) + "\u0000" + String(page);
    if (!byKey.has(key)) byKey.set(key, { title, page, keywords: [] });
    mergeKeywords(byKey.get(key), keywords);
  }
  const out = [...byKey.values()];
  // Same title at different pages: a misprint in the index, or two recipes.
  const pagesByTitle = new Map();
  for (const r of out) {
    if (!pagesByTitle.has(norm(r.title))) pagesByTitle.set(norm(r.title), []);
    pagesByTitle.get(norm(r.title)).push(r.page);
  }
  for (const [t, pages] of pagesByTitle) {
    if (pages.length > 1) {
      const title = out.find((r) => norm(r.title) === t).title;
      addFlag(`title-pages:${t}`, "conflict", `"${title}" appears at different pages: ${pages.join(", ")}.`);
    }
  }
  flagSharedPages(out);
  return out;
}

// Turn one printed entry into a candidate title, using the book's conventions:
//   "with Squash, ..." under Campanelle   -> "Campanelle with Squash, ..."
//   "alla Vodka with ..." under Casarecce -> "Casarecce alla Vodka with ..."
//   "Mom's Mushroom Ragù with" under Cascatelli -> "Mom's Mushroom Ragù with Cascatelli"
//   "Clam Miso Sauce, Linguine with"      -> "Linguine with Clam Miso Sauce"
// quality: exact (printed as a whole title) > derived (built by a rule above)
//   > maybe-inverted (has a comma before any "with", like "Dal, Mac 'n'")
//   > fragment (one word under a heading, like "Kimchi" under Carbonara).
function candidate(e) {
  let t = e.row.text;
  let how = "exact";
  if (e.row.level > 0 && /^[a-z]/.test(t) && e.parent) {
    t = `${e.parent} ${t}`;
    how = "derived";
  }
  const inv = t.match(/^(.*), ([^,]+ with)$/);
  if (inv) {
    t = `${inv[2]} ${inv[1]}`;
    how = "derived";
  } else if (e.row.level > 0 && / with$/.test(t) && e.parent) {
    t = `${t} ${e.parent}`;
    how = "derived";
  }
  if (how === "exact") {
    const w = t.indexOf(" with ");
    const c = t.indexOf(", ");
    if (c >= 0 && (w < 0 || c < w)) how = "maybe-inverted";
    else if (e.row.level > 0 && !/\s/.test(t)) how = "fragment";
  }
  return { title: t, how, level: e.row.level };
}

function groupByPage(list) {
  const groups = new Map();
  for (const e of list) {
    const key = String(parsePages(e.row.pagesRaw));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ e, c: candidate(e) });
  }
  const out = [];
  for (const [page, members] of groups) {
    let titles;
    const forced = overrides.pageTitles[page];
    if (forced) {
      titles = Array.isArray(forced) ? forced : [forced];
      applied.push(`page ${page}: ${titles.map((t) => `"${t}"`).join(" + ")}`);
    } else {
      const counts = new Map();
      for (const m of members) counts.set(norm(m.c.title), (counts.get(norm(m.c.title)) || 0) + 1);
      const best = members
        .map((m, i) => ({ ...m.c, i, n: counts.get(norm(m.c.title)) }))
        .sort((a, b) =>
          RANK[b.how] - RANK[a.how] || b.n - a.n || (b.level === 0) - (a.level === 0) || b.title.length - a.title.length || a.i - b.i
        )[0];
      titles = [best.title];
      if (best.how === "derived") derivedTitles.push(`p.${page}: "${best.title}"`);
      if (RANK[best.how] < RANK.derived) {
        addFlag(`title:${page}`, "title?", `Page ${page}: best title found is "${best.title}" (${best.how}). Set pageTitles["${page}"] if it's wrong.`);
      }
      // Two titles that aren't word-for-word variants of each other are
      // probably two recipes on the same pages (or one recipe with two names).
      const bw = words(best.title);
      const others = [...new Map(members.filter((m) => m.c.how !== "fragment").map((m) => [norm(m.c.title), m.c.title])).values()]
        .filter((t) => { const w = words(t); return !isSubset(w, bw) && !isSubset(bw, w); });
      if (others.length) {
        addFlag(`page-titles:${page}`, "same page",
          `Page ${page} has titles that don't match: "${best.title}" and ${others.map((t) => `"${t}"`).join(", ")}. Two recipes, or one with two names? Set pageTitles["${page}"].`);
      }
    }
    // With more than one title on a page, each entry goes to the title that
    // shares the most words with it (and its heading).
    const recs = titles.map((title) => ({ title, page: asPage(page), keywords: [] }));
    for (const m of members) {
      const w = words(`${m.e.parent || ""} ${m.e.row.text}`);
      let target = recs[0];
      let bestScore = -1;
      for (const r of recs) {
        const score = [...words(r.title)].filter((x) => w.has(x)).length;
        if (score > bestScore) { bestScore = score; target = r; }
      }
      mergeKeywords(target, m.e.keywords);
      // A flush-left entry printed under another name is indexed under its
      // first term: "Clam Miso Sauce, Linguine with" is listed under "clam miso sauce".
      if (m.e.row.level === 0 && norm(m.e.row.text) !== norm(target.title) && m.e.row.text.includes(",")) {
        mergeKeywords(target, [m.e.row.text.split(",")[0].trim().toLowerCase()]);
      }
    }
    for (const r of recs) {
      if (overrides.pages[r.title] != null && String(overrides.pages[r.title]) !== String(r.page)) {
        applied.push(`page: "${r.title}" ${r.page} -> ${overrides.pages[r.title]}`);
        r.page = asPage(overrides.pages[r.title]);
      }
      out.push(r);
    }
  }
  return out;
}

function asPage(v) {
  return /^\d+$/.test(String(v)) ? Number(v) : String(v);
}

function mergeKeywords(rec, keywords) {
  for (const k of keywords) if (!rec.keywords.includes(k)) rec.keywords.push(k);
}

function flagSharedPages(list) {
  const byPage = new Map();
  for (const r of list) {
    const p = String(r.page);
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p).push(r.title);
  }
  for (const [p, titles] of byPage) {
    if (titles.length > 1) {
      addFlag(`page-titles:${p}`, "same page", `Page ${p} has ${titles.length} titles: ${titles.map((t) => `"${t}"`).join(", ")}.`);
    }
  }
}

recipes.sort((a, b) => norm(a.title).localeCompare(norm(b.title)));
for (const r of recipes) r.keywords.sort();

// ---- 5. Output ---------------------------------------------------------------
const out = {
  id: book.id,
  title: book.title,
  ...(book.author ? { author: book.author } : {}),
  source: book.source || "index",
  recipes: recipes.map((r) => ({ title: r.title, page: r.page, ...(r.chapter ? { chapter: r.chapter } : {}), keywords: r.keywords }))
};

const photos = [...new Set(rows.map((r) => r.photo))];
const appliedList = [...new Set(applied)];
const section = (title, items) => [`## ${title} (${items.length})`, ...(items.length ? items.map((x) => `- ${x}`) : ["- none"]), ""];
const review = [
  `# Review: ${book.title}`,
  "",
  `Generated by \`node scripts/build-book.js ${bookId}\`. Don't edit by hand; resolve flags in overrides.json and rerun.`,
  "",
  `- Photos: ${photos.length} (${photos.join(", ")})`,
  `- Printed rows: ${rows.length}, entries with pages: ${entries.length}`,
  `- Grouped by: ${hasToc ? "table of contents (index matched by page)" : groupBy}`,
  `- Recipes: ${recipes.length}`,
  "",
  ...section("Errors", errors),
  ...section("Flags to check", flags.map((f) => `[${f.kind}] ${f.message} (key: \`${f.key}\`)`)),
  ...(hasToc
    ? [
        ...section("TOC entries excluded", tocReport.excluded),
        ...section("Index entries matching no TOC recipe (dropped: notes, gear, people, components)", tocReport.unmatched)
      ]
    : section("Excluded automatically (add to \"keep\" to include)", autoExcluded)),
  ...section("Overrides applied", appliedList),
  ...(groupBy === "page" ? section("Titles built from a heading or an inverted entry (spot-check)", derivedTitles) : []),
  ...section("Carry-overs between photos", info)
].join("\n");
fs.writeFileSync(path.join(dir, "review.md"), review);

console.log(`${book.title}: ${rows.length} rows -> ${entries.length} entries -> ${recipes.length} recipes`);
console.log(`errors: ${errors.length}, open flags: ${flags.length}, auto-excluded: ${autoExcluded.length}, overrides applied: ${appliedList.length}`);
console.log(`review: ${path.relative(ROOT, path.join(dir, "review.md"))}`);

if (doCompare) compare(out);
if (doWrite) {
  if (errors.length) {
    console.error("not writing: fix the errors first");
    process.exit(1);
  }
  const dataPath = path.join(ROOT, "data", "recipes.json");
  const data = readJson(dataPath);
  const i = data.cookbooks.findIndex((c) => c.id === book.id);
  if (i >= 0) data.cookbooks[i] = out;
  else data.cookbooks.push(out);
  fs.writeFileSync(dataPath, formatData(data));
  console.log(`wrote ${book.id} into data/recipes.json`);
}

// Same layout as the hand-written file: one recipe per line, so diffs stay small.
function formatData(data) {
  const ind = (n) => " ".repeat(n);
  const val = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v));
  const books = data.cookbooks.map((cb) => {
    const head = Object.entries(cb)
      .filter(([k]) => k !== "recipes")
      .map(([k, v]) => `${ind(6)}${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    const recs = (cb.recipes || []).map((r) => {
      const fields = Object.entries(r).map(([k, v]) => `${JSON.stringify(k)}: ${val(v)}`);
      return `${ind(8)}{ ${fields.join(", ")} }`;
    });
    return `${ind(4)}{\n${head.join(",\n")},\n${ind(6)}"recipes": [\n${recs.join(",\n")}\n${ind(6)}]\n${ind(4)}}`;
  });
  const top = Object.entries(data)
    .filter(([k]) => k !== "cookbooks")
    .map(([k, v]) => `${ind(2)}${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return `{\n${top.join(",\n")},\n${ind(2)}"cookbooks": [\n${books.join(",\n")}\n${ind(2)}]\n}\n`;
}

// Compare against the book's current entry in data/recipes.json. A partial
// transcription (a subset of photos) can't find every recipe, and its keywords
// can only be a subset of the full book's, so report those cases separately.
function compare(built) {
  const data = readJson(path.join(ROOT, "data", "recipes.json"));
  const current = data.cookbooks.find((c) => c.id === built.id);
  if (!current) {
    console.log("compare: book not in data/recipes.json yet");
    return;
  }
  const pg = (r) => String(r.page).replace(/[–—]/g, "-");
  const k = (r) => norm(r.title) + "\u0000" + pg(r);
  const cur = new Map(current.recipes.map((r) => [k(r), r]));
  const used = new Set();
  const notInCurrent = [];
  const titleDiffs = [];
  const extraKeywords = [];
  const missingKeywords = [];
  let matched = 0;
  for (const r of built.recipes) {
    let c = cur.get(k(r));
    if (!c) {
      // Same page, different title: report as a title difference.
      const samePage = current.recipes.filter((x) => pg(x) === pg(r) && !used.has(k(x)) && !built.recipes.some((b) => k(b) === k(x)));
      if (samePage.length === 1) {
        c = samePage[0];
        titleDiffs.push(`p.${r.page}: built "${r.title}", there "${c.title}"`);
      } else {
        notInCurrent.push(`${r.title} p.${r.page}`);
        continue;
      }
    }
    used.add(k(c));
    matched++;
    const extra = r.keywords.filter((x) => !(c.keywords || []).includes(x));
    if (extra.length) extraKeywords.push(`${r.title}: ${extra.join(", ")}`);
    const missing = (c.keywords || []).filter((x) => !r.keywords.includes(x));
    if (missing.length) missingKeywords.push(`${r.title}: ${missing.join(", ")}`);
  }
  const notBuilt = current.recipes.filter((x) => !used.has(k(x))).map((x) => `${x.title} p.${x.page}`);
  const list = (items) => items.map((x) => "\n    " + x).join("");
  console.log(`\ncompare with data/recipes.json (${current.recipes.length} recipes there):`);
  console.log(`  matched: ${matched}/${built.recipes.length} built recipes`);
  console.log(`  same page, different title (${titleDiffs.length}):${list(titleDiffs)}`);
  console.log(`  built but not there (${notInCurrent.length}):${list(notInCurrent)}`);
  console.log(`  there but not built (${notBuilt.length}):${list(notBuilt)}`);
  console.log(`  keywords built but not there (${extraKeywords.length}):${list(extraKeywords)}`);
  console.log(`  keywords there but not built (${missingKeywords.length}):${list(missingKeywords)}`);
}
