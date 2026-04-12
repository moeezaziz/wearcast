import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outDir = join(rootDir, "tmp");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.WEARCAST_RECOMMEND_URL || "http://127.0.0.1:3001";
const endpoint = `${baseUrl.replace(/\/$/, "")}/api/recommend`;
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = join(outDir, `recommendation-matrix-${runId}.jsonl`);
const summaryPath = join(outDir, `recommendation-matrix-${runId}.summary.json`);
const concurrency = Math.max(1, Number(process.env.WEARCAST_MATRIX_CONCURRENCY || 6));

const cities = [
  { country: "Germany", name: "Berlin", lat: 52.52, lon: 13.405 },
  { country: "Germany", name: "Munich", lat: 48.1374, lon: 11.5755 },
  { country: "Germany", name: "Hamburg", lat: 53.5511, lon: 9.9937 },
  { country: "Germany", name: "Frankfurt", lat: 50.1109, lon: 8.6821 },
  { country: "Germany", name: "Cologne", lat: 50.9375, lon: 6.9603 },
  { country: "United States", name: "New York", lat: 40.7128, lon: -74.006 },
  { country: "United States", name: "San Francisco", lat: 37.7749, lon: -122.4194 },
  { country: "United States", name: "Chicago", lat: 41.8781, lon: -87.6298 },
  { country: "United States", name: "Seattle", lat: 47.6062, lon: -122.3321 },
  { country: "United States", name: "Boston", lat: 42.3601, lon: -71.0589 },
  { country: "Pakistan", name: "Islamabad", lat: 33.6844, lon: 73.0479 },
  { country: "Pakistan", name: "Karachi", lat: 24.8607, lon: 67.0011 },
  { country: "Pakistan", name: "Lahore", lat: 31.5204, lon: 74.3587 },
  { country: "Pakistan", name: "Rawalpindi", lat: 33.5651, lon: 73.0169 },
  { country: "Pakistan", name: "Faisalabad", lat: 31.4504, lon: 73.135 },
  { country: "Ireland", name: "Dublin", lat: 53.3498, lon: -6.2603 },
  { country: "Ireland", name: "Cork", lat: 51.8985, lon: -8.4756 },
  { country: "Ireland", name: "Galway", lat: 53.2707, lon: -9.0568 },
  { country: "Ireland", name: "Limerick", lat: 52.6638, lon: -8.6267 },
  { country: "Ireland", name: "Waterford", lat: 52.2593, lon: -7.1101 },
  { country: "Italy", name: "Milan", lat: 45.4642, lon: 9.19 },
  { country: "Italy", name: "Rome", lat: 41.9028, lon: 12.4964 },
  { country: "Italy", name: "Turin", lat: 45.0703, lon: 7.6869 },
  { country: "Italy", name: "Bologna", lat: 44.4949, lon: 11.3426 },
  { country: "Italy", name: "Florence", lat: 43.7696, lon: 11.2558 },
  { country: "Switzerland", name: "Zurich", lat: 47.3769, lon: 8.5417 },
  { country: "Switzerland", name: "Geneva", lat: 46.2044, lon: 6.1432 },
  { country: "Switzerland", name: "Basel", lat: 47.5596, lon: 7.5886 },
  { country: "Switzerland", name: "Lausanne", lat: 46.5197, lon: 6.6323 },
  { country: "Switzerland", name: "Bern", lat: 46.948, lon: 7.4474 },
];

