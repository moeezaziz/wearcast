// Turn digest.json into a concrete sourcing manifest the team or the
// downloader script can act on.
//
// Output columns:
//   slot, item, color, material, priority, gapType,
//   suggestedKey, suggestedFilename, searchQuery,
//   unsplashSearchUrl, pexelsSearchUrl, licenseNote
//
// Priority is a heuristic of how often this gap is likely to fire:
//   P0 = item missing entirely (always wrong)
//   P1 = high-frequency item type (jeans / chinos / sneakers / loafers / parka /
//        button-up / hoodie etc.) in a base wardrobe color
//   P2 = same item type, less common color
//   P3 = niche items
"use strict";

const fs = require("fs");
const path = require("path");
const digest = require("./digest.json");

const HIGH_FREQ_ITEMS = new Set([
  "T-shirt","Long-sleeve t-shirt","Polo shirt","Button-up shirt","Linen shirt",
  "Knit sweater","Hoodie","Knit tee",
  "Jeans","Chinos","Tailored trousers","Joggers","Cotton shorts","Linen trousers",
  "Lightweight chinos","Slim chinos",
  "Blazer","Trench coat","Parka","Wool overcoat","Bomber jacket","Field jacket",
  "Rain jacket","Shell jacket","Puffer jacket","Hooded parka","Pea coat",
  "Sneakers","White sneakers","Black sneakers","Running shoes","Loafers",
  "Brown loafers","Chelsea boots","Ankle boots","Hiking boots","Winter boots",
  "Watch","Sunglasses","Beanie","Baseball cap","Sun hat","Tote bag","Backpack",
  "Scarf","Wool scarf","Belt","Gloves",
]);
const BASE_COLORS = new Set([
  "black","white","navy","gray","charcoal","beige","tan","brown","olive","cream",
]);

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function suggestKey(slot, item, color, material) {
  return `${slot}_${slug(color)}_${slug(item)}_${slug(material)}_studio`;
}
function suggestFilename(slot, item, color, material) {
  return `assets/recommendation-stock/${slot}-${slug(color)}-${slug(item)}-${slug(material)}.jpg`;
}
function searchQuery(item, color, material) {
  // Bias the query toward studio / flat-lay shots so results match the
  // catalog's existing visual style.
  return `${color} ${material} ${item} flat lay studio product`;
}

function priority({ slot, item, color, material, gapType }) {
  if (gapType === "noMatch") return "P0";
  const base = BASE_COLORS.has(color);
  const hi = HIGH_FREQ_ITEMS.has(item);
  if (hi && base) return "P1";
  if (hi || base) return "P2";
  return "P3";
}

const rows = [];

// --- A. NO-MATCH categories: produce one row per (slot,item) in a default
//        base color/material that fits the silhouette.
const noMatchDefaults = {
  Backpack: { color: "black", material: "nylon" },
  "Bow tie": { color: "navy", material: "silk" },
  Bracelet: { color: "silver", material: "metal" },
  Fedora: { color: "tan", material: "wool" },
  Necklace: { color: "silver", material: "metal" },
  "Pocket square": { color: "navy", material: "silk" },
  Tie: { color: "navy", material: "silk" },
  "Quilted vest": { color: "olive", material: "nylon" },
  Brogues: { color: "brown", material: "leather" },
  Espadrilles: { color: "tan", material: "canvas" },
  Sandals: { color: "brown", material: "leather" },
  Slides: { color: "black", material: "rubber" },
  "Slip-ons": { color: "white", material: "canvas" },
  Cardigan: { color: "navy", material: "wool" },
  Henley: { color: "white", material: "cotton" },
  "Wool turtleneck": { color: "charcoal", material: "wool" },
};
for (const c of digest.noMatch) {
  const def = noMatchDefaults[c.item] || { color: "black", material: "cotton" };
  rows.push({
    slot: c.slot,
    item: c.item,
    color: def.color,
    material: def.material,
    gapType: "noMatch",
  });
}

