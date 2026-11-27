# Source: raw cookbook tables of contents

This folder is the **re-parseable safety net**. For each cookbook there's a
plain-text file holding its table of contents and/or index exactly as it was
read from the photos, including groupings and page numbers. `data/recipes.json`
is generated from these.

Why text and not the photos: the point of keeping a source is to re-derive the
data later (for example, to group by chapter, split sub-recipes, or fix a typo)
and text is exactly what that needs. Photos are large binaries that bloat a
public git repo, so the photos stay out of git (see `.gitignore`, `source-photos/`).

## TOC format

One file per cookbook, named `<cookbook-id>.md`, matching the `id` in
`data/recipes.json`. Keep chapters as `##` headings and recipes as `page — title`
lines so a chapter is never lost:

```
# The Food Lab
author: J. Kenji López-Alt
source: toc

## Eggs
45 — Perfect Scrambled Eggs
52 — Soft-Boiled Eggs

## Poultry
412 — Chicken Parmesan
```

## Index format

An index is alphabetical by keyword/ingredient, with recipes nested under those
keywords. Transcribe it so the nesting is preserved — a keyword heading, then the
recipes listed under it:

```
# My Big Fat Greek Cookbook
source: index

## appetizers
3 — Meatballs (keftedes)
4 — Pumpkin Fritters (kolokythokeftedes)
7 — Stuffed Grape Leaves with Egg-Lemon Sauce (dolmadakia me avgolemono)

## beef
13 — Egg-Lemon Meatball Soup (giouvarlakia me avgolemono)
99 — Kebab
3 — Meatballs (keftedes)
```

Index gotchas (see AGENTS.md for the full list):
- **Columns flow** top-to-bottom, left into the top of the right; carry the
  current heading across the column break.
- **Headings are usually ingredients/categories, not recipes.**
- **The same recipe recurs under many keywords** — that's expected; it's deduped
  to one record per (title + page) with the keywords merged when building
  `data/recipes.json`.

When you send new photos, the flow is:
1. Transcribe them into a file here (TOC and/or index).
2. Regenerate the matching cookbook entry in `data/recipes.json`.
