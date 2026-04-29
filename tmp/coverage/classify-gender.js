// Classify every catalog entry as masculine | feminine | unisex.
//
// Sources of signal, strongest first:
//   1. Commons source title (downloads.json) — explicit "Men's...", "Women's...".
//   2. Catalog item type — silhouettes that are inherently gendered (skirt → F,
//      bow tie → M-leaning, bra → F, etc.).
//   3. Catalog keywords/description — same as above but weaker.
//   4. Default: "unisex".
//
// Outputs:
//   tmp/coverage/gender-tags.json   — { catalogKey: "masculine" | "feminine" | "unisex" }
//   tmp/coverage/gender-tags.md     — human-readable summary
"use strict";
const fs = require("fs");
const path = require("path");

const SERVER_PATH = path.resolve(__dirname, "../../server/index.js");
const SOURCE = fs.readFileSync(SERVER_PATH, "utf8");

// Pull catalog
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

// Map filename -> Commons source title (from downloads.json)
const downloads = require("./downloads.json");
const titleByFilename = {};
for (const r of downloads) {
  if (r.status !== "ok" || !r.outPath) continue;
  titleByFilename[path.basename(r.outPath)] = r.title || "";
}

// --- Heuristics ---------------------------------------------------------
// "dress" in fashion is dangerously ambiguous: "dress" garment is feminine,
// but "dress shirt / shoes / pants / code" are masculine formalwear. We
// match it only when it's a standalone noun, not a compound modifier.
const STANDALONE_DRESS = /(?<![- ])(?:^|\s)(?:a |the )?(?:wrap|slip|midi|maxi|mini|sun|cocktail|sheath|shift|tea|halter|bodycon|sundress|sundresses)?\s*dresses?\b(?!\s+(?:shirt|shoes|pants|trousers|code|down))/i;

