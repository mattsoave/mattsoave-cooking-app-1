# AGENTS.md — Cookbook Recipe Finder

A static PWA (no build step, no framework, no backend) hosted on GitHub Pages.
It searches recipe titles across Matt's cookbooks and shows the cookbook and
page number. The data is built from photos of each cookbook's index and table
of contents: an agent transcribes the photos into plain rows, and a script
turns the rows into `data/recipes.json`. See
`~/.kiro/steering/mattsoav-personal-pwa.md` for the general personal-PWA
conventions; this file covers what's specific to this app.

## Data model

- `data/recipes.json` holds the recipes and **is committed** (unlike Matt's
  other PWAs that keep data in localStorage). It comes from processing photos,
  not from the phone, so committing it means it loads on any device with no
  import step. The repo is public; titles and page numbers are factual index
  data.
- Shape: `{ schemaVersion, cookbooks: [ { id, title, author?, source, recipes: [ { title, page, chapter?, keywords } ] } ] }`.
  - `source`: `"index"` (built from an index, with or without a TOC) or `"toc"`.
  - `page`: a number (`42`) or a string (`"112-114"`, `"124, 131-132"`).
  - `chapter`: from the TOC when the book has one. The app shows it after the
    book name.
  - `keywords`: the headings the index listed the recipe under (ingredients,
    categories, substitute pasta shapes). Searched only when the "Also search
    ingredients & categories" toggle is on.
- **Don't edit a book's entry in `recipes.json` by hand.** Change its intake
  files and rebuild (below).

## Intake files

One folder per book, `intake/<book-id>/`:

- `book.json`: `{ id, title, author?, source, groupBy? }`.
- `index.tsv`: one row per printed index line, in order. Columns `photo`,
  `level`, `text`, `pages`.
- `toc.tsv` (optional): one row per TOC entry. Columns `photo`, `chapter`,
  `title`, `page` (the start page).
- `chapters.tsv` (optional, only without `toc.tsv`): for a contents page that
  lists chapters but not recipes. Columns `photo`, `chapter`, `page`; each
  recipe gets the last chapter starting at or before its first page.
- `overrides.json`: decisions made during review (see below).
- `notes.md`: book-specific context that isn't obvious from the other files.
- `review.md`: written by the build script. Don't edit it.

Photos live in `source-photos/<book-id>/` and are gitignored (big binaries in a
public repo). They aren't backed up anywhere else.

Matt often delivers photos as a Google Drive zip
(`drive-download-*.zip`) dropped into the book's folder. Unzip it into that same
folder without overwriting (`unzip -n`), check that every file in the zip is
there, then delete the zip. Drive zips list files out of order; the filenames
still sort into page order.

`intake/open-questions.md` holds questions for Matt that don't block the work,
each with what was done in the meantime and what to change once answered. Add
new questions there instead of asking in chat; he answers them in bulk.

## Transcribing photos

- **Photo order:** Matt takes photos in page order, so filenames sort into page
  sequence within each part of the book. Order the rows of each TSV by
  filename. The TOC and the index are separate files, so it doesn't matter
  whether the TOC photos sort before or after the index photos. Check one
  photo's content (e.g. a chapter number) if the order looks off.
- **Large photos:** newer photos are full resolution (2–5 MB). Read a copy
  downsized to 1568px (`sips -Z 1568 <in> --out <scratch>/<name>`), not the
  original.
- **Index rows, exactly as printed:**
  - `level` is the indent: 0 flush left, 1 indented once, 2 twice. A row with
    no pages is a heading; a row with pages is an entry.
  - `text` without the comma that separates it from the page numbers. Join
    wrapped lines into one row.
  - `pages` as printed, with en dashes and short ranges (`102–4`). Italic photo
    pages aren't marked.
  - **Columns flow top to bottom, left column into the top of the right, then
    on to the next photo.** A sub-entry list can continue across a column or
    photo break; keep its level and don't invent a heading. The script carries
    the last heading over and lists each carry-over between photos in
    `review.md`.
  - Copy printed typos as they are and fix them in `overrides.json`, so the fix
    is visible.
- **TOC rows:** titles in normal capitalization (TOCs are often all caps),
  using the index's spelling and casing where it prints the same title. Drop a
  parenthetical that only repeats the title ("BRIAMI (briami)" is "Briami").
  `chapter` is the chapter name from the main contents page.
- Matt photographs both the TOC and the index for every book. The agent decides
  whether the TOC is useful: skip it if it lists only chapters.

## Building a book

```
node scripts/build-book.js <book-id>            # build, print a summary, write review.md
node scripts/build-book.js <book-id> --compare  # also compare with data/recipes.json
node scripts/build-book.js <book-id> --write    # replace the book in data/recipes.json
```

