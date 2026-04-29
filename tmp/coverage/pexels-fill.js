// Pexels-based fill for catalog entries currently using a generated SVG.
//
// Strategy:
//   - Read every catalog entry whose `path` ends in .svg
//   - For each, search Pexels with item-specific studio-biased queries
//   - Apply strict filters (no people, no off-topic, aspect 0.85-1.18)
//   - On success: download the medium-size photo, save next to the SVG with
//     a .jpg extension, and rewrite the catalog entry's `path` to point at
//     the new JPG. Keep the SVG file (acts as a future fallback).
//   - On failure (no good match): leave the SVG in place.
//
// Pexels API: https://www.pexels.com/api/documentation/
//   - Free tier: 200 req/hr, 20,000/mo
//   - We throttle to ~1 search/sec → 317 entries ≈ 6 min, well under cap
//   - License: free for commercial use, no attribution required, but we
//     credit photographers in credits.html voluntarily.
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");

// Tiny inline .env parser so we don't depend on dotenv being installed at root
function loadDotEnv(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnv(path.resolve(__dirname, "../../server/.env"));
const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error("PEXELS_API_KEY not set in server/.env. Aborting.");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "../..");
const STOCK = path.join(ROOT, "www/assets/recommendation-stock");
const SERVER = path.join(ROOT, "server/index.js");
const SEARCH_DELAY_MS = 1100;            // ~55/min, well under 200/hr
const DOWNLOAD_DELAY_MS = 200;
const MAX_DOWNLOAD_BYTES = 2_500_000;
const MIN_DOWNLOAD_BYTES = 30_000;

// ── Catalog read ─────────────────────────────────────────────────────────
const src = fs.readFileSync(SERVER, "utf8");
const start = src.indexOf("const STOCK_IMAGE_CATALOG = {");
const open = src.indexOf("{", start);
let depth = 0, end = -1;
for (let i = open; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
}
const catalog = Function(`"use strict"; return (${src.slice(open, end)});`)();

// Targets: every entry currently pointing at a .svg
const targets = Object.entries(catalog)
  .filter(([, e]) => e.path && e.path.endsWith(".svg"))
  .map(([key, e]) => ({ key, entry: e }));

console.log(`Pexels fill queue: ${targets.length} entries currently on SVG.`);

// ── HTTPS helpers ────────────────────────────────────────────────────────
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "WearCast/0.3", ...headers } }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode)) {
        res.resume();
        return resolve(httpsGet(new URL(res.headers.location, url).toString(), headers));
      }
      const chunks = []; let total = 0;
      res.on("data", (c) => { total += c.length; if (total > 4_000_000) { req.destroy(new Error("too_large")); return; } chunks.push(c); });
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("timeout")));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Pexels search ────────────────────────────────────────────────────────
async function pexelsSearch(query, perPage = 15) {
  const u = new URL("https://api.pexels.com/v1/search");
  u.searchParams.set("query", query);
  u.searchParams.set("per_page", String(perPage));
  u.searchParams.set("orientation", "square");
  u.searchParams.set("size", "medium");
  const { status, body } = await httpsGet(u.toString(), { Authorization: API_KEY });
  if (status !== 200) throw new Error(`pexels_http_${status}`);
  return JSON.parse(body.toString("utf8")).photos || [];
}

// ── Reverse-parse catalog key → search hints ─────────────────────────────
function parseKey(key, entry) {
  const slot = entry.slot;
  const noFemV1 = key.split("_").filter((p) => p !== "fem" && p !== "v1");
  const color = noFemV1[1];
  const material = noFemV1[noFemV1.length - 1];
  const item = noFemV1.slice(2, -1).join(" ").replace(/-/g, " ");
  return { slot, color, item, material, gender: entry.gender || "unisex" };
}

