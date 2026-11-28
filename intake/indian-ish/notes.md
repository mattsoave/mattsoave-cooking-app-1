# Notes: Indian-ish

- By Priya Krishna with Ritu Krishna (from the cover photo). The cover prints the title as "Indian (-ish)"; the book's own page footers say "Indian-ish", which is used here. Subtitle: "Recipes and Antics from a Modern American Family". Foreword by Padma Lakshmi.
- 12 photos in one Drive zip: the three contents pages (`...024352639`, `...024357667`, `...024410773`), the cover (`...024419603`), and the index pp. 233–241 (`...024522700` to `...024709021`). The cover sorts after the contents pages.
- Two index photos were taken sideways (`...024522700`, p. 233, and `...024612372`, p. 236). They were rotated in place with `sips -r`, so the originals in `source-photos/indian-ish/` are now upright.
- There's no photo of p. 237. The index runs straight from "Lentils, guide to" (end of p. 236) to "Lijjat Punjabi Masala Papad" (top of p. 238), so p. 237 is probably a full-page photo and nothing is missing.
- Built from the TOC and the index: 74 recipes. The TOC lists 92 entries. The Essentials chapter (8 how-tos and guides) is excluded with `excludeChapters`, and 10 condiments from Mother Sauces are in `exclude` (see `intake/open-questions.md`).
- The index prints many entries inverted ("Basil › -Tofu Endive Leaves", "Bean(s) › White, –Stuffed Poblanos"). They're copied as printed; matching by page span sends them to the right recipe.
- Spelling differences between the TOC and the index: the TOC prints "Bhindi (Charred, Spiced Okra)", the index "Bhindi (Charred Spiced Okra)". The index form is used.
- Kachumber (Salads!) is one TOC entry, but the index lists five salads on pp. 106–109: Basic, Beet and Avocado, Avocado Corn and Tomato, Mung Bean and Potato, and Daikon Radish Kachumber. They're keywords on the one recipe, and its page is set to 106-109 in `overrides.json` (the most common index span was 106-108).
- "Tilapia › Kachumber, 189" is Kachumber Tilapia, not the salads. It's corrected with a scoped `titles` key ("Tilapia › Kachumber").
- Italic photo pages make some spans misleading. The dips share a photo on p. 56, so Chile, Garlic, and Bay Leaf Olives would read 56-67 and Spicy Olive Tapenade 51-56. Both are set in `overrides.json` as "56, 67" and "51, 56". Spicy Chickpea Dip (56-58) and the toasts that share the photo on p. 124 (Dahi Toast (Spiced Yogurt Sandwich) 124-127, Tomato-Cheese Masala Toast 124-126) keep the first–last span.
- The index's "guide to", "about", and "note about" entries, the product mentions (pp. 34–35), and the wine pairing guide are dropped; the review file lists them.