const MASC_PATTERNS = [
  /\b(men's|mens|man's|gentleman|gentlemen|menswear)\b/i,
  /\b(necktie|bow[- ]?tie|tuxedo|cummerbund|pocket square)\b/i,
  /\b(suit jacket|sport coat|tailcoat|frock coat|smoking jacket)\b/i,
  /\b(boxer (?:short|brief)|jockstrap)\b/i,
  /\b(beard|moustache)\b/i,
];
const FEM_PATTERNS = [
  /\b(women's|womens|woman's|ladies|lady's|girls'?|womenswear|female fashion)\b/i,
  /\b(skirt|skirts|blouse|blouses|gown|gowns|bodice|corset|camisole|chemise|petticoat|tunic[- ]dress)\b/i,
  /\b(stiletto|kitten heel|ballet flat|ballerina flat|mary jane|d'orsay|peep[- ]?toe|sling[- ]?back|espadrille wedge|court shoe)\b/i,
  /\b(bra|bralette|bustier|babydoll|bodysuit|leotard|jumpsuit|romper|playsuit)\b/i,
  /\b(handbag|clutch bag|hobo bag|crossbody handbag)\b/i,
  /\b(earring|brooch|hair clip|hair pin|tiara|headband|hair band|barrette|scrunchie)\b/i,
  /\b(maternity|breastfeeding)\b/i,
];

// Item-type rules — these run BEFORE generic title/text matching so that an
// inherently-gendered silhouette is classified by its silhouette, not by
// noisy words in the source title (e.g. "Suit, hat and blouse" would
// wrongly tag a bow tie as feminine via the word "blouse").
const ITEM_TYPE_RULES = [
  // Strongly feminine silhouettes (clothing items women predominantly wear)
  { match: /\b(skirt|skirts)\b/i, gender: "feminine" },
  { match: /\b(blouse|blouses)\b/i, gender: "feminine" },
  { match: /\b(gown|gowns)\b/i, gender: "feminine" },
  { match: /\b(bodice|corset|camisole|chemise)\b/i, gender: "feminine" },
  { match: STANDALONE_DRESS, gender: "feminine" },
  { match: /\b(stiletto|kitten heel|mary jane|d'orsay|peep[- ]?toe|sling[- ]?back)\b/i, gender: "feminine" },
  { match: /\b(ballet flat|ballerina flat|court shoe)\b/i, gender: "feminine" },
  // Strongly masculine silhouettes
  { match: /\b(necktie|neckties|bow[- ]?tie)\b/i, gender: "masculine" },
  { match: /\b(tuxedo|tailcoat|cummerbund|pocket square|smoking jacket)\b/i, gender: "masculine" },
  // Note: blazer / suit / oxford shirt / tailored trousers / loafers / dress
  // shoes are NOT in this list because in 2025 fashion they're worn across
  // genders. The catalog tag stays "unisex" unless the source title
  // explicitly says "Men's"/"Women's".
];

// Commons titles in military / uniform contexts use "blouse", "skirt",
// "dress" etc. as jargon — exclude these from feminine matching.
const MILITARY_CONTEXT = /\b(uniform|army|navy|military|infantry|insignia|regiment|battalion|cavalry|bersaglieri|ww2|world war|signals corps|corps|officer)\b/i;

function classifyEntry(key, entry) {
  const filename = path.basename(entry.path || "");
  const title = titleByFilename[filename] || "";
  // Catalog-only haystack (excludes Commons title, which can mislead).
  const catalogText = `${entry.description || ""} ${(entry.keywords || []).join(" ")} ${key}`;
  const fullHaystack = `${title} ${catalogText}`;
  const titleIsMilitary = title && MILITARY_CONTEXT.test(title);

  // 1. Item-type rules first — most reliable. Apply to catalog text.
  for (const rule of ITEM_TYPE_RULES) {
    if (rule.match.test(catalogText)) return { gender: rule.gender, reason: `item_type:${rule.match.source.slice(0,40)}` };
  }
  // 2. Explicit "Men's" / "Women's" in Commons title (military titles excluded
  //    from feminine because "blouse"/"skirt"/"dress" are army-uniform jargon).
  if (title) {
    for (const p of MASC_PATTERNS) if (p.test(title)) return { gender: "masculine", reason: `title:${p.source.slice(0,40)}` };
    if (!titleIsMilitary) {
      for (const p of FEM_PATTERNS) if (p.test(title)) return { gender: "feminine", reason: `title:${p.source.slice(0,40)}` };
    }
  }
  // 3. Soft signals on full haystack.
  for (const p of MASC_PATTERNS) if (p.test(fullHaystack)) return { gender: "masculine", reason: `text:${p.source.slice(0,40)}` };
  if (!titleIsMilitary) {
    for (const p of FEM_PATTERNS) if (p.test(fullHaystack)) return { gender: "feminine", reason: `text:${p.source.slice(0,40)}` };
  }
  return { gender: "unisex", reason: "default" };
}

const tags = {};
const reasonByKey = {};
const counts = { masculine: 0, feminine: 0, unisex: 0 };
const samplesByGender = { masculine: [], feminine: [], unisex: [] };

for (const [key, entry] of Object.entries(CATALOG)) {
  const { gender, reason } = classifyEntry(key, entry);
  tags[key] = gender;
  reasonByKey[key] = reason;
  counts[gender]++;
  if (samplesByGender[gender].length < 8) samplesByGender[gender].push({ key, slot: entry.slot, title: titleByFilename[path.basename(entry.path)] || "", reason });
}

console.log("Gender classification of catalog:");
console.log("  Catalog size:", Object.keys(CATALOG).length);
console.log("  Counts:", counts);
console.log("\nSample masculine:");
samplesByGender.masculine.forEach((s) => console.log(`  [${s.slot}] ${s.key}  -- ${s.reason}`));
console.log("\nSample feminine:");
samplesByGender.feminine.forEach((s) => console.log(`  [${s.slot}] ${s.key}  -- ${s.reason}`));
console.log("\nSample unisex:");
samplesByGender.unisex.forEach((s) => console.log(`  [${s.slot}] ${s.key}  -- ${s.reason}`));

fs.writeFileSync(path.join(__dirname, "gender-tags.json"), JSON.stringify({ tags, counts, reasons: reasonByKey }, null, 2));
const md = ["# Catalog gender classification","",`Catalog size: ${Object.keys(CATALOG).length}`,`Counts: ${JSON.stringify(counts)}`,""];
for (const g of ["feminine","masculine","unisex"]) {
  md.push(`## ${g} (${counts[g]})`);
  for (const [k] of Object.entries(tags).filter(([, v]) => v === g)) {
    md.push(`- ${k}  — ${reasonByKey[k]}`);
  }
  md.push("");
}
fs.writeFileSync(path.join(__dirname, "gender-tags.md"), md.join("\n"));
console.log("\nWrote tmp/coverage/gender-tags.json + gender-tags.md");
