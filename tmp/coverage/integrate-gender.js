// Integrates gender awareness into server/index.js in two passes:
//   1. Adds a `gender` field to every existing STOCK_IMAGE_CATALOG entry,
//      using tmp/coverage/gender-tags.json for masculine/feminine/unisex.
//   2. Appends 197 new feminine catalog entries from downloads-fem.json
//      (only entries with status="ok"), tagged gender:"feminine" with
//      front-loaded item-name keywords for the matcher.
// Idempotent: re-running won't double-insert or duplicate fields.
"use strict";

const fs = require("fs");
const path = require("path");

const SERVER_PATH = path.resolve(__dirname, "../../server/index.js");
const tags = require("./gender-tags.json").tags;
const fem = require("./downloads-fem.json").filter((r) => r.status === "ok");

let src = fs.readFileSync(SERVER_PATH, "utf8");

// --- Pass 1: locate catalog block + parse keys via brace walk -------------
const startMarker = "const STOCK_IMAGE_CATALOG = {";
const startIdx = src.indexOf(startMarker);
if (startIdx < 0) throw new Error("catalog start not found");
const openIdx = src.indexOf("{", startIdx);
let depth = 0, closeIdx = -1;
for (let i = openIdx; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { closeIdx = i; break; } }
}
if (closeIdx < 0) throw new Error("catalog close not found");

const catalogBlock = src.slice(openIdx, closeIdx + 1);

