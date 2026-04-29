// Stock-image coverage audit.
// Loads STOCK_IMAGE_CATALOG + the scoring helpers straight from server/index.js
// (no copy-paste, no drift), then sweeps a representative space of plausible
// LLM outfit outputs across slot/item/color/material/weather/style and reports:
//   A. Items that fall back to the generic stock image (no real match).
//   B. Items that match a real entry but the entry's visual color or material
//      conflicts with the request (image will look wrong on the card).

"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const SERVER_PATH = path.resolve(__dirname, "../../server/index.js");
const SOURCE = fs.readFileSync(SERVER_PATH, "utf8");

// We cannot just `require` server/index.js (it boots an HTTP listener with side
// effects). Extract just the symbols we need by evaluating the file with
// `app.listen` neutralised. Cheapest reliable approach: compile a stub that
// shadows `app.listen` and then run the file.
const stubbed = SOURCE
  // Stop server from listening
  .replace(/app\.listen\(/g, "(()=>{}); (()=> ")
  // Avoid running long-lived intervals/timers
  .replace(/setInterval\(/g, "(()=> ")
  .replace(/setTimeout\(/g, "(()=> ");

const m = new Module(SERVER_PATH);
m.filename = SERVER_PATH;
m.paths = Module._nodeModulePaths(path.dirname(SERVER_PATH));
try {
  m._compile(stubbed, SERVER_PATH);
} catch (err) {
  // Some helpers reference module-scope state initialized at load. If the stub
  // breaks, fall back to direct catalog parsing — we only really need the
  // catalog object and reproduce scoring locally.
  console.warn("[audit] could not load server module:", err.message);
}

// Pull out catalog from the loaded module if available, else parse manually.
function loadCatalog() {
  if (m.exports && m.exports.STOCK_IMAGE_CATALOG) return m.exports.STOCK_IMAGE_CATALOG;
  // Manual: extract `const STOCK_IMAGE_CATALOG = { ... };`
  const start = SOURCE.indexOf("const STOCK_IMAGE_CATALOG = {");
  const open = SOURCE.indexOf("{", start);
  // brace-match to find end
  let depth = 0;
  let end = -1;
  for (let i = open; i < SOURCE.length; i++) {
    if (SOURCE[i] === "{") depth++;
    else if (SOURCE[i] === "}") {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  const objSrc = SOURCE.slice(open, end);
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${objSrc});`)();
}

const STOCK_IMAGE_CATALOG = loadCatalog();
console.log(`[audit] catalog entries: ${Object.keys(STOCK_IMAGE_CATALOG).length}`);

// ---- Local copy of scoring (kept in sync; exact code from server/index.js) --
function cleanInlineText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim() || fallback;
}
function normalizeMatchText(value) {
  return cleanInlineText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function inferCatalogAesthetic(entry = {}, key = "") {
  const text = `${key} ${entry.description || ""} ${(entry.keywords || []).join(" ")}`.toLowerCase();
  return {
    warmth: /\b(winter|insulated|thermal|fleece|beanie|glove|parka|overcoat|coat|sweater|knit)\b/.test(text)
      ? "warm"
      : /\b(tank|shorts|linen|sun|tee|t-shirt|polo)\b/.test(text)
      ? "cool"
      : "neutral",
    formality: /\b(blazer|tailored|dress|loafer|oxford|button-up|button up|trouser|slack|watch|polo)\b/.test(text)
      ? "polished"
      : /\b(running|athletic|sport|trail|performance|leggings)\b/.test(text)
      ? "sporty"
      : "casual",
    weather: /\b(rain|waterproof|water-resistant|shell|umbrella|parka|windbreaker|weatherproof)\b/.test(text)
      ? "protective"
      : /\b(sunglasses|sun hat|cap)\b/.test(text)
      ? "sun"
      : "neutral",
    materialCue: /\b(denim)\b/.test(text) ? "denim"
      : /\b(wool|merino)\b/.test(text) ? "wool"
      : /\b(linen)\b/.test(text) ? "linen"
      : /\b(cotton|chino|twill)\b/.test(text) ? "cotton"
      : "generic",
    visualStyle: /\b(street|outdoor|city|outdoors)\b/.test(text) ? "lifestyle" : "studio",
  };
}
// Simplified scoring (no weather penalties — we want pure name match coverage).
function scoreCatalogMatch(text, entry) {
  const normalized = normalizeMatchText(text);
  if (!normalized) return 0;
  const textTokens = normalized.split(" ").filter((t) => t.length > 2);
  let score = 0;
  for (const keyword of entry.keywords || []) {
    const nk = normalizeMatchText(keyword);
    if (!nk) continue;
    const kTokens = nk.split(" ").filter((t) => t.length > 2);
    if (normalized === nk) { score += 18; continue; }
    if (normalized.includes(nk)) score += 8;
    if (nk.includes(normalized)) score += 6;
    if (kTokens.length) {
      const matched = kTokens.filter((t) => textTokens.includes(t)).length;
      if (matched === kTokens.length) score += 6;
      else if (matched > 0) score += matched * 2;
    }
  }
  const desc = normalizeMatchText(entry.description);
  if (desc) {
    if (desc.includes(normalized)) score += 4;
    const dTokens = desc.split(" ").filter((t) => t.length > 2);
    const overlap = textTokens.filter((t) => dTokens.includes(t)).length;
    if (overlap > 0) score += Math.min(overlap, 3);
  }
  if (entry.fallback) score -= 1;
  return score;
}
function findStockImageForSlot(slot, itemName) {
  const entries = Object.entries(STOCK_IMAGE_CATALOG).filter(([, e]) => e.slot === slot);
  let best = null, bestScore = -Infinity;
  for (const [k, e] of entries) {
    const s = scoreCatalogMatch(itemName, e);
    if (s > bestScore) { best = { key: k, entry: e, score: s }; bestScore = s; }
  }
  if (best && bestScore > 0) return { ...best, isFallback: false };
  const fb = entries.find(([, e]) => e.fallback);
  return fb ? { key: fb[0], entry: fb[1], score: bestScore, isFallback: true } : null;
}

// ---- Color / material extraction from catalog entry image ------------------
const COLOR_WORDS = [
  "white","black","gray","grey","charcoal","navy","blue","red","burgundy",
  "rust","brown","tan","beige","cream","ivory","olive","green","khaki",
  "yellow","pink","magenta","purple","silver","gold","tortoiseshell",
];
const MATERIAL_WORDS = [
  "linen","cotton","wool","merino","denim","leather","suede","canvas","fleece",
  "knit","silk","tech","performance","waterproof","shell","insulated","cashmere",
];
function entryVisualColor(entry, key) {
  const text = `${key} ${entry.description || ""}`.toLowerCase();
  for (const c of COLOR_WORDS) if (new RegExp(`\\b${c}\\b`).test(text)) return c === "grey" ? "gray" : c;
  return null;
}
function entryVisualMaterial(entry, key) {
  const text = `${key} ${entry.description || ""} ${(entry.keywords || []).join(" ")}`.toLowerCase();
  for (const m of MATERIAL_WORDS) if (new RegExp(`\\b${m}\\b`).test(text)) return m;
  return null;
}

// ---- Input space: representative LLM outputs ------------------------------
// These mirror what the model emits for outfit.{top,bottom,outer,shoes,accessory}
// across the conditions we'd see on Today (cold, mild, hot, wet) and bands
// (office, sporty, minimal, streetwear, evening).
const ITEM_TYPES = {
  top: [
    "T-shirt","Long-sleeve t-shirt","Polo shirt","Button-up shirt","Linen shirt",
    "Long-sleeve linen shirt","Oxford shirt","Chambray shirt","Henley",
    "Knit tee","Knit sweater","Cashmere sweater","Merino crewneck","Wool turtleneck",
    "Hoodie","Zip hoodie","Sweatshirt","Tank top","Camp shirt",
    "Performance tee","Graphic tee","Flannel shirt","Cardigan",
    "Rugby shirt","Mock-neck top","Thermal base layer",
  ],
  bottom: [
    "Jeans","Slim jeans","Relaxed jeans","Black jeans",
    "Chinos","Slim chinos","Tailored trousers","Wool trousers","Wide-leg trousers",
    "Linen trousers","Lightweight chinos","Cargo pants","Joggers","Tech joggers",
    "Athletic shorts","Running shorts","Cotton shorts","Linen shorts","Denim shorts",
    "Leggings","Track pants","Pleated trousers","Corduroy pants",
  ],
  outer: [
    "Blazer","Tailored blazer","Lightweight blazer","Wool overcoat","Trench coat",
    "Parka","Hooded parka","Insulated parka","Down jacket","Puffer jacket",
    "Hoodie","Zip hoodie","Cardigan","Overshirt","Shacket","Denim jacket",
    "Bomber jacket","Leather jacket","Field jacket","Chore coat",
    "Windbreaker","Rain jacket","Shell jacket","Tech shell","Fleece jacket",
    "Quilted vest","Pea coat","Duffle coat",
  ],
  shoes: [
    "Sneakers","White sneakers","Black sneakers","Canvas sneakers","Leather sneakers",
    "Running shoes","Trail runners","Performance runners",
    "Loafers","Penny loafers","Tassel loafers","Suede loafers","Brown loafers",
    "Oxford shoes","Derby shoes","Brogues","Chelsea boots","Chukka boots",
    "Hiking boots","Winter boots","Ankle boots","Combat boots","Rain boots",
    "Espadrilles","Boat shoes","Slip-ons","Slides","Sandals",
  ],
  accessory: [
    "Watch","Sunglasses","Beanie","Wool beanie","Baseball cap","Sports cap",
    "Sun hat","Wide-brim hat","Fedora","Bucket hat",
    "Scarf","Wool scarf","Silk scarf","Pocket square","Tie","Bow tie",
    "Belt","Leather belt","Tote bag","Backpack","Crossbody bag","Belt bag",
    "Umbrella","Compact umbrella","Gloves","Leather gloves","Wool gloves",
    "Wool socks","Necklace","Bracelet",
  ],
};

const COLORS_BY_SLOT = {
  top: ["white","black","navy","gray","cream","beige","blue","light blue","olive","burgundy","red","pink","yellow","green","brown"],
  bottom: ["black","navy","gray","charcoal","beige","tan","khaki","olive","brown","cream","white","blue"],
  outer: ["black","navy","gray","charcoal","brown","tan","olive","cream","green","beige","white","red"],
  shoes: ["white","black","brown","tan","gray","navy","olive","cream","red"],
  accessory: ["black","brown","tan","navy","cream","white","gray","red","yellow","blue"],
};

const MATERIALS_BY_SLOT = {
  top: ["cotton","linen","wool","merino","cashmere","silk","jersey","performance"],
  bottom: ["denim","cotton","linen","wool","corduroy","tech","fleece"],
  outer: ["wool","cotton","tech","leather","down","fleece","cashmere","nylon","gore-tex"],
  shoes: ["leather","suede","canvas","mesh","rubber","knit"],
  accessory: ["leather","wool","silk","cotton","metal","acetate","nylon"],
};

// ---- Run the sweep --------------------------------------------------------
const noMatch = [];      // falls back to generic
const colorMismatch = []; // matches a real entry but image color != request
const materialMismatch = []; // matches a real entry but image material != request
const lowScore = [];     // scores 1–3 (weak match, likely poor image)

function colorClash(req, img) {
  if (!img || !req) return false;
  if (req === img) return false;
  // Treat near-neighbour neutrals as compatible (lots of catalog images are
  // near-neutral and look fine with adjacent shades).
  const neutrals = new Set(["white","cream","ivory","beige"]);
  if (neutrals.has(req) && neutrals.has(img)) return false;
  const grays = new Set(["gray","charcoal","silver"]);
  if (grays.has(req) && grays.has(img)) return false;
  const browns = new Set(["brown","tan"]);
  if (browns.has(req) && browns.has(img)) return false;
  return true;
}
function materialClash(req, img) {
  if (!req || !img) return false;
  if (req === img) return false;
  // Treat tech/performance/nylon as interchangeable for visual purposes.
  const techy = new Set(["tech","performance","nylon"]);
  if (techy.has(req) && techy.has(img)) return false;
  // Cotton ≈ canvas for shoes; jersey ≈ cotton.
  if (req === "jersey" && img === "cotton") return false;
  if (req === "canvas" && img === "cotton") return false;
  return true;
}

const seen = new Set();
let total = 0;
for (const slot of Object.keys(ITEM_TYPES)) {
  for (const item of ITEM_TYPES[slot]) {
    for (const color of COLORS_BY_SLOT[slot]) {
      for (const material of MATERIALS_BY_SLOT[slot]) {
        total++;
        const name = `${color[0].toUpperCase()+color.slice(1)} ${material} ${item}`;
        const dedupe = `${slot}|${item.toLowerCase()}|${color}|${material}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        const match = findStockImageForSlot(slot, name);
        if (!match || match.isFallback) {
          noMatch.push({ slot, item, color, material, name });
          continue;
        }
        if (match.score > 0 && match.score <= 3) {
          lowScore.push({ slot, item, color, material, name, key: match.key, score: match.score });
        }
        const imgColor = entryVisualColor(match.entry, match.key);
        const imgMaterial = entryVisualMaterial(match.entry, match.key);
        if (imgColor && colorClash(color, imgColor)) {
          colorMismatch.push({ slot, item, requestedColor: color, imageColor: imgColor, material, name, matchedKey: match.key });
        }
        if (imgMaterial && materialClash(material, imgMaterial)) {
          materialMismatch.push({ slot, item, color, requestedMaterial: material, imageMaterial: imgMaterial, name, matchedKey: match.key });
        }
      }
    }
  }
}

// ---- Roll up: collapse near-duplicates per slot+item type ------------------
function summarize(rows, label, keyFn) {
  const buckets = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!buckets.has(k)) buckets.set(k, { ...r, examples: new Set(), count: 0 });
    const b = buckets.get(k);
    b.count++;
    b.examples.add(r.name);
  }
  const out = [...buckets.values()].sort((a, b) => b.count - a.count);
  console.log(`\n=== ${label} (${out.length} unique buckets, ${rows.length} sample combos) ===`);
  for (const b of out) {
    const exs = [...b.examples].slice(0, 2).join("  |  ");
    console.log(`  [${b.slot}] ${JSON.stringify({ ...b, examples: undefined, count: b.count })}\n    e.g. ${exs}`);
  }
  return out;
}