// ── Relevance / quality filter ───────────────────────────────────────────
function nounsFor(item) {
  const lower = item.toLowerCase();
  // Per-item set of nouns the alt/url slug must contain to be relevant.
  const map = {
    "blouse":["blouse","top","shirt"],
    "silk blouse":["blouse","silk","top"],
    "wrap blouse":["blouse","wrap"],
    "ruffled blouse":["blouse","ruffl"],
    "camisole":["camisole","cami","tank"],
    "halter top":["halter","top"],
    "off shoulder top":["shoulder","top","off-shoulder"],
    "off-shoulder top":["shoulder","top"],
    "crop top":["crop","top"],
    "bodysuit":["bodysuit","leotard"],
    "tunic":["tunic","top"],
    "knit cardigan":["cardigan","knit"],
    "long cardigan":["cardigan","long","duster"],
    "peplum top":["peplum","top"],
    "wrap dress":["dress","wrap"],
    "slip dress":["dress","slip"],
    "sundress":["sundress","dress","summer dress"],
    "midi dress":["dress","midi"],
    "maxi dress":["dress","maxi"],
    "mini dress":["dress","mini"],
    "sheath dress":["dress","sheath"],
    "shirtdress":["dress","shirtdress","shirt dress"],
    "cocktail dress":["dress","cocktail"],
    "sweater dress":["dress","sweater"],
    "t shirt dress":["dress","t-shirt","tee"],
    "bodycon dress":["dress","bodycon","fitted"],
    "a line skirt":["skirt"],
    "pencil skirt":["skirt","pencil"],
    "midi skirt":["skirt","midi"],
    "mini skirt":["skirt","mini"],
    "maxi skirt":["skirt","maxi"],
    "pleated skirt":["skirt","pleat"],
    "wrap skirt":["skirt","wrap"],
    "denim skirt":["skirt","denim"],
    "leather skirt":["skirt","leather"],
    "tennis skirt":["skirt","tennis"],
    "high waist jeans":["jeans","denim"],
    "mom jeans":["jeans","denim"],
    "wide leg trousers":["trouser","pant"],
    "cigarette pants":["trouser","pant"],
    "capri pants":["capri","pant"],
    "culottes":["culotte","pant"],
    "palazzo pants":["palazzo","pant"],
    "bike shorts":["shorts","cycling","bike"],
    "wrap coat":["coat","wrap"],
    "faux fur coat":["coat","fur"],
    "cropped jacket":["jacket","cropped"],
    "cape":["cape"],
    "poncho":["poncho"],
    "kimono":["kimono","robe"],
    "duster coat":["duster","coat"],
    "heels":["heel","high heel","shoe"],
    "stiletto heels":["stiletto","heel"],
    "kitten heels":["kitten","heel"],
    "block heels":["block","heel"],
    "pumps":["pump","heel","court shoe"],
    "ballet flats":["ballet","flat","ballerina"],
    "mary janes":["mary jane","flat"],
    "mules":["mule","slide"],
    "wedge sandals":["wedge","sandal"],
    "strappy sandals":["sandal","strappy"],
    "espadrille wedges":["espadrille","wedge"],
    "knee high boots":["boot","tall boot","knee"],
    "riding boots":["riding","boot"],
    "clutch":["clutch","bag","handbag"],
    "mini bag":["bag","mini","handbag"],
    "hobo bag":["hobo","bag"],
    "bucket bag":["bucket","bag"],
    "crossbody handbag":["crossbody","handbag","bag"],
    "hair clip":["hair clip","barrette","hair"],
    "headband":["headband","hair"],
    "hair scarf":["scarf","head","hair"],
    "pearl earrings":["pearl","earring"],
    "hoop earrings":["hoop","earring"],
    "drop earrings":["earring","drop"],
    "statement necklace":["necklace","statement"],
    "pendant necklace":["necklace","pendant"],
    "brooch":["brooch","pin"],
    "stacked bracelets":["bracelet","stacked"],
    "charm bracelet":["bracelet","charm"],
    "beret":["beret","hat"],
    // unisex
    "t shirt":["t-shirt","tee","tshirt"],
    "long sleeve t shirt":["t-shirt","tee","long sleeve"],
    "polo shirt":["polo"],
    "button up shirt":["button-up","button up","shirt","oxford"],
    "linen shirt":["linen","shirt"],
    "knit sweater":["sweater","jumper","pullover"],
    "hoodie":["hoodie"],
    "graphic tee":["t-shirt","graphic","tee"],
    "henley":["henley","shirt"],
    "flannel shirt":["flannel","shirt"],
    "rugby shirt":["rugby","shirt"],
    "cardigan":["cardigan"],
    "mock neck top":["mock","top","turtleneck"],
    "thermal base layer":["thermal","base","top"],
    "performance tee":["t-shirt","tee","performance"],
    "cashmere sweater":["sweater","cashmere"],
    "merino crewneck":["sweater","merino","crewneck"],
    "wool turtleneck":["turtleneck","sweater"],
    "tank top":["tank","top"],
    "sweatshirt":["sweatshirt","crewneck"],
    "knit tee":["tee","knit","top"],
    "chambray shirt":["chambray","shirt"],
    "camp shirt":["camp shirt","shirt","linen"],
    "long sleeve linen shirt":["linen","shirt","long sleeve"],
    "oxford shirt":["oxford","shirt"],
    "jeans":["jeans","denim"],
    "slim jeans":["jeans"],
    "relaxed jeans":["jeans"],
    "black jeans":["jeans"],
    "chinos":["chino","khaki","pant"],
    "slim chinos":["chino","pant"],
    "tailored trousers":["trouser","pant","tailored"],
    "wool trousers":["trouser","wool","pant"],
    "lightweight chinos":["chino","pant"],
    "linen trousers":["linen","trouser","pant"],
    "cargo pants":["cargo","pant"],
    "joggers":["jogger","pant","sweatpant"],
    "tech joggers":["jogger","pant"],
    "athletic shorts":["short","athletic"],
    "running shorts":["running","short"],
    "cotton shorts":["short","chino"],
    "linen shorts":["linen","short"],
    "denim shorts":["denim","short","cutoff"],
    "leggings":["legging"],
    "track pants":["track","pant"],
    "pleated trousers":["pleated","trouser","pant"],
    "corduroy pants":["corduroy","pant"],
    "blazer":["blazer","jacket"],
    "tailored blazer":["blazer"],
    "lightweight blazer":["blazer"],
    "wool overcoat":["overcoat","topcoat","coat"],
    "trench coat":["trench","coat"],
    "parka":["parka","coat"],
    "hooded parka":["parka","hood","coat"],
    "insulated parka":["parka","coat"],
    "down jacket":["down","jacket","puffer"],
    "puffer jacket":["puffer","jacket"],
    "zip hoodie":["hoodie","zip"],
    "overshirt":["overshirt","shacket","shirt"],
    "shacket":["shacket","shirt jacket"],
    "denim jacket":["denim","jacket","jean jacket"],
    "bomber jacket":["bomber","jacket"],
    "leather jacket":["leather","jacket"],
    "field jacket":["field","jacket"],
    "chore coat":["chore","coat","jacket"],
    "windbreaker":["windbreaker","jacket"],
    "rain jacket":["rain","jacket"],
    "shell jacket":["shell","jacket"],
    "tech shell":["shell","jacket"],
    "fleece jacket":["fleece","jacket"],
    "quilted vest":["vest","gilet","quilted"],
    "pea coat":["peacoat","pea coat","coat"],
    "duffle coat":["duffle","coat"],
    "sneakers":["sneaker","trainer","shoe"],
    "white sneakers":["sneaker","trainer"],
    "black sneakers":["sneaker","trainer"],
    "canvas sneakers":["sneaker","canvas"],
    "leather sneakers":["sneaker","leather"],
    "running shoes":["running","shoe","sneaker"],
    "trail runners":["trail","runner","shoe"],
    "performance runners":["running","shoe","sneaker"],
    "loafers":["loafer","shoe"],
    "penny loafers":["loafer","penny"],
    "tassel loafers":["loafer","tassel"],
    "suede loafers":["loafer","suede"],
    "brown loafers":["loafer","brown"],
    "oxford shoes":["oxford","shoe"],
    "derby shoes":["derby","shoe"],
    "brogues":["brogue","shoe"],
    "chelsea boots":["chelsea","boot"],
    "chukka boots":["chukka","boot"],
    "hiking boots":["hiking","boot"],
    "winter boots":["winter","boot"],
    "ankle boots":["ankle","boot"],
    "combat boots":["combat","boot"],
    "rain boots":["rain","boot","wellington"],
    "espadrilles":["espadrille","shoe"],
    "boat shoes":["boat","shoe"],
    "slip ons":["slip-on","slip on","shoe"],
    "slides":["slide","sandal"],
    "sandals":["sandal"],
    "watch":["watch","wristwatch"],
    "sunglasses":["sunglass","eyewear"],
    "beanie":["beanie","hat","watch cap"],
    "wool beanie":["beanie","hat"],
    "baseball cap":["baseball cap","cap","hat"],
    "sports cap":["cap","sport"],
    "sun hat":["sun hat","hat","wide brim"],
    "wide brim hat":["wide brim","hat"],
    "fedora":["fedora","hat"],
    "bucket hat":["bucket","hat"],
    "scarf":["scarf"],
    "wool scarf":["scarf","wool"],
    "silk scarf":["scarf","silk"],
    "pocket square":["pocket square"],
    "tie":["tie","necktie"],
    "bow tie":["bow tie","bowtie"],
    "belt":["belt"],
    "leather belt":["belt","leather"],
    "tote bag":["tote","bag"],
    "backpack":["backpack","rucksack"],
    "crossbody bag":["crossbody","bag"],
    "belt bag":["belt bag","fanny pack","waist"],
    "umbrella":["umbrella"],
    "compact umbrella":["umbrella","compact"],
    "gloves":["glove"],
    "leather gloves":["glove","leather"],
    "wool gloves":["glove","wool"],
    "wool socks":["sock"],
    "necklace":["necklace"],
    "bracelet":["bracelet"],
  };
  return map[lower] || [lower.split(" ").pop()];
}

