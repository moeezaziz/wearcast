"use strict";

// Fill missing recommendation-stock assets from Pexels with strict product/studio filters.
//
// Usage:
//   node tmp/coverage/pexels-missing-fill.js [maxRows]
//
// Reads:
//   tmp/coverage/missing-after-cleanup.json
//   server/.env (PEXELS_API_KEY)
//
// Writes accepted images to:
//   www/assets/recommendation-stock/*-studio.jpg
//
// Also patches server/index.js catalog paths for accepted entries and writes:
//   tmp/coverage/downloads-pexels-missing.json

const fs = require("fs");
const path = require("path");
const https = require("https");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const ROOT = path.resolve(__dirname, "../..");
const STOCK_DIR = path.join(ROOT, "www/assets/recommendation-stock");
const SERVER_FILE = path.join(ROOT, "server/index.js");
const MISSING_FILE = path.join(__dirname, "missing-after-cleanup.json");
const LOG_FILE = path.join(__dirname, "downloads-pexels-missing.json");

loadDotEnv(path.join(ROOT, "server/.env"));

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error("PEXELS_API_KEY is missing. Add it to server/.env first.");
  process.exit(1);
}

const requestedMaxRows = Number(process.argv[2]);
const MAX_ROWS = Number.isFinite(requestedMaxRows) ? requestedMaxRows : Infinity;
const RETRY_REJECTS = process.env.RETRY_REJECTS === "1";
const SEARCH_DELAY_MS = 1250;
const DOWNLOAD_DELAY_MS = 200;
const MIN_BYTES = 25_000;
const MAX_BYTES = 2_800_000;
const UA = "WearCast/0.4 recommendation-stock-fill";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA, ...headers } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        return resolve(httpsGet(new URL(res.headers.location, url).toString(), headers));
      }
      const chunks = [];
      let total = 0;
      res.on("data", (chunk) => {
        total += chunk.length;
        if (total > 5_000_000) {
          req.destroy(new Error("too_large"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks),
        headers: res.headers,
      }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20_000, () => req.destroy(new Error("timeout")));
  });
}

async function pexelsSearch(query, perPage = 30) {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "square");
  url.searchParams.set("size", "medium");
  const response = await httpsGet(url.toString(), { Authorization: API_KEY });
  if (response.status !== 200) {
    throw new Error(`pexels_http_${response.status}:${response.body.toString("utf8").slice(0, 160)}`);
  }
  return (JSON.parse(response.body.toString("utf8")).photos || []).map((photo) => ({
    provider: "pexels",
    id: photo.id,
    width: photo.width,
    height: photo.height,
    text: photo.alt || "",
    imageUrl: photo.src?.large || photo.src?.medium,
    pageUrl: photo.url,
    creator: photo.photographer,
    creatorUrl: photo.photographer_url,
    license: "Pexels License",
    raw: photo,
  }));
}

async function openverseSearch(query, pageSize = 30) {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(pageSize));
  url.searchParams.set("license_type", "commercial");
  url.searchParams.set("mature", "false");
  const response = await httpsGet(url.toString());
  if (response.status !== 200) {
    throw new Error(`openverse_http_${response.status}:${response.body.toString("utf8").slice(0, 160)}`);
  }
  return (JSON.parse(response.body.toString("utf8")).results || []).map((result) => ({
    provider: `openverse:${result.source || "unknown"}`,
    id: result.id,
    width: result.width,
    height: result.height,
    text: [result.title, result.description, result.tags?.map?.((tag) => tag.name).join(" ")].filter(Boolean).join(" "),
    imageUrl: result.url,
    pageUrl: result.foreign_landing_url || result.url,
    creator: result.creator,
    creatorUrl: result.creator_url,
    license: [result.license, result.license_version].filter(Boolean).join(" "),
    raw: result,
  }));
}

