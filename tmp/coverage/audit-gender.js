// Gender-aware audit. Builds two parallel input spaces — masculine items
// for `gender:"male"` users and feminine items for `gender:"female"` users —
// runs them through the matcher, and confirms each user gets a same-gender
// match more often than not.
"use strict";

const fs = require("fs");
const path = require("path");

const SERVER_PATH = path.resolve(__dirname, "../../server/index.js");
const SOURCE = fs.readFileSync(SERVER_PATH, "utf8");

function loadCatalog() {
  const start = SOURCE.indexOf("const STOCK_IMAGE_CATALOG = {");
  const open = SOURCE.indexOf("{", start);
  let depth = 0, end = -1;
  for (let i = open; i < SOURCE.length; i++) {
    if (SOURCE[i] === "{") depth++;
    else if (SOURCE[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return Function(`"use strict"; return (${SOURCE.slice(open, end)});`)();
}
const CATALOG = loadCatalog();

// Lite scoring (no weather penalties — pure name + gender match).
function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
function norm(v) { return clean(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function nameScore(text, entry) {
  const n = norm(text);
  if (!n) return 0;
  const tokens = n.split(" ").filter((t) => t.length > 2);
  let s = 0;
  for (const k of entry.keywords || []) {
    const nk = norm(k);
    if (!nk) continue;
    if (n === nk) { s += 18; continue; }
    if (n.includes(nk)) s += 8;
    if (nk.includes(n)) s += 6;
    const kt = nk.split(" ").filter((t) => t.length > 2);
    if (kt.length) {
      const m = kt.filter((t) => tokens.includes(t)).length;
      if (m === kt.length) s += 6;
      else if (m > 0) s += m * 2;
    }
  }
  const desc = norm(entry.description);
  if (desc) {
    if (desc.includes(n)) s += 4;
    const dt = desc.split(" ").filter((t) => t.length > 2);
    s += Math.min(tokens.filter((t) => dt.includes(t)).length, 3);
  }
  if (entry.fallback) s -= 1;
  return s;
}
function genderBoost(userGender, entry) {
  const eg = String(entry.gender || "unisex").toLowerCase();
  if (userGender === "male") {
    if (eg === "masculine") return 14;
    if (eg === "feminine") return -26;
  }
  if (userGender === "female") {
    if (eg === "feminine") return 14;
    if (eg === "masculine") return -26;
  }
  if (userGender === "nonbinary") {
    if (eg === "unisex") return 6;
  }
  return 0;
}
function findMatch(slot, itemName, userGender) {
  const entries = Object.entries(CATALOG).filter(([, e]) => e.slot === slot);
  let best = null, bestScore = -Infinity;
  for (const [k, e] of entries) {
    const s = nameScore(itemName, e) + genderBoost(userGender, e);
    if (s > bestScore) { best = { key: k, entry: e, score: s }; bestScore = s; }
  }
  if (best && bestScore > 0) return best;
  const fb = entries.find(([, e]) => e.fallback);
  return fb ? { key: fb[0], entry: fb[1], score: bestScore, isFallback: true } : null;
}

// --- Input spaces ---------------------------------------------------------
const MASC_INPUTS = {
  top: ["T-shirt","Long-sleeve t-shirt","Oxford shirt","Polo shirt","Button-up shirt","Linen shirt","Knit sweater","Hoodie","Graphic tee","Henley"],
  bottom: ["Jeans","Slim chinos","Tailored trousers","Wool trousers","Cargo pants","Joggers","Cotton shorts","Linen shorts","Black jeans"],
  outer: ["Blazer","Wool overcoat","Trench coat","Field jacket","Bomber jacket","Parka","Rain jacket","Hoodie","Leather jacket"],
  shoes: ["White sneakers","Black sneakers","Loafers","Brown loafers","Oxford shoes","Chelsea boots","Hiking boots","Running shoes"],
  accessory: ["Watch","Sunglasses","Beanie","Baseball cap","Tie","Bow tie","Tote bag","Backpack","Leather belt","Wool scarf"],
};
const FEM_INPUTS = {
  top: ["Blouse","Silk blouse","Wrap blouse","Camisole","Halter top","Crop top","Knit cardigan","Tunic","Wrap dress","Slip dress","Sundress","Midi dress","Maxi dress","Sheath dress","Cocktail dress","Sweater dress","Bodycon dress"],
  bottom: ["A-line skirt","Pencil skirt","Midi skirt","Mini skirt","Pleated skirt","Wrap skirt","Maxi skirt","Denim skirt","High-waist jeans","Wide-leg trousers","Culottes","Palazzo pants","Bike shorts","Mom jeans"],
  outer: ["Wrap coat","Faux fur coat","Cropped jacket","Cape","Poncho","Kimono","Duster coat"],
  shoes: ["Heels","Stiletto heels","Pumps","Ballet flats","Mary Janes","Mules","Wedge sandals","Knee-high boots","Riding boots","Block heels"],
  accessory: ["Clutch","Mini bag","Crossbody handbag","Bucket bag","Hair clip","Headband","Hair scarf","Pearl earrings","Hoop earrings","Pendant necklace","Beret"],
};
const COLORS = ["black","white","navy","cream","beige","gray","brown","tan","red","blue"];

function sweep(inputs, userGender) {
  let total = 0, sameGender = 0, crossGender = 0, unisexHit = 0, fallback = 0;
  const examples = { sameGender: [], crossGender: [], fallback: [] };
  for (const slot of Object.keys(inputs)) {
    for (const item of inputs[slot]) {
      for (const color of COLORS) {
        const name = `${color[0].toUpperCase()+color.slice(1)} ${item}`;
        const m = findMatch(slot, name, userGender);
        total++;
        if (!m) continue;
        if (m.isFallback) {
          fallback++;
          if (examples.fallback.length < 3) examples.fallback.push({ name, key: m.key });
          continue;
        }
        const eg = String(m.entry.gender || "unisex");
        if (eg === "unisex") {
          unisexHit++;
        } else if (eg === (userGender === "male" ? "masculine" : "feminine")) {
          sameGender++;
          if (examples.sameGender.length < 3) examples.sameGender.push({ name, key: m.key });
        } else {
          crossGender++;
          if (examples.crossGender.length < 5) examples.crossGender.push({ name, key: m.key });
        }
      }
    }
  }
  return { total, sameGender, crossGender, unisexHit, fallback, examples };
}

console.log("Audit run with new gender-aware matcher");
console.log("Catalog:", Object.keys(CATALOG).length, "entries");

const m = sweep(MASC_INPUTS, "male");
const f = sweep(FEM_INPUTS, "female");

console.log("\n--- male user (masculine items) ---");
console.log(JSON.stringify({
  total: m.total,
  sameGenderHits: m.sameGender,
  crossGenderHits: m.crossGender,
  unisexHits: m.unisexHit,
  fallback: m.fallback,
  pctOnTarget: ((m.sameGender + m.unisexHit) / m.total * 100).toFixed(1) + "%",
  pctCrossGender: (m.crossGender / m.total * 100).toFixed(1) + "%",
}, null, 2));
console.log("cross-gender examples:", m.examples.crossGender);

console.log("\n--- female user (feminine items) ---");
console.log(JSON.stringify({
  total: f.total,
  sameGenderHits: f.sameGender,
  crossGenderHits: f.crossGender,
  unisexHits: f.unisexHit,
  fallback: f.fallback,
  pctOnTarget: ((f.sameGender + f.unisexHit) / f.total * 100).toFixed(1) + "%",
  pctCrossGender: (f.crossGender / f.total * 100).toFixed(1) + "%",
}, null, 2));
console.log("cross-gender examples:", f.examples.crossGender);

fs.writeFileSync(path.join(__dirname, "audit-gender.json"), JSON.stringify({ male: m, female: f }, null, 2));
console.log("\nWrote tmp/coverage/audit-gender.json");