How the script decides what's a recipe:

- **With `toc.tsv`:** the TOC is the list of recipes and the source of titles,
  chapters, and start pages. An index entry printed with a TOC title (or the
  title minus its parenthetical) goes to that recipe; if its page span doesn't
  include the TOC page, it's flagged as a likely index misprint and the TOC page
  wins. Other entries are grouped by page span, and each group goes to the TOC
  recipe whose start page is inside the span; when two TOC recipes fall inside
  one span, each entry goes to the title it shares the most words with.
  Index entries that match no TOC recipe (notes, gear, people, components) are
  dropped and listed in `review.md`. A TOC recipe with no index match keeps its
  TOC page and gets flagged.
- **Without a TOC, `groupBy: "title"` (default):** one recipe per
  (title + page). For indexes that print each recipe under the same name
  everywhere (the Greek book).
- **Without a TOC, `groupBy: "page"`:** one recipe per page span, with the
  title picked from the entries that share it. For indexes that print recipes
  under many names. Non-recipes are guessed (headings with their own page,
  "notes on", "origins of", "Surname, First"), and entries like "Blender, 17"
  need `exclude`. Spans given the same title are merged into one recipe
  covering all of them ("14" and "14-15" become 14-15). For an index in
  lowercase index phrasing (Tapas), set every title in `pageTitles` and say in
  the book's notes that the titles are reconstructed.

Pages are collapsed to first–last (`68, 69–70` becomes `68-70`), per Matt.
Sub-headings keep their parent as a keyword ("vinegar › white" gives "white
vinegar" as well as "vinegar").

`overrides.json` keys:

- `titles`: `{ "printed text": "corrected text" }`, applied to index rows first.
- `pages`: `{ "title": "page" }`, a corrected or display page.
- `pageTitles`: `{ "span": "title" or ["title", ...] }`, for `groupBy: "page"`.
- `exclude`: titles or index text that aren't recipes.
- `excludeChapters`: TOC chapters to leave out entirely.
- `keep`: undo an automatic non-recipe guess.
- `reviewed`: flag keys from `review.md` that have been checked.

## Adding a cookbook

1. Matt adds photos to `source-photos/<book-id>/`.
2. Create `intake/<book-id>/book.json` and transcribe the photos into
   `index.tsv` (and `toc.tsv`).
3. Run the build script and read `review.md`. Resolve each flag in
   `overrides.json`, or add it to `open-questions.md` if Matt has to decide.
   Rerun until there are no errors.
4. Run with `--write`, then `node test/search.test.js`.
5. Bump the version when shipping (see below). Commit and push only when Matt
   asks.

When naming a recipe to Matt (in chat, flags, or open questions), use its full
title as stored, e.g. "Ciceri e Tria (Fried and Boiled Noodles with
Chickpeas)", not a shortened form. Shortened titles make one recipe read like
two.

## Search

- All matching lives in `search.js` (`flattenRecipes`, `searchRecipes`) — the
  single seam, no DOM. Case/accent-insensitive, multi-word AND, substring match.
  `searchRecipes(index, query, { includeKeywords })`:
  - default (toggle off): matches **title only**.
  - `includeKeywords: true`: also matches a recipe's `keywords`, so "tomato"
    surfaces recipes that list tomato even when the title doesn't. Title
    matches rank above keyword-only matches.
- The toggle ("Also search ingredients & categories") is a checkbox in the
  header; `app.js` persists it in `localStorage` (`cooking.includeKeywords`,
  default off) and shows a "matches: …" hint on keyword-only hits.
- `flattenRecipes` also dedupes by (title + page) within a book, as a backstop.
- `app.js` is the shell: load, render, highlight, service worker.

## Version rule

- `VERSION` in `app.js` and `CACHE` in `sw.js` change together, once per release,
  in the commit that ships the change. Don't bump while iterating.
- Add any new file the page needs to `SHELL` in `sw.js`. The intake files and
  the script aren't needed by the page.

## Tests

- `node test/search.test.js` runs the search-logic tests (pure Node, no deps).
- After changing `scripts/build-book.js`, run every book with `--compare` and
  check that nothing changed unexpectedly.

## Local preview

- `python3 -m http.server 8000 --bind 127.0.0.1` then open
  `http://127.0.0.1:8000/`. A phone can only install from the https Pages URL.

## Hosting

- GitHub Pages, public repo `mattsoave/mattsoave-cooking-app-1`, branch `main`,
  folder `/ (root)`. Site: https://mattsoave.github.io/mattsoave-cooking-app-1/
- The branch is `main`, not `mainline` (personal repo).
- Push only when Matt asks, naming the branch: `git push origin main`.