async function commonsSearch(query, pageSize = 30) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", String(pageSize));
  url.searchParams.set("gsrsearch", `${query} filetype:bitmap`);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|mime|extmetadata");
  const response = await httpsGet(url.toString());
  if (response.status !== 200) {
    throw new Error(`commons_http_${response.status}:${response.body.toString("utf8").slice(0, 160)}`);
  }
  const pages = Object.values(JSON.parse(response.body.toString("utf8")).query?.pages || {});
  return pages
    .map((page) => {
      const image = page.imageinfo?.[0];
      const meta = image?.extmetadata || {};
      const title = String(page.title || "").replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "");
      const description = [meta.ImageDescription?.value, meta.ObjectName?.value]
        .filter(Boolean)
        .join(" ")
        .replace(/<[^>]+>/g, " ");
      return {
        provider: "commons",
        id: page.pageid,
        width: image?.width,
        height: image?.height,
        text: [title, description, meta.Categories?.value].filter(Boolean).join(" "),
        imageUrl: image?.url,
        pageUrl: image?.descriptionurl,
        creator: meta.Artist?.value?.replace?.(/<[^>]+>/g, " "),
        creatorUrl: image?.descriptionurl,
        license: [meta.LicenseShortName?.value, meta.UsageTerms?.value].filter(Boolean).join(" "),
        mime: image?.mime,
        raw: page,
      };
    })
    .filter((result) => result.mime === "image/jpeg");
}

