import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outDir = join(rootDir, "tmp");
mkdirSync(outDir, { recursive: true });

const baseUrl = (process.env.WEARCAST_AUDIT_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = join(outDir, `recommendation-launch-audit-${runId}.json`);

const transparentPixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const basePrefs = {
  cold: false,
  hot: false,
  formal: false,
  casual: false,
  sporty: false,
  streetwear: false,
  minimalist: false,
  bike: false,
  activityContext: "everyday",
  locationContext: "mixed",
  styleFocus: "auto",
  fashionNotes: null,
  gender: "unspecified",
};

const weather = {
  extremeCold: {
    temperature: -9.9,
    feelsLike: -15.6,
    wind: 16,
    gusts: 20,
    humidity: 92,
    cloud: 100,
    precip: 0,
    precipProb: 0,
    uv: 0.2,
    weatherLabel: "Overcast",
    isDay: false,
    remainingForecast: {
      tempRange: "-10°C – -8°C",
      feelsLikeRange: "-16°C – -12°C",
      maxWind: "20 km/h",
      maxPrecipProb: "0%",
      peakUV: 0,
    },
  },
  mildOvercast: {
    temperature: 22.5,
    feelsLike: 22.3,
    wind: 5,
    gusts: 8,
    humidity: 50,
    cloud: 95,
    precip: 0,
    precipProb: 2,
    uv: 0,
    weatherLabel: "Overcast",
    isDay: false,
  },
  rainy: {
    temperature: 12,
    feelsLike: 9,
    wind: 18,
    gusts: 30,
    humidity: 84,
    cloud: 100,
    precip: 0.5,
    precipProb: 78,
    uv: 1,
    weatherLabel: "Rain",
    isDay: true,
  },
  hot: {
    temperature: 36,
    feelsLike: 38,
    wind: 9,
    gusts: 12,
    humidity: 45,
    cloud: 5,
    precip: 0,
    precipProb: 0,
    uv: 8,
    weatherLabel: "Clear",
    isDay: true,
  },
};

const wardrobes = {
  empty: [],
  exactPhotos: [
    { id: "w-top", type: "top", name: "Black Merino Sweater", color: "Black", material: "Merino wool", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
    { id: "w-bottom", type: "bottom", name: "Insulated Snow Trousers", color: "Brown", material: "Insulated shell", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
    { id: "w-outer", type: "outer", name: "Insulated Winter Parka", color: "Navy", material: "Down shell", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
    { id: "w-shoes", type: "shoes", name: "Insulated Winter Boots", color: "Black", material: "Waterproof leather", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
    { id: "w-accessory", type: "accessory", name: "Insulated Gloves", color: "Black", material: "Insulated fabric", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
  ],
  misleadingPhotos: [
    { id: "m-top", type: "top", name: "White Polo Shirt", color: "White", material: "Cotton", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
    { id: "m-bottom", type: "bottom", name: "Denim Shorts", color: "Blue", material: "Denim", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
    { id: "m-accessory", type: "accessory", name: "White Gloves", color: "White", material: "Cotton", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
  ],
  signedInStyle: [
    { id: "s-top", type: "top", name: "Hoodie AR", color: "Black", material: "Cotton fleece", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
    { id: "s-outer", type: "outer", name: "Fleece Zip Jacket", color: "Charcoal", material: "Fleece", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
    { id: "s-bottom", type: "bottom", name: "Dark Jeans", color: "Black", material: "Denim", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
    { id: "s-accessory", type: "accessory", name: "Baseball Cap", color: "Black", material: "Cotton", photoDataUrl: transparentPixel, sourcePhotoDataUrl: transparentPixel },
  ],
};

const cases = [
  { id: "extreme-cold-empty-male", weather: weather.extremeCold, wardrobe: wardrobes.empty, preferences: { ...basePrefs, gender: "male", locationContext: "outdoors" } },
  { id: "extreme-cold-exact-wardrobe", weather: weather.extremeCold, wardrobe: wardrobes.exactPhotos, preferences: { ...basePrefs, gender: "male", locationContext: "outdoors" } },
  { id: "extreme-cold-misleading-wardrobe", weather: weather.extremeCold, wardrobe: wardrobes.misleadingPhotos, preferences: { ...basePrefs, gender: "male", locationContext: "outdoors" } },
  { id: "mild-signed-in-male", weather: weather.mildOvercast, wardrobe: wardrobes.signedInStyle, preferences: { ...basePrefs, gender: "male" } },
  { id: "mild-signed-in-female", weather: weather.mildOvercast, wardrobe: wardrobes.signedInStyle, preferences: { ...basePrefs, gender: "female" } },
  { id: "mild-signed-in-nonbinary", weather: weather.mildOvercast, wardrobe: wardrobes.signedInStyle, preferences: { ...basePrefs, gender: "nonbinary" } },
  { id: "rain-empty", weather: weather.rainy, wardrobe: wardrobes.empty, preferences: { ...basePrefs, gender: "unspecified", locationContext: "transit" } },
  { id: "hot-empty", weather: weather.hot, wardrobe: wardrobes.empty, preferences: { ...basePrefs, gender: "unspecified", hot: true, locationContext: "outdoors" } },
];

function textForOutfit(outfit = {}, details = {}) {
  const accessories = Array.isArray(outfit.accessories) ? outfit.accessories : [outfit.accessories];
  return [
    outfit.top,
    outfit.bottom,
    outfit.outer,
    outfit.shoes,
    ...accessories,
    details.top?.material,
    details.bottom?.material,
    details.outer?.material,
    details.shoes?.material,
    details.accessory?.material,
  ].filter(Boolean).join(" ").toLowerCase();
}

function addIssue(issues, severity, code, message) {
  issues.push({ severity, code, message });
}

function inspectResult(testCase, response) {
  const issues = [];
  const outfit = response?.outfit || {};
  const details = response?.itemDetails || {};
  const images = response?.outfitImages || {};
  const text = textForOutfit(outfit, details);
  const feelsLike = Number(testCase.weather.feelsLike ?? testCase.weather.temperature);

  if (feelsLike <= -5) {
    if (!/\b(thermal|wool|merino|fleece|insulated|sweater|base layer)\b/.test(`${outfit.top || ""} ${details.top?.material || ""}`.toLowerCase())) {
      addIssue(issues, "severe", "extreme_cold_top", "Extreme cold top is not insulating.");
    }
    if (!/\b(insulated|snow|ski|shell|lined|wool)\b/.test(`${outfit.bottom || ""} ${details.bottom?.material || ""}`.toLowerCase())) {
      addIssue(issues, "severe", "extreme_cold_bottom", "Extreme cold bottom is not insulated or snow-ready.");
    }
    if (!/\b(parka|puffer|down|insulated|winter coat|heavy coat)\b/.test(`${outfit.outer || ""} ${details.outer?.material || ""}`.toLowerCase())) {
      addIssue(issues, "severe", "extreme_cold_outer", "Extreme cold outer is not substantial enough.");
    }
    if (!/\b(winter boots?|snow boots?|insulated boots?|waterproof boots?)\b/.test(`${outfit.shoes || ""} ${details.shoes?.material || ""}`.toLowerCase())) {
      addIssue(issues, "severe", "extreme_cold_shoes", "Extreme cold shoes are not winter boots.");
    }
    if (/\b(polo|shorts|sandals|sneakers)\b/.test(text)) {
      addIssue(issues, "severe", "extreme_cold_unsafe_piece", "Extreme cold includes an obviously unsafe light piece.");
    }
  }

  if (testCase.preferences.gender === "male" && /\b(dress|skirt|blouse|heels?|ballet flats?|mary jane|stiletto|clutch|hair clip|beret)\b/.test(text)) {
    addIssue(issues, "severe", "male_presentation_mismatch", "Male preference received a feminine-coded outfit item.");
  }
  if (testCase.preferences.gender === "female" && /\b(necktie|bow tie|menswear|men's)\b/.test(text)) {
    addIssue(issues, "severe", "female_presentation_mismatch", "Female preference received a masculine-coded outfit item.");
  }

  Object.entries(images).forEach(([slot, image]) => {
    const haystack = `${image?.key || ""} ${image?.path || ""} ${image?.description || ""}`.toLowerCase();
    if (/accessory/.test(slot) && /\bcap\b/.test(text) && /\bgloves?\b/.test(haystack)) {
      addIssue(issues, "severe", "cap_matched_to_gloves", "A cap-like accessory used glove imagery.");
    }
    if (testCase.preferences.gender === "male" && /_fem|fem-|feminine|dress/.test(haystack)) {
      addIssue(issues, "severe", "male_stock_feminine", `Male preference used feminine stock image for ${slot}.`);
    }
    if (image?.source === "wardrobe" && !image.path?.startsWith("data:image/")) {
      addIssue(issues, "severe", "wardrobe_photo_not_preserved", `Wardrobe image for ${slot} did not preserve data URL photo.`);
    }
  });

  if (testCase.wardrobe.some((item) => item.photoDataUrl) && testCase.id.includes("exact")) {
    const wardrobeSources = Object.values(images).filter((image) => image?.source === "wardrobe").length;
    if (wardrobeSources < 3) {
      addIssue(issues, "severe", "expected_wardrobe_priority", "Exact wardrobe case did not use enough wardrobe photos.");
    }
  }

  if (response?.performance?.fallback && !response?.fallbackReason && !response?.recommendationSource) {
    addIssue(issues, "warning", "unexplained_fallback", "Fallback occurred without structured source/reason metadata.");
  }

  return issues;
}

async function postJson(path, body) {
  const startedAt = Date.now();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    json = { raw };
  }
  return { ok: res.ok, status: res.status, durationMs: Date.now() - startedAt, json };
}

const results = [];
for (const testCase of cases) {
  const payload = {
    weather: testCase.weather,
    wardrobe: testCase.wardrobe,
    preferences: testCase.preferences,
    location: { name: "Launch audit", lat: 0, lon: 0 },
  };
  const response = await postJson("/api/recommend", payload);
  const issues = response.ok ? inspectResult(testCase, response.json) : [{ severity: "severe", code: "http_error", message: `HTTP ${response.status}` }];
  results.push({
    id: testCase.id,
    status: response.status,
    durationMs: response.durationMs,
    ok: response.ok,
    issues,
    outfit: response.json?.outfit || null,
    outfitImages: response.json?.outfitImages || null,
    quality: response.json?.quality || null,
    recommendationSource: response.json?.recommendationSource || null,
    fallbackReason: response.json?.fallbackReason || response.json?.performance?.fallback || null,
  });
  console.error(`[${results.length}/${cases.length}] ${testCase.id}: ${response.status} ${response.durationMs}ms issues=${issues.length}`);
}

const severe = results.flatMap((result) => result.issues.filter((issue) => issue.severity === "severe").map((issue) => ({ caseId: result.id, ...issue })));
const warnings = results.flatMap((result) => result.issues.filter((issue) => issue.severity !== "severe").map((issue) => ({ caseId: result.id, ...issue })));
const summary = {
  baseUrl,
  runId,
  totalCases: results.length,
  successes: results.filter((result) => result.ok).length,
  severeCount: severe.length,
  warningCount: warnings.length,
  pass: severe.length === 0 && results.every((result) => result.ok),
  severe,
  warnings,
};

writeFileSync(outputPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, summary }, null, 2));
if (!summary.pass) process.exitCode = 1;
