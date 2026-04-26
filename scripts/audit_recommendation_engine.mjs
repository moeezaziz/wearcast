import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outDir = join(rootDir, "tmp");
mkdirSync(outDir, { recursive: true });

const baseUrl = (process.env.WEARCAST_AUDIT_URL || "https://wearcast.fly.dev").replace(/\/$/, "");
const concurrency = Math.max(1, Number(process.env.WEARCAST_AUDIT_CONCURRENCY || 2));
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = join(outDir, `recommendation-engine-audit-${runId}.json`);
const markdownOutputPath = join(outDir, `recommendation-engine-audit-${runId}.md`);

const locations = [
  { id: "berlin", name: "Berlin, Germany", lat: 52.52, lon: 13.405 },
  { id: "dublin", name: "Dublin, Ireland", lat: 53.3498, lon: -6.2603 },
  { id: "karachi", name: "Karachi, Pakistan", lat: 24.8607, lon: 67.0011 },
];

const profiles = [
  {
    id: "everyday_auto",
    preferences: {
      cold: false,
      hot: false,
      formal: false,
      casual: true,
      sporty: false,
      streetwear: false,
      minimalist: false,
      bike: false,
      activityContext: "everyday",
      locationContext: "mixed",
      styleFocus: "auto",
      fashionNotes: null,
    },
  },
  {
    id: "office_polished",
    preferences: {
      cold: false,
      hot: false,
      formal: true,
      casual: false,
      sporty: false,
      streetwear: false,
      minimalist: false,
      bike: false,
      activityContext: "office",
      locationContext: "mixed",
      styleFocus: "polished",
      fashionNotes: null,
    },
  },
];

const wardrobes = [
  { id: "empty", wardrobe: [] },
  {
    id: "appropriate_capsule",
    wardrobe: [
      { id: "w1", type: "top", name: "White Oxford Shirt", color: "White", material: "Cotton" },
      { id: "w2", type: "bottom", name: "Navy Chinos", color: "Navy", material: "Cotton twill" },
      { id: "w3", type: "outer", name: "Black Shell Jacket", color: "Black", material: "Waterproof technical shell" },
      { id: "w4", type: "shoes", name: "White Leather Sneakers", color: "White", material: "Leather" },
      { id: "w5", type: "accessory", name: "Compact Umbrella", color: "Black", material: "Nylon" },
    ],
  },
  {
    id: "mismatched_capsule",
    wardrobe: [
      { id: "m1", type: "top", name: "Sleeveless Linen Tank", color: "Cream", material: "Linen" },
      { id: "m2", type: "bottom", name: "Denim Shorts", color: "Light blue", material: "Denim" },
      { id: "m3", type: "outer", name: "Heavy Wool Overcoat", color: "Camel", material: "Wool" },
      { id: "m4", type: "shoes", name: "Open Sandals", color: "Tan", material: "Leather" },
      { id: "m5", type: "accessory", name: "Straw Sun Hat", color: "Natural", material: "Straw" },
    ],
  },
];

function weatherCodeLabel(code) {
  if ([0].includes(code)) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if ([3].includes(code)) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Mixed conditions";
}

