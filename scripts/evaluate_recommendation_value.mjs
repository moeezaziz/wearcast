import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const tmpDir = join(rootDir, "tmp");

function latestMatrixPath() {
  const candidates = readdirSync(tmpDir)
    .filter((name) => /^recommendation-matrix-.*\.jsonl$/.test(name))
    .map((name) => ({
      name,
      path: join(tmpDir, name),
      mtimeMs: statSync(join(tmpDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (!candidates.length) {
    throw new Error("No recommendation matrix JSONL files found in tmp/");
  }
  return candidates[0].path;
}

const inputPath = process.argv[2] ? join(rootDir, process.argv[2]) : latestMatrixPath();
const rows = readFileSync(inputPath, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

function outfitText(outfit = {}) {
  const accessories = Array.isArray(outfit.accessories) ? outfit.accessories : [outfit.accessories];
  return [outfit.top, outfit.bottom, outfit.outer, outfit.shoes, ...accessories].filter(Boolean).join(" ").toLowerCase();
}

function signature(outfit = {}) {
  const accessories = Array.isArray(outfit.accessories) ? outfit.accessories.join("|") : (outfit.accessories || "");
  return [outfit.top || "", outfit.bottom || "", outfit.outer || "", outfit.shoes || "", accessories].join(" :: ");
}

function hasCompleteCore(outfit = {}) {
  const accessories = Array.isArray(outfit.accessories) ? outfit.accessories.filter(Boolean) : [outfit.accessories].filter(Boolean);
  return !!(outfit.top && outfit.bottom && outfit.shoes && accessories.length === 1);
}

function countWords(text = "") {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function scoreWeatherFit(row) {
  const weather = row.request?.weather || {};
  const text = outfitText(row.response?.outfit || {});
  const feelsLike = Number(weather.feelsLike ?? weather.temperature);
  const wet = Number(weather.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow|freezing/i.test(String(weather.weatherLabel || ""));
  const windy = Number(weather.wind ?? 0) >= 24;
  let score = 100;

  if (feelsLike <= 8) {
    if (!/\b(jacket|coat|parka|thermal|sweater|knit|boot)\b/.test(text)) score -= 45;
    if (/\b(shorts|tank)\b/.test(text)) score -= 35;
  }
  if (feelsLike >= 28) {
    if (/\b(coat|parka|hoodie|sweater|thermal|boot)\b/.test(text)) score -= 40;
    if (!/\b(tee|t-shirt|tank|linen|lightweight|shorts)\b/.test(text)) score -= 15;
  }
  if (wet) {
    if (!/\b(rain|waterproof|shell|umbrella|water-resistant)\b/.test(text)) score -= 35;
  }
  if (windy && feelsLike <= 18) {
    if (!/\b(windbreaker|shell|jacket|coat|overshirt)\b/.test(text)) score -= 20;
  }

  return Math.max(0, score);
}

function scoreProfileFit(row) {
  const profile = row.profile;
  const outfit = row.response?.outfit || {};
  const text = outfitText(outfit);
  let score = 100;

  if (profile === "office_mild_clear") {
    if (/\b(t-shirt|t shirt|tee)\b/.test(text) && /\b(sneaker|runner)\b/.test(text) && /\b(cap|beanie)\b/.test(text)) score -= 70;
    if (!/\b(oxford|shirt|blazer|loafer|trouser|chino|watch|scarf)\b/.test(text)) score -= 25;
  }

  if (profile === "commute_rain") {
    if (!/\b(rain|waterproof|umbrella|shell|water-resistant)\b/.test(text)) score -= 60;
    if (!/\b(sneaker|shoe|boot)\b/.test(text)) score -= 10;
  }

  if (profile === "sporty_exposed_breezy") {
    if (!/\b(athletic|performance|runner|running|shorts|jogger|windbreaker|sport cap|sports cap)\b/.test(text)) score -= 65;
    if (/\b(oxford|loafer|blazer)\b/.test(text)) score -= 30;
  }

  if (profile === "cold_outdoors") {
    if (!/\b(thermal|coat|jacket|boot|beanie|scarf)\b/.test(text)) score -= 70;
  }

  if (profile === "hot_urban_evening") {
    if (/\b(coat|parka|hoodie|sweater|thermal|boot)\b/.test(text)) score -= 60;
    if (/\b(t-shirt|t shirt|tee)\b/.test(text) && /\b(black trousers|trousers|jeans)\b/.test(text) && /\b(cap)\b/.test(text)) score -= 30;
    if (!/\b(linen|lightweight|canvas|shirt|chino|watch|loafer|sneaker)\b/.test(text)) score -= 15;
  }

  if (profile === "minimal_indoor_transition") {
    if (outfit.outer) score -= 35;
    if (!/\b(minimal|simple|watch|chino|sneaker|long-sleeve|tee)\b/.test(text)) score -= 20;
  }

  return Math.max(0, score);
}

function scoreDecisionFatigue(row) {
  const outfit = row.response?.outfit || {};
  const reasoning = row.response?.reasoning || "";
  let score = 100;
  if (!hasCompleteCore(outfit)) score -= 45;
  if (!reasoning.trim()) score -= 30;
  const words = countWords(reasoning);
  if (words > 20) score -= 15;
  if (words < 6) score -= 10;
  if ((row.response?.warnings || []).length > 1) score -= 10;
  return Math.max(0, score);
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

const scoredRows = rows.map((row) => ({
  ...row,
  _weatherFit: scoreWeatherFit(row),
  _profileFit: scoreProfileFit(row),
  _decisionFatigue: scoreDecisionFatigue(row),
}));

const byProfile = groupBy(scoredRows, (row) => row.profile);
const profileSummary = {};

for (const [profile, entries] of byProfile.entries()) {
  const uniqueOutfits = new Set(entries.map((entry) => signature(entry.response?.outfit || {})));
  const avg = (field) => +(entries.reduce((sum, entry) => sum + entry[field], 0) / entries.length).toFixed(1);
  profileSummary[profile] = {
    cases: entries.length,
    uniqueOutfits: uniqueOutfits.size,
    avgWeatherFit: avg("_weatherFit"),
    avgProfileFit: avg("_profileFit"),
    avgDecisionFatigue: avg("_decisionFatigue"),
  };
}

const overall = {
  totalCases: scoredRows.length,
  avgWeatherFit: +(scoredRows.reduce((sum, row) => sum + row._weatherFit, 0) / scoredRows.length).toFixed(1),
  avgProfileFit: +(scoredRows.reduce((sum, row) => sum + row._profileFit, 0) / scoredRows.length).toFixed(1),
  avgDecisionFatigue: +(scoredRows.reduce((sum, row) => sum + row._decisionFatigue, 0) / scoredRows.length).toFixed(1),
  completeOutfitRate: +((scoredRows.filter((row) => hasCompleteCore(row.response?.outfit || {})).length / scoredRows.length) * 100).toFixed(1),
};

const diversityFailures = Object.entries(profileSummary)
  .filter(([, value]) => value.uniqueOutfits < 3)
  .map(([profile, value]) => ({ profile, uniqueOutfits: value.uniqueOutfits, cases: value.cases }));

const verdict = {
  providesDailyValue: overall.avgWeatherFit >= 80 && overall.avgProfileFit >= 75,
  reducesDecisionFatigue: overall.avgDecisionFatigue >= 80 && overall.completeOutfitRate >= 95,
  hasHealthyVariability: diversityFailures.length === 0,
};

const output = {
  inputPath,
  overall,
  verdict,
  profileSummary,
  diversityFailures,
  weakestExamples: scoredRows
    .sort((a, b) => (a._weatherFit + a._profileFit + a._decisionFatigue) - (b._weatherFit + b._profileFit + b._decisionFatigue))
    .slice(0, 12)
    .map((row) => ({
      city: row.city,
      profile: row.profile,
      wardrobeVariant: row.wardrobeVariant,
      weatherFit: row._weatherFit,
      profileFit: row._profileFit,
      decisionFatigue: row._decisionFatigue,
      outfit: row.response?.outfit || {},
      reasoning: row.response?.reasoning || "",
    })),
};

const outputPath = join(tmpDir, `recommendation-value-eval-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(JSON.stringify({ ...output, outputPath }, null, 2));
