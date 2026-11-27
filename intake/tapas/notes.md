# Notes: Tapas: A Classic Collection of Spanish-Style Recipes

- Two photos: the contents page (`PXL_20261127_202919498.jpg`) and the one-page index on p. 96 (`PXL_20261127_202939566.jpg`). They arrived as a Drive zip dropped straight into `source-photos/`; the agent made the `tapas` folder.
- The contents page lists only the four parts (Meat & Poultry p. 8, Vegetables p. 32, Cheese & Eggs p. 60, Fish & Seafood p. 72), so there's no `toc.tsv`. The parts are in `chapters.tsv`, and each recipe gets the part its first page falls in.
- `groupBy` is page. The index is all lowercase and in index phrasing ("chicken › in lemon & garlic", "livers, chicken, in sherry sauce"), so every title is set by hand in `pageTitles`, reconstructed from the entries that share a page. **These are not the book's printed titles.** See `intake/open-questions.md`.
- Groups at overlapping spans that got the same title were merged into one span: Chorizo in Red Wine (14 and 14–15), Stuffed Cherry Tomatoes (40 and 40–41), Stuffed Pimientos (44, 44–45, and 45), Cheese Puffs with Fiery Tomato Salsa (62 and 62–63).
- Treated as parts of a recipe rather than recipes of their own:
	- the six fillings on pp. 40–45 (they go with Stuffed Cherry Tomatoes and Stuffed Pimientos)
	- aïoli on p. 53 (Potatoes with Aïoli)
	- the fiery tomato salsa on p. 62 (Cheese Puffs)
	- the Canary Island green and red sauces on p. 77 (Salmon in Mojo Sauce)
	- the bread dough on pp. 54–55 (Spinach & Tomato Pizzas)
	- the pine nut sauce on p. 56 (Zucchini Fritters with a Dipping Sauce)
- Squid (90–91) is the same recipe as Calamares and is a keyword on it.