console.log(`\nTotal sampled combos: ${total} (deduped: ${seen.size})`);

const noMatchBuckets = summarize(
  noMatch,
  "A. NO MATCH — falls back to generic catalog image",
  (r) => `${r.slot}|${r.item}|${r.material}`
);

const colorMismatchBuckets = summarize(
  colorMismatch,
  "B. COLOR MISMATCH — matched entry's image is the wrong color",
  (r) => `${r.slot}|${r.item}|${r.requestedColor}->${r.imageColor}`
);

const materialMismatchBuckets = summarize(
  materialMismatch,
  "C. MATERIAL MISMATCH — matched entry's image is the wrong material",
  (r) => `${r.slot}|${r.item}|${r.requestedMaterial}->${r.imageMaterial}`
);

const lowScoreBuckets = summarize(
  lowScore,
  "D. WEAK MATCH — matched but score ≤ 3 (likely a stretched fit)",
  (r) => `${r.slot}|${r.item}|->${r.key}`
);

// Save machine-readable report next to this script
const out = {
  generatedAt: new Date().toISOString(),
  totalCombos: total,
  uniqueCombos: seen.size,
  catalogSize: Object.keys(STOCK_IMAGE_CATALOG).length,
  buckets: {
    noMatch: noMatchBuckets.map((b) => ({ ...b, examples: [...b.examples].slice(0, 3) })),
    colorMismatch: colorMismatchBuckets.map((b) => ({ ...b, examples: [...b.examples].slice(0, 3) })),
    materialMismatch: materialMismatchBuckets.map((b) => ({ ...b, examples: [...b.examples].slice(0, 3) })),
    lowScore: lowScoreBuckets.map((b) => ({ ...b, examples: [...b.examples].slice(0, 3) })),
  },
};
fs.writeFileSync(path.join(__dirname, "report.json"), JSON.stringify(out, null, 2));
console.log(`\n[audit] wrote ${path.join(__dirname, "report.json")}`);
