# Notes: My Big Fat Greek Cookbook

- Built from the index only (pp. 174–179, six photos). No TOC was photographed. The index prints each recipe under the same title everywhere, so a TOC wouldn't change titles; it would only add chapters.
- The first index page (p. 174) is `PXL_20261127_035156172.jpg`. Matt retook it to replace an earlier pasted screenshot, which was deleted.
- `groupBy` is the default (title): one recipe per title and page.
- Two index misprints, both confirmed by Matt against the book and fixed in `overrides.json`:
	- Stuffed Grape Leaves with Egg-Lemon Sauce (dolmadakia me avgolemono) is page 7. The index prints 4 under beef, grape leaves, pork, rice, and veal; page 4 is Pumpkin Fritters (kolokythokeftedes).
	- Roasted Cod with Onions and Potatoes (bakaliaros plaki) is page 110. The index prints 109, the same page as Octopus with Pasta (htapodi me kofto makaronaki).
- One printed typo: under "endives", Boiled Dandelion Greens (horta vrasta) is printed twice with no space between. Fixed with a `titles` override.
- Easy to misread: several flush-left entries sit right after an ingredient list and look like part of it. For example, White Bean Soup (fasolada) follows the walnuts list, and Stuffed Grape Leaves follows the soup list. The hand-built version got four of these wrong; the TSV levels fixed them.
- There's no "tomato sauce" heading. The tomato juice list is long and continues across a column break on p. 178.
