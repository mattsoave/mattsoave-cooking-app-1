# Notes: My Big Fat Greek Cookbook

- Built from the TOC (main contents page plus 12 chapter pages) and the index (pp. 174–179). Each recipe has its chapter.
- Photo order in `source-photos/my-big-fat-greek-cookbook/`: index p. 174 (`PXL_20261127_035156172.jpg`, which Matt retook to replace an earlier pasted screenshot), index pp. 175–179 (`...0409*`), main contents (`...195408119`), then the chapters from Appetizers to Coffee & Tea (`...195418666` to `...195630479`). The TOC photos arrived in a Google Drive zip.
- The TOC confirms both index misprints Matt had already checked against the book, and the script now flags them on its own:
	- Stuffed Grape Leaves with Egg-Lemon Sauce (dolmadakia me avgolemono) is page 7. The index prints 4 under beef, grape leaves, pork, rice, and veal; page 4 is Pumpkin Fritters (kolokythokeftedes).
	- Roasted Cod with Onions and Potatoes (bakaliaros plaki) is page 110. The index prints 109, the same page as Octopus with Pasta (htapodi me kofto makaronaki).
	- Both flags are marked reviewed in `overrides.json`.
- The TOC adds Greek names the index leaves out: Egg-Lemon Chicken Soup (kotosoupa avgolemono) and King Pie (vasilopita).
- Where the TOC repeats the English name in parentheses (Briami (briami), Tzatziki (tzatziki), Hilopites (hilopites), Giouvetsi (giouvetsi), Pastichio (pastichio), Moussaka (moussaka), Kebab (kebab), Diples (diples), Koulourakia (koulourakia), Melomakarona (melomakarona), Galaktoboureko (galaktoboureko), Bougatsa (bougatsa), Kourabiedes (kourabiedes)), `toc.tsv` drops the repeat and uses the index title.
- One printed typo: under "endives", Boiled Dandelion Greens (horta vrasta) is printed twice with no space between. Fixed with a `titles` override.
- Easy to misread: several flush-left entries sit right after an ingredient list and look like part of it. For example, White Bean Soup (fasolada) follows the walnuts list, and Stuffed Grape Leaves follows the soup list. The hand-built version got four of these wrong; the TSV levels fixed them.
- There's no "tomato sauce" heading. The tomato juice list is long and continues across a column break on p. 178.
