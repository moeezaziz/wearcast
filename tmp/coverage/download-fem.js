// Feminine-catalog Commons downloader. Reuses the same plumbing as
// download.js but uses manifest-fem.json (with pre-built women-biased
// queries) and a feminine-specific noun map for relevance checks.
"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "../..");
const ASSETS_DIR = path.join(ROOT, "www/assets/recommendation-stock");
const MANIFEST = require("./manifest-fem.json");

const REQUEST_DELAY_MS = 600;
const MIN_FILE_BYTES = 30 * 1024;
const MAX_DOWNLOAD_BYTES = 2_500_000;
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const UA = "WearCastCatalogAudit/0.1 (https://wearcast.fly.dev) sourcing-pass-fem";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function httpsGet(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA, ...(opts.headers || {}) } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return resolve(httpsGet(next, opts));
      }
      const chunks = [];
      let total = 0;
      res.on("data", (c) => {
        total += c.length;
        if (total > MAX_DOWNLOAD_BYTES) { req.destroy(new Error("too_large")); return; }
        chunks.push(c);
      });
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("timeout")));
  });
}

async function commonsSearch(query) {
  const u = new URL(COMMONS_API);
  u.searchParams.set("action", "query");
  u.searchParams.set("list", "search");
  u.searchParams.set("srsearch", `${query} filetype:bitmap|drawing`);
  u.searchParams.set("srnamespace", "6");
  u.searchParams.set("srlimit", "8");
  u.searchParams.set("format", "json");
  const { body } = await httpsGet(u.toString());
  const data = JSON.parse(body.toString("utf8"));
  return (data?.query?.search || []).map((r) => r.title);
}

async function commonsImageInfo(title) {
  const u = new URL(COMMONS_API);
  u.searchParams.set("action", "query");
  u.searchParams.set("titles", title);
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("iiprop", "url|size|mime|extmetadata");
  u.searchParams.set("format", "json");
  const { body } = await httpsGet(u.toString());
  const data = JSON.parse(body.toString("utf8"));
  const ii = Object.values(data?.query?.pages || {})[0]?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata || {};
  return {
    url: ii.url,
    width: ii.width,
    height: ii.height,
    mime: ii.mime,
    size: ii.size,
    license: meta.LicenseShortName?.value || meta.License?.value || "unknown",
    artist: (meta.Artist?.value || "").replace(/<[^>]+>/g, "").slice(0, 200),
    pageUrl: ii.descriptionurl || ii.descriptionshorturl || "",
  };
}

