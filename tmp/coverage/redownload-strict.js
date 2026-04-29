// Strict Commons re-download for the 317 missing entries.
// Filters tuned by analyzing which images the user kept vs deleted.
//
// Hard blocks (any one disqualifies a title):
//   - >= 1 comma                             (multi-item / descriptive)
//   - any 4-digit year 1700-2099             (vintage / historical)
//   - museum codes (MET, LACMA, V&A, AC195)  (heritage scans)
//   - personal names (capital-First Last)    (candid photos)
//   - military / govt / Flickr-Official      (uniform scans)
//   - paintings ("by ...", oil, acrylic)     (art history)
//   - dates / period (century, AD, BC, era)
//   - wearing / posing / selfie / wedding / bridal / dancer / model
//
// Bonus signals (preferred):
//   - "(drawing)", "(illustration)", "(svg)", "isolated", "studio"
//   - aspect ratio 0.75 - 1.35 (square-ish)
//   - file size 50KB - 1.5MB (avoid scans of books)
//   - title <= 70 chars (long titles = encyclopedia descriptions)
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "../..");
const ASSETS_DIR = path.join(ROOT, "www/assets/recommendation-stock");
const MISSING = require("./missing-after-cleanup.json");

const REQUEST_DELAY_MS = 600;
const MIN_FILE_BYTES = 50 * 1024;
const MAX_FILE_BYTES = 1_500_000;
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const UA = "WearCastCatalogAudit/0.2 (https://wearcast.fly.dev) strict-redownload";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA } }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode)) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return resolve(httpsGet(next));
      }
      const chunks = []; let total = 0;
      res.on("data", (c) => { total += c.length; if (total > 4_000_000) { req.destroy(new Error("too_large")); return; } chunks.push(c); });
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("timeout")));
  });
}
async function commonsSearch(query) {
  const u = new URL(COMMONS_API);
  u.searchParams.set("action","query"); u.searchParams.set("list","search");
  u.searchParams.set("srsearch", `${query} filetype:bitmap|drawing`);
  u.searchParams.set("srnamespace","6"); u.searchParams.set("srlimit","12");
  u.searchParams.set("format","json");
  const { body } = await httpsGet(u.toString());
  return JSON.parse(body.toString("utf8"))?.query?.search?.map(r=>r.title) || [];
}
async function commonsImageInfo(title) {
  const u = new URL(COMMONS_API);
  u.searchParams.set("action","query"); u.searchParams.set("titles", title);
  u.searchParams.set("prop","imageinfo");
  u.searchParams.set("iiprop","url|size|mime|extmetadata");
  u.searchParams.set("format","json");
  const { body } = await httpsGet(u.toString());
  const ii = Object.values(JSON.parse(body.toString("utf8"))?.query?.pages || {})[0]?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata || {};
  return {
    url: ii.url, width: ii.width, height: ii.height, mime: ii.mime, size: ii.size,
    license: meta.LicenseShortName?.value || "unknown",
    artist: (meta.Artist?.value || "").replace(/<[^>]+>/g, "").slice(0, 200),
    pageUrl: ii.descriptionurl || "",
  };
}