function cleanToken(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\bv1\b|\bfem\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MATERIALS = new Set([
  "acetate", "canvas", "cashmere", "cotton", "denim", "down", "gold", "jersey",
  "leather", "linen", "mesh", "metal", "merino", "pearl", "rubber", "silk",
  "silver", "tech", "wool",
]);
const COLORS = new Set([
  "beige", "black", "blue", "brown", "camel", "charcoal", "cream", "floral",
  "gold", "gray", "green", "grey", "khaki", "magenta", "navy", "nude", "olive",
  "pattern", "pearl", "red", "rust", "silver", "tan", "tortoiseshell", "white",
  "yellow",
]);

function parseMissingRow(row) {
  const parts = String(row.key || "")
    .replace(/_v1$/, "")
    .replace(/_fem$/, "")
    .split("_")
    .filter(Boolean);
  const slot = row.slot || parts[0] || "";
  if (parts[0] === slot) parts.shift();
  const color = COLORS.has(parts[0]) ? parts.shift() : "";
  const descriptorWords = new Set(["studio", "warm", "hanger", "polished", "outdoors", "minimal", "stack"]);
  while (descriptorWords.has(parts[parts.length - 1])) parts.pop();
  const maybeMaterial = parts[parts.length - 1] || "";
  const material = MATERIALS.has(maybeMaterial) ? parts.pop() : "";
  const item = cleanToken(parts.join(" "))
    .replace(/\btshirt\b/g, "t-shirt")
    .replace(/\bt shirt\b/g, "t-shirt")
    .replace(/\blong sleeve\b/g, "long-sleeve")
    .replace(/\boff shoulder\b/g, "off-shoulder")
    .replace(/\ba line\b/g, "a-line")
    .replace(/\bhigh waist\b/g, "high-waist")
    .replace(/\bwide leg\b/g, "wide-leg")
    .replace(/\bknee high\b/g, "knee-high");
  return { slot, color, material, item, gender: row.gender || "unisex" };
}

const NOUNS = {
  "a-line skirt": ["skirt"],
  "ankle boots": ["boot", "boots"],
  "backpack": ["backpack"],
  "baseball cap": ["baseball cap"],
  "belt": ["belt"],
  "bike shorts": ["shorts"],
  "blouse": ["blouse", "top"],
  "bodycon dress": ["dress"],
  "bodysuit": ["bodysuit"],
  "bomber jacket": ["bomber", "jacket"],
  "bow tie": ["bow tie", "bowtie"],
  "bracelet": ["bracelet", "bangle"],
  "brooch": ["brooch", "pin"],
  "bucket bag": ["bucket bag", "bag", "handbag"],
  "button up shirt": ["shirt", "button"],
  "button-up shirt": ["shirt", "button"],
  "cape": ["cape"],
  "capri pants": ["capri", "pants", "trousers"],
  "cardigan": ["cardigan"],
  "chinos": ["chinos", "pants", "trousers"],
  "cigarette pants": ["pants", "trousers"],
  "clutch": ["clutch", "bag"],
  "cocktail dress": ["dress"],
  "crop top": ["crop top", "top"],
  "culottes": ["culottes", "pants"],
  "denim skirt": ["skirt", "denim"],
  "drop earrings": ["earring", "earrings"],
  "duster coat": ["duster", "coat"],
  "field jacket": ["field jacket", "jacket"],
  "gloves": ["glove", "gloves"],
  "graphic tee": ["graphic tee", "t-shirt", "tee"],
  "halter top": ["halter", "top"],
  "hair clip": ["hair clip", "barrette", "clip"],
  "hair scarf": ["scarf"],
  "headband": ["headband"],
  "heels": ["heels", "heel", "shoe"],
  "high-waist jeans": ["jeans", "denim"],
  "hobo bag": ["hobo bag", "bag", "handbag"],
  "hooded parka": ["parka", "coat"],
  "hoodie": ["hoodie", "sweatshirt"],
  "joggers": ["joggers", "pants"],
  "kimono": ["kimono"],
  "knee-high boots": ["boot", "boots"],
  "kitten heels": ["heels", "shoe"],
  "knit cardigan": ["cardigan"],
  "knit tee": ["knit", "tee", "t-shirt"],
  "leather skirt": ["skirt"],
  "linen shirt": ["linen shirt", "shirt"],
  "linen trousers": ["trousers", "pants"],
  "loafers": ["loafer", "loafers", "shoe"],
  "long cardigan": ["cardigan"],
  "long-sleeve t-shirt": ["t-shirt", "shirt", "tee"],
  "maxi dress": ["dress"],
  "maxi skirt": ["skirt"],
  "midi skirt": ["skirt"],
  "mini bag": ["bag", "handbag"],
  "mini dress": ["dress"],
  "mini skirt": ["skirt"],
  "mules": ["mules", "shoe"],
  "off-shoulder top": ["top"],
  "palazzo pants": ["palazzo", "pants", "trousers"],
  "parka": ["parka", "coat"],
  "pea coat": ["pea coat", "peacoat", "coat"],
  "pearl earrings": ["earring", "earrings", "pearl"],
  "pencil skirt": ["skirt"],
  "pendant necklace": ["necklace", "pendant"],
  "pleated skirt": ["skirt"],
  "polo shirt": ["polo", "shirt"],
  "polo": ["polo", "shirt"],
  "poncho": ["poncho"],
  "pumps": ["pumps", "heels", "shoe"],
  "rain jacket": ["rain jacket", "jacket"],
  "riding boots": ["boot", "boots"],
  "ruffled blouse": ["blouse", "top"],
  "running shoes": ["running shoe", "sneaker", "shoe"],
  "sandals": ["sandal", "sandals"],
  "scarf": ["scarf"],
  "sheath dress": ["dress"],
  "shell jacket": ["shell jacket", "jacket"],
  "shirt": ["shirt"],
  "shirtdress": ["shirt dress", "shirtdress", "dress"],
  "silk blouse": ["blouse"],
  "slip dress": ["dress"],
  "sneakers": ["sneaker", "sneakers", "shoe"],
  "stiletto heels": ["heels", "shoe"],
  "strappy sandals": ["sandal", "sandals"],
  "sundress": ["dress", "sundress"],
  "sunglasses": ["sunglasses", "eyewear"],
  "sweater": ["sweater", "jumper", "pullover"],
  "sweater dress": ["dress"],
  "t shirt": ["t-shirt", "shirt", "tee"],
  "t-shirt": ["t-shirt", "shirt", "tee"],
  "t shirt dress": ["dress"],
  "tennis skirt": ["skirt"],
  "tie": ["tie", "necktie"],
  "trench coat": ["trench", "coat"],
  "tunic": ["tunic", "top"],
  "watch": ["watch", "wristwatch"],
  "wide-leg trousers": ["trousers", "pants"],
  "wool overcoat": ["overcoat", "coat"],
  "wool scarf": ["scarf"],
  "wrap coat": ["coat"],
  "wrap dress": ["dress"],
  "wrap skirt": ["skirt"],
};

function nounList(item) {
  return NOUNS[item] || [item.split(" ").pop(), item];
}

const PRODUCT_WORDS = /\b(flat lay|flatlay|product|product photo|product photography|still life|studio|catalog|isolated|on white|white background|plain background|neutral background|display|displayed|arranged|arrangement|hanger|hanging|mannequin|close-up|close up|minimalist|copy space|showcase|showcasing)\b/i;
const PERSON_WORDS = /\b(woman|women|man|men|girl|girls|boy|boys|person|people|model|portrait|wearing|dressed|outfit|posing|pose|standing|sitting|walking|smiling|leaning|street|outdoors|outside|beach|park|city|urban|fashionable|stylish|young|adult|sleeve adjusting|adjusting sleeve)\b/i;
const NSFW_WORDS = /\b(nude|naked|lingerie|underwear|bra|panties|bikini|swimsuit|sexy|sensual|erotic|boudoir|cleavage|see-through|transparent)\b/i;
const OFF_TOPIC_WORDS = /\b(food|coffee|kitchen|lemon|lemons|laptop|phone|computer|car|airplane|train|building|church|cathedral|landscape|sunset|flower|flowers|plant|animal|dog|cat|spider|painting|poster|logo|map|tool|tools|camera|lens|wedding|bride|funeral|ballet|dancer|photographer|photographers|audio|music production|electronic equipment|can showcasing|pull tab|branding|hardhat|hard hat|safety goggles|occupational safety|diamond rings|rings on|jewelry display)\b/i;

function includesAny(text, values) {
  return values.some((value) => text.includes(value));
}

const COLOR_WORDS = {
  beige: ["beige", "cream", "tan", "khaki", "ivory"],
  black: ["black"],
  blue: ["blue", "navy"],
  brown: ["brown", "tan", "camel"],
  camel: ["camel", "tan", "brown", "beige"],
  charcoal: ["charcoal", "gray", "grey", "black"],
  cream: ["cream", "ivory", "beige", "white"],
  floral: [],
  gold: ["gold", "golden"],
  gray: ["gray", "grey", "charcoal", "silver"],
  green: ["green", "olive"],
  grey: ["grey", "gray", "charcoal", "silver"],
  khaki: ["khaki", "tan", "beige"],
  magenta: ["magenta", "pink", "fuchsia"],
  navy: ["navy", "blue"],
  nude: ["nude", "beige", "tan"],
  olive: ["olive", "green"],
  pattern: [],
  pearl: ["pearl", "white", "cream"],
  red: ["red", "burgundy"],
  rust: ["rust", "orange", "brown", "red"],
  silver: ["silver", "gray", "grey"],
  tan: ["tan", "brown", "beige", "camel"],
  tortoiseshell: ["tortoiseshell", "brown", "turtle"],
  white: ["white", "ivory", "cream"],
  yellow: ["yellow", "gold"],
};

function colorMatches(text, color) {
  if (!color) return true;
  const words = COLOR_WORDS[color] || [color];
  if (!words.length) return true;
  const itemColorText = text
    .replace(/\bblack and white (photo|image|photograph)\b/g, "monochrome image")
    .replace(/\b(grayscale|monochrome)\b/g, "monochrome")
    .replace(/\b(on|against|with|plain|clean|neutral)?\s*white background\b/g, " background")
    .replace(/\bwhite surface\b/g, " surface");
  return words.some((word) => itemColorText.includes(word));
}

function isJpegDownload(download) {
  const contentType = String(download.headers?.["content-type"] || "").toLowerCase();
  return contentType.includes("image/jpeg") || download.body.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]));
}