// --- B. COLOR-LOCKED: emit a row per (slot,item,color) for every unsupported
//        color. Limit to base colors for prioritisation cleanliness; rare
//        colors stay P3 below if not base.
for (const c of digest.colorLocked) {
  // Pick a sensible default material for the silhouette.
  const slot = c.slot;
  const defaultMaterial =
    slot === "top" ? (/(linen|camp)/i.test(c.item) ? "linen" : /(knit|sweater|merino|cashmere|turtleneck)/i.test(c.item) ? "wool" : /(t-?shirt|tee|tank|sweatshirt|hoodie|polo|graphic)/i.test(c.item) ? "cotton" : "cotton")
    : slot === "bottom" ? (/(jean|denim)/i.test(c.item) ? "denim" : /(linen)/i.test(c.item) ? "linen" : /(legging|jogger|track|tech|athletic|running)/i.test(c.item) ? "tech" : /(corduroy)/i.test(c.item) ? "corduroy" : /(wool|trouser)/i.test(c.item) ? "wool" : "cotton")
    : slot === "outer" ? (/(rain|shell|wind|tech)/i.test(c.item) ? "tech" : /(parka|puffer|down|insulated)/i.test(c.item) ? "down" : /(leather)/i.test(c.item) ? "leather" : /(fleece)/i.test(c.item) ? "fleece" : /(cardigan|knit)/i.test(c.item) ? "wool" : /(blazer|overcoat|trench|peacoat|pea coat|duffle|wool)/i.test(c.item) ? "wool" : "cotton")
    : slot === "shoes" ? (/(canvas|sneaker)/i.test(c.item) ? (/sneaker/i.test(c.item) ? "leather" : "canvas") : /(running|trail|performance|athletic)/i.test(c.item) ? "mesh" : /(rain)/i.test(c.item) ? "rubber" : /(boot|chelsea|chukka|hiking|winter|combat|ankle)/i.test(c.item) ? (/suede/i.test(c.item) ? "suede" : "leather") : "leather")
    : /* accessory */ (/(scarf|tie|bow)/i.test(c.item) ? "silk" : /(beanie|wool)/i.test(c.item) ? "wool" : /(belt|loafer)/i.test(c.item) ? "leather" : /(bag|tote|backpack|crossbody)/i.test(c.item) ? "leather" : /(sunglass)/i.test(c.item) ? "acetate" : /(watch|necklace|bracelet)/i.test(c.item) ? "metal" : "cotton");
  for (const color of c.unsupportedColors) {
    rows.push({
      slot,
      item: c.item,
      color,
      material: defaultMaterial,
      gapType: "colorLocked",
    });
  }
}

// Dedupe identical rows (some come from both noMatch and colorLocked sources).
const seen = new Set();
const deduped = rows.filter((r) => {
  const k = `${r.slot}|${r.item}|${r.color}|${r.material}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

// Score and enrich
const enriched = deduped.map((r) => {
  const p = priority(r);
  const key = suggestKey(r.slot, r.item, r.color, r.material);
  const filename = suggestFilename(r.slot, r.item, r.color, r.material);
  const q = searchQuery(r.item, r.color, r.material);
  return {
    ...r,
    priority: p,
    suggestedKey: key,
    suggestedFilename: filename,
    searchQuery: q,
    unsplashSearchUrl: `https://unsplash.com/s/photos/${encodeURIComponent(q)}`,
    pexelsSearchUrl: `https://www.pexels.com/search/${encodeURIComponent(q)}/`,
    licenseNote: "Verify license before use. Unsplash/Pexels: free for commercial, no attribution required (recommended). Pixabay: similar but check each image. Avoid Flickr/Google Images unless explicit CC0/CC-BY.",
  };
});

// Stable sort: P0 -> P1 -> P2 -> P3, then slot, then item, then color
const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
enriched.sort((a, b) => order[a.priority] - order[b.priority]
  || a.slot.localeCompare(b.slot)
  || a.item.localeCompare(b.item)
  || a.color.localeCompare(b.color));

// Write JSON
fs.writeFileSync(path.join(__dirname, "manifest.json"), JSON.stringify(enriched, null, 2));

// Write CSV
const cols = [
  "priority","gapType","slot","item","color","material",
  "suggestedKey","suggestedFilename","searchQuery",
  "unsplashSearchUrl","pexelsSearchUrl","licenseNote",
];
const csvEsc = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [cols.join(",")]
  .concat(enriched.map((r) => cols.map((c) => csvEsc(r[c])).join(",")))
  .join("\n");
fs.writeFileSync(path.join(__dirname, "manifest.csv"), csv);

// Tally
const tally = enriched.reduce((acc, r) => {
  acc[r.priority] = (acc[r.priority] || 0) + 1;
  return acc;
}, {});
console.log(`Manifest rows: ${enriched.length}`);
console.log(`By priority:`, tally);
console.log(`Wrote ${path.join(__dirname, "manifest.json")}`);
console.log(`Wrote ${path.join(__dirname, "manifest.csv")}`);