// --- HARD BLOCKLIST -------------------------------------------------------
const BLOCK = [
  /,/,                                            // commas → multi-item
  /\b(1[6-9]\d{2}|20\d{2})\b/,                    // years 1600-2099
  /\b(MET|LACMA|V&A|VandA|AM\s?\d|FindID|DPLA|MFA|WAG|RISD|FIDM|MIA)\b/i, // museum codes
  /\b(century|centuries|millennium|AD|BC|BCE|CE|medieval|baroque|victorian|edwardian|elizabethan|tudor|antique|antiquity|prehistoric|stone[- ]age|bronze[- ]age|iron[- ]age|dynasty|empire|kingdom of)\b/i, // historical
  /\bby\s+[A-Z][a-z]+\b/,                         // "by ArtistName" → painting
  /\b(painting|portrait|sculpture|effigy|figurine|fresco|mosaic|engraving|drawing of|woodcut|lithograph|etching|illustration of [A-Z])\b/i,
  /\b(wearing|posing|posed|stands|standing|walks|walking|sitting|seated|kneeling|leaning)\b/i, // person-centric
  /\b(selfie|model[- ]wearing|model wearing|fashion model|woman wearing|man wearing|girl wearing|boy wearing|woman in|man in|girl in|boy in|guy with)\b/i,
  /\b(wedding|bridal|prom|funeral|burial|tomb|grave|mummy|ceremonial|ceremonial dress|coronation|inauguration)\b/i,
  /\b(navy|army|air[- ]force|marines|naval|infantry|regiment|battalion|cavalry|squadron|division|corps|insignia|battle of|war of|conflict|combat|pilot|sailor|soldier|police|trooper|cadet)\b/i,
  /\b(flickr - official|official u\.?s\.?|public domain photo by|government photo)\b/i,
  /\b(volcanic|geological|geographic|tectonic|asteroid|nebula|galaxy|chromosome|specimen|fossil|botanical|zoology|anatomy|microscope)\b/i, // homonym disambiguation
  /\b(map[ _]of|seal[ _]of|coat[ _]of[ _]arms|emblem|crest|flag of)\b/i,
  /\b(stamp|postage|envelope|book[ _]cover|album[ _]cover|movie[ _]poster|playbill|theatre[ _]programme)\b/i,
  /\b(temple|shrine|church|cathedral|mosque|monastery|abbey|tomb|mausoleum|ruins|excavation|archaeological)\b/i,
  /\b(lego|figurine|puppet|doll|action figure|cartoon|caricature|cosplay|costume|mascot)\b/i,
  /\b(\.png|\.jpg|\.gif|\.svg)\b\s*$/i,            // strip filename extension when matching
  /\bpage\s+\d+\b/i,                               // book page scan
  /\([12]\d{3}\)/,                                 // (1948) etc.
];
const PERSON_NAME = /^File:[A-Z][a-z]+\s+[A-Z][a-z]+\b/;  // First Last at start