const profiles = [
  {
    id: "office_mild_clear",
    weather: {
      temperature: 18,
      feelsLike: 17,
      wind: 12,
      gusts: 18,
      humidity: 56,
      cloud: 18,
      precip: 0,
      precipProb: 8,
      uv: 4,
      weatherLabel: "Mainly clear",
      isDay: true,
      remainingForecast: {
        tempRange: "16°C – 20°C",
        feelsLikeRange: "15°C – 19°C",
        maxWind: "18 km/h",
        maxPrecipProb: "10%",
        totalPrecip: "0 mm",
        peakUV: 4,
        avgHumidity: "57%",
      },
    },
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
  {
    id: "commute_rain",
    weather: {
      temperature: 14,
      feelsLike: 11,
      wind: 23,
      gusts: 31,
      humidity: 82,
      cloud: 92,
      precip: 1.4,
      precipProb: 78,
      uv: 2,
      weatherLabel: "Rain",
      isDay: true,
      remainingForecast: {
        tempRange: "11°C – 15°C",
        feelsLikeRange: "8°C – 13°C",
        maxWind: "32 km/h",
        maxPrecipProb: "82%",
        totalPrecip: "7.3 mm",
        peakUV: 2,
        avgHumidity: "83%",
      },
    },
    preferences: {
      cold: false,
      hot: false,
      formal: false,
      casual: true,
      sporty: false,
      streetwear: false,
      minimalist: false,
      bike: true,
      activityContext: "commute",
      locationContext: "transit",
      styleFocus: "casual",
      fashionNotes: null,
    },
  },
  {
    id: "sporty_exposed_breezy",
    weather: {
      temperature: 18.5,
      feelsLike: 14.2,
      wind: 24.6,
      gusts: 33,
      humidity: 61,
      cloud: 24,
      precip: 0,
      precipProb: 10,
      uv: 4,
      weatherLabel: "Mainly clear",
      isDay: true,
      remainingForecast: {
        tempRange: "14°C – 19°C",
        feelsLikeRange: "11°C – 17°C",
        maxWind: "33 km/h",
        maxPrecipProb: "12%",
        totalPrecip: "0 mm",
        peakUV: 4,
        avgHumidity: "62%",
      },
    },
    preferences: {
      cold: false,
      hot: true,
      formal: false,
      casual: false,
      sporty: true,
      streetwear: false,
      minimalist: false,
      bike: false,
      activityContext: "workout",
      locationContext: "exposed",
      styleFocus: "sporty",
      fashionNotes: null,
    },
  },
  {
    id: "cold_outdoors",
    weather: {
      temperature: 6,
      feelsLike: 2,
      wind: 29,
      gusts: 39,
      humidity: 74,
      cloud: 68,
      precip: 0.2,
      precipProb: 32,
      uv: 2,
      weatherLabel: "Partly cloudy",
      isDay: true,
      remainingForecast: {
        tempRange: "3°C – 7°C",
        feelsLikeRange: "-1°C – 4°C",
        maxWind: "39 km/h",
        maxPrecipProb: "35%",
        totalPrecip: "0.4 mm",
        peakUV: 2,
        avgHumidity: "75%",
      },
    },
    preferences: {
      cold: true,
      hot: false,
      formal: false,
      casual: false,
      sporty: false,
      streetwear: false,
      minimalist: false,
      bike: false,
      activityContext: "walking",
      locationContext: "outdoors",
      styleFocus: "auto",
      fashionNotes: null,
    },
  },
  {
    id: "hot_urban_evening",
    weather: {
      temperature: 31,
      feelsLike: 35,
      wind: 10,
      gusts: 16,
      humidity: 71,
      cloud: 20,
      precip: 0,
      precipProb: 6,
      uv: 7,
      weatherLabel: "Partly cloudy",
      isDay: true,
      remainingForecast: {
        tempRange: "29°C – 33°C",
        feelsLikeRange: "33°C – 37°C",
        maxWind: "16 km/h",
        maxPrecipProb: "8%",
        totalPrecip: "0 mm",
        peakUV: 7,
        avgHumidity: "72%",
      },
    },
    preferences: {
      cold: false,
      hot: true,
      formal: false,
      casual: false,
      sporty: false,
      streetwear: true,
      minimalist: false,
      bike: false,
      activityContext: "evening",
      locationContext: "event",
      styleFocus: "streetwear",
      fashionNotes: null,
    },
  },
  {
    id: "minimal_indoor_transition",
    weather: {
      temperature: 21,
      feelsLike: 21,
      wind: 9,
      gusts: 13,
      humidity: 49,
      cloud: 30,
      precip: 0,
      precipProb: 5,
      uv: 5,
      weatherLabel: "Clear",
      isDay: true,
      remainingForecast: {
        tempRange: "19°C – 23°C",
        feelsLikeRange: "19°C – 23°C",
        maxWind: "13 km/h",
        maxPrecipProb: "7%",
        totalPrecip: "0 mm",
        peakUV: 5,
        avgHumidity: "50%",
      },
    },
    preferences: {
      cold: false,
      hot: false,
      formal: false,
      casual: false,
      sporty: false,
      streetwear: false,
      minimalist: true,
      bike: false,
      activityContext: "everyday",
      locationContext: "indoors",
      styleFocus: "minimalist",
      fashionNotes: "clean and understated",
    },
  },
];

const wardrobeVariants = [
  {
    id: "empty",
    wardrobe: [],
  },
  {
    id: "starter_capsule",
    wardrobe: [
      { id: 1, type: "top", name: "White T-shirt", color: "White", material: "Cotton", careInstructions: [] },
      { id: 2, type: "bottom", name: "Black Trousers", color: "Black", material: "Wool blend", careInstructions: [] },
      { id: 3, type: "outer", name: "Black Shell Jacket", color: "Black", material: "Technical shell", careInstructions: [] },
      { id: 4, type: "shoes", name: "White Sneakers", color: "White", material: "Leather", careInstructions: [] },
      { id: 5, type: "accessory", name: "Black Cap", color: "Black", material: "Cotton twill", careInstructions: [] },
    ],
  },
];

const cases = [];
for (const city of cities) {
  for (const profile of profiles) {
    for (const wardrobeVariant of wardrobeVariants) {
      cases.push({
        city,
        profile,
        wardrobeVariant,
      });
    }
  }
}

async function runCase(entry, index, total) {
  const location = {
    lat: entry.city.lat,
    lon: entry.city.lon,
    name: `${entry.city.name}, ${entry.city.country}`,
  };
  const payload = {
    weather: entry.profile.weather,
    wardrobe: entry.wardrobeVariant.wardrobe,
    preferences: entry.profile.preferences,
    location,
  };

  const startedAt = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    const result = {
      index: index + 1,
      total,
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - startedAt,
      city: location.name,
      profile: entry.profile.id,
      wardrobeVariant: entry.wardrobeVariant.id,
      request: payload,
      response: parsed,
    };
    appendFileSync(outputPath, `${JSON.stringify(result)}\n`);
    console.error(`[${index + 1}/${total}] ${location.name} | ${entry.profile.id} | ${entry.wardrobeVariant.id} -> ${res.status}`);
    return result;
  } catch (error) {
    const result = {
      index: index + 1,
      total,
      ok: false,
      status: "FETCH_ERROR",
      durationMs: Date.now() - startedAt,
      city: location.name,
      profile: entry.profile.id,
      wardrobeVariant: entry.wardrobeVariant.id,
      request: payload,
      error: error?.message || String(error),
    };
    appendFileSync(outputPath, `${JSON.stringify(result)}\n`);
    console.error(`[${index + 1}/${total}] ${location.name} | ${entry.profile.id} | ${entry.wardrobeVariant.id} -> ERROR ${result.error}`);
    return result;
  }
}

const summary = {
  endpoint,
  totalCases: cases.length,
  concurrency,
  countries: [...new Set(cities.map((city) => city.country))],
  profiles: profiles.map((profile) => profile.id),
  wardrobeVariants: wardrobeVariants.map((variant) => variant.id),
  outputPath,
  successes: 0,
  failures: 0,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  byStatus: {},
};

let nextIndex = 0;
const workers = Array.from({ length: concurrency }, async () => {
  while (nextIndex < cases.length) {
    const currentIndex = nextIndex;
    nextIndex += 1;
    const result = await runCase(cases[currentIndex], currentIndex, cases.length);
    if (result.ok) summary.successes += 1;
    else summary.failures += 1;
    const statusKey = String(result.status);
    summary.byStatus[statusKey] = (summary.byStatus[statusKey] || 0) + 1;
  }
});

await Promise.all(workers);

summary.finishedAt = new Date().toISOString();
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log(JSON.stringify({
  ...summary,
  summaryPath,
}, null, 2));