function toNumber(value, fallback = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function summarizeRemainingForecast(weatherData) {
  const hourly = weatherData?.hourly || {};
  const currentTime = weatherData?.current?.time;
  const startIndex = Math.max(0, Array.isArray(hourly.time) ? hourly.time.indexOf(currentTime) : 0);
  const endIndex = Math.min((hourly.time || []).length, startIndex + 12);
  const slice = (arr) => Array.isArray(arr) ? arr.slice(startIndex, endIndex).map(Number).filter(Number.isFinite) : [];
  const temps = slice(hourly.temperature_2m);
  const feels = slice(hourly.apparent_temperature);
  const winds = slice(hourly.wind_speed_10m);
  const rain = slice(hourly.precipitation_probability);
  const precip = slice(hourly.precipitation);
  const uv = slice(hourly.uv_index);
  const range = (values, unit = "") => values.length ? `${Math.round(Math.min(...values))}${unit} – ${Math.round(Math.max(...values))}${unit}` : "";
  return {
    tempRange: range(temps, "°C"),
    feelsLikeRange: range(feels, "°C"),
    maxWind: winds.length ? `${Math.round(Math.max(...winds))} km/h` : "",
    maxPrecipProb: rain.length ? `${Math.round(Math.max(...rain))}%` : "",
    totalPrecip: precip.length ? `${precip.reduce((sum, value) => sum + value, 0).toFixed(1)} mm` : "",
    peakUV: uv.length ? Math.round(Math.max(...uv)) : 0,
    avgHumidity: "",
  };
}

function buildRecommendationWeather(weatherData) {
  const current = weatherData?.current || {};
  const hourly = weatherData?.hourly || {};
  const timeIndex = Array.isArray(hourly.time) ? hourly.time.indexOf(current.time) : -1;
  return {
    temperature: toNumber(current.temperature_2m, 0),
    feelsLike: toNumber(current.apparent_temperature, current.temperature_2m ?? 0),
    wind: toNumber(current.wind_speed_10m, 0),
    gusts: toNumber(current.wind_gusts_10m, current.wind_speed_10m ?? 0),
    humidity: toNumber(current.relative_humidity_2m, 0),
    cloud: toNumber(current.cloud_cover, 0),
    precip: toNumber(current.precipitation, 0),
    precipProb: timeIndex >= 0 ? toNumber(hourly.precipitation_probability?.[timeIndex], 0) : 0,
    uv: toNumber(current.uv_index, 0),
    weatherLabel: weatherCodeLabel(Number(current.weather_code)),
    isDay: current.is_day === 1,
    remainingForecast: summarizeRemainingForecast(weatherData),
  };
}

function textForOutfit(outfit = {}) {
  const accessories = Array.isArray(outfit.accessories) ? outfit.accessories : [outfit.accessories];
  return [outfit.top, outfit.bottom, outfit.outer, outfit.shoes, ...accessories].filter(Boolean).join(" ").toLowerCase();
}

function parseForecastNumber(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function classifyWeatherProfile(weather = {}) {
  const feelsLike = Number(weather.feelsLike ?? weather.temperature);
  const precipProb = Number(weather.precipProb ?? 0);
  const precip = Number(weather.precip ?? 0);
  const label = String(weather.weatherLabel || "").toLowerCase();
  const laterRain = Math.max(precipProb, parseForecastNumber(weather.remainingForecast?.maxPrecipProb) ?? 0);
  const wet = precip > 0 || precipProb >= 45 || /rain|drizzle|storm|thunder|snow|sleet|freezing/.test(label);
  return {
    feelsLike,
    hot: Number.isFinite(feelsLike) && feelsLike >= 30,
    veryHot: Number.isFinite(feelsLike) && feelsLike >= 35,
    cold: Number.isFinite(feelsLike) && feelsLike <= 8,
    veryCold: Number.isFinite(feelsLike) && feelsLike <= 0,
    wet,
    rainLikelyLater: wet || laterRain >= 45,
    dry: !(wet || laterRain >= 45),
    windy: Number(weather.gusts ?? weather.wind ?? 0) >= 30,
    highUv: Number(weather.uv ?? 0) >= 6,
  };
}

function detectRedFlags(response = {}, weather = {}, profileId = "") {
  const outfit = response.outfit || {};
  const itemText = [
    textForOutfit(outfit),
    response.itemDetails?.top?.material || "",
    response.itemDetails?.bottom?.material || "",
    response.itemDetails?.outer?.material || "",
    response.itemDetails?.accessory?.material || "",
  ].join(" ").toLowerCase();
  const text = [
    textForOutfit(outfit),
    response.reasoning || "",
    response.slotReasons?.top || "",
    response.slotReasons?.bottom || "",
    response.slotReasons?.outer || "",
    response.slotReasons?.shoes || "",
    response.slotReasons?.accessory || "",
    response.itemDetails?.top?.material || "",
    response.itemDetails?.bottom?.material || "",
    response.itemDetails?.outer?.material || "",
    response.itemDetails?.accessory?.material || "",
  ].join(" ").toLowerCase();
  const weatherProfile = classifyWeatherProfile(weather);
  const flags = [];
  const add = (severity, code, message) => flags.push({ severity, code, message });
  if (weatherProfile.hot && /\b(wool|merino|thermal|fleece|sherpa|insulated|winter|parka|overcoat|beanie|glove)\b/.test(itemText)) {
    add("severe", "hot_heavy_material", "Hot weather includes cold-weather material or accessory.");
  }
  if (weatherProfile.veryHot && /\b(sweater|hoodie|overshirt|jacket|coat|blazer|long-sleeve|long sleeve)\b/.test(itemText)) {
    add("severe", "very_hot_layering", "Very hot weather includes unnecessary upper-body layering.");
  }
  if (weatherProfile.dry && /\b(umbrella|rain jacket|raincoat|waterproof parka)\b/.test(text)) {
    add("severe", "dry_rain_gear", "Dry weather includes rain gear.");
  }
  if (weatherProfile.cold && /\b(shorts|tank|sleeveless|sandals)\b/.test(text)) {
    add("severe", "cold_exposed", "Cold weather exposes too much skin.");
  }
  if (profileId === "office_polished" && /\b(running shorts|leggings|tank|graphic tee|hoodie|sandals)\b/.test(itemText)) {
    add("severe", "office_too_casual", "Office profile is too casual or athletic.");
  }
  if ((weatherProfile.wet || weatherProfile.rainLikelyLater) && !/\b(rain|waterproof|water-resistant|shell|umbrella|weatherproof)\b/.test(text)) {
    add("warning", "wet_missing_protection", "Wet weather lacks clear protection.");
  }
  if (weatherProfile.highUv && !/\b(sunglasses|cap|hat|sun|uv|sunscreen)\b/.test(text)) {
    add("warning", "uv_missing_guidance", "High UV lacks sun guidance.");
  }
  return flags;
}

function scoreWeatherFit(outfit = {}, weather = {}) {
  const text = textForOutfit(outfit);
  const feelsLike = Number(weather.feelsLike ?? weather.temperature);
  const wet = Number(weather.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow/i.test(weather.weatherLabel || "");
  const windy = Number(weather.wind ?? 0) >= 24;
  let score = 100;
  if (feelsLike <= 8 && !/\b(coat|jacket|parka|thermal|sweater|knit|boot|beanie|scarf)\b/.test(text)) score -= 35;
  if (feelsLike <= 8 && /\b(shorts|tank|sandals)\b/.test(text)) score -= 35;
  if (feelsLike >= 28 && /\b(coat|parka|wool|thermal|heavy|overcoat)\b/.test(text)) score -= 35;
  if (feelsLike >= 28 && !/\b(tee|t-shirt|tank|linen|lightweight|shorts|breathable|shirt)\b/.test(text)) score -= 15;
  if (wet && !/\b(rain|waterproof|shell|umbrella|water-resistant|weatherproof)\b/.test(text)) score -= 35;
  if (windy && feelsLike <= 18 && !/\b(windbreaker|shell|jacket|coat|overshirt)\b/.test(text)) score -= 20;
  return Math.max(0, score);
}

function scoreProfileFit(outfit = {}, profileId = "") {
  const text = textForOutfit(outfit);
  let score = 100;
  if (profileId === "office_polished") {
    if (/\b(shorts|tank|hoodie|graphic tee|running shorts|sandals)\b/.test(text)) score -= 45;
    if (!/\b(oxford|shirt|blazer|loafer|trouser|chino|watch|sweater|polo)\b/.test(text)) score -= 25;
  }
  if (profileId === "everyday_auto") {
    if (!/\b(tee|shirt|sweater|jeans|chino|sneaker|boot|jacket|coat|umbrella|cap|watch)\b/.test(text)) score -= 25;
  }
  return Math.max(0, score);
}

function scoreWardrobeUsage(outfit = {}, wardrobe = [], weather = {}) {
  if (!wardrobe.length) return { score: 100, usedCount: 0, matchedNames: [] };
  const text = textForOutfit(outfit);
  const matchedNames = wardrobe
    .filter((item) => text.includes(String(item.name || "").toLowerCase()))
    .map((item) => item.name);
  const wet = Number(weather.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow/i.test(weather.weatherLabel || "");
  const feelsLike = Number(weather.feelsLike ?? weather.temperature);
  const mismatchRisk = wardrobe.some((item) => /\b(shorts|tank|sandals|sun hat)\b/i.test(item.name || "")) && (wet || feelsLike <= 12);
  if (mismatchRisk) {
    return { score: matchedNames.length <= 1 ? 95 : 55, usedCount: matchedNames.length, matchedNames };
  }
  return { score: matchedNames.length >= 2 ? 95 : matchedNames.length === 1 ? 80 : 55, usedCount: matchedNames.length, matchedNames };
}

function scoreStockImages(response = {}, weather = {}, profileId = "") {
  const images = response.outfitImages || {};
  const outfit = response.outfit || {};
  const slots = ["top", "bottom", "outer", "shoes"];
  let checked = 0;
  let matched = 0;
  let aestheticScore = 100;
  const misses = [];
  const aestheticIssues = [];
  const weatherProfile = classifyWeatherProfile(weather);
  for (const slot of slots) {
    const item = outfit[slot];
    if (!item) continue;
    checked += 1;
    const image = images[slot];
    const haystack = `${image?.key || ""} ${image?.description || ""} ${image?.path || ""}`.toLowerCase();
    const itemText = String(item || "").toLowerCase();
    const itemWords = String(item).toLowerCase().split(/\W+/).filter((word) => word.length >= 4);
    const hasSlot = haystack.includes(slot === "outer" ? "outer" : slot);
    const hasItemWord = itemWords.some((word) => haystack.includes(word));
    if (image && (hasSlot || hasItemWord)) matched += 1;
    else misses.push({ slot, item, image });
    if (weatherProfile.hot && /\b(winter|coat|sweater|knit|beanie|glove|parka|overcoat)\b/.test(haystack)) {
      aestheticScore -= 20;
      aestheticIssues.push({ slot, item, image: image?.key, issue: "warm image in hot weather" });
    }
    if (weatherProfile.dry && /\b(umbrella|rain)\b/.test(haystack)) {
      aestheticScore -= 25;
      aestheticIssues.push({ slot, item, image: image?.key, issue: "rain image in dry weather" });
    }
    if (/\b(chino|linen trouser|lightweight trouser|tailored trouser)\b/.test(itemText) && /\bjeans-stack|blue-jeans|denim\b/.test(haystack)) {
      aestheticScore -= 15;
      aestheticIssues.push({ slot, item, image: image?.key, issue: "casual denim visual for polished trouser" });
    }
    if (/\b(cotton shorts|chino shorts|tailored shorts)\b/.test(itemText) && /\bdenim-shorts\b/.test(haystack)) {
      aestheticScore -= 15;
      aestheticIssues.push({ slot, item, image: image?.key, issue: "denim visual for non-denim shorts" });
    }
    if (profileId === "office_polished" && /\b(running|athletic|sports|trail)\b/.test(haystack) && !/\b(weather|rain|shell)\b/.test(haystack)) {
      aestheticScore -= 12;
      aestheticIssues.push({ slot, item, image: image?.key, issue: "too sporty for polished office" });
    }
  }
  const accessoryImages = Object.entries(images).filter(([key]) => key.startsWith("accessory"));
  if ((outfit.accessories || []).length) {
    checked += 1;
    if (accessoryImages.length) {
      matched += 1;
      const accessoryText = accessoryImages.map(([, image]) => `${image?.key || ""} ${image?.description || ""}`).join(" ").toLowerCase();
      if (weatherProfile.dry && /\bumbrella|rain\b/.test(accessoryText)) {
        aestheticScore -= 25;
        aestheticIssues.push({ slot: "accessory", item: outfit.accessories, image: accessoryImages[0]?.[1]?.key, issue: "rain accessory visual in dry weather" });
      }
    } else misses.push({ slot: "accessory", item: outfit.accessories, image: null });
  }
  return {
    score: checked ? Math.round((matched / checked) * 100) : 0,
    aestheticScore: Math.max(0, Math.round(aestheticScore)),
    checked,
    matched,
    misses,
    aestheticIssues,
  };
}

async function timedJson(url, options) {
  const started = performance.now();
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, durationMs: Math.round(performance.now() - started), json };
}

const cases = [];
for (const location of locations) {
  for (const profile of profiles) {
    for (const wardrobe of wardrobes) {
      cases.push({ location, profile, wardrobe });
    }
  }
}

const weatherByLocation = {};
for (const location of locations) {
  const weatherUrl = new URL(`${baseUrl}/api/weather`);
  weatherUrl.searchParams.set("lat", location.lat);
  weatherUrl.searchParams.set("lon", location.lon);
  weatherByLocation[location.id] = await timedJson(weatherUrl);
}

let nextIndex = 0;
const results = [];
async function worker() {
  while (nextIndex < cases.length) {
    const index = nextIndex++;
    const testCase = cases[index];
    const weatherResult = weatherByLocation[testCase.location.id];
    const weather = buildRecommendationWeather(weatherResult.json);
    const payload = {
      weather,
      wardrobe: testCase.wardrobe.wardrobe,
      preferences: testCase.profile.preferences,
      location: testCase.location,
    };
    const recommendation = await timedJson(`${baseUrl}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const response = recommendation.json;
    const wardrobeScore = scoreWardrobeUsage(response.outfit, testCase.wardrobe.wardrobe, weather);
    const stockImageScore = scoreStockImages(response, weather, testCase.profile.id);
    const redFlags = detectRedFlags(response, weather, testCase.profile.id);
    results[index] = {
      index: index + 1,
      location: testCase.location.name,
      profile: testCase.profile.id,
      wardrobeVariant: testCase.wardrobe.id,
      ok: recommendation.ok,
      status: recommendation.status,
      weatherMs: weatherResult.durationMs,
      recommendationMs: recommendation.durationMs,
      weather,
      scores: {
        weatherFit: scoreWeatherFit(response.outfit, weather),
        profileFit: scoreProfileFit(response.outfit, testCase.profile.id),
        wardrobeUsage: wardrobeScore.score,
        stockImages: stockImageScore.score,
        stockImageAesthetic: stockImageScore.aestheticScore,
      },
      redFlags,
      wardrobeUsage: wardrobeScore,
      stockImages: stockImageScore,
      quality: response.quality || null,
      trustSignals: response.trustSignals || [],
      performance: response.performance || null,
      outfit: response.outfit,
      outfitImages: response.outfitImages,
      reasoning: response.reasoning,
      warnings: response.warnings || [],
      missingItems: response.missingItems || [],
      error: recommendation.ok ? null : response,
    };
    console.error(`[${index + 1}/${cases.length}] ${testCase.location.name} ${testCase.profile.id} ${testCase.wardrobe.id}: ${recommendation.status} ${recommendation.durationMs}ms`);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length) : null;
}

const successful = results.filter((result) => result?.ok);
const severeRedFlags = successful.flatMap((result) =>
  (result.redFlags || [])
    .filter((flag) => flag.severity === "severe")
    .map((flag) => ({ ...flag, location: result.location, profile: result.profile, wardrobeVariant: result.wardrobeVariant, outfit: result.outfit }))
);
const warningRedFlags = successful.flatMap((result) =>
  (result.redFlags || [])
    .filter((flag) => flag.severity === "warning")
    .map((flag) => ({ ...flag, location: result.location, profile: result.profile, wardrobeVariant: result.wardrobeVariant, outfit: result.outfit }))
);
const summary = {
  baseUrl,
  runId,
  totalCases: results.length,
  successes: successful.length,
  failures: results.length - successful.length,
  weatherTiming: {
    avgMs: average(Object.values(weatherByLocation).map((entry) => entry.durationMs)),
    maxMs: Math.max(...Object.values(weatherByLocation).map((entry) => entry.durationMs)),
    byLocation: Object.fromEntries(Object.entries(weatherByLocation).map(([id, entry]) => [id, { status: entry.status, durationMs: entry.durationMs, provider: entry.json?.provider }])),
  },
  recommendationTiming: {
    avgMs: average(successful.map((result) => result.recommendationMs)),
    p50Ms: percentile(successful.map((result) => result.recommendationMs), 50),
    p90Ms: percentile(successful.map((result) => result.recommendationMs), 90),
    maxMs: Math.max(...successful.map((result) => result.recommendationMs)),
  },
  scoreAverages: {
    weatherFit: average(successful.map((result) => result.scores.weatherFit)),
    profileFit: average(successful.map((result) => result.scores.profileFit)),
    wardrobeUsage: average(successful.map((result) => result.scores.wardrobeUsage)),
    stockImages: average(successful.map((result) => result.scores.stockImages)),
    stockImageAesthetic: average(successful.map((result) => result.scores.stockImageAesthetic)),
  },
  redFlags: {
    severe: severeRedFlags.length,
    warnings: warningRedFlags.length,
    severeExamples: severeRedFlags.slice(0, 8),
    warningExamples: warningRedFlags.slice(0, 8),
  },
  pass: successful.length === results.length
    && severeRedFlags.length === 0
    && average(successful.map((result) => result.scores.weatherFit)) >= 90
    && average(successful.map((result) => result.scores.stockImageAesthetic)) >= 85,
  weakCases: successful
    .filter((result) => Object.values(result.scores).some((score) => score < 75) || (result.redFlags || []).length)
    .map((result) => ({
      location: result.location,
      profile: result.profile,
      wardrobeVariant: result.wardrobeVariant,
      recommendationMs: result.recommendationMs,
      scores: result.scores,
      wardrobeMatched: result.wardrobeUsage.matchedNames,
      stockImageMisses: result.stockImages.misses,
      stockImageAestheticIssues: result.stockImages.aestheticIssues,
      redFlags: result.redFlags,
      outfit: result.outfit,
      reasoning: result.reasoning,
    })),
};

const output = { summary, results };
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
const markdown = `# WearCast Recommendation Engine Audit

Run: ${runId}

- Base URL: ${baseUrl}
- Pass: ${summary.pass ? "yes" : "no"}
- Cases: ${summary.successes}/${summary.totalCases} successful
- Weather p95 target context: avg ${summary.weatherTiming.avgMs}ms, max ${summary.weatherTiming.maxMs}ms
- Recommendation timing: p50 ${summary.recommendationTiming.p50Ms}ms, p90 ${summary.recommendationTiming.p90Ms}ms, max ${summary.recommendationTiming.maxMs}ms
- Weather fit avg: ${summary.scoreAverages.weatherFit}
- Profile fit avg: ${summary.scoreAverages.profileFit}
- Wardrobe usage avg: ${summary.scoreAverages.wardrobeUsage}
- Stock image category avg: ${summary.scoreAverages.stockImages}
- Stock image aesthetic avg: ${summary.scoreAverages.stockImageAesthetic}
- Severe red flags: ${summary.redFlags.severe}
- Warning red flags: ${summary.redFlags.warnings}

## Severe Examples

${severeRedFlags.length ? severeRedFlags.slice(0, 10).map((flag) => `- ${flag.location} / ${flag.profile} / ${flag.wardrobeVariant}: ${flag.code} - ${flag.message}`).join("\n") : "- None"}

## Weak Cases

${summary.weakCases.length ? summary.weakCases.slice(0, 12).map((result) => `- ${result.location} / ${result.profile} / ${result.wardrobeVariant}: scores ${JSON.stringify(result.scores)} outfit ${JSON.stringify(result.outfit)}`).join("\n") : "- None"}
`;
writeFileSync(markdownOutputPath, markdown);
console.log(JSON.stringify({ outputPath, markdownOutputPath, summary }, null, 2));