function hasProductSignal(text, candidate, nouns) {
  if (text.length > 360) return false;
  if (PRODUCT_WORDS.test(text)) return true;
  if (candidate.provider !== "pexels" && text.length <= 72 && includesAny(text, nouns)) return true;
  return false;
}

function itemSpecificRejectReason(text, parsed) {
  if (parsed.slot === "bottom" && /\b(shoe|shoes|sneaker|sneakers|loafer|loafers|sandal|sandals|heel|heels|boot|boots|platform)\b/i.test(text)) {
    return "bottom_photo_focuses_on_shoes";
  }
  if (parsed.slot === "top" && /\b(pants|trousers|jeans|skirt|shoes|sneakers|portrait|model)\b/i.test(text)) {
    return "top_photo_wrong_focus";
  }
  if (parsed.slot === "outer" && /\b(pants|trousers|jeans|skirt|shoes|sneakers|portrait|model)\b/i.test(text)) {
    return "outer_photo_wrong_focus";
  }
  if (parsed.color && !["black", "charcoal", "gray", "grey"].includes(parsed.color) && /\b(black and white photo|black and white image|monochrome|grayscale)\b/i.test(text)) {
    return "monochrome_hides_requested_color";
  }
  if (parsed.item === "baseball cap" && /\b(summer hat|sun hat|beach hat|hardhat|hard hat|helmet|kepka)\b/i.test(text)) {
    return "wrong_cap_type";
  }
  if (/\bgloves?\b/i.test(parsed.item) && /\b(ring|rings|jewelry|hardhat|hard hat|goggles|safety|work gloves?|occupational)\b/i.test(text)) {
    return "wrong_glove_context";
  }
  return "";
}

