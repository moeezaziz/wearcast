import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import https from "https";
import express from "express";
import cors from "cors";
import { initDB } from "./db.js";
import authRoutes from "./routes/auth.js";
import wardrobeRoutes from "./routes/wardrobe.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve the frontend static files from the 'www' directory
app.use(express.static(join(__dirname, "..", "www")));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "auto";
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;
const RECOMMENDATION_CACHE_TTL_MS = 2 * 60 * 1000;
const weatherCache = new Map();
const recommendationCache = new Map();

function decodeOAuthState(state) {
  if (!state || typeof state !== "string") return {};
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

async function chatCompletion(messages, { maxTokens = 560 } = {}) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://wearcast.app",
      "X-Title": "WearCast",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
      reasoning: { effort: "none" },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function kmhFromMs(value) {
  const n = toNumber(value);
  return n == null ? null : n * 3.6;
}

function inferIsDay(symbolCode, fallbackTime) {
  if (typeof symbolCode === "string") {
    if (symbolCode.includes("_day")) return 1;
    if (symbolCode.includes("_night")) return 0;
  }
  if (!fallbackTime) return null;
  const hour = new Date(fallbackTime).getUTCHours();
  return hour >= 6 && hour < 18 ? 1 : 0;
}

function metSymbolToWmoCode(symbolCode = "") {
  if (!symbolCode) return 3;
  if (symbolCode.includes("thunder")) return 95;
  if (symbolCode.includes("heavysleet")) return 67;
  if (symbolCode.includes("sleet")) return 66;
  if (symbolCode.includes("heavysnow")) return 75;
  if (symbolCode.includes("snow")) return 73;
  if (symbolCode.includes("heavyrainshowers")) return 82;
  if (symbolCode.includes("rainshowers")) return 81;
  if (symbolCode.includes("heavyrain")) return 65;
  if (symbolCode.includes("rain")) return 63;
  if (symbolCode.includes("heavydrizzle")) return 55;
  if (symbolCode.includes("drizzle")) return 53;
  if (symbolCode.includes("fog")) return 45;
  if (symbolCode.includes("fair")) return 1;
  if (symbolCode.includes("partlycloudy")) return 2;
  if (symbolCode.includes("clearsky")) return 0;
  if (symbolCode.includes("cloudy")) return 3;
  return 3;
}

async function fetchOpenMeteoWeather(lat, lon) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "cloud_cover",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m",
      "uv_index",
      "visibility",
      "is_day",
    ].join(",")
  );
  url.searchParams.set(
    "hourly",
    [
      "precipitation_probability",
      "precipitation",
      "rain",
      "snowfall",
      "temperature_2m",
      "apparent_temperature",
      "wind_speed_10m",
      "relative_humidity_2m",
      "cloud_cover",
      "uv_index",
    ].join(",")
  );
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo failed (${res.status})`);
  return res.json();
}

async function fetchMetNorwayWeather(lat, lon) {
  const url = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": "WearCast/1.0 https://wearcast.fly.dev",
    },
  });
  if (!res.ok) throw new Error(`MET Norway failed (${res.status})`);
  const data = await res.json();
  return normalizeMetNorwayWeather(data);
}

async function fetchWeatherWithFallback(lat, lon) {
  try {
    return await fetchOpenMeteoWeather(lat, lon);
  } catch (openMeteoErr) {
    console.warn("Open-Meteo fallback trigger:", openMeteoErr);
    return fetchMetNorwayWeather(lat, lon);
  }
}

function weatherCacheKey(lat, lon) {
  return `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
}

function getCachedWeather(lat, lon) {
  const entry = weatherCache.get(weatherCacheKey(lat, lon));
  if (!entry) return null;
  if (Date.now() - entry.savedAt > WEATHER_CACHE_TTL_MS) {
    weatherCache.delete(weatherCacheKey(lat, lon));
    return null;
  }
  return entry.data;
}

function setCachedWeather(lat, lon, data) {
  weatherCache.set(weatherCacheKey(lat, lon), {
    savedAt: Date.now(),
    data,
  });
}

