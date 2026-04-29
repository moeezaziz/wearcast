// Compress audit report into an actionable digest:
//   1. Categories with NO catalog entry (hard gaps)
//   2. Categories that exist but are color-locked (catalog only has one color)
//   3. Categories that exist but are material-locked
//   4. Categories whose match score is weak across all colors/materials
"use strict";
const fs = require("fs");
const path = require("path");
const r = require("./report.json");

// ---- 1. NO-MATCH categories ------------------------------------------------
// Bucket by (slot, item-type) — drop color/material noise.
const noMatchCats = new Map();
for (const b of r.buckets.noMatch) {
  const k = `${b.slot}|${b.item}`;
  if (!noMatchCats.has(k)) noMatchCats.set(k, { slot: b.slot, item: b.item, materials: new Set(), examples: new Set() });
  const c = noMatchCats.get(k);
  c.materials.add(b.material);
  for (const e of b.examples || []) c.examples.add(e);
}

// ---- 2. Color-locked: for each (slot,item) in colorMismatch, see what
//        image color it always falls back to and which requested colors clash.
const colorLocks = new Map();
for (const b of r.buckets.colorMismatch) {
  const k = `${b.slot}|${b.item}`;
  if (!colorLocks.has(k)) colorLocks.set(k, { slot: b.slot, item: b.item, imageColors: new Set(), unsupportedColors: new Set(), examples: new Set() });
  const c = colorLocks.get(k);
  c.imageColors.add(b.imageColor);
  c.unsupportedColors.add(b.requestedColor);
  for (const e of b.examples || []) c.examples.add(e);
}

// ---- 3. Material-locked
const materialLocks = new Map();
for (const b of r.buckets.materialMismatch) {
  const k = `${b.slot}|${b.item}`;
  if (!materialLocks.has(k)) materialLocks.set(k, { slot: b.slot, item: b.item, imageMaterials: new Set(), unsupportedMaterials: new Set(), examples: new Set() });
  const c = materialLocks.get(k);
  c.imageMaterials.add(b.imageMaterial);
  c.unsupportedMaterials.add(b.requestedMaterial);
  for (const e of b.examples || []) c.examples.add(e);
}

// ---- 4. Weak-match
const weakCats = new Map();
for (const b of r.buckets.lowScore) {
  const k = `${b.slot}|${b.item}`;
  if (!weakCats.has(k)) weakCats.set(k, { slot: b.slot, item: b.item, matchedKeys: new Set(), examples: new Set() });
  const c = weakCats.get(k);
  c.matchedKeys.add(b.key);
  for (const e of b.examples || []) c.examples.add(e);
}

function fmt(map, kind) {
  const arr = [...map.values()].sort((a, b) =>
    a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : a.item.localeCompare(b.item)
  );
  console.log(`\n## ${kind}  (${arr.length} categories)\n`);
  for (const c of arr) {
    const ex = [...c.examples].slice(0, 1)[0] || "";
    if (kind === "NO-MATCH") {
      console.log(`- [${c.slot}] **${c.item}** — falls back to generic. e.g. "${ex}"`);
    } else if (kind === "COLOR-LOCKED") {
      const imgs = [...c.imageColors].sort().join(", ");
      const reqs = [...c.unsupportedColors].sort().join(", ");
      console.log(`- [${c.slot}] **${c.item}** — only ${imgs} image; bad for: ${reqs}`);
    } else if (kind === "MATERIAL-LOCKED") {
      const imgs = [...c.imageMaterials].sort().join(", ");
      const reqs = [...c.unsupportedMaterials].sort().join(", ");
      console.log(`- [${c.slot}] **${c.item}** — only ${imgs} image; bad for: ${reqs}`);
    } else if (kind === "WEAK-MATCH") {
      const keys = [...c.matchedKeys].join(", ");
      console.log(`- [${c.slot}] **${c.item}** — score ≤ 3 mapping to: ${keys}. e.g. "${ex}"`);
    }
  }
  return arr;
}

const noMatch = fmt(noMatchCats, "NO-MATCH");
const colorLocked = fmt(colorLocks, "COLOR-LOCKED");
const materialLocked = fmt(materialLocks, "MATERIAL-LOCKED");
const weak = fmt(weakCats, "WEAK-MATCH");

// Persist digest
const out = {
  generatedAt: new Date().toISOString(),
  totals: {
    noMatchCategories: noMatch.length,
    colorLockedCategories: colorLocked.length,
    materialLockedCategories: materialLocked.length,
    weakMatchCategories: weak.length,
  },
  noMatch: noMatch.map((c) => ({ slot: c.slot, item: c.item, materials: [...c.materials], example: [...c.examples][0] || "" })),
  colorLocked: colorLocked.map((c) => ({ slot: c.slot, item: c.item, imageColors: [...c.imageColors], unsupportedColors: [...c.unsupportedColors] })),
  materialLocked: materialLocked.map((c) => ({ slot: c.slot, item: c.item, imageMaterials: [...c.imageMaterials], unsupportedMaterials: [...c.unsupportedMaterials] })),
  weakMatch: weak.map((c) => ({ slot: c.slot, item: c.item, matchedKeys: [...c.matchedKeys], example: [...c.examples][0] || "" })),
};
fs.writeFileSync(path.join(__dirname, "digest.json"), JSON.stringify(out, null, 2));
console.log(`\n[digest] wrote ${path.join(__dirname, "digest.json")}`);
