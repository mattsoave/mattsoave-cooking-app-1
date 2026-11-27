# Open questions

Questions for Matt that don't block the work. Agents add new ones here instead of asking in chat, each with what was done in the meantime and what to change once it's answered. Answer inline (or reply with the number, like "2: yes") and the agent will apply it and move the item to Answered.

## Open

### App

1. **Show the chapter in search results?** Books built from a table of contents now store each recipe's chapter (only Anything's Pastable so far). The app was already written to show a chapter after the book name, so a result reads "Anything's Pastable · Stews, Rouxes, and Ragùs: Thick and Hearty, Warm and Toasty · p. 175-179". Some chapter names are long and will wrap on a phone.
	- In the meantime: shown, since that's what the app already does. Not checked on a phone or in a screenshot yet.
	- If no: remove the `chapter` part of the result line in `app.js` (`render()`); keep the data, which is still useful for grouping later. Bump the version in `app.js` and `sw.js`.
	- If shortened: options are chapter number only ("Ch. 5"), or the part before the colon ("Stews, Rouxes, and Ragùs"). Either needs a small change in `app.js`, plus storing the chapter number if we go with "Ch. 5".

### Tapas

2. **Can you photograph the four part-opener pages (pp. 8, 32, 60, 72), if they list recipes?** The contents page only lists the parts, and the index is all lowercase, so all 42 titles are my reconstructions from index wording (e.g. "Chicken in Lemon & Garlic" from "chicken › in lemon & garlic"). Search still finds them, since the words are the same, but the titles may not match the book's.
	- In the meantime: reconstructed titles in `intake/tapas/overrides.json` (`pageTitles`).
	- If you send them: add a `toc.tsv` from those pages; it replaces `pageTitles` (delete it) and gives exact chapters, so `chapters.tsv` can go too. Then rebuild with `--write`.
	- If there's no recipe list anywhere, the parts I'm least sure of:
		- **pp. 78–79:** salmon, sardines, and trout are each "marinated in sherry vinegar". I made one recipe, "Salmon, Sardines, or Trout Marinated in Sherry Vinegar". It could be three short recipes.
		- **pp. 38 and 38–39:** "Sautéed Garlic Mushrooms" and "Sautéed Garlic Zucchini" as two recipes.
		- **p. 77:** "Salmon in Mojo Sauce", with the Canary Island green and red sauces treated as the mojo sauces, not separate recipes.
3. **Shorter book name in results?** Every Tapas result shows "Tapas: A Classic Collection of Spanish-Style Recipes", which will wrap on a phone, especially with a chapter after it (see question 1).
	- In the meantime: the full title.
	- If shorter: change `title` in `intake/tapas/book.json` to "Tapas" and rebuild with `--write`. (Or add a separate short display name to the data model, if you want the full title kept somewhere.)

### Japanese Soul Cooking

4. **Which TOC entries count as recipes?** Following "skip component recipes", I excluded 20 of the 114 TOC entries:
	- **Sauces:** Soy Sauce Marinade, Miso Dipping Sauce, Homemade Rayu, Homemade Tonkatsu Sauce, Miso Tonkatsu Dipping Sauce, Japanese-Style Tartar Sauce, Ponzu, Tempura Dipping Sauce (Ten Tsuyu), Kaeshi, Udon Tsuyu, White Sauce
	- **Stocks:** Torigara Stock, Dashi
	- **Coatings:** Homemade Panko Bread Crumbs, Tempura Batter
	- **Section intros:** Furai, Korokke, Itame, Chahan, Wafu Pasta
	- In the meantime: those are in `exclude` in `intake/japanese-soul-cooking/overrides.json`.
	- **Kept, though they're borderline:**
		- Ramen Soup and Chashu (the ramen base, but chashu is a dish of its own)
		- Soy Sauce Eggs (a topping you'd also eat alone)
		- Tomato Salada and Lettuce with Ginger-Carrot Dressing (side salads)
		- the three "Variations" pages
	- If you want any of them changed: add a title to `exclude`, or remove one from it, then rebuild with `--write`.

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