// Inject `gender: "<value>",` right after the slot field of each entry. We
// match by entry key so we know which gender tag to apply. Each catalog entry
// looks like:
//
//   key_name_v1: {
//     slot: "top",
//     path: "...",
//     ...
//   },
//
// We keep edits scoped: skip if the entry already has `gender: ...,`.
let updated = catalogBlock;
let tagged = 0;
for (const [key, gender] of Object.entries(tags)) {
  // Find the entry block for this key. The key is followed by a colon and
  // a `{`, which begins the entry's properties.
  const entryRe = new RegExp(`(^\\s+${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}:\\s*\\{)([^]*?)(\\n  \\},)`, "m");
  const m = updated.match(entryRe);
  if (!m) continue;
  const head = m[1];
  let body = m[2];
  const tail = m[3];
  if (/\n\s+gender:\s*"/.test(body)) continue;  // already tagged
  // Insert after the slot line (always present and short to find).
  body = body.replace(/(\n\s+slot:\s*"[^"]+",)/, `$1\n    gender: "${gender}",`);
  if (!/\n\s+gender:\s*"/.test(body)) continue;  // safety net
  updated = updated.slice(0, m.index) + head + body + tail + updated.slice(m.index + m[0].length);
  tagged++;
}
console.log(`tagged ${tagged} existing entries with gender`);

// --- Pass 2: append feminine entries before the closing `};` of catalog ---
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, ""); }
function slugItemKeywords(item) {
  // Build a small keyword cluster for each item so the matcher hits.
  const lower = item.toLowerCase();
  const base = [lower];
  // Add aliases for highly searched items
  const aliases = {
    "blouse": ["top","shirt","collared shirt","button-up blouse"],
    "silk blouse": ["blouse","silk top","top"],
    "wrap blouse": ["blouse","top","wrap top"],
    "camisole": ["cami","tank","sleeveless top","top"],
    "halter top": ["halter","top","tank top"],
    "off-shoulder top": ["off shoulder top","top","off-shoulder blouse"],
    "crop top": ["cropped top","top","tee"],
    "bodysuit": ["bodysuit top","top"],
    "tunic": ["long top","tunic top","top"],
    "knit cardigan": ["cardigan","knit top","sweater"],
    "long cardigan": ["duster cardigan","cardigan","long sweater"],
    "ruffled blouse": ["ruffle blouse","ruffled top","top"],
    "peplum top": ["peplum","top"],
    "wrap dress": ["dress","midi dress","jersey dress"],
    "slip dress": ["dress","slip","silk dress"],
    "sundress": ["dress","summer dress"],
    "midi dress": ["dress","midi"],
    "maxi dress": ["dress","maxi","long dress"],
    "mini dress": ["dress","mini","short dress"],
    "sheath dress": ["dress","tailored dress"],
    "shirtdress": ["dress","shirt dress"],
    "cocktail dress": ["dress","party dress","evening dress"],
    "sweater dress": ["dress","knit dress"],
    "t-shirt dress": ["dress","tee dress","casual dress"],
    "bodycon dress": ["dress","fitted dress"],
    "a-line skirt": ["skirt","a line skirt"],
    "pencil skirt": ["skirt","tailored skirt"],
    "midi skirt": ["skirt","midi"],
    "mini skirt": ["skirt","short skirt"],
    "maxi skirt": ["skirt","long skirt"],
    "pleated skirt": ["skirt","pleat skirt"],
    "wrap skirt": ["skirt","wrap"],
    "denim skirt": ["skirt","jean skirt"],
    "leather skirt": ["skirt"],
    "tennis skirt": ["skirt","sport skirt"],
    "high-waist jeans": ["jeans","denim","high waisted jeans"],
    "mom jeans": ["jeans","denim","relaxed jeans"],
    "wide-leg trousers": ["trousers","pants","wide leg pants"],
    "cigarette pants": ["trousers","pants","slim trousers"],
    "capri pants": ["pants","cropped pants"],
    "culottes": ["pants","wide trousers"],
    "palazzo pants": ["pants","wide trousers","flowing trousers"],
    "bike shorts": ["shorts","biker shorts","cycling shorts"],
    "wrap coat": ["coat","wrap"],
    "faux fur coat": ["coat","fur coat"],
    "cropped jacket": ["jacket","crop jacket","short jacket"],
    "cape": ["cape","poncho","wrap"],
    "poncho": ["poncho","cape","wrap"],
    "kimono": ["kimono","robe","wrap"],
    "duster coat": ["duster","long coat","cardigan coat"],
    "heels": ["heel","high heels","pump"],
    "stiletto heels": ["heel","stiletto","pump"],
    "kitten heels": ["heel","kitten heel"],
    "block heels": ["heel","block heel"],
    "pumps": ["pump","heel","court shoe"],
    "ballet flats": ["flat","ballerina flat","ballet flat"],
    "mary janes": ["mary jane","flat","strap shoe"],
    "mules": ["mule","slide","slip on"],
    "wedge sandals": ["wedge","sandal"],
    "strappy sandals": ["sandal","strappy sandal"],
    "espadrille wedges": ["wedge","espadrille"],
    "knee-high boots": ["boots","tall boots","over-the-knee boot"],
    "riding boots": ["boots","tall boots"],
    "clutch": ["bag","evening bag","clutch bag"],
    "mini bag": ["bag","small bag","mini purse"],
    "hobo bag": ["bag","slouch bag"],
    "bucket bag": ["bag","drawstring bag"],
    "crossbody handbag": ["bag","handbag","crossbody bag"],
    "hair clip": ["barrette","hair pin","hair accessory"],
    "headband": ["hair band","headband"],
    "hair scarf": ["scarf","head scarf","kerchief"],
    "pearl earrings": ["earrings","pearls","jewelry"],
    "hoop earrings": ["earrings","hoops","jewelry"],
    "drop earrings": ["earrings","jewelry"],
    "statement necklace": ["necklace","jewelry","chain"],
    "pendant necklace": ["necklace","pendant","jewelry"],
    "brooch": ["pin","brooch","jewelry"],
    "stacked bracelets": ["bracelet","jewelry","stack"],
    "charm bracelet": ["bracelet","jewelry"],
    "beret": ["hat","french hat"],
  };
  return Array.from(new Set([...base, ...(aliases[lower] || [])]));
}

const newEntries = [];
for (const r of fem) {
  const filename = path.basename(r.outPath);
  const colorTitle = r.color.charAt(0).toUpperCase() + r.color.slice(1);
  // Stable key: slot + color + item slug + material + fem suffix
  const key = `${r.slot}_${slug(r.color)}_${slug(r.item)}_${slug(r.material)}_fem_v1`;
  // Skip if catalog already has this key (idempotent)
  if (new RegExp(`^\\s+${key}:\\s*\\{`, "m").test(updated)) continue;
  const itemKeywords = slugItemKeywords(r.item);
  const colorMaterialKeywords = [
    `${r.color} ${r.item}`.toLowerCase(),
    `${r.material} ${r.item}`.toLowerCase(),
    `${r.color} ${r.material} ${r.item}`.toLowerCase(),
  ];
  const allKeywords = Array.from(new Set([...colorMaterialKeywords, ...itemKeywords]));
  newEntries.push(
`  ${key}: {
    slot: "${r.slot}",
    gender: "feminine",
    path: "assets/recommendation-stock/${filename}",
    description: "${colorTitle} ${r.material} ${r.item.toLowerCase()} (women's catalog)",
    keywords: ${JSON.stringify(allKeywords)},
    source: ${JSON.stringify(r.sourcePage || "")},
    license: ${JSON.stringify(r.license || "")},
    attribution: ${JSON.stringify((r.attribution || "").slice(0, 200))},
  },`
  );
}
console.log(`appending ${newEntries.length} feminine entries`);

if (newEntries.length) {
  // Insert just before the catalog's closing `};`. We rebuild the block.
  const newBlockBeforeClose = updated.replace(/\n\};?\s*$/, "");
  const finalBlock = newBlockBeforeClose + "\n" + newEntries.join("\n") + "\n};";
  src = src.slice(0, openIdx) + finalBlock + src.slice(closeIdx + 1);
} else {
  // No new entries — just update with gender tags
  src = src.slice(0, openIdx) + updated + src.slice(closeIdx + 1);
}

fs.writeFileSync(SERVER_PATH, src);

// Verify catalog count
const after = fs.readFileSync(SERVER_PATH, "utf8");
const block = after.match(/STOCK_IMAGE_CATALOG = \{[\s\S]*?\n\};/)[0];
const count = (block.match(/^\s+\w+:\s*\{/gm) || []).length;
console.log(`catalog now: ${count} entries`);
const taggedCount = (block.match(/\n\s+gender:\s*"/g) || []).length;
console.log(`entries with gender field: ${taggedCount}`);
