// Pure Node tests for notes.js (no dependencies). Run: node test/notes.test.js
const assert = require("assert");
const N = require("../notes.js");
const { flattenRecipes, searchRecipes } = require("../search.js");

let pass = 0;
function t(name, fn) { fn(); pass++; console.log("ok -", name); }

const moussaka = { cookbookId: "greek", title: "Moussaka", page: "95-96" };
const key = N.recipeKey("greek", "Moussaka");
const at = (s) => new Date("2026-11-27T" + s + ":00Z");

t("cleanList trims, drops blanks, dedupes case-insensitively", () => {
  assert.deepStrictEqual(N.cleanList([" Ground beef ", "", "ground BEEF", "lamb"]), ["Ground beef", "lamb"]);
});

t("an edit creates a pending local entry", () => {
  const s = N.emptyStore(), a = N.emptyAdditions();
  N.setEntry(s, a, moussaka, { notes: "Good", ingredients: ["ground beef"], keywords: [] }, at("10:00"));
  const e = N.effective(s, a, key);
  assert.strictEqual(e.status, "pending");
  assert.deepStrictEqual(e.ingredients, ["ground beef"]);
  assert.deepStrictEqual(N.counts(s), { pending: 1, waiting: 0 });
});

t("clearing a never-exported entry removes it", () => {
  const s = N.emptyStore(), a = N.emptyAdditions();
  N.setEntry(s, a, moussaka, { notes: "x" });
  N.setEntry(s, a, moussaka, { notes: "" });
  assert.strictEqual(Object.keys(s.entries).length, 0);
});

t("export includes only entries not exported yet, and marks them waiting", () => {
  const s = N.emptyStore(), a = N.emptyAdditions();
  N.setEntry(s, a, moussaka, { notes: "Good" });
  const b1 = N.buildExport(s, { exportId: "e1", now: at("11:00") });
  assert.strictEqual(b1.file.entries.length, 1);
  N.markExported(s, b1.keys, "e1");
  assert.strictEqual(N.effective(s, a, key).status, "waiting");
  assert.strictEqual(N.buildExport(s), null, "nothing left to export");
  const again = N.buildExport(s, { includeWaiting: true, exportId: "e2" });
  assert.strictEqual(again.file.entries.length, 1, "export-again includes waiting ones");
});

t("editing after export makes the entry pending again", () => {
  const s = N.emptyStore(), a = N.emptyAdditions();
  N.setEntry(s, a, moussaka, { notes: "Good" });
  N.markExported(s, [key], "e1");
  N.setEntry(s, a, moussaka, { notes: "Good, use less salt" });
  assert.strictEqual(N.effective(s, a, key).status, "pending");
});

t("full round trip: export, import, ship, reconcile clears the phone", () => {
  const s = N.emptyStore(), a = N.emptyAdditions();
  N.setEntry(s, a, moussaka, { notes: "Good", ingredients: ["ground beef"] }, at("10:00"));
  const b = N.buildExport(s, { exportId: "e1", now: at("11:00") });
  N.markExported(s, b.keys, "e1");

  const report = N.applyImport(a, b.file);
  assert.deepStrictEqual(report.added, [key]);
  assert.deepStrictEqual(a.importedExports, ["e1"]);
  assert.strictEqual(a.recipes[key].notes, "Good");

  assert.strictEqual(N.reconcile(s, a), 1);
  assert.strictEqual(Object.keys(s.entries).length, 0);
  const e = N.effective(s, a, key);
  assert.strictEqual(e.status, "saved");
  assert.deepStrictEqual(e.ingredients, ["ground beef"]);
});

t("reconcile keeps an entry edited after its export was taken", () => {
  const s = N.emptyStore(), a = N.emptyAdditions();
  N.setEntry(s, a, moussaka, { notes: "v1" }, at("10:00"));
  const b = N.buildExport(s, { exportId: "e1" });
  N.markExported(s, b.keys, "e1");
  N.setEntry(s, a, moussaka, { notes: "v2" }, at("12:00"));
  N.applyImport(a, b.file);
  assert.strictEqual(N.reconcile(s, a), 0);
  assert.strictEqual(N.effective(s, a, key).notes, "v2");
});

t("importing the same export twice does nothing the second time", () => {
  const s = N.emptyStore(), a = N.emptyAdditions();
  N.setEntry(s, a, moussaka, { notes: "Good" });
  const b = N.buildExport(s, { exportId: "e1" });
  N.applyImport(a, b.file);
  assert.strictEqual(N.applyImport(a, b.file).alreadyImported, true);
  assert.deepStrictEqual(a.importedExports, ["e1"]);
});

t("an older export imported late doesn't overwrite a newer edit", () => {
  const a = N.emptyAdditions();
  const newer = { kind: "cooking-app-notes-export", exportId: "e2", exportedAt: "2026-11-28T00:00:00Z",
    entries: [{ key, cookbookId: "greek", title: "Moussaka", notes: "new", updatedAt: "2026-11-28T00:00:00Z" }] };
  const older = { kind: "cooking-app-notes-export", exportId: "e1", exportedAt: "2026-11-27T00:00:00Z",
    entries: [{ key, cookbookId: "greek", title: "Moussaka", notes: "old", updatedAt: "2026-11-27T00:00:00Z" }] };
  N.applyImport(a, newer);
  const r = N.applyImport(a, older);
  assert.deepStrictEqual(r.skippedOlder, [key]);
  assert.strictEqual(a.recipes[key].notes, "new");
  assert.deepStrictEqual(a.importedExports, ["e2", "e1"]);
});

t("clearing a permanent recipe's additions exports an empty entry that removes them", () => {
  const s = N.emptyStore(), a = N.emptyAdditions();
  a.recipes[key] = { cookbookId: "greek", title: "Moussaka", notes: "old", ingredients: [], keywords: [], updatedAt: "2026-11-01T00:00:00Z" };
  N.setEntry(s, a, moussaka, { notes: "" }, at("10:00"));
  assert.strictEqual(N.effective(s, a, key).status, "pending");
  const b = N.buildExport(s, { exportId: "e1" });
  const r = N.applyImport(a, b.file);
  assert.deepStrictEqual(r.removed, [key]);
  assert.strictEqual(a.recipes[key], undefined);
});

t("search with the toggle on also matches my ingredients and keywords", () => {
  const index = flattenRecipes({ cookbooks: [{ id: "greek", title: "Greek", recipes: [{ title: "Moussaka", page: 95 }] }] });
  index[0].mine = { notes: "", ingredients: ["ground beef"], keywords: ["weeknight"] };
  assert.strictEqual(searchRecipes(index, "beef").length, 0, "title-only by default");
  assert.strictEqual(searchRecipes(index, "beef", { includeKeywords: true }).length, 1);
  assert.strictEqual(searchRecipes(index, "weeknight", { includeKeywords: true }).length, 1);
});

console.log(`\n${pass} passed`);