// Score-based selection. Pexels's fashion catalog is people-heavy, so we
// score every candidate and pick the best — but require a real bar so that
// unmatched items keep their SVG (which is always on-brand and accurate).
const PRODUCT_BONUS = /\b(flat lay|flatlay|still life|isolated|product photography|displayed|display(ed)?\s+on|on white|on black|on a (?:plain|neutral|white|black|grey|gray) background|studio shot|product photo|merchandise|catalog|on a hanger|hanger|mannequin|table|surface|arrangement|arranged|composition|close[- ]up|detail shot|macro|laid out|laid on)\b/i;
const PERSON_PENALTY = /\b(woman|women|man|men|girl|girls|boy|boys|young|adult|female|male|person|people|model|gentleman|lady|ladies|anonymous|posing|portrait|standing|sitting|smiling|leaning|walking|outdoor|outside|street|park|in front of|by a wall|by a building|by the|holding|reaching|stretches|kneeling|seated|wearing|dressed|fashion shoot|fashion model|fashionable\s+(?:woman|man|girl|boy)|stylish\s+(?:woman|man|girl|boy)|squatting|posed)\b/i;
const HARD_OFFTOPIC = /\b(spider|insect|web|food|coffee|breakfast|landscape|sunset|sunrise|kitchen|fridge|cooking|recipe|laptop|phone|computer|keyboard|software|car|airplane|train|cathedral|church|building|map|globe|microscope|tool|hardware|nail|screw|electric|cable|tree|flower bouquet|wedding|bride|funeral|tomb|painting|drawing of|illustration of|camera|lens|dslr)\b/i;

