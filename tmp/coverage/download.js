// Free-stock-image downloader for the WearCast catalog gaps.
//
// Source: Wikimedia Commons API (no API key required, all results have a
// declared license — we keep the metadata in downloads.log so the legal
// provenance is auditable). Limits to P0 + P1 by default to avoid wasting
// quota on niche items.
//
// Usage:  node tmp/coverage/download.js [P0|P1|P2|P3|all] [maxRows]
//
// What it writes:
//   www/assets/recommendation-stock/<suggestedFilename>   (the .jpg)
//   tmp/coverage/downloads.log                            (one row per attempt)
//   tmp/coverage/downloads.json                           (machine-readable)

"use strict";
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "../..");
const ASSETS_DIR = path.join(ROOT, "www/assets/recommendation-stock");
const MANIFEST = require("./manifest.json");

const TARGET_PRIORITY = (process.argv[2] || "P0,P1").split(",").map((s) => s.trim());
const MAX_ROWS = Number(process.argv[3]) || Infinity;
const REQUEST_DELAY_MS = 600;          // be polite to Commons (1.5 rps)
const MIN_FILE_BYTES = 8 * 1024;       // reject tiny / placeholder responses
const MAX_DOWNLOAD_BYTES = 2_500_000;  // skip > 2.5 MB originals

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const UA = "WearCastCatalogAudit/0.1 (https://wearcast.fly.dev) sourcing-pass";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function httpsGet(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA, ...(opts.headers || {}) } }, (res) => {
      // follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return resolve(httpsGet(next, opts));
      }
      const chunks = [];
      let total = 0;
      res.on("data", (c) => {
        total += c.length;
        if (total > MAX_DOWNLOAD_BYTES) {
          req.destroy(new Error("too_large"));
          return;
        }
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
  u.searchParams.set("srlimit", "5");
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
  const pages = data?.query?.pages || {};
  const page = Object.values(pages)[0];
  const ii = page?.imageinfo?.[0];
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
  if (!info) return false;
  if (!/^image\//.test(info.mime)) return false;
  if (info.size && info.size > MAX_DOWNLOAD_BYTES) return false;
  if (info.size && info.size < 50_000) return false;          // skip tiny thumbnails
  if (info.width && info.height) {
    const ratio = info.width / info.height;
    if (info.width < 360 || info.height < 360) return false;  // tighter than before
    if (ratio < 0.5 || ratio > 2.5) return false;
  }
  return true;
}

// Primary noun for an item name — the word the file title must mention.
function itemNouns(item) {
  const lower = item.toLowerCase();
  const last = lower.split(/\s+/).pop();
  // Strip plurals only naively — Commons titles use both forms.
  const stem = last.endsWith("s") && last.length > 3 ? last.slice(0, -1) : last;
  // Item-specific synonyms so we accept richer titles.
  const aliases = {
    "shirt": ["shirt"], "jacket": ["jacket","coat"], "coat": ["coat","jacket"],
    "hoodie": ["hoodie","hoody"], "loafer": ["loafer"], "boot": ["boot","boots"],
    "trouser": ["trouser","trousers","pant","pants","slacks"],
    "jeans": ["jeans","denim"], "chino": ["chino","chinos"],
    "sweater": ["sweater","jumper","pullover","knitwear","jersey"],
    "tee": ["tee","t-shirt","tshirt","shirt"], "t-shirt": ["t-shirt","tshirt","tee","shirt"],
    "polo": ["polo"], "cardigan": ["cardigan"],
    "henley": ["henley"], "tank": ["tank","singlet","vest"],
    "sneaker": ["sneaker","trainer","shoe"], "shoe": ["shoe","footwear","loafer","sneaker"],
    "trainer": ["trainer","sneaker","shoe"],
    "watch": ["watch","wristwatch"], "tie": ["tie","necktie"],
    "bag": ["bag","tote","backpack","handbag","shoulder bag"],
    "scarf": ["scarf","scarves"], "beanie": ["beanie","knit cap","tuque"],
    "cap": ["cap","hat"], "hat": ["hat","cap"],
    "umbrella": ["umbrella","parasol"],
    "vest": ["vest","gilet","waistcoat"],
    "blazer": ["blazer","suit jacket","sport coat"],
    "parka": ["parka","anorak"],
    "trenchcoat": ["trench","trenchcoat"], "overcoat": ["overcoat","topcoat"],
    "windbreaker": ["windbreaker","anorak","shell"],
    "fedora": ["fedora","trilby","felt hat"],
    "necklace": ["necklace","chain","pendant"],
    "bracelet": ["bracelet","bangle","cuff"],
    "leggings": ["leggings","tights"],
    "bowtie": ["bow tie","bowtie"],
  };
  return aliases[stem] || [stem, last];
}

function titleMatchesItem(title, item) {
  const t = title.toLowerCase();
  const nouns = itemNouns(item);
  return nouns.some((n) => t.includes(n));
}

// Reject titles that are obviously off-topic but happen to contain a colour
// or material word.
const TITLE_BLOCKLIST = /(station|map|building|cathedral|church|train|bus|aircraft|stamp|flag|coin|coat[ _]of[ _]arms|map[_ ]of|painting|portrait|monument|street[ _]sign|book[ _]cover|album[ _]cover|poster|logo|cartoon|diagram|illustration[ _]of|chart|graph|seal[ _]of)/i;
function titleAllowed(title) {
  return !TITLE_BLOCKLIST.test(title);
}

const log = [];
let downloaded = 0, skipped = 0, failed = 0;

async function processRow(row, idx, total) {
  if (!TARGET_PRIORITY.includes(row.priority)) return;
  if (downloaded + skipped + failed >= MAX_ROWS) return;
  const outName = path.basename(row.suggestedFilename);
  const outPath = path.join(ASSETS_DIR, outName);
  if (fs.existsSync(outPath)) {
    skipped++;
    log.push({ ...row, status: "exists", outPath });
    return;
  }
  // Build query variants — Commons matches better with concrete nouns first.
  const queries = [
    `${row.color} ${row.material} ${row.item}`,
    `${row.item} ${row.color}`,
    `${row.item}`,
  ];
  let chosen = null;
  let attemptedTitles = [];
  for (const q of queries) {
    let titles = [];
    try {
      titles = await commonsSearch(q);
    } catch (err) {
      log.push({ ...row, status: "search_failed", error: err.message, query: q });
      continue;
    }
    for (const t of titles) {
      attemptedTitles.push(t);
      if (!titleAllowed(t)) continue;
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
    log.push({ ...row, status: "no_candidate", attemptedTitles });
    return;
  }
  // Download
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
  // If it's not a JPEG, write the binary bytes anyway with the original
  // extension preserved (we keep the manifest filename .jpg for catalog
  // consistency — sharp / browsers handle whatever's inside).
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
  process.stdout.write(`  [${idx + 1}/${total}] ${row.priority} ${row.slot}/${row.item}/${row.color}  -> ${outName} (${chosen.info.license})\n`);
  await sleep(REQUEST_DELAY_MS);
}

(async () => {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  const queue = MANIFEST.filter((r) => TARGET_PRIORITY.includes(r.priority)).slice(0, MAX_ROWS);
  console.log(`Queue: ${queue.length} rows. Priorities=${TARGET_PRIORITY.join(",")}`);
  for (let i = 0; i < queue.length; i++) {
    try { await processRow(queue[i], i, queue.length); }
    catch (err) {
      failed++;
      log.push({ ...queue[i], status: "exception", error: err.message });
    }
  }
  fs.writeFileSync(path.join(__dirname, "downloads.json"), JSON.stringify(log, null, 2));
  const human = log.map((r) => {
    const base = `[${r.status}] ${r.priority || "-"} ${r.slot}/${r.item}/${r.color}/${r.material}`;
    if (r.status === "ok") return `${base} -> ${r.outPath} (${(r.bytes/1024).toFixed(0)}kb, license=${r.license}, attr=${r.attribution || "n/a"}, src=${r.sourcePage})`;
    if (r.status === "exists") return `${base} skipped, already exists`;
    if (r.status === "no_candidate") return `${base} no acceptable candidate from Commons`;
    return `${base} ${r.error || r.httpStatus || ""}`;
  }).join("\n");
  fs.writeFileSync(path.join(__dirname, "downloads.log"), human);
  console.log(`\nDone. ok=${downloaded} skipped=${skipped} failed=${failed}`);
  console.log(`Wrote tmp/coverage/downloads.log + downloads.json`);
})();
