# AGENTS.md — Cookbook Recipe Finder

A static PWA (no build step, no framework, no backend) hosted on GitHub Pages.
It searches recipe titles across Matt's cookbooks and shows the cookbook and
page number. Data is built by an agent from photos of each cookbook's table of
contents. See `~/.kiro/steering/mattsoav-personal-pwa.md` for the general
personal-PWA conventions; this file covers what's specific to this app.

## Data model

- `data/recipes.json` holds the index and **is committed** (unlike Matt's other
  PWAs that keep data in localStorage). The data comes from the agent processing
  photos, not from the phone, so committing it means it just loads on any device
  with no import step. The repo is public; cookbook listings (titles + page
  numbers) are factual index data.
- Shape: `{ schemaVersion, cookbooks: [ { id, title, author, source, recipes: [ { title, page, chapter?, keywords? } ] } ] }`.
  - `source`: `"toc"` or `"index"` — where the data was read from.
  - `page`: a number (`42`) or a range string (`"112-114"`).
  - `chapter`: optional; captured now so grouping/filtering by chapter later
    needs no re-reading of photos — just a new filter.
  - `keywords`: optional; the categories/ingredients an **index** listed the
    recipe under (e.g. a soup appearing under "carrots" and "celery"). Stored now
    but NOT searched yet; ingredient search is a one-line change in `search.js`.
- `source/<id>.md` holds the raw transcription per cookbook (the re-parseable
  safety net). Photos stay out of git (`.gitignore`: `source-photos/`, `*.jpg`…).

## TOC vs index pages

A cookbook has a TOC, an index, or both. They're different shapes:

- A **TOC** is roughly one line per recipe → clean "recipe → start page". Prefer
  it when a book has both.
- An **index** is alphabetical by keyword/ingredient. Transcribing one correctly:
  - **Columns flow top-to-bottom, left column into the top of the right.** A
    sub-entry list can break across the column boundary, so carry the current
    heading and indent level across the break (e.g. the "beef" sub-entries can
    continue at the top of column 2 before top-level entries resume).
  - **Most headings are ingredients/categories, not recipes.** The recipes are
    the titled lines with page numbers. But some flush-left entries genuinely
    are recipes — judge by whether there's a page number and a dish name.
  - **The same recipe appears under many keywords.** Store it once per
    (title + page) and merge the keywords. `flattenRecipes` also dedupes
    defensively at load, so authoring dupes won't show twice.
  - Index page numbers point to where a dish is mentioned, which is occasionally
    a reference rather than the recipe start — a known, accepted bit of noise.

## Adding a cookbook (the main workflow)

1. Matt sends photos of a cookbook's TOC and/or index pages.
2. Transcribe them into `source/<id>.md` (chapters/keyword headings as `##`,
   recipes as `page — title` lines, keeping nesting). Keep chapters/keywords
   even though search ignores them for now.
3. Add/replace that cookbook's entry in `data/recipes.json`, deduped per
   (title + page) with `source` set and keywords merged.
4. Bump version (see below) when shipping, commit when asked, Matt pushes.

## Search

- All matching lives in `search.js` (`flattenRecipes`, `searchRecipes`) — the
  single seam, no DOM. Currently: case/accent-insensitive, multi-word AND,
  substring match on **title only**. Swap for fuzzy search or add
  chapter/cookbook filters here and nowhere else.
- `app.js` is the shell: load, render, highlight, service worker.

## Version rule

- `VERSION` in `app.js` and `CACHE` in `sw.js` change together, once per release,
  in the commit that ships the change. Don't bump while iterating.
- Add any new file the page needs to `SHELL` in `sw.js`.

## Tests

- `node test/search.test.js` runs the search-logic tests (pure Node, no deps).

## Local preview

- `python3 -m http.server 8000 --bind 127.0.0.1` then open
  `http://127.0.0.1:8000/`. A phone can only install from the https Pages URL.

## Hosting

- GitHub Pages, public repo `mattsoave/mattsoave-cooking-app-1`, branch `main`,
  folder `/ (root)`. Site: https://mattsoave.github.io/mattsoave-cooking-app-1/
- Matt pushes himself (Kiro's setup blocks pushes).