function scoreCandidate(candidate, parsed) {
  if (!candidate?.imageUrl) return { score: -Infinity, reasons: ["missing_src"] };
  const ratio = Number(candidate.width || 0) / Number(candidate.height || 1);
  if (!Number.isFinite(ratio) || ratio < 0.72 || ratio > 1.42) {
    return { score: -Infinity, reasons: [`bad_ratio:${ratio.toFixed(2)}`] };
  }
  const alt = String(candidate.text || "").toLowerCase();
  const reasons = [];
  if (!alt) return { score: -Infinity, reasons: ["missing_alt"] };
  if (NSFW_WORDS.test(alt)) return { score: -Infinity, reasons: ["nsfw_alt"] };
  if (OFF_TOPIC_WORDS.test(alt)) return { score: -Infinity, reasons: ["off_topic_alt"] };
  const itemRejectReason = itemSpecificRejectReason(alt, parsed);
  if (itemRejectReason) return { score: -Infinity, reasons: [itemRejectReason] };
  const nouns = nounList(parsed.item);
  if (!includesAny(alt, nouns)) return { score: -Infinity, reasons: [`missing_item_noun:${nouns.join("|")}`] };
  if (!hasProductSignal(alt, candidate, nouns)) return { score: -Infinity, reasons: ["missing_product_signal"] };
  if (!colorMatches(alt, parsed.color)) return { score: -Infinity, reasons: [`color_mismatch:${parsed.color}`] };

  let score = 0;
  score += 12;
  if (PRODUCT_WORDS.test(alt)) {
    score += 18;
    reasons.push("product_signal");
  } else {
    score += 8;
    reasons.push("concise_open_license_title");
  }
  if (PERSON_WORDS.test(alt)) {
    score -= 26;
    reasons.push("person_penalty");
  }
  if (candidate.provider !== "pexels") {
    score += 3;
    reasons.push("alternate_provider");
  }
  if (parsed.color && colorMatches(alt, parsed.color)) {
    score += 7;
    reasons.push("color_match");
  }
  if (parsed.material && alt.includes(parsed.material)) {
    score += 3;
    reasons.push("material_match");
  }
  if (ratio >= 0.9 && ratio <= 1.12) {
    score += 4;
    reasons.push("squareish");
  }
  if (alt.length <= 92) {
    score += 3;
    reasons.push("concise_alt");
  }
  return { score, reasons };
}