function isAcceptableImage(info) {
  if (!info || !/^image\//.test(info.mime)) return false;
  if (info.size && (info.size > MAX_DOWNLOAD_BYTES || info.size < 50_000)) return false;
  if (info.width && info.height) {
    const r = info.width / info.height;
    if (info.width < 360 || info.height < 360) return false;
    if (r < 0.45 || r > 2.2) return false;
  }
  return true;
}

// Feminine-item noun aliases for title relevance
function itemNouns(item) {
  const lower = item.toLowerCase();
  const map = {
    "blouse": ["blouse","top","shirt"],
    "silk blouse": ["blouse","top"],
    "wrap blouse": ["blouse","wrap"],
    "camisole": ["camisole","tank","top"],
    "halter top": ["halter","top"],
    "off-shoulder top": ["off-shoulder","off shoulder","top"],
    "crop top": ["crop top","top"],
    "bodysuit": ["bodysuit"],
    "tunic": ["tunic","kurta"],
    "knit cardigan": ["cardigan","knit"],
    "long cardigan": ["cardigan","duster"],
    "ruffled blouse": ["ruffle","blouse"],
    "peplum top": ["peplum","top"],
    "wrap dress": ["dress","wrap"],
    "slip dress": ["dress","slip"],
    "sundress": ["sundress","dress"],
    "midi dress": ["dress","midi"],
    "maxi dress": ["dress","maxi"],
    "mini dress": ["dress","mini"],
    "sheath dress": ["dress","sheath"],
    "shirtdress": ["shirtdress","dress"],
    "cocktail dress": ["dress","cocktail"],
    "sweater dress": ["dress","sweater"],
    "t-shirt dress": ["dress","t-shirt"],
    "bodycon dress": ["dress","bodycon"],
    "a-line skirt": ["skirt","a-line"],
    "pencil skirt": ["skirt","pencil"],
    "midi skirt": ["skirt","midi"],
    "mini skirt": ["skirt","mini"],
    "maxi skirt": ["skirt","maxi"],
    "pleated skirt": ["skirt","pleated"],
    "wrap skirt": ["skirt","wrap"],
    "denim skirt": ["skirt","denim"],
    "leather skirt": ["skirt","leather"],
    "tennis skirt": ["skirt","tennis"],
    "high-waist jeans": ["jeans","denim"],
    "mom jeans": ["jeans","denim"],
    "wide-leg trousers": ["trousers","pants"],
    "cigarette pants": ["trousers","pants","cigarette"],
    "capri pants": ["capri","pants"],
    "culottes": ["culottes","pants"],
    "palazzo pants": ["palazzo","pants"],
    "bike shorts": ["shorts","bike"],
    "wrap coat": ["coat","wrap"],
    "faux fur coat": ["coat","fur"],
    "cropped jacket": ["jacket","cropped"],
    "cape": ["cape","poncho"],
    "poncho": ["poncho","cape"],
    "kimono": ["kimono"],
    "duster coat": ["coat","duster"],
    "heels": ["heels","heel","shoe"],
    "stiletto heels": ["stiletto","heel"],
    "kitten heels": ["kitten","heel"],
    "block heels": ["block heel","heel"],
    "pumps": ["pump","heel"],
    "ballet flats": ["ballet","flat","ballerina"],
    "mary janes": ["mary jane"],
    "mules": ["mule"],
    "wedge sandals": ["wedge","sandal"],
    "strappy sandals": ["strappy","sandal"],
    "espadrille wedges": ["espadrille","wedge"],
    "knee-high boots": ["knee","boot"],
    "riding boots": ["riding","boot"],
    "clutch": ["clutch","bag"],
    "mini bag": ["mini bag","bag"],
    "hobo bag": ["hobo","bag"],
    "bucket bag": ["bucket","bag"],
    "crossbody handbag": ["crossbody","handbag","bag"],
    "hair clip": ["hair clip","barrette"],
    "headband": ["headband"],
    "hair scarf": ["scarf","kerchief"],
    "pearl earrings": ["pearl","earring"],
    "hoop earrings": ["hoop","earring"],
    "drop earrings": ["drop earring","earring"],
    "statement necklace": ["necklace","statement"],
    "pendant necklace": ["pendant","necklace"],
    "brooch": ["brooch"],
    "stacked bracelets": ["bracelet","stacked"],
    "charm bracelet": ["charm","bracelet"],
    "beret": ["beret"],
  };
  return map[lower] || [lower.split(/\s+/).pop()];
}
function titleMatchesItem(title, item) {
  const t = title.toLowerCase();
  return itemNouns(item).some((n) => t.includes(n));
}
const TITLE_BLOCKLIST = /(station|map|cathedral|church|train|aircraft|stamp|coat[ _]of[ _]arms|monument|sign[_ ]board|painting[ _]of|portrait[ _]of|book[ _]cover|cartoon|diagram|chart|graph|building|seal[ _]of|airport|library|museum[ _]of|hall|theatre|theater|palace)/i;

const log = [];
let downloaded = 0, skipped = 0, failed = 0;

async function processRow(row, idx, total) {
  const outName = path.basename(row.suggestedFilename);
  const outPath = path.join(ASSETS_DIR, outName);
  if (fs.existsSync(outPath)) {
    skipped++;
    log.push({ ...row, status: "exists", outPath });
    return;
  }
  // Order queries: most-specific first.
  const queries = [
    `${row.searchQuery}`,                                // women <color> <item> fashion
    `women ${row.item} ${row.color}`,
    `${row.item} ${row.color}`,
    `${row.item}`,
  ];
  let chosen = null;
  let attempted = [];
  for (const q of queries) {
    let titles = [];
    try { titles = await commonsSearch(q); } catch (err) {
      log.push({ ...row, status: "search_failed", query: q, error: err.message });
      continue;
    }
    for (const t of titles) {
      attempted.push(t);
      if (TITLE_BLOCKLIST.test(t)) continue;
      if (!titleMatchesItem(t, row.item)) continue;
      let info;
      try { info = await commonsImageInfo(t); } catch { info = null; }
      await sleep(REQUEST_DELAY_MS / 2);
      if (isAcceptableImage(info)) { chosen = { title: t, info, query: q }; break; }
    }
    if (chosen) break;
    await sleep(REQUEST_DELAY_MS);
  }
  if (!chosen) {
    failed++;
    log.push({ ...row, status: "no_candidate", attemptedTitles: attempted.slice(0, 6) });
    return;
  }
  let dl;
  try { dl = await httpsGet(chosen.info.url); } catch (err) {
    failed++;
    log.push({ ...row, status: "download_failed", title: chosen.title, error: err.message });
    return;
  }
  if (dl.status !== 200 || dl.body.length < MIN_FILE_BYTES) {
    failed++;
    log.push({ ...row, status: "download_bad", title: chosen.title, httpStatus: dl.status, bytes: dl.body.length });
    return;
  }
  fs.writeFileSync(outPath, dl.body);
  downloaded++;
  log.push({
    ...row,
    status: "ok",
    outPath: path.relative(ROOT, outPath),
    bytes: dl.body.length,
    source: chosen.info.url,
    sourcePage: chosen.info.pageUrl,
    license: chosen.info.license,
    attribution: chosen.info.artist,
    title: chosen.title,
    queryUsed: chosen.query,
  });
  process.stdout.write(`  [${idx + 1}/${total}] ${row.slot}/${row.item}/${row.color}  -> ${outName} (${chosen.info.license})\n`);
  await sleep(REQUEST_DELAY_MS);
}

(async () => {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  console.log(`Feminine queue: ${MANIFEST.length} rows`);
  for (let i = 0; i < MANIFEST.length; i++) {
    try { await processRow(MANIFEST[i], i, MANIFEST.length); }
    catch (err) {
      failed++;
      log.push({ ...MANIFEST[i], status: "exception", error: err.message });
    }
  }
  fs.writeFileSync(path.join(__dirname, "downloads-fem.json"), JSON.stringify(log, null, 2));
  const human = log.map((r) => {
    const base = `[${r.status}] ${r.slot}/${r.item}/${r.color}/${r.material}`;
    if (r.status === "ok") return `${base} -> ${r.outPath} (${(r.bytes/1024).toFixed(0)}kb, license=${r.license}, attr=${r.attribution || "n/a"}, src=${r.sourcePage})`;
    if (r.status === "exists") return `${base} skipped, already exists`;
    if (r.status === "no_candidate") return `${base} no acceptable candidate`;
    return `${base} ${r.error || r.httpStatus || ""}`;
  }).join("\n");
  fs.writeFileSync(path.join(__dirname, "downloads-fem.log"), human);
  console.log(`\nDone. ok=${downloaded} skipped=${skipped} failed=${failed}`);
  console.log(`Wrote downloads-fem.log + downloads-fem.json`);
})();