// --- RELEVANCE: title MUST contain the item noun -------------------------
function nounsFor(item) {
  const lower = item.toLowerCase();
  const map = {
    "blouse":["blouse","top","shirt"],
    "silk blouse":["blouse"],
    "wrap blouse":["blouse"],
    "ruffled blouse":["blouse","ruffle"],
    "camisole":["camisole","cami","tank"],
    "halter top":["halter"],
    "off-shoulder top":["off-shoulder"],
    "crop top":["crop top"],
    "bodysuit":["bodysuit"],
    "tunic":["tunic"],
    "knit cardigan":["cardigan"],
    "long cardigan":["cardigan","duster"],
    "peplum top":["peplum"],
    "wrap dress":["dress","wrap dress"],
    "slip dress":["slip dress"],
    "sundress":["sundress"],
    "midi dress":["midi dress"],
    "maxi dress":["maxi dress"],
    "mini dress":["mini dress"],
    "sheath dress":["sheath"],
    "shirtdress":["shirtdress"],
    "cocktail dress":["cocktail dress"],
    "sweater dress":["sweater dress"],
    "t-shirt dress":["t-shirt dress"],
    "bodycon dress":["bodycon"],
    "a-line skirt":["skirt"],
    "pencil skirt":["skirt","pencil"],
    "midi skirt":["skirt","midi"],
    "mini skirt":["skirt","mini"],
    "maxi skirt":["skirt","maxi"],
    "pleated skirt":["skirt","pleated"],
    "wrap skirt":["skirt","wrap"],
    "denim skirt":["skirt"],
    "leather skirt":["skirt"],
    "tennis skirt":["skirt"],
    "high-waist jeans":["jeans"],
    "mom jeans":["jeans"],
    "wide-leg trousers":["trousers"],
    "cigarette pants":["trousers","pants"],
    "capri pants":["capri","pants"],
    "culottes":["culottes"],
    "palazzo pants":["palazzo","pants"],
    "bike shorts":["shorts","cycling"],
    "wrap coat":["coat"],
    "faux fur coat":["coat","fur"],
    "cropped jacket":["jacket"],
    "cape":["cape"],
    "poncho":["poncho"],
    "kimono":["kimono"],
    "duster coat":["duster"],
    "heels":["heel","heels"],
    "stiletto heels":["stiletto","heel"],
    "kitten heels":["kitten heel"],
    "block heels":["block heel"],
    "pumps":["pump","pumps","heels"],
    "ballet flats":["ballet flat","ballerina"],
    "mary janes":["mary jane"],
    "mules":["mule"],
    "wedge sandals":["wedge","sandal"],
    "strappy sandals":["sandal"],
    "espadrille wedges":["espadrille"],
    "knee-high boots":["boots"],
    "riding boots":["boots"],
    "clutch":["clutch","handbag"],
    "mini bag":["bag","handbag"],
    "hobo bag":["hobo","bag"],
    "bucket bag":["bucket bag"],
    "crossbody handbag":["crossbody","handbag"],
    "hair clip":["barrette","hair pin"],
    "headband":["headband"],
    "hair scarf":["scarf"],
    "pearl earrings":["earring"],
    "hoop earrings":["earring"],
    "drop earrings":["earring"],
    "statement necklace":["necklace"],
    "pendant necklace":["necklace","pendant"],
    "brooch":["brooch"],
    "stacked bracelets":["bracelet"],
    "charm bracelet":["bracelet"],
    "beret":["beret"],
    // unisex items reused too
    "t-shirt":["t-shirt","tee","tshirt"],
    "long-sleeve t-shirt":["long sleeve","tee","t-shirt"],
    "polo shirt":["polo"],
    "button-up shirt":["button-up","oxford","collared shirt"],
    "linen shirt":["linen shirt","linen top"],
    "knit sweater":["sweater","jumper","pullover"],
    "hoodie":["hoodie"],
    "graphic tee":["graphic tee"],
    "henley":["henley"],
    "flannel shirt":["flannel"],
    "rugby shirt":["rugby"],
    "cardigan":["cardigan"],
    "mock-neck top":["mock"],
    "thermal base layer":["thermal"],
    "performance tee":["tee","performance"],
    "cashmere sweater":["sweater","cashmere"],
    "merino crewneck":["sweater","merino"],
    "wool turtleneck":["turtleneck"],
    "tank top":["tank top","tank"],
    "sweatshirt":["sweatshirt","crewneck"],
    "knit tee":["knit","tee"],
    "chambray shirt":["chambray"],
    "camp shirt":["camp shirt","linen shirt"],
    "long-sleeve linen shirt":["linen shirt"],
    "oxford shirt":["oxford"],
    "jeans":["jeans","denim"],
    "slim jeans":["jeans"],
    "relaxed jeans":["jeans"],
    "black jeans":["jeans"],
    "chinos":["chinos","khakis"],
    "slim chinos":["chinos"],
    "tailored trousers":["trousers"],
    "wool trousers":["trousers"],
    "lightweight chinos":["chinos"],
    "linen trousers":["linen trousers","linen pants"],
    "cargo pants":["cargo"],
    "joggers":["joggers"],
    "tech joggers":["joggers"],
    "athletic shorts":["shorts","athletic"],
    "running shorts":["running shorts"],
    "cotton shorts":["shorts","chino shorts"],
    "linen shorts":["linen shorts"],
    "denim shorts":["denim shorts","cutoff"],
    "leggings":["leggings"],
    "track pants":["track pants"],
    "pleated trousers":["trousers","pleated"],
    "corduroy pants":["corduroy"],
    "blazer":["blazer"],
    "tailored blazer":["blazer"],
    "lightweight blazer":["blazer"],
    "wool overcoat":["overcoat","topcoat"],
    "trench coat":["trench"],
    "parka":["parka"],
    "hooded parka":["parka","hood"],
    "insulated parka":["parka"],
    "down jacket":["down jacket","puffer"],
    "puffer jacket":["puffer"],
    "zip hoodie":["hoodie"],
    "overshirt":["overshirt","shacket"],
    "shacket":["shacket"],
    "denim jacket":["denim jacket","jean jacket"],
    "bomber jacket":["bomber"],
    "leather jacket":["leather jacket"],
    "field jacket":["field jacket"],
    "chore coat":["chore"],
    "windbreaker":["windbreaker"],
    "rain jacket":["rain jacket"],
    "shell jacket":["shell jacket"],
    "tech shell":["shell jacket","windbreaker"],
    "fleece jacket":["fleece"],
    "quilted vest":["vest","gilet"],
    "pea coat":["peacoat"],
    "duffle coat":["duffle"],
    "sneakers":["sneaker","trainer"],
    "white sneakers":["sneaker"],
    "black sneakers":["sneaker"],
    "canvas sneakers":["sneaker","canvas"],
    "leather sneakers":["sneaker","leather"],
    "running shoes":["running shoe"],
    "trail runners":["trail runner"],
    "performance runners":["running shoe"],
    "loafers":["loafer"],
    "penny loafers":["loafer"],
    "tassel loafers":["loafer","tassel"],
    "suede loafers":["loafer","suede"],
    "brown loafers":["loafer"],
    "oxford shoes":["oxford"],
    "derby shoes":["derby"],
    "brogues":["brogue"],
    "chelsea boots":["chelsea"],
    "chukka boots":["chukka"],
    "hiking boots":["hiking boot"],
    "winter boots":["winter boot"],
    "ankle boots":["ankle boot"],
    "combat boots":["combat boot"],
    "rain boots":["wellington","rain boot","rubber boot"],
    "espadrilles":["espadrille"],
    "boat shoes":["boat shoe"],
    "slip-ons":["slip-on","slip on"],
    "slides":["slide sandal","slide"],
    "sandals":["sandal"],
    "watch":["watch","wristwatch"],
    "sunglasses":["sunglass","eyewear"],
    "beanie":["beanie","watch cap"],
    "wool beanie":["beanie"],
    "baseball cap":["baseball cap","cap"],
    "sports cap":["cap"],
    "sun hat":["sun hat","wide brim"],
    "wide-brim hat":["wide brim"],
    "fedora":["fedora"],
    "bucket hat":["bucket hat"],
    "scarf":["scarf"],
    "wool scarf":["scarf"],
    "silk scarf":["silk scarf"],
    "pocket square":["pocket square"],
    "tie":["necktie","tie"],
    "bow tie":["bow tie","bowtie"],
    "belt":["belt"],
    "leather belt":["belt"],
    "tote bag":["tote"],
    "backpack":["backpack","rucksack"],
    "crossbody bag":["crossbody"],
    "belt bag":["belt bag","fanny pack"],
    "umbrella":["umbrella"],
    "compact umbrella":["umbrella"],
    "gloves":["glove"],
    "leather gloves":["leather glove"],
    "wool gloves":["wool glove"],
    "wool socks":["socks"],
    "necklace":["necklace"],
    "bracelet":["bracelet"],
  };
  return map[lower] || [lower.split(" ").pop()];
}
function relevanceOk(title, item) {
  const t = title.toLowerCase();
  return nounsFor(item).some((n) => t.includes(n));
}