function recommendationCacheKey(weather, wardrobe, preferences) {
  return JSON.stringify({
    temperature: Math.round(Number(weather?.temperature) || 0),
    feelsLike: Math.round(Number(weather?.feelsLike) || 0),
    wind: Math.round(Number(weather?.wind) || 0),
    precipProb: Math.round(Number(weather?.precipProb) || 0),
    weatherLabel: weather?.weatherLabel || "",
    remainingForecast: weather?.remainingForecast || null,
    wardrobe: Array.isArray(wardrobe)
      ? wardrobe.map((item) => ({
          id: item.id ?? null,
          type: item.type ?? "",
          name: item.name ?? "",
          color: item.color ?? "",
          material: item.material ?? "",
        }))
      : [],
    preferences: preferences || {},
  });
}

function getCachedRecommendation(key) {
  const entry = recommendationCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > RECOMMENDATION_CACHE_TTL_MS) {
    recommendationCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedRecommendation(key, data) {
  recommendationCache.set(key, {
    savedAt: Date.now(),
    data,
  });
}

function normalizeMetNorwayWeather(data) {
  const timeseries = data?.properties?.timeseries;
  if (!Array.isArray(timeseries) || timeseries.length === 0) {
    throw new Error("MET Norway returned no timeseries");
  }

  const hourlyEntries = timeseries.slice(0, 48);
  const currentEntry = hourlyEntries[0];
  const currentDetails = currentEntry?.data?.instant?.details || {};
  const currentPeriod = currentEntry?.data?.next_1_hours || currentEntry?.data?.next_6_hours || currentEntry?.data?.next_12_hours || {};
  const currentPeriodDetails = currentPeriod?.details || {};
  const currentSymbol = currentPeriod?.summary?.symbol_code || "";

  return {
    current: {
      time: currentEntry.time,
      temperature_2m: toNumber(currentDetails.air_temperature, 0),
      apparent_temperature: toNumber(currentDetails.air_temperature, 0),
      relative_humidity_2m: toNumber(currentDetails.relative_humidity, 0),
      cloud_cover: toNumber(currentDetails.cloud_area_fraction, 0),
      precipitation: toNumber(currentPeriodDetails.precipitation_amount, 0),
      weather_code: metSymbolToWmoCode(currentSymbol),
      wind_speed_10m: kmhFromMs(currentDetails.wind_speed) ?? 0,
      wind_gusts_10m: kmhFromMs(currentDetails.wind_speed_of_gust) ?? kmhFromMs(currentDetails.wind_speed) ?? 0,
      uv_index: toNumber(currentDetails.ultraviolet_index_clear_sky, 0),
      visibility: null,
      is_day: inferIsDay(currentSymbol, currentEntry.time),
    },
    hourly: {
      time: hourlyEntries.map((entry) => entry.time),
      precipitation_probability: hourlyEntries.map((entry) => toNumber(entry?.data?.next_1_hours?.details?.probability_of_precipitation, 0)),
      precipitation: hourlyEntries.map((entry) => toNumber(entry?.data?.next_1_hours?.details?.precipitation_amount, 0)),
      rain: hourlyEntries.map((entry) => {
        const amount = toNumber(entry?.data?.next_1_hours?.details?.precipitation_amount, 0);
        const symbol = entry?.data?.next_1_hours?.summary?.symbol_code || "";
        return symbol.includes("snow") || symbol.includes("sleet") ? 0 : amount;
      }),
      snowfall: hourlyEntries.map((entry) => {
        const amount = toNumber(entry?.data?.next_1_hours?.details?.precipitation_amount, 0);
        const symbol = entry?.data?.next_1_hours?.summary?.symbol_code || "";
        return symbol.includes("snow") ? amount : 0;
      }),
      temperature_2m: hourlyEntries.map((entry) => toNumber(entry?.data?.instant?.details?.air_temperature, 0)),
      apparent_temperature: hourlyEntries.map((entry) => toNumber(entry?.data?.instant?.details?.air_temperature, 0)),
      wind_speed_10m: hourlyEntries.map((entry) => kmhFromMs(entry?.data?.instant?.details?.wind_speed) ?? 0),
      relative_humidity_2m: hourlyEntries.map((entry) => toNumber(entry?.data?.instant?.details?.relative_humidity, 0)),
      cloud_cover: hourlyEntries.map((entry) => toNumber(entry?.data?.instant?.details?.cloud_area_fraction, 0)),
      uv_index: hourlyEntries.map((entry) => toNumber(entry?.data?.instant?.details?.ultraviolet_index_clear_sky, 0)),
    },
  };
}

function extractJsonObject(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = trimmed.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i += 1) {
    const ch = trimmed[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;

    if (depth === 0) {
      return trimmed.slice(start, i + 1);
    }
  }

  return null;
}

function parseModelJson(text) {
  const attempts = [];
  const direct = typeof text === "string"
    ? text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim()
    : "";
  if (direct) attempts.push(direct);

  const extracted = extractJsonObject(text);
  if (extracted && extracted !== direct) attempts.push(extracted);

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  throw new Error("Model did not return valid JSON");
}

function parseFirstJsonString(fragment) {
  if (typeof fragment !== "string") return null;
  const start = fragment.indexOf("\"");
  if (start === -1) return null;

  let escaped = false;
  for (let i = start + 1; i < fragment.length; i += 1) {
    const ch = fragment[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "\"") {
      try {
        return JSON.parse(fragment.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function parseStringArrayField(text, key, limit = 2) {
  if (typeof text !== "string") return [];
  const keyIndex = text.indexOf(`"${key}"`);
  if (keyIndex === -1) return [];
  const bracketStart = text.indexOf("[", keyIndex);
  if (bracketStart === -1) return [];

  const values = [];
  let i = bracketStart + 1;
  while (i < text.length && values.length < limit) {
    while (i < text.length && /\s|,/.test(text[i])) i += 1;
    if (i >= text.length || text[i] === "]") break;
    const value = parseFirstJsonString(text.slice(i));
    if (!value) break;
    values.push(value);
    const consumed = JSON.stringify(value).length;
    i += consumed;
  }

  return values;
}

function extractStringField(text, key) {
  if (typeof text !== "string") return null;
  const keyIndex = text.indexOf(`"${key}"`);
  if (keyIndex === -1) return null;
  const colonIndex = text.indexOf(":", keyIndex);
  if (colonIndex === -1) return null;

  const afterColon = text.slice(colonIndex + 1).trimStart();
  if (afterColon.startsWith("null")) return null;
  return parseFirstJsonString(afterColon);
}

function salvageRecommendationFromText(text) {
  const outfit = {
    top: extractStringField(text, "top"),
    bottom: extractStringField(text, "bottom"),
    outer: extractStringField(text, "outer"),
    shoes: extractStringField(text, "shoes"),
    accessories: parseStringArrayField(text, "accessories", 1),
  };

  const reasoning = extractStringField(text, "reasoning");
  const warnings = parseStringArrayField(text, "warnings", 1);
  const missingItems = parseStringArrayField(text, "missingItems", 1);

  if (!outfit.top && !outfit.bottom && !outfit.shoes && !reasoning) {
    return null;
  }

  return {
    outfit,
    reasoning,
    warnings,
    missingItems,
  };
}

function cleanInlineText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function clampSentenceCount(value, maxSentences = 2) {
  const cleaned = cleanInlineText(value);
  if (!cleaned) return "";
  const parts = cleaned.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean) || [cleaned];
  return parts.slice(0, maxSentences).join(" ").trim();
}

function normalizeList(values, { limit = 2, fallback = [] } = {}) {
  if (!Array.isArray(values)) return fallback;
  return values
    .map((value) => cleanInlineText(value))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeRecommendationResponse(parsed) {
  return {
    outfit: {
      top: cleanInlineText(parsed?.outfit?.top, "A comfortable top suited to the current temperature"),
      bottom: cleanInlineText(parsed?.outfit?.bottom, "Comfortable bottoms for today's conditions"),
      outer: cleanInlineText(parsed?.outfit?.outer) || null,
      shoes: cleanInlineText(parsed?.outfit?.shoes, "Comfortable everyday shoes"),
      accessories: normalizeList(parsed?.outfit?.accessories, { limit: 1 }),
    },
    reasoning: clampSentenceCount(
      parsed?.reasoning,
      1
    ) || "Chosen to match today's weather and keep you comfortable through the day.",
    warnings: normalizeList(parsed?.warnings, { limit: 1 }),
    missingItems: normalizeList(parsed?.missingItems, { limit: 1 }),
  };
}

function weatherCodeLabel(code) {
  const labels = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Dense drizzle",
    56: "Freezing drizzle",
    57: "Freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Rain showers",
    82: "Violent rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm + hail",
    99: "Thunderstorm + hail",
  };
  return labels[code] ?? `Code ${code}`;
}

function summarizeRemainingForecast(weatherData) {
  const hourly = weatherData?.hourly;
  const nowIso = weatherData?.current?.time || new Date().toISOString();
  if (!hourly?.time || !Array.isArray(hourly.time)) return null;

  const nowMs = new Date(nowIso).getTime();
  const todayStr = nowIso.slice(0, 10);
  const indices = [];

  for (let i = 0; i < hourly.time.length; i += 1) {
    const time = hourly.time[i];
    const hourMs = new Date(time).getTime();
    if (typeof time !== "string" || !time.startsWith(todayStr)) continue;
    if (!Number.isFinite(hourMs) || hourMs < nowMs) continue;
    indices.push(i);
  }

  if (!indices.length) return null;

  const pick = (key) =>
    indices
      .map((i) => hourly[key]?.[i])
      .filter((value) => value != null && Number.isFinite(Number(value)))
      .map(Number);
  const min = (arr) => (arr.length ? Math.min(...arr) : null);
  const max = (arr) => (arr.length ? Math.max(...arr) : null);
  const avg = (arr) =>
    arr.length ? +(arr.reduce((sum, value) => sum + value, 0) / arr.length).toFixed(1) : null;

  const temps = pick("temperature_2m");
  const feelsLike = pick("apparent_temperature");
  const winds = pick("wind_speed_10m");
  const precipProbs = pick("precipitation_probability");
  const precips = pick("precipitation");
  const uvs = pick("uv_index");
  const humidities = pick("relative_humidity_2m");

  return {
    tempRange: `${min(temps)}°C – ${max(temps)}°C`,
    feelsLikeRange: `${min(feelsLike)}°C – ${max(feelsLike)}°C`,
    maxWind: `${max(winds)} km/h`,
    maxPrecipProb: `${max(precipProbs)}%`,
    totalPrecip: `${+(precips.reduce((sum, value) => sum + value, 0)).toFixed(1)} mm`,
    peakUV: max(uvs),
    avgHumidity: `${avg(humidities)}%`,
  };
}

function buildRecommendationWeather(weatherData) {
  const current = weatherData?.current;
  if (!current) return null;

  const timeIndex = weatherData?.hourly?.time?.indexOf?.(current.time) ?? -1;

  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    wind: current.wind_speed_10m,
    gusts: current.wind_gusts_10m,
    humidity: current.relative_humidity_2m,
    cloud: current.cloud_cover,
    precip: current.precipitation,
    precipProb: timeIndex >= 0 ? weatherData?.hourly?.precipitation_probability?.[timeIndex] ?? null : null,
    uv: current.uv_index,
    weatherLabel: weatherCodeLabel(current.weather_code),
    isDay: current.is_day === 1,
    remainingForecast: summarizeRemainingForecast(weatherData),
  };
}

async function resolveRecommendationWeather(inputWeather, location) {
  const lat = toNumber(location?.lat);
  const lon = toNumber(location?.lon);

  if (inputWeather?.temperature != null && inputWeather?.feelsLike != null) {
    return {
      ...inputWeather,
      remainingForecast: inputWeather.remainingForecast || inputWeather.dayForecast || null,
    };
  }

  if (lat != null && lon != null) {
    const cachedWeather = getCachedWeather(lat, lon);
    const liveWeather = cachedWeather || await fetchWeatherWithFallback(lat, lon);
    if (!cachedWeather) setCachedWeather(lat, lon, liveWeather);
    return buildRecommendationWeather(liveWeather);
  }

  if (!inputWeather) return null;
  return {
    ...inputWeather,
    remainingForecast: inputWeather.remainingForecast || inputWeather.dayForecast || null,
  };
}

function buildFallbackRecommendation(weather) {
  const temp = Number(weather?.temperature);
  const precipProb = Number(weather?.precipProb ?? 0);
  const wind = Number(weather?.wind ?? 0);

  const top = temp <= 10 ? "A warm sweater or hoodie" : temp <= 20 ? "A light long-sleeve top or T-shirt" : "A breathable T-shirt or light top";
  const bottom = temp <= 12 ? "Long pants or jeans" : temp >= 24 ? "Lightweight trousers or shorts" : "Comfortable pants or jeans";
  const outer = temp <= 14 || precipProb >= 40 || wind >= 25 ? "A light jacket or rain layer" : null;
  const shoes = precipProb >= 40 ? "Closed-toe shoes that can handle wet ground" : "Comfortable everyday shoes";
  const accessories = [];

  if (precipProb >= 40) accessories.push("Umbrella");
  if (wind >= 25) accessories.push("Wind-resistant layer");
  if (Number(weather?.uv ?? 0) >= 6) accessories.push("Sunglasses");

  return {
    outfit: { top, bottom, outer, shoes, accessories },
    reasoning: "The AI provider returned a non-JSON response, so this fallback outfit was generated from the weather conditions instead.",
    warnings: precipProb >= 40 ? ["Rain may be likely later, so bring a waterproof layer."] : [],
    missingItems: [],
  };
}

// ─── POST /api/scan-tag ───────────────────────────────────────
app.post("/api/analyze-item-photo", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "No image provided" });

    const text = await chatCompletion([
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: image } },
          {
            type: "text",
            text: `You are analysing a clothing photo for a wardrobe app.

Return ONLY valid JSON with this shape:
{
  "type": "best clothing category such as T-shirt, Jacket, Jeans, Dress, Sneakers, Other",
  "name": "short natural item name",
  "color": "main visible color or null",
  "material": "likely material if reasonably inferable, otherwise null",
  "careInstructions": []
}

Rules:
- Keep values short.
- Use null when unsure.
- Do not include markdown fences or extra text.`,
          },
        ],
      },
    ], { maxTokens: 180 });

    const parsed = parseModelJson(text);
    res.json({
      type: typeof parsed?.type === "string" ? parsed.type : null,
      name: typeof parsed?.name === "string" ? parsed.name : null,
      color: typeof parsed?.color === "string" ? parsed.color : null,
      material: typeof parsed?.material === "string" ? parsed.material : null,
      careInstructions: Array.isArray(parsed?.careInstructions) ? parsed.careInstructions.filter((value) => typeof value === "string") : [],
    });
  } catch (err) {
    console.error("analyze-item-photo error:", err);
    res.status(500).json({ error: "Failed to analyse clothing photo" });
  }
});

