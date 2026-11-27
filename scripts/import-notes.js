#!/usr/bin/env node
// Merge notes exported from the app into data/additions.json.
//
//   node scripts/import-notes.js <export.json> [more.json ...]   # dry run, prints what would change
//   node scripts/import-notes.js <export.json> ... --write         # write data/additions.json
//   node scripts/import-notes.js --check                           # list additions whose recipe is gone
//
// Files are applied oldest export first. Each export's id is recorded in
// importedExports; once that ships, the app clears those entries from the
// phone. See notes.js for the full lifecycle.
"use strict";
const fs = require("fs");
const path = require("path");
const N = require("../notes.js");

const root = path.join(__dirname, "..");
const additionsPath = path.join(root, "data", "additions.json");
const recipesPath = path.join(root, "data", "recipes.json");

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }

function recipeKeys() {
  const data = readJson(recipesPath);
  const keys = new Map();
  for (const cb of data.cookbooks || []) {
    for (const r of cb.recipes || []) keys.set(N.recipeKey(cb.id, r.title), r);
  }
  return keys;
}

// Stable, diff-friendly output: recipes sorted by key, one field per line.
function writeAdditions(additions) {
  const sorted = {};
  for (const k of Object.keys(additions.recipes).sort()) sorted[k] = additions.recipes[k];
  const out = { schemaVersion: additions.schemaVersion || 1, importedExports: additions.importedExports, recipes: sorted };
  fs.writeFileSync(additionsPath, JSON.stringify(out, null, 2) + "\n");
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const check = args.includes("--check");
  const files = args.filter((a) => !a.startsWith("--"));
  const additions = fs.existsSync(additionsPath) ? readJson(additionsPath) : N.emptyAdditions();
  additions.importedExports = additions.importedExports || [];
  additions.recipes = additions.recipes || {};
  const known = recipeKeys();

  if (check || !files.length) {
    const orphans = Object.keys(additions.recipes).filter((k) => !known.has(k));
    console.log(`${Object.keys(additions.recipes).length} recipes with additions, ${additions.importedExports.length} exports imported.`);
    if (orphans.length) {
      console.log(`\nNot in recipes.json (retitled or removed? rename the key, or delete it):`);
      for (const k of orphans) console.log("  - " + k);
      process.exitCode = 1;
    } else {
      console.log("Every addition matches a recipe.");
    }
    if (!files.length) return;
  }

  const exports = files.map((f) => ({ f, file: readJson(f) }))
    .sort((a, b) => String(a.file.exportedAt).localeCompare(String(b.file.exportedAt)));

  for (const { f, file } of exports) {
    const r = N.applyImport(additions, file);
    console.log(`\n${path.basename(f)} (export ${r.exportId}, ${(file.entries || []).length} entries)`);
    if (r.alreadyImported) { console.log("  already imported, skipped"); continue; }
    for (const k of r.added) console.log("  + " + k);
    for (const k of r.updated) console.log("  ~ " + k);
    for (const k of r.removed) console.log("  - " + k + " (cleared)");
    for (const k of r.skippedOlder) console.log("  ! " + k + " skipped: data/additions.json already has a newer edit");
    for (const e of file.entries || []) {
      const k = e.key || N.recipeKey(e.cookbookId, e.title);
      if (!known.has(k)) console.log("  ? " + k + " isn't in recipes.json; check the title");
    }
  }

  if (write) {
    writeAdditions(additions);
    console.log(`\nWrote ${path.relative(root, additionsPath)}. Bump the version and ship it; the app then clears these from the phone.`);
  } else {
    console.log("\nDry run. Add --write to save.");
  }
}

main();