function isAcceptable(info, title) {
  if (!info) return false;
  if (!/^image\//.test(info.mime)) return false;
  if (info.size && (info.size > MAX_FILE_BYTES || info.size < MIN_FILE_BYTES)) return false;
  if (!info.width || !info.height) return false;
  if (info.width < 360 || info.height < 360) return false;
  const r = info.width / info.height;
  if (r < 0.7 || r > 1.4) return false; // tighter aspect
  // Title length cap
  const cleanTitle = title.replace(/^File:/, "").replace(/\.[a-z]{3,4}$/i, "").trim();
  if (cleanTitle.length > 70) return false;
  // Personal name
  if (PERSON_NAME.test(title)) return false;
  return true;
}
function titleOK(title) {
  for (const re of BLOCK) if (re.test(title)) return false;
  return true;
}

// Reverse-engineer item/color from catalog key:
// pattern: "{slot}_{color}_{item-with-dashes}_{material}_(fem_)?v1"
function parseKey(k) {
  const parts = k.split("_");
  const slot = parts[0];
  const isFem = parts.includes("fem");
  const noFem = parts.filter(p => p !== "fem" && p !== "v1");
  // noFem is [slot, color, ...item, material]
  const color = noFem[1];
  const material = noFem[noFem.length - 1];
  const itemParts = noFem.slice(2, -1);
  const item = itemParts.join(" ").replace(/-/g, " ");
  return { slot, color, item, material, isFem };
}

const log = [];
let downloaded = 0, skipped = 0, failed = 0;

async function processRow(row, idx, total) {
  const outName = path.basename(row.path);
  const outPath = path.join(ASSETS_DIR, outName);
  if (fs.existsSync(outPath)) {
    skipped++;
    log.push({ key: row.key, status: "exists", outPath });
    return;
  }
  const parsed = parseKey(row.key);
  // Try: very specific → broad → drawing-specific
  const queries = [
    `${parsed.item} studio isolated`,
    `${parsed.color} ${parsed.item} ${parsed.material}`,
    `${parsed.item} ${parsed.color}`,
    `${parsed.item} drawing`,
    parsed.item,
  ];
  let chosen = null;
  for (const q of queries) {
    let titles;
    try { titles = await commonsSearch(q); } catch { continue; }
    for (const t of titles) {
      if (!titleOK(t)) continue;
      if (!relevanceOk(t, parsed.item)) continue;
      let info;
      try { info = await commonsImageInfo(t); } catch { info = null; }
      await sleep(REQUEST_DELAY_MS / 2);
      if (isAcceptable(info, t)) { chosen = { title: t, info, query: q, ...parsed }; break; }
    }
    if (chosen) break;
    await sleep(REQUEST_DELAY_MS);
  }
  if (!chosen) {
    failed++;
    log.push({ key: row.key, ...parsed, status: "no_candidate" });
    return;
  }
  let dl;
  try { dl = await httpsGet(chosen.info.url); } catch (err) {
    failed++;
    log.push({ key: row.key, status: "download_failed", error: err.message });
    return;
  }
  if (dl.status !== 200 || dl.body.length < MIN_FILE_BYTES) {
    failed++;
    log.push({ key: row.key, status: "download_bad", httpStatus: dl.status });
    return;
  }
  fs.writeFileSync(outPath, dl.body);
  downloaded++;
  log.push({
    key: row.key, ...parsed, status: "ok",
    outPath: path.relative(ROOT, outPath),
    bytes: dl.body.length,
    source: chosen.info.url,
    sourcePage: chosen.info.pageUrl,
    license: chosen.info.license,
    attribution: chosen.info.artist,
    title: chosen.title,
    queryUsed: chosen.query,
  });
  process.stdout.write(`  [${idx + 1}/${total}] ${parsed.slot}/${parsed.item}/${parsed.color}  -> ${outName} (${chosen.info.license})\n`);
  await sleep(REQUEST_DELAY_MS);
}

(async () => {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  console.log(`Strict re-download queue: ${MISSING.length} rows`);
  for (let i = 0; i < MISSING.length; i++) {
    try { await processRow(MISSING[i], i, MISSING.length); }
    catch (err) { failed++; log.push({ key: MISSING[i].key, status: "exception", error: err.message }); }
  }
  fs.writeFileSync(path.join(__dirname, "downloads-strict.json"), JSON.stringify(log, null, 2));
  console.log(`\nDone. ok=${downloaded} skipped=${skipped} failed=${failed}`);
})();