// ─── POST /api/scan-tag ───────────────────────────────────────
// Accepts { image: "<base64 data-url>" }
// Returns parsed care instructions via Gemini Vision.
app.post("/api/scan-tag", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "No image provided" });

    const match = image.match(/^data:(.+?);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "Invalid image format. Expected base64 data URL." });

    const text = await chatCompletion([
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: image } },
          {
            type: "text",
            text: `You are analysing a photo of a clothing care label / tag.

Extract ALL information you can see and return **only** valid JSON (no markdown fences) with these fields:

{
  "material": "fabric composition, e.g. 80% cotton, 20% polyester",
  "careInstructions": ["machine wash cold", "tumble dry low", ...],
  "brand": "brand name if visible, else null",
  "madeIn": "country if visible, else null",
  "size": "size if visible, else null",
  "extras": "any other notable info, else null"
}

If the image is not a care tag or is unreadable, return:
{ "error": "Could not read care tag" }`,
          },
        ],
      },
    ]);

    const parsed = parseModelJson(text);
    res.json(parsed);
  } catch (err) {
    console.error("scan-tag error:", err);
    res.status(500).json({ error: "Failed to analyse care tag" });
  }
});

// ─── POST /api/recommend ──────────────────────────────────────
// Accepts { weather, wardrobe, preferences }
// Returns AI outfit recommendation based on wardrobe + conditions.
app.post("/api/recommend", async (req, res) => {
  try {
    const { weather, wardrobe, preferences, location } = req.body;
    const resolvedWeather = await resolveRecommendationWeather(weather, location);
    if (!resolvedWeather) return res.status(400).json({ error: "No weather data or location provided" });
    const wardrobeItems = Array.isArray(wardrobe) ? wardrobe : [];
    const hasWardrobe = wardrobeItems.length > 0;

    const cacheKey = recommendationCacheKey(resolvedWeather, wardrobeItems, preferences);
    const cachedRecommendation = getCachedRecommendation(cacheKey);
    if (cachedRecommendation) {
      return res.json(cachedRecommendation);
    }

    const wardrobeDesc =
      hasWardrobe
        ? wardrobeItems
            .map(
              (item) =>
                `- ${item.type}: ${item.name}${item.color ? ` (${item.color})` : ""}${item.material ? ` [${item.material}]` : ""}${item.careInstructions?.length ? ` care: ${item.careInstructions.join(", ")}` : ""}`
            )
            .join("\n")
        : "User has no saved wardrobe items. Suggest a generic outfit only.";

    const prefsDesc = [];
    if (preferences?.cold) prefsDesc.push("runs cold (feels colder than average)");
    if (preferences?.hot) prefsDesc.push("runs hot (feels warmer than average)");
    if (preferences?.formal) prefsDesc.push("prefers polished or smart-casual style");
    if (preferences?.casual) prefsDesc.push("prefers casual everyday outfits");
    if (preferences?.sporty) prefsDesc.push("prefers sporty or athleisure looks");
    if (preferences?.streetwear) prefsDesc.push("prefers streetwear-inspired outfits");
    if (preferences?.minimalist) prefsDesc.push("prefers minimalist styling");
    if (preferences?.bike) prefsDesc.push("plans to bike or walk (active)");
    if (preferences?.fashionNotes) prefsDesc.push(`style notes: ${preferences.fashionNotes}`);

    const dayFc = resolvedWeather.remainingForecast;
    const dayForecastDesc = dayFc
      ? `## Forecast For The Rest Of Today
- Temperature range: ${dayFc.tempRange}
- Feels-like range: ${dayFc.feelsLikeRange}
- Max wind: ${dayFc.maxWind}
- Max precipitation probability: ${dayFc.maxPrecipProb}
- Total precipitation: ${dayFc.totalPrecip}
- Peak UV index: ${dayFc.peakUV}
- Average humidity: ${dayFc.avgHumidity}`
      : "## Forecast For The Rest Of Today\n- No later-hour forecast summary available.";

    const prompt = `You are WearCast, a smart clothing recommendation assistant.

Given the current weather and the forecast from NOW through the rest of today, suggest a specific outfit they should wear for the rest of today.${hasWardrobe ? " Pick actual items from their wardrobe when possible." : " The user has no wardrobe saved, so suggest a generic outfit."}

## Current Weather
- Temperature: ${resolvedWeather.temperature}°C (feels like ${resolvedWeather.feelsLike}°C)
- Wind: ${resolvedWeather.wind} km/h (gusts ${resolvedWeather.gusts} km/h)
- Humidity: ${resolvedWeather.humidity}%
- Cloud cover: ${resolvedWeather.cloud}%
- Precipitation: ${resolvedWeather.precip} mm/h
- Precipitation probability: ${resolvedWeather.precipProb ?? "unknown"}%
- UV index: ${resolvedWeather.uv}
- Weather: ${resolvedWeather.weatherLabel}
- Is daytime: ${resolvedWeather.isDay ? "yes" : "no"}

${dayForecastDesc}

## User Preferences
${prefsDesc.length ? prefsDesc.join("\n") : "No special preferences set."}

## User's Wardrobe
${wardrobeDesc}

## Instructions
1. Recommend a COMPLETE outfit using short item names only.
2. Consider ONLY the forecast from now onward today.
3. ${hasWardrobe ? "Reference SPECIFIC wardrobe items by name." : "Do not mention missing wardrobe pieces beyond one short missing-item suggestion."}
4. Keep reasoning to ONE short sentence.
5. Return at most ONE accessory, ONE warning, and ONE missing item.
6. Do not explain each clothing piece separately.
7. Return JSON only.

Return ONLY valid JSON (no markdown fences):
{
  "outfit": {
    "top": "short item name",
    "bottom": "short item name",
    "outer": "short item name, or null if not needed",
    "shoes": "short item name",
    "accessories": ["one optional item"]
  },
  "reasoning": "One short sentence",
  "warnings": ["one short warning if needed"],
  "missingItems": ["one short missing item if needed"]
}`;

    const text = await chatCompletion(
      [{ role: "user", content: prompt }],
      { maxTokens: hasWardrobe ? 280 : 180 }
    );
    console.info("AI recommendation response:", text);

    try {
      const parsed = parseModelJson(text);
      const response = normalizeRecommendationResponse(parsed);
      setCachedRecommendation(cacheKey, response);
      res.json(response);
    } catch (parseErr) {
      console.warn("recommend parse fallback:", parseErr);
      const salvaged = salvageRecommendationFromText(text);
      if (salvaged) {
        const response = normalizeRecommendationResponse(salvaged);
        setCachedRecommendation(cacheKey, response);
        return res.json(response);
      }
      const response = buildFallbackRecommendation(resolvedWeather);
      setCachedRecommendation(cacheKey, response);
      res.json(response);
    }
  } catch (err) {
    console.error("recommend error:", err);
    res.status(500).json({ error: "Failed to generate recommendation" });
  }
});