function outputName(row) {
  const original = path.basename(row.path || `${row.key}.jpg`)
    .replace(/\.(svg|png|webp|jpe?g)$/i, "");
  const base = /studio/i.test(original) ? original : `${original}-studio`;
  return `${base}.jpg`
    .replace(/--+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patchCatalogPath(source, key, nextPath) {
  const pattern = new RegExp(`(${escapeRegExp(key)}:\\s*{[\\s\\S]*?path:\\s*")assets/recommendation-stock/[^"]+("[\\s\\S]*?\\n  },)`);
  return source.replace(pattern, `$1${nextPath}$2`);
}

function queryList(parsed) {
  const colorPrefix = parsed.color && !["floral", "pearl"].includes(parsed.color) ? `${parsed.color} ` : "";
  const materialPrefix = parsed.material && !["cotton", "metal"].includes(parsed.material) ? `${parsed.material} ` : "";
  const item = parsed.item;
  return [
    `${colorPrefix}${item} product photo studio`,
    `${colorPrefix}${item} flat lay`,
    `${materialPrefix}${item} on white background`,
    `${item} product photography`,
  ].map((query) => query.replace(/\s+/g, " ").trim());
}

async function choosePhoto(parsed) {
  let best = null;
  for (const query of queryList(parsed)) {
    const providerBatches = [];
    try {
      providerBatches.push(await pexelsSearch(query, 30));
    } catch (error) {
      providerBatches.push([{ provider: "pexels", imageUrl: "", text: "", _error: error.message }]);
    }
    try {
      providerBatches.push(await openverseSearch(query, 30));
    } catch (error) {
      providerBatches.push([{ provider: "openverse", imageUrl: "", text: "", _error: error.message }]);
    }
    try {
      providerBatches.push(await commonsSearch(query, 30));
    } catch (error) {
      providerBatches.push([{ provider: "commons", imageUrl: "", text: "", _error: error.message }]);
    }
    for (const photo of providerBatches.flat()) {
      const scored = scoreCandidate(photo, parsed);
      if (!best || scored.score > best.score) {
        best = { photo, query, ...scored };
      }
    }
    if (best?.score >= 30) break;
    await sleep(SEARCH_DELAY_MS);
  }
  return best && best.score >= 27 ? best : best;
}

(async () => {
  const rows = JSON.parse(fs.readFileSync(MISSING_FILE, "utf8"));
  const log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, "utf8")) : [];
  const completedKeys = new Set(log
    .filter((row) => row.status === "ok" || row.status === "exists" || (!RETRY_REJECTS && row.status))
    .map((row) => row.key));
  let source = fs.readFileSync(SERVER_FILE, "utf8");
  for (const row of log) {
    if ((row.status === "ok" || row.status === "exists") && row.newPath) {
      source = patchCatalogPath(source, row.key, row.newPath);
    }
  }
  let processed = 0;
  let ok = 0;
  let skipped = 0;
  let rejected = 0;
  let failed = 0;

  for (const row of rows) {
    if (processed >= MAX_ROWS) break;
    if (completedKeys.has(row.key)) continue;
    processed += 1;

    const parsed = parseMissingRow(row);
    const fileName = outputName(row);
    const relativePath = `assets/recommendation-stock/${fileName}`;
    const absolutePath = path.join(STOCK_DIR, fileName);

    if (fs.existsSync(absolutePath)) {
      source = patchCatalogPath(source, row.key, relativePath);
      log.push({ ...row, ...parsed, status: "exists", newPath: relativePath });
      skipped += 1;
      continue;
    }

    let chosen = null;
    try {
      chosen = await choosePhoto(parsed);
    } catch (error) {
      failed += 1;
      log.push({ ...row, ...parsed, status: "search_failed", error: error.message });
      if (/429/.test(error.message)) break;
      continue;
    }

    if (!chosen || chosen.score < 27) {
      rejected += 1;
      log.push({
        ...row,
        ...parsed,
        status: "no_quality_candidate",
        bestScore: chosen?.score ?? null,
        bestAlt: chosen?.photo?.text || null,
        bestUrl: chosen?.photo?.pageUrl || null,
        bestProvider: chosen?.photo?.provider || null,
        reasons: chosen?.reasons || [],
      });
      continue;
    }

    let download;
    try {
      download = await httpsGet(chosen.photo.imageUrl);
    } catch (error) {
      failed += 1;
      log.push({ ...row, ...parsed, status: "download_failed", error: error.message });
      continue;
    }
    if (download.status !== 200 || !isJpegDownload(download) || download.body.length < MIN_BYTES || download.body.length > MAX_BYTES) {
      failed += 1;
      log.push({
        ...row,
        ...parsed,
        status: "download_bad",
        httpStatus: download.status,
        contentType: download.headers?.["content-type"] || null,
        bytes: download.body.length,
      });
      continue;
    }

    fs.writeFileSync(absolutePath, download.body);
    source = patchCatalogPath(source, row.key, relativePath);
    ok += 1;
    log.push({
      ...row,
      ...parsed,
      status: "ok",
      newPath: relativePath,
      bytes: download.body.length,
      score: chosen.score,
      reasons: chosen.reasons,
      query: chosen.query,
      alt: chosen.photo.text,
      provider: chosen.photo.provider,
      providerId: chosen.photo.id,
      sourcePage: chosen.photo.pageUrl,
      photographer: chosen.photo.creator,
      photographerUrl: chosen.photo.creatorUrl,
      license: chosen.photo.license,
    });
    console.log(`[ok ${ok}] ${row.key} -> ${fileName} | ${chosen.score} | ${chosen.photo.provider} | ${chosen.photo.text}`);
    await sleep(DOWNLOAD_DELAY_MS);
  }

  fs.writeFileSync(SERVER_FILE, source);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  console.log(JSON.stringify({ processed, ok, skipped, rejected, failed, log: path.relative(ROOT, LOG_FILE) }, null, 2));
})();
