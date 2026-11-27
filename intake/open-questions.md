# Open questions

Questions for Matt that don't block the work. Agents add new ones here instead of asking in chat, each with what was done in the meantime and what to change once it's answered. Answer inline (or reply with the number, like "2: yes") and the agent will apply it and move the item to Answered.

## Open

### App

1. **Show the chapter in search results?** Books built from a table of contents now store each recipe's chapter (only Anything's Pastable so far). The app was already written to show a chapter after the book name, so a result reads "Anything's Pastable · Stews, Rouxes, and Ragùs: Thick and Hearty, Warm and Toasty · p. 175-179". Some chapter names are long and will wrap on a phone.
	- In the meantime: shown, since that's what the app already does. Not checked on a phone or in a screenshot yet.
	- If no: remove the `chapter` part of the result line in `app.js` (`render()`); keep the data, which is still useful for grouping later. Bump the version in `app.js` and `sw.js`.
	- If shortened: options are chapter number only ("Ch. 5"), or the part before the colon ("Stews, Rouxes, and Ragùs"). Either needs a small change in `app.js`, plus storing the chapter number if we go with "Ch. 5".

## Answered

- Anything's Pastable, real title on pp. 80–82: the TOC prints "Scallion Oil Bucatini with Runny Eggs". My guess ("Bucatini with Scallion Oil and Runny Eggs") was wrong; the TOC title is now used.
- Anything's Pastable, real title on pp. 188–189: the TOC prints "Garlic-and-Herb Cheese and Potatoes with Pasta Mista". My guess ("Pasta Mista with Garlic-and-Herb Cheese and Potatoes") was wrong; the TOC title is now used.
- Anything's Pastable recipe count: the cover says 81; the app has 65. The TOC lists 75 entries, and chapter 1's 10 are excluded as components (8 real component recipes: the pesto formula and seven pangrattatos, plus 2 non-recipes). The remaining gap is probably sub-recipes with no TOC line, such as Yogurt-Garlic Sauce (p.186) and the pesto variations (p.22). Matt is fine with 65.
- Anything's Pastable author: Dan Pashman is correct (confirmed by Matt). No change needed in `intake/anythings-pastable/book.json`.
- Delete the old markdown sources: yes, once the TSV branch was merged. Done in the merge commit, along with rewriting AGENTS.md for the TSV process.
- Guessed keywords for TOC-only books: skip for now; may come back to it later. If revisited, it touches the TOC capture format (`toc.tsv` now exists), `scripts/build-book.js`, `search.js` (same toggle as index keywords or its own?), the "likely: …" label in `app.js`, tests, and AGENTS.md. Guesses should disappear if that book's index photos arrive later.
- Smarter search matching: not needed. "bean" already matches "beans" because matching is by substring; "beans" not matching "bean" is fine. Checked 2026-11-27: "bean" finds 5 titles, "beans" finds 4 (all but White Bean Soup (fasolada)).
- Greek: Stuffed Grape Leaves with Egg-Lemon Sauce (dolmadakia me avgolemono) is page 7 (the index's page 4 is a misprint). Recorded in `intake/my-big-fat-greek-cookbook/overrides.json`.
- Greek: Roasted Cod with Onions and Potatoes (bakaliaros plaki) is page 110 (the index says 109). Same file.
- Pastable: skip component recipes; collapse page lists to first–last except Kimchi alla Gricia ("124, 131-132"); merge dual-named recipes keeping both names; keep all three Pasta Pizzas. With the TOC, "skip components" is now `excludeChapters` for chapter 1 (the pestos, the seven pangrattatos, and the jarred tomato sauce decision tree), and dual names come from the TOC in its order, e.g. "Ciceri e Tria (Fried and Boiled Noodles with Chickpeas)". Recorded in `intake/anythings-pastable/overrides.json`.