app.get("/api/weather", async (req, res) => {
  const lat = toNumber(req.query.lat);
  const lon = toNumber(req.query.lon);

  if (lat == null || lon == null) {
    return res.status(400).json({ error: "Missing or invalid lat/lon" });
  }

  try {
    const data = await fetchOpenMeteoWeather(lat, lon);
    setCachedWeather(lat, lon, data);
    return res.json({ ...data, provider: "open-meteo" });
  } catch (openMeteoErr) {
    console.warn("Open-Meteo fallback trigger:", openMeteoErr);
    try {
      const fallback = await fetchMetNorwayWeather(lat, lon);
      setCachedWeather(lat, lon, fallback);
      return res.json({ ...fallback, provider: "met-norway" });
    } catch (fallbackErr) {
      console.error("weather fetch error:", { openMeteoErr, fallbackErr });
      return res.status(502).json({ error: "All weather providers failed" });
    }
  }
});

// ─── Auth & Wardrobe routes ──────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/wardrobe", wardrobeRoutes);

// Google OAuth HTTPS → custom scheme bridge for Capacitor and web
app.get('/oauth2redirect/google', (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  const state = req.query.state;
  const stateData = decodeOAuthState(state);

  const isNative = stateData.platform === "native";

  const buildQuery = (params) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const qs = query.toString();
    return qs ? `?${qs}` : "";
  };

  if (error) {
    if (isNative) {
      return res.redirect(`com.wearcast-beta.app:/oauth2redirect/google${buildQuery({ error, state })}`);
    }
    return res.redirect(`/${buildQuery({ auth_error: error, state })}`);
  }

  if (!code) {
    if (isNative) {
      return res.redirect(`com.wearcast-beta.app:/oauth2redirect/google${buildQuery({ error: "no_code", state })}`);
    }
    return res.redirect(`/${buildQuery({ auth_error: "no_code", state })}`);
  }

  if (isNative) {
    // Redirect back to app with code for native flow
    return res.redirect(`com.wearcast-beta.app:/oauth2redirect/google${buildQuery({ code, state })}`);
  }

  // Redirect to SPA with code for web flow
  return res.redirect(`/${buildQuery({ code, state })}`);
});

import http from "http";
import { text } from "stream/consumers";

const IS_PROD = process.env.NODE_ENV === "production";

async function startServer() {
  // Initialize database tables
  if (process.env.DATABASE_URL) {
    await initDB();
  }

  if (IS_PROD) {
    http.createServer(app).listen(PORT, "0.0.0.0", () => {
      console.info(`WearCast → http://0.0.0.0:${PORT}`);
    });
  } else {
    const sslOpts = {
      key: readFileSync(join(__dirname, "certs", "key.pem")),
      cert: readFileSync(join(__dirname, "certs", "cert.pem")),
    };
    // http.createServer(app).listen(4000, "0.0.0.0", () => {
    //   console.info(`WearCast HTTP  → http://localhost:4000`);
    // });
    https.createServer(sslOpts, app).listen(PORT, "0.0.0.0", () => {
      console.info(`WearCast HTTPS → https://localhost:${PORT}`);
    });
  }
}

startServer().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
