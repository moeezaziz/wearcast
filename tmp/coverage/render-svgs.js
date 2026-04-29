// Render polished SVG illustrations for every missing catalog entry, then
// rewrite each entry's `path` field in server/index.js so it points at the
// new .svg file. Idempotent: re-runs are safe.
"use strict";
const fs = require("fs");
const path = require("path");
const { generate } = require("./svg-gen");

const ROOT = path.resolve(__dirname, "../..");
const STOCK = path.join(ROOT, "www/assets/recommendation-stock");
const SERVER = path.join(ROOT, "server/index.js");

// Pull the catalog from server/index.js
const src = fs.readFileSync(SERVER, "utf8");
const start = src.indexOf("const STOCK_IMAGE_CATALOG = {");
const open = src.indexOf("{", start);
let depth = 0, end = -1;
for (let i = open; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
}
const catalog = Function(`"use strict"; return (${src.slice(open, end)});`)();

// Reverse-parse each catalog key into {slot,color,item,material,gender}
function parseEntry(key, entry) {
  const slot = entry.slot;
  const isFem = key.includes("_fem_");
  const noFemV1 = key.split("_").filter((p) => p !== "fem" && p !== "v1");
  // [slot, color, ...itemParts, material]
  const color = noFemV1[1];
  const material = noFemV1[noFemV1.length - 1];
  const itemRaw = noFemV1.slice(2, -1).join(" ").replace(/-/g, " ");
  return { slot, color, item: itemRaw, material, gender: entry.gender || "unisex", isFem };
}

const generated = [];
let kept = 0;
let regenerated = 0;
for (const [key, entry] of Object.entries(catalog)) {
  if (!entry.path) continue;
  const fullPath = path.join(ROOT, "www", entry.path);
  if (fs.existsSync(fullPath)) {
    kept++;
    continue;  // user kept this one — don't touch
  }
  // File is missing → render an SVG to replace it
  const parsed = parseEntry(key, entry);
  const svg = generate(parsed);
  // Write to a parallel .svg path so we don't accidentally collide with any
  // future Pexels/Commons re-download we might do.
  const baseName = path.basename(entry.path).replace(/\.(jpe?g|png)$/i, ".svg");
  const newRel = `assets/recommendation-stock/${baseName}`;
  const newAbs = path.join(STOCK, baseName);
  fs.writeFileSync(newAbs, svg);
  generated.push({ key, oldPath: entry.path, newPath: newRel, ...parsed });
  regenerated++;
}

// --- Rewrite catalog paths ----------------------------------------------
let updatedSrc = src;
for (const g of generated) {
  // Match the entry's `path: "<oldPath>"` and replace just the value
  const re = new RegExp(
    `(${g.key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}:\\s*\\{[^}]*?path:\\s*")[^"]+(")`,
    "m"
  );
  if (re.test(updatedSrc)) {
    updatedSrc = updatedSrc.replace(re, (_, head, tail) => head + g.newPath + tail);
  } else {
    console.warn("[render-svgs] could not patch path for", g.key);
  }
}
fs.writeFileSync(SERVER, updatedSrc);

// --- Save log -----------------------------------------------------------
fs.writeFileSync(
  path.join(__dirname, "render-svgs.json"),
  JSON.stringify({ kept, regenerated, generated: generated.map((g) => ({ key: g.key, slot: g.slot, item: g.item, color: g.color, material: g.material, newPath: g.newPath })) }, null, 2)
);

console.log(`SVG generation complete.`);
console.log(`  kept (user kept the original): ${kept}`);
console.log(`  regenerated as SVG:           ${regenerated}`);
console.log(`  total catalog entries:        ${kept + regenerated}`);
console.log(`Wrote tmp/coverage/render-svgs.json`);
