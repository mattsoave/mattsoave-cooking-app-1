// Pure Node tests for search.js (no dependencies). Run: node test/search.test.js
const assert = require("assert");
const { flattenRecipes, searchRecipes } = require("../search.js");

const data = {
  cookbooks: [
    {
      id: "a", title: "Book A", author: "Aa", source: "toc",
      recipes: [
        { title: "Chicken Parmesan", page: 10, chapter: "Poultry" },
        { title: "Crème Brûlée", page: 20 }
      ]
    },
    {
      id: "b", title: "Book B", author: "Bb", source: "index",
      recipes: [
        // An index lists the same recipe under several categories, with a range page.
        { title: "Grilled Chicken Salad", page: "5-6", keywords: ["chicken"] },
        { title: "Grilled Chicken Salad", page: "5-6", keywords: ["salads", "chicken"] },
        // Same title as Book A, different book + page: must stay separate.
        { title: "Chicken Parmesan", page: 88, keywords: ["chicken", "pasta"] }
      ]
    }
  ]
};

let pass = 0;
function t(name, fn) { fn(); pass++; console.log("ok -", name); }

const index = flattenRecipes(data);

t("flattens recipes with cookbook + page + source, deduping per cookbook", () => {
  // 2 (Book A) + Grilled Chicken Salad (deduped to 1) + Chicken Parmesan@88 = 4
  assert.strictEqual(index.length, 4);
  const cp = index.find((r) => r.title === "Chicken Parmesan" && r.cookbook === "Book A");
  assert.strictEqual(cp.page, 10);
  assert.strictEqual(cp.chapter, "Poultry");
  assert.strictEqual(cp.source, "toc");
});

t("same title in different cookbooks stays separate", () => {
  const both = index.filter((r) => r.title === "Chicken Parmesan");
  assert.strictEqual(both.length, 2);
  assert.deepStrictEqual(both.map((r) => r.cookbook).sort(), ["Book A", "Book B"]);
});

t("duplicate index entries collapse and merge keywords", () => {
  const salads = index.filter((r) => r.title === "Grilled Chicken Salad");
  assert.strictEqual(salads.length, 1);
  assert.strictEqual(salads[0].page, "5-6"); // range string preserved
  assert.deepStrictEqual(salads[0].keywords.sort(), ["chicken", "salads"]);
  assert.strictEqual(salads[0].source, "index");
});

t("empty query returns nothing", () => {
  assert.strictEqual(searchRecipes(index, "").length, 0);
  assert.strictEqual(searchRecipes(index, "   ").length, 0);
});

t("single-word substring match across cookbooks", () => {
  // Chicken Parmesan (A), Chicken Parmesan (B), Grilled Chicken Salad (B)
  const r = searchRecipes(index, "chicken");
  assert.strictEqual(r.length, 3);
});

t("multi-word is AND", () => {
  const r = searchRecipes(index, "grilled chicken");
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].title, "Grilled Chicken Salad");
});

t("accent-insensitive", () => {
  const r = searchRecipes(index, "creme brulee");
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].title, "Crème Brûlée");
});

t("prefix match sorts first", () => {
  const r = searchRecipes(index, "chicken");
  assert.strictEqual(r[0].title, "Chicken Parmesan"); // starts with query
});

console.log(`\n${pass} tests passed`);