function alt(photo) { return String(photo?.alt || "").toLowerCase(); }

function score(photo, item) {
  if (!photo || !photo.src) return -Infinity;
  const r = photo.width / photo.height;
  if (r < 0.7 || r > 1.45) return -Infinity;
  const a = alt(photo);
  if (HARD_OFFTOPIC.test(a)) return -Infinity;
  // Item noun MUST appear in alt text (not url — too noisy).
  const nouns = nounsFor(item);
  const nounMatches = nouns.filter((n) => a.includes(n)).length;
  if (nounMatches === 0) return -Infinity;
  let s = nounMatches * 5;
  if (PRODUCT_BONUS.test(a)) s += 14;
  if (PERSON_PENALTY.test(a)) s -= 18;
  if (r >= 0.92 && r <= 1.08) s += 4;
  if (a.length > 0 && a.length <= 60) s += 6;
  if (a.length > 140) s -= 4;
  // Bonus for top-3 search-rank position (Pexels's relevance):
  // we don't track rank here; caller can reward separately if needed.
  return s;
}
const MIN_SCORE = 8;

// ── Run ──────────────────────────────────────────────────────────────────
const log = [];
let downloaded = 0, noCandidate = 0, failed = 0;

(async () => {
  for (let i = 0; i < targets.length; i++) {
    const { key, entry } = targets[i];
    const parsed = parseKey(key, entry);
    // Tier the queries from most-product-biased to most-permissive. We
    // collect candidates from the first tier that returns ANY photo above
    // MIN_SCORE; otherwise we fall through.
    const queries = [
      `${parsed.item} flat lay`,
      `${parsed.item} on white background`,
      `${parsed.color} ${parsed.item} product`,
      `${parsed.item} isolated`,
      `${parsed.color} ${parsed.item}`,
      `${parsed.item}`,
    ];
    let chosen = null;
    let bestSeen = -Infinity;
    for (const q of queries) {
      let photos;
      try { photos = await pexelsSearch(q, 15); }
      catch (err) { log.push({ key, status: "search_failed", query: q, error: err.message }); break; }
      // Score every photo, take the best.
      let best = null; let bs = -Infinity;
      for (const p of photos) {
        const s = score(p, parsed.item);
        if (s > bs) { bs = s; best = p; }
      }
      if (bs > bestSeen) { bestSeen = bs; }
      if (best && bs >= MIN_SCORE) {
        chosen = { ...parsed, photo: best, query: q, score: bs };
        break;
      }
      await sleep(SEARCH_DELAY_MS);
    }
    if (!chosen) {
      noCandidate++;
      log.push({ key, ...parsed, status: "no_candidate" });
      continue;
    }
    // download medium-size jpg
    let dl;
    try { dl = await httpsGet(chosen.photo.src.medium); }
    catch (err) { failed++; log.push({ key, status: "download_failed", error: err.message }); continue; }
    if (dl.status !== 200 || dl.body.length < MIN_DOWNLOAD_BYTES || dl.body.length > MAX_DOWNLOAD_BYTES) {
      failed++; log.push({ key, status: "download_bad", httpStatus: dl.status, bytes: dl.body.length }); continue;
    }
    // write next to existing svg, with .jpg extension
    const outName = path.basename(entry.path).replace(/\.svg$/i, ".jpg");
    const outAbs = path.join(STOCK, outName);
    fs.writeFileSync(outAbs, dl.body);
    downloaded++;
    log.push({
      key, ...parsed, status: "ok",
      newPath: `assets/recommendation-stock/${outName}`,
      bytes: dl.body.length,
      photographer: chosen.photo.photographer,
      photographerUrl: chosen.photo.photographer_url,
      sourcePage: chosen.photo.url,
      alt: chosen.photo.alt,
      query: chosen.query,
    });
    process.stdout.write(`  [${i+1}/${targets.length}] ${parsed.slot}/${parsed.item}/${parsed.color}  -> ${outName}  (${chosen.photo.photographer})\n`);
    await sleep(DOWNLOAD_DELAY_MS);
  }
  fs.writeFileSync(path.join(__dirname, "downloads-pexels.json"), JSON.stringify(log, null, 2));
  console.log(`\nDone. ok=${downloaded} no_candidate=${noCandidate} failed=${failed}`);
})();
