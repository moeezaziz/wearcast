import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import https from "https";
import { randomUUID } from "crypto";
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
const RECOMMENDATION_COPY_VERSION = 7;
const weatherCache = new Map();
const recommendationCache = new Map();
const STOCK_IMAGE_CATALOG = {
  top_white_tshirt_studio: {
    slot: "top",
    path: "assets/recommendation-stock/top-white-tshirt-studio.jpg",
    description: "white crew-neck T-shirt in a clean studio flat lay",
    keywords: ["t-shirt", "tee", "tee shirt", "tshirt", "short sleeve", "crew neck", "basic tee"],
    fallback: true,
  },
  top_white_button_up_shirt: {
    slot: "top",
    path: "assets/recommendation-stock/top-white-button-up-shirt.jpg",
    description: "white button-up shirt on hangers in soft studio light",
    keywords: ["button-up", "button down", "button-up shirt", "button-down", "oxford", "dress shirt", "collared shirt", "white shirt"],
  },
  top_knit_sweater_hanger: {
    slot: "top",
    path: "assets/recommendation-stock/top-knit-sweater-hanger.jpg",
    description: "knit sweater hanging on a wooden hanger",
    keywords: ["sweater", "knit", "jumper", "pullover", "crewneck", "thermal", "base layer", "thermal shirt", "long-sleeve thermal shirt"],
  },
  bottom_blue_jeans_stack: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-blue-jeans-stack.jpg",
    description: "stack of blue jeans in studio light",
    keywords: ["jeans", "denim", "pants", "trousers", "chinos", "bottoms", "leggings", "shorts"],
    fallback: true,
  },
  bottom_black_trousers_studio: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-black-trousers-studio.jpg",
    description: "black tailored trousers on a white studio background",
    keywords: ["tailored trousers", "trousers", "dress pants", "slacks", "chinos", "tailored pants"],
  },
  bottom_athletic_leggings_studio: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-athletic-leggings-studio.jpg",
    description: "athletic leggings in a clean studio shot",
    keywords: ["athletic leggings", "leggings", "running leggings", "fleece-lined leggings", "active leggings"],
  },
  bottom_magenta_leggings_studio: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-magenta-leggings-studio.jpg",
    description: "magenta athletic leggings in a studio shot",
    keywords: ["magenta leggings", "pink leggings", "athletic leggings", "running leggings", "active leggings", "leggings"],
  },
  bottom_cargo_pants_studio: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-cargo-pants-studio.jpg",
    description: "cargo-style pants in a clean fashion shot",
    keywords: ["cargo pants", "water-resistant pants", "insulated pants", "fleece-lined pants", "rain pants", "utility pants"],
  },
  bottom_plaid_trousers_street: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-plaid-trousers-street.jpg",
    description: "plaid tailored trousers with a street-style look",
    keywords: ["plaid trousers", "checked trousers", "tailored trousers", "smart trousers", "dress pants", "slacks"],
  },
  outer_gray_jacket_studio: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-gray-jacket-studio.jpg",
    description: "gray lightweight jacket on a white studio background",
    keywords: ["jacket", "coat", "outerwear", "outer", "blazer", "shell", "windbreaker", "parka", "cardigan", "layer"],
    fallback: true,
  },
  outer_black_blazer_studio: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-black-blazer-studio.jpg",
    description: "tailored blazer detail in clean studio styling",
    keywords: ["blazer", "light blazer", "tailored blazer", "smart blazer"],
  },
  outer_white_hoodie_studio: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-white-hoodie-studio.jpg",
    description: "white hoodie in a minimal studio shot",
    keywords: ["hoodie", "zip hoodie", "hooded layer", "casual hoodie"],
  },
  outer_black_windbreaker_studio: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-black-windbreaker-studio.jpg",
    description: "black windbreaker style jacket in studio light",
    keywords: ["windbreaker", "lightweight windbreaker", "windproof jacket", "waterproof jacket"],
  },
  outer_black_shell_jacket_city: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-black-shell-jacket-city.jpg",
    description: "black shell jacket worn outdoors in the city",
    keywords: ["shell jacket", "black shell jacket", "running jacket", "light shell", "windbreaker", "technical jacket"],
  },
  outer_charcoal_overshirt_studio: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-charcoal-overshirt-studio.jpg",
    description: "charcoal overshirt jacket over a knit top",
    keywords: ["overshirt", "shirt jacket", "charcoal overshirt", "light jacket", "casual jacket", "overshirt jacket"],
  },
  outer_rust_parka_outdoors: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-rust-parka-outdoors.jpg",
    description: "rust hooded parka worn outdoors",
    keywords: ["rust parka", "hooded parka", "parka", "rain parka", "weatherproof parka", "hooded jacket"],
  },
  outer_winter_coat_studio: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-winter-coat-studio.jpg",
    description: "heavy winter coat detail in a cold-weather fashion shot",
    keywords: ["waterproof parka", "parka", "winter coat", "waterproof winter coat", "insulated jacket", "insulated coat"],
  },
  shoes_white_sneakers_minimal: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-white-sneakers-minimal.jpg",
    description: "minimal white sneakers on a light background",
    keywords: ["sneakers", "trainers", "tennis shoes", "casual shoes", "white sneakers"],
    fallback: true,
  },
  shoes_black_white_sneakers_studio: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-black-white-sneakers-studio.jpg",
    description: "black and white statement sneakers in studio lighting",
    keywords: ["streetwear sneakers", "sporty sneakers", "athletic shoes", "fashion sneakers", "black sneakers"],
  },
  shoes_white_running_sneakers: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-white-running-sneakers.jpg",
    description: "white running sneakers in a clean product shot",
    keywords: ["running sneakers", "running shoes", "athletic shoes", "water-resistant athletic shoes", "breathable sneakers", "waterproof sneakers"],
  },
  shoes_white_performance_runner_studio: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-white-performance-runner-studio.jpg",
    description: "white performance running shoe in a dramatic product shot",
    keywords: ["performance runner", "running sneakers", "running shoes", "white running shoe", "athletic shoes", "technical sneakers"],
  },
  shoes_black_loafers_studio: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-black-loafers-studio.jpg",
    description: "black loafers in a studio product shot",
    keywords: ["loafers", "dress loafers", "smart loafers"],
  },
  shoes_tan_winter_boots: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-tan-winter-boots.jpg",
    description: "tan winter boots on a soft white background",
    keywords: ["boots", "ankle boots", "winter boots", "suede boots", "waterproof boots", "water-resistant boots", "insulated boots"],
  },
  accessory_white_umbrella_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-white-umbrella-studio.jpg",
    description: "umbrella silhouette in a clean dramatic product-style scene",
    keywords: ["umbrella", "compact umbrella", "rain umbrella"],
  },
  accessory_black_sunglasses_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-black-sunglasses-studio.jpg",
    description: "black sunglasses on a clean white surface",
    keywords: ["black sunglasses", "sunglasses", "dark sunglasses", "shades"],
  },
  accessory_pattern_scarf_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-pattern-scarf-studio.jpg",
    description: "patterned silk scarf on a white background",
    keywords: ["scarf", "neck scarf", "silk scarf", "wrap"],
  },
  accessory_yellow_silk_scarf_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-yellow-silk-scarf-studio.jpg",
    description: "yellow silk scarf styled over a white shirt",
    keywords: ["yellow scarf", "silk scarf", "neck scarf", "pattern scarf", "scarf"],
  },
  accessory_white_beanie_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-white-beanie-studio.jpg",
    description: "knit beanie in a clean product-style shot",
    keywords: ["beanie", "warm hat", "knit hat", "winter hat"],
  },
  accessory_knit_beanies_outdoors: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-knit-beanies-outdoors.jpg",
    description: "knit beanies in outdoor natural styling",
    keywords: ["knit beanie", "beanie", "winter hat", "warm hat", "knit hat"],
  },
  accessory_black_baseball_cap_outdoors: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-black-baseball-cap-outdoors.jpg",
    description: "black baseball cap worn outdoors",
    keywords: ["black baseball cap", "black cap", "baseball cap", "cap", "dad cap", "sport cap"],
  },
  accessory_watch_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-watch-studio.jpg",
    description: "wristwatch on a white product background",
    keywords: ["watch", "wristwatch", "classic watch"],
  },
  accessory_tote_bag_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-tote-bag-studio.jpg",
    description: "leather tote bag on a clean white background",
    keywords: ["tote bag", "tote", "carryall", "shopper bag"],
  },
  accessory_belt_bag_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-belt-bag-studio.jpg",
    description: "belt bag on a white background",
    keywords: ["belt bag", "crossbody bag", "waist bag", "bag"],
  },
  accessory_socks_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-socks-studio.jpg",
    description: "rolled socks on a white surface",
    keywords: ["socks", "crew socks", "wool socks"],
  },
  accessory_white_gloves_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-white-gloves-studio.jpg",
    description: "white gloves on a white background",
    keywords: ["gloves", "light gloves", "warm gloves"],
    fallback: true,
  },
};

function decodeOAuthState(state) {
  if (!state || typeof state !== "string") return {};
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

async function chatCompletion(messages, { maxTokens = 560, requestId = null, traceLabel = "chat", timeoutMs = 18000 } = {}) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`openrouter_timeout_${timeoutMs}ms`)), timeoutMs);
  try {
    if (!OPENROUTER_API_KEY) {
      console.error("[openrouter] missing api key", { requestId, traceLabel });
      throw new Error("OPENROUTER_API_KEY is not configured");
    }
    console.info("[openrouter] start", {
      requestId,
      traceLabel,
      maxTokens,
      messageCount: Array.isArray(messages) ? messages.length : 0,
      promptChars: Array.isArray(messages) ? messages.reduce((sum, msg) => sum + String(msg?.content || "").length, 0) : 0,
    });
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
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
        reasoning: {
          effort: "minimal",
          exclude: true,
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn("OpenRouter error response:", {
        status: res.status,
        statusText: res.statusText,
        body: err.slice(0, 3000),
      });
      throw new Error(`OpenRouter ${res.status}: ${err}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      console.warn("OpenRouter empty content response:", JSON.stringify({
        id: data?.id,
        model: data?.model,
        created: data?.created,
        choices: data?.choices,
        usage: data?.usage,
        error: data?.error,
      }).slice(0, 3000));
      throw new Error("OpenRouter returned empty content");
    }
    console.info("[openrouter] success", {
      requestId,
      traceLabel,
      durationMs: Date.now() - startedAt,
      maxTokens,
      contentLength: content.length,
      model: data?.model || MODEL,
      usage: data?.usage || null,
    });
    return content;
  } catch (err) {
    const abortReason = controller.signal.aborted
      ? controller.signal.reason?.message || String(controller.signal.reason || "aborted")
      : null;
    console.error("[openrouter] failed", {
      requestId,
      traceLabel,
      durationMs: Date.now() - startedAt,
      maxTokens,
      aborted: controller.signal.aborted,
      abortReason,
      errorName: err?.name || "Error",
      errorMessage: err?.message || String(err),
    });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
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
    copyVersion: RECOMMENDATION_COPY_VERSION,
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
    slotReasons: {},
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

function normalizeMatchText(value) {
  return cleanInlineText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

function normalizeDetailsOverview(value) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : { why: value };
  return {
    what: clampSentenceCount(source?.what, 2),
    why: clampSentenceCount(source?.why, 2),
    note: clampSentenceCount(source?.note, 1),
  };
}

function normalizeCareInstructions(value, { limit = 8 } = {}) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]+/)
      : [];
  return values
    .map((item) => cleanInlineText(item))
    .filter(Boolean)
    .slice(0, limit);
}

function humanizeCatalogKey(key, entry = null) {
  const catalogEntry = entry || STOCK_IMAGE_CATALOG[key];
  if (!catalogEntry) return "";
  const fromKeyword = catalogEntry.keywords.find((keyword) => !/\b(basic|casual|everyday|lightweight|minimal|studio|clean)\b/i.test(keyword));
  if (fromKeyword) {
    return cleanInlineText(fromKeyword)
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  return key
    .split("_")
    .slice(1)
    .join(" ")
    .replace(/\b(studio|minimal|hanger|stack)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function sanitizeOutfitSlotText(value, slot, preferredKey = null) {
  const cleaned = cleanInlineText(value);
  if (!cleaned) return "";

  const normalized = normalizeMatchText(cleaned);
  const directCatalogEntry = STOCK_IMAGE_CATALOG[cleaned] || STOCK_IMAGE_CATALOG[preferredKey];
  if (directCatalogEntry && directCatalogEntry.slot === slot) {
    return humanizeCatalogKey(preferredKey && STOCK_IMAGE_CATALOG[preferredKey]?.slot === slot ? preferredKey : cleaned, directCatalogEntry);
  }

  const catalogMatch = Object.entries(STOCK_IMAGE_CATALOG).find(([key, entry]) =>
    entry.slot === slot && (
      normalizeMatchText(key) === normalized ||
      normalizeMatchText(entry.path) === normalized
    ));

  if (catalogMatch) {
    return humanizeCatalogKey(catalogMatch[0], catalogMatch[1]);
  }

  if (/\.(png|jpe?g|webp|svg)\b/i.test(cleaned) || cleaned.includes("assets/recommendation-stock/")) {
    const fallbackEntry = preferredKey && STOCK_IMAGE_CATALOG[preferredKey]?.slot === slot
      ? STOCK_IMAGE_CATALOG[preferredKey]
      : null;
    return humanizeCatalogKey(preferredKey, fallbackEntry);
  }

  return cleaned;
}

function normalizeRecommendationResponse(parsed) {
  const preferredImageKeys = parsed?.outfitImageKeys && typeof parsed.outfitImageKeys === "object"
    ? parsed.outfitImageKeys
    : {};
  const outfit = {
    top: sanitizeOutfitSlotText(parsed?.outfit?.top, "top", cleanInlineText(preferredImageKeys?.top)) || "A comfortable top suited to the current temperature",
    bottom: sanitizeOutfitSlotText(parsed?.outfit?.bottom, "bottom", cleanInlineText(preferredImageKeys?.bottom)) || "Comfortable bottoms for today's conditions",
    outer: sanitizeOutfitSlotText(parsed?.outfit?.outer, "outer", cleanInlineText(preferredImageKeys?.outer)) || null,
    shoes: sanitizeOutfitSlotText(parsed?.outfit?.shoes, "shoes", cleanInlineText(preferredImageKeys?.shoes)) || "Comfortable everyday shoes",
    accessories: normalizeList(parsed?.outfit?.accessories, { limit: 1 })
      .map((value) => sanitizeOutfitSlotText(value, "accessory", cleanInlineText(preferredImageKeys?.accessory)))
      .filter(Boolean),
  };
  const slotReasons = {
    top: clampSentenceCount(parsed?.slotReasons?.top, 1),
    bottom: clampSentenceCount(parsed?.slotReasons?.bottom, 1),
    outer: clampSentenceCount(parsed?.slotReasons?.outer, 1),
    shoes: clampSentenceCount(parsed?.slotReasons?.shoes, 1),
    accessory: clampSentenceCount(parsed?.slotReasons?.accessory, 1),
  };
  return {
    outfit,
    outfitImages: buildRecommendationImageMatches(outfit, preferredImageKeys),
    slotReasons,
    reasoning: clampSentenceCount(parsed?.reasoning, 1),
    detailsOverview: normalizeDetailsOverview(parsed?.detailsOverview),
    warnings: normalizeList(parsed?.warnings, { limit: 1 }),
    missingItems: normalizeList(parsed?.missingItems, { limit: 1 }),
  };
}

function pickAlwaysOnOuter(weather = {}) {
  const feelsLike = Number(weather?.feelsLike ?? weather?.temperature);
  const wind = Number(weather?.wind ?? 0);
  const precipProb = Number(weather?.precipProb ?? 0);
  const label = String(weather?.weatherLabel || "").toLowerCase();
  const wet = precipProb >= 40 || /rain|drizzle|storm|snow|freezing|sleet/.test(label);
  if (wet && feelsLike <= 8) return "Weatherproof Parka";
  if (wet) return "Waterproof Jacket";
  if (feelsLike <= 5) return "Warm Coat";
  if (feelsLike <= 12) return "Insulated Jacket";
  if (wind >= 22) return "Windbreaker";
  if (feelsLike <= 18) return "Light Jacket";
  if (feelsLike >= 28) return "Breathable Overshirt";
  return "Light Overshirt";
}

function pickAlwaysOnAccessory(weather = {}) {
  const feelsLike = Number(weather?.feelsLike ?? weather?.temperature);
  const precipProb = Number(weather?.precipProb ?? 0);
  const uv = Number(weather?.uv ?? 0);
  const label = String(weather?.weatherLabel || "").toLowerCase();
  const wet = precipProb >= 40 || /rain|drizzle|storm|snow|freezing|sleet/.test(label);
  if (wet) return "Umbrella";
  if (uv >= 6) return "Sunglasses";
  if (feelsLike <= 6) return "Beanie";
  if (feelsLike <= 12) return "Scarf";
  if (feelsLike >= 26) return "Cap";
  return "Watch";
}

function ensureFiveCategoryOutfit(response, weather = {}) {
  const outfit = response?.outfit && typeof response.outfit === "object" ? { ...response.outfit } : {};
  outfit.top = cleanInlineText(outfit.top) || "Comfortable Top";
  outfit.bottom = cleanInlineText(outfit.bottom) || "Everyday Trousers";
  outfit.outer = cleanInlineText(outfit.outer) || pickAlwaysOnOuter(weather);
  outfit.shoes = cleanInlineText(outfit.shoes) || "Sneakers";
  const accessory = cleanInlineText(Array.isArray(outfit.accessories) ? outfit.accessories[0] : outfit.accessories) || pickAlwaysOnAccessory(weather);
  outfit.accessories = [accessory];

  const slotReasons = {
    ...(response?.slotReasons || {}),
    top: cleanInlineText(response?.slotReasons?.top) || "Builds the base of the outfit for today's temperature.",
    bottom: cleanInlineText(response?.slotReasons?.bottom) || "Keeps the look practical and balanced through the day.",
    outer: cleanInlineText(response?.slotReasons?.outer) || "Adds a weather-ready outer layer so the look stays complete.",
    shoes: cleanInlineText(response?.slotReasons?.shoes) || "Keeps the outfit grounded for all-day wear.",
    accessory: cleanInlineText(response?.slotReasons?.accessory) || "Finishes the outfit with a useful extra.",
  };

  return {
    ...response,
    outfit,
    slotReasons,
    outfitImages: buildRecommendationImageMatches(outfit),
  };
}

function scoreCatalogMatch(text, entry) {
  const normalized = normalizeMatchText(text);
  if (!normalized) return 0;
  let score = 0;
  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalizeMatchText(keyword);
    if (!normalizedKeyword) continue;
    if (normalized === normalizedKeyword) score += 10;
    else if (normalized.includes(normalizedKeyword)) score += 4;
  }
  if (entry.fallback) score += 1;
  return score;
}

function findStockImageForSlot(slot, itemName, preferredKey = null) {
  if (preferredKey && STOCK_IMAGE_CATALOG[preferredKey]?.slot === slot) {
    const entry = STOCK_IMAGE_CATALOG[preferredKey];
    return { key: preferredKey, path: entry.path, description: entry.description };
  }

  const entries = Object.entries(STOCK_IMAGE_CATALOG).filter(([, entry]) => entry.slot === slot);
  let best = null;
  let bestScore = -1;
  for (const [key, entry] of entries) {
    const score = scoreCatalogMatch(itemName, entry);
    if (score > bestScore) {
      best = { key, path: entry.path, description: entry.description };
      bestScore = score;
    }
  }

  if (best && bestScore > 0) return best;
  const fallback = entries.find(([, entry]) => entry.fallback);
  return fallback ? { key: fallback[0], path: fallback[1].path, description: fallback[1].description } : null;
}

function buildRecommendationImageMatches(outfit, preferredKeys = null) {
  const output = {};
  const preferred = preferredKeys && typeof preferredKeys === "object" ? preferredKeys : {};
  for (const slot of ["top", "bottom", "outer", "shoes"]) {
    const itemName = cleanInlineText(outfit?.[slot]);
    if (!itemName) {
      output[slot] = null;
      continue;
    }
    output[slot] = findStockImageForSlot(slot, itemName, cleanInlineText(preferred?.[slot])) || null;
  }
  const accessories = Array.isArray(outfit?.accessories)
    ? outfit.accessories
    : [outfit?.accessories];
  accessories
    .map((value) => cleanInlineText(value))
    .filter(Boolean)
    .slice(0, 1)
    .forEach((itemName, index) => {
      output[`accessory-${index}`] = findStockImageForSlot("accessory", itemName, cleanInlineText(preferred?.accessory)) || null;
    });
  return output;
}

function hasCompleteSlotReasons(slotReasons, outfit) {
  const slots = ["top", "bottom", "shoes"];
  if (cleanInlineText(outfit?.outer)) slots.push("outer");
  if (cleanInlineText(Array.isArray(outfit?.accessories) ? outfit.accessories[0] : outfit?.accessories)) slots.push("accessory");
  return slots.every((slot) => cleanInlineText(slotReasons?.[slot]));
}

function isGenericRecommendationReasoning(value) {
  const text = cleanInlineText(value).toLowerCase();
  if (!text) return true;
  const genericPatterns = [
    /chosen to match today'?s weather/,
    /chosen to match today’s weather/,
    /keep you comfortable through the day/,
    /built around today'?s conditions/,
    /built around today’s conditions/,
    /matched to the weather/,
    /matched to today’s weather/,
    /matched to today's weather/,
    /suited to today'?s conditions/,
    /suited to today’s conditions/,
  ];
  return genericPatterns.some((pattern) => pattern.test(text));
}

function buildContextReasoningFallback(response, weather) {
  const feelsLike = Number.isFinite(Number(weather?.feelsLike))
    ? Number(weather.feelsLike)
    : Number(weather?.temperature);
  const wind = Number(weather?.wind ?? 0);
  const rainChance = Number(weather?.precipProb ?? 0);
  const precip = Number(weather?.precip ?? 0);
  const humidity = Number(weather?.humidity ?? 0);
  const uv = Number(weather?.uv ?? 0);
  const label = cleanInlineText(weather?.weatherLabel, "current conditions").toLowerCase();
  const traits = [];

  if (Number.isFinite(feelsLike)) {
    if (feelsLike <= 6) traits.push("cold");
    else if (feelsLike <= 13) traits.push("chilly");
    else if (feelsLike >= 29) traits.push("hot");
    else if (feelsLike >= 24) traits.push("warm");
    else traits.push("mild");
  }
  if (wind >= 25) traits.push("windy");
  if (rainChance >= 45 || precip > 0) traits.push("rainy later today");
  if (humidity >= 80 && feelsLike >= 18) traits.push("humid");
  if (uv >= 7) traits.push("bright");
  traits.push(label);

  const summary = Array.from(new Set(traits.filter(Boolean))).slice(0, 3);
  const naturalSummary = summary.length > 1
    ? `${summary.slice(0, -1).join(", ")} and ${summary[summary.length - 1]}`
    : (summary[0] || label);
  return `Today looks ${naturalSummary}, so the outfit leans into comfort, coverage, and weather protection without feeling overbuilt.`;
}

async function ensureAiRecommendationReasoning(response, weather, preferences, location) {
  if (!isGenericRecommendationReasoning(response?.reasoning)) return response;

  const accessories = Array.isArray(response?.outfit?.accessories)
    ? response.outfit.accessories.filter(Boolean).join(", ")
    : cleanInlineText(response?.outfit?.accessories);
  const prompt = `Write the recommendation subline for WearCast.

It appears under the outfit heading. It should summarize the weather story in natural language and explain the outfit direction.

## Location
${location?.name || "Unknown"}

## Weather
- Temperature: ${weather?.temperature}°C
- Feels like: ${weather?.feelsLike}°C
- Wind: ${weather?.wind} km/h
- Gusts: ${weather?.gusts} km/h
- Humidity: ${weather?.humidity}%
- Precipitation: ${weather?.precip} mm/h
- Precipitation probability: ${weather?.precipProb ?? "unknown"}%
- UV: ${weather?.uv}
- Weather: ${weather?.weatherLabel}

## Outfit
- Top: ${response?.outfit?.top || ""}
- Bottom: ${response?.outfit?.bottom || ""}
- Outer: ${response?.outfit?.outer || "none"}
- Shoes: ${response?.outfit?.shoes || ""}
- Accessory: ${accessories || "none"}

## User tuning
${Object.entries(preferences || {}).filter(([, value]) => !!value).map(([key, value]) => `- ${key}: ${value}`).join("\n") || "- none"}

Rules:
- Return JSON only.
- Write one natural sentence.
- Do not use raw stats, numbers, units, percentages, or symbols.
- Mention the weather pattern in words, such as chilly, windy, humid, bright, rain later, or colder this evening.
- Tie the weather overview to the outfit direction.
- Do not use generic phrases like "chosen to match today's weather" or "keep you comfortable through the day".

{
  "reasoning": "one natural weather-overview subline"
}`;

  try {
    const text = await chatCompletion([{ role: "user", content: prompt }], { maxTokens: 220 });
    const parsed = parseModelJson(text);
    const reasoning = clampSentenceCount(parsed?.reasoning, 1);
    return {
      ...response,
      reasoning: isGenericRecommendationReasoning(reasoning)
        ? buildContextReasoningFallback(response, weather)
        : reasoning,
    };
  } catch (err) {
    console.warn("recommendation subtitle generation fallback:", err?.message || err);
    return {
      ...response,
      reasoning: buildContextReasoningFallback(response, weather),
    };
  }
}

async function ensureAiSlotReasons(response, weather, preferences, location) {
  if (hasCompleteSlotReasons(response?.slotReasons, response?.outfit)) return response;

  const prompt = `You are writing short outfit-card blurbs for WearCast.

Write one short, natural, context-based line for each outfit item.

## Location
${location?.name || "Unknown"}

## Weather
- Temperature: ${weather?.temperature}°C
- Feels like: ${weather?.feelsLike}°C
- Wind: ${weather?.wind} km/h
- Precipitation probability: ${weather?.precipProb ?? "unknown"}%
- UV: ${weather?.uv}
- Weather: ${weather?.weatherLabel}

## Preferences
${Object.entries(preferences || {}).filter(([, value]) => !!value).map(([key, value]) => `- ${key}: ${value}`).join("\n") || "- none"}

## Outfit
- Top: ${response?.outfit?.top || ""}
- Bottom: ${response?.outfit?.bottom || ""}
- Outer: ${response?.outfit?.outer || "none"}
- Shoes: ${response?.outfit?.shoes || ""}
- Accessory: ${Array.isArray(response?.outfit?.accessories) ? (response.outfit.accessories[0] || "none") : (response?.outfit?.accessories || "none")}

Rules:
- Each line must be 4 to 10 words.
- Make them specific to weather or context.
- Do not repeat the item name.
- Do not use bullets in the values.
- If there is no outer layer, return an empty string for outer.
- If there is no accessory, return an empty string for accessory.
- Return JSON only.

{
  "top": "short reason",
  "bottom": "short reason",
  "outer": "short reason or empty string",
  "shoes": "short reason",
  "accessory": "short reason or empty string"
}`;

  try {
    const text = await chatCompletion([{ role: "user", content: prompt }], { maxTokens: 260 });
    const parsed = parseModelJson(text);
    return {
      ...response,
      slotReasons: {
        top: clampSentenceCount(parsed?.top, 1) || response?.slotReasons?.top || "",
        bottom: clampSentenceCount(parsed?.bottom, 1) || response?.slotReasons?.bottom || "",
        outer: clampSentenceCount(parsed?.outer, 1) || response?.slotReasons?.outer || "",
        shoes: clampSentenceCount(parsed?.shoes, 1) || response?.slotReasons?.shoes || "",
        accessory: clampSentenceCount(parsed?.accessory, 1) || response?.slotReasons?.accessory || "",
      },
    };
  } catch (err) {
    console.warn("slot reason generation fallback:", err?.message || err);
    return response;
  }
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
  const feelsLike = Number(weather?.feelsLike ?? temp);
  const precipProb = Number(weather?.precipProb ?? 0);
  const wind = Number(weather?.wind ?? 0);
  const weatherLabel = String(weather?.weatherLabel || "").toLowerCase();

  const freezing = weatherLabel.includes("snow") || weatherLabel.includes("freezing");
  const stormy = weatherLabel.includes("thunder");
  const coldish = feelsLike <= 8;
  const veryCold = feelsLike <= 2;
  const hot = feelsLike >= 28;
  const veryHot = feelsLike >= 32;
  const wet = precipProb >= 45 || weatherLabel.includes("rain") || weatherLabel.includes("drizzle") || stormy || freezing;

  const top = veryCold
    ? "Thermal base layer"
    : coldish
      ? "Long-sleeve tee"
      : veryHot
        ? "Lightweight T-shirt"
        : temp <= 20
          ? "Long-sleeve top"
          : "Breathable T-shirt";
  const bottom = veryCold
    ? "Insulated pants"
    : hot
      ? "Linen shorts"
      : wet && coldish
        ? "Water-resistant pants"
        : temp <= 12
          ? "Jeans"
          : "Comfortable pants";
  const outer = veryCold
    ? "Waterproof parka"
    : wet
      ? "Waterproof jacket"
      : coldish || wind >= 25
        ? "Light jacket"
        : hot
          ? "Breathable overshirt"
          : "Light overshirt";
  const shoes = veryCold || freezing
    ? "Waterproof boots"
    : wet
      ? "Waterproof sneakers"
      : hot
        ? "Canvas sneakers"
        : "Sneakers";
  const accessories = [];

  if (wet && !freezing) accessories.push("Umbrella");
  else if (Number(weather?.uv ?? 0) >= 6) accessories.push("Sunglasses");
  else if (coldish) accessories.push("Beanie");
  else accessories.push("Watch");

  return {
    outfit: { top, bottom, outer, shoes, accessories },
    outfitImages: buildRecommendationImageMatches({ top, bottom, outer, shoes, accessories }),
    slotReasons: {
      top: veryCold ? "Builds a warmer base for the cold." : hot ? "Keeps the outfit light in the heat." : "Works as a comfortable base layer.",
      bottom: veryCold ? "Adds needed insulation for colder air." : hot ? "Keeps airflow and movement easy." : "Balances coverage and comfort.",
      outer: outer ? (wet ? "Adds weather protection for rain and wind." : "Adds a practical outer layer.") : "",
      shoes: wet || veryCold ? "Better suited to wet or colder ground." : "Keeps the look easy and wearable.",
      accessory: accessories[0]
        ? (accessories[0] === "Umbrella"
            ? "Helps cover you if rain hits."
            : accessories[0] === "Sunglasses"
              ? "Adds useful protection in brighter sun."
              : "Rounds out the look for the conditions.")
        : "",
    },
    reasoning: buildContextReasoningFallback({ outfit: { top, bottom, outer, shoes, accessories } }, weather),
    detailsOverview: {
      what: `${top}, ${bottom}, and ${shoes}${outer ? ` with a ${outer}` : ""} make a practical outfit for the current conditions.`,
      why: buildContextReasoningFallback({ outfit: { top, bottom, outer, shoes, accessories } }, weather),
      note: accessories[0] ? `${accessories[0]} adds a useful final layer of weather protection.` : "This was generated from weather rules while AI styling is unavailable.",
    },
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
  "careInstructions": ["machine wash cold"]
}

Rules:
- Keep values short.
- Use null when unsure.
- Return careInstructions as an array of plain strings. Use [] if there is no readable care label.
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
      careInstructions: normalizeCareInstructions(parsed?.careInstructions),
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
  "careInstructions": ["machine wash cold", "tumble dry low"],
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
    res.json({
      ...parsed,
      careInstructions: normalizeCareInstructions(parsed?.careInstructions),
    });
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
    const requestId = `rec_${randomUUID().slice(0, 8)}`;
    const startedAt = Date.now();
    const { weather, wardrobe, preferences, location } = req.body;
    const resolvedWeather = await resolveRecommendationWeather(weather, location);
    if (!resolvedWeather) return res.status(400).json({ error: "No weather data or location provided" });
    const wardrobeItems = Array.isArray(wardrobe) ? wardrobe : [];
    const hasWardrobe = wardrobeItems.length > 0;
    console.info("[recommend] start", {
      requestId,
      location: location?.name || "Unknown",
      hasInlineWeather: !!weather,
      wardrobeCount: wardrobeItems.length,
      tempC: resolvedWeather.temperature,
      feelsLikeC: resolvedWeather.feelsLike,
      windKmh: resolvedWeather.wind,
      precipProb: resolvedWeather.precipProb ?? null,
      weatherLabel: resolvedWeather.weatherLabel,
    });

    const cacheKey = recommendationCacheKey(resolvedWeather, wardrobeItems, preferences);
    const cachedRecommendation = getCachedRecommendation(cacheKey);
    if (cachedRecommendation) {
      console.info("[recommend] cache-hit", {
        requestId,
        durationMs: Date.now() - startedAt,
        genericReasoning: isGenericRecommendationReasoning(cachedRecommendation.reasoning),
      });
      if (!isGenericRecommendationReasoning(cachedRecommendation.reasoning)) {
        return res.json(cachedRecommendation);
      }
      const withReasoning = {
        ...cachedRecommendation,
        reasoning: buildContextReasoningFallback(cachedRecommendation, resolvedWeather),
      };
      setCachedRecommendation(cacheKey, withReasoning);
      return res.json(withReasoning);
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
    if (preferences?.activityContext === "walking") prefsDesc.push("expects to walk more than usual today");
    if (preferences?.activityContext === "commute") prefsDesc.push("is dressing for commuting and movement");
    if (preferences?.activityContext === "errands") prefsDesc.push("is dressing for errands with frequent short stops");
    if (preferences?.activityContext === "office") prefsDesc.push("is dressing for an office or work setting");
    if (preferences?.activityContext === "workout") prefsDesc.push("is dressing around light workout or athleisure needs");
    if (preferences?.activityContext === "travel") prefsDesc.push("is dressing for travel and comfort through transitions");
    if (preferences?.activityContext === "evening") prefsDesc.push("is dressing for an evening plan");
    if (preferences?.locationContext === "indoors") prefsDesc.push("will spend most of the day indoors");
    if (preferences?.locationContext === "outdoors") prefsDesc.push("will spend a lot of time outdoors");
    if (preferences?.locationContext === "transit") prefsDesc.push("will move between transit, streets, and indoor spaces");
    if (preferences?.locationContext === "event") prefsDesc.push("will be in a more intentional event setting");
    if (preferences?.locationContext === "exposed") prefsDesc.push("will be exposed to the weather for longer stretches");
    if (preferences?.styleFocus === "polished") prefsDesc.push("wants the outfit to lean polished");
    if (preferences?.styleFocus === "casual") prefsDesc.push("wants the outfit to lean casual");
    if (preferences?.styleFocus === "sporty") prefsDesc.push("wants the outfit to lean sporty");
    if (preferences?.styleFocus === "streetwear") prefsDesc.push("wants the outfit to lean streetwear");
    if (preferences?.styleFocus === "minimalist") prefsDesc.push("wants the outfit to lean minimalist");
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

    const effectiveTemp = Number.isFinite(Number(resolvedWeather.feelsLike))
      ? Number(resolvedWeather.feelsLike)
      : Number(resolvedWeather.temperature);
    const wetRisk = Number(resolvedWeather.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow|freezing/i.test(String(resolvedWeather.weatherLabel || ""));
    const weatherRules = [
      effectiveTemp <= 2
        ? "- It is very cold. Use a thermal or insulated top, insulated bottoms, a substantial winter outer layer, and boots. Avoid light sneakers."
        : effectiveTemp <= 8
          ? "- It is cold. Prefer long sleeves and a real outer layer. Do not suggest shorts."
          : effectiveTemp >= 32
            ? "- It is very hot. Keep the outfit very light. No outer layer unless absolutely necessary."
            : effectiveTemp >= 28
              ? "- It is hot. Prefer breathable, lightweight pieces and avoid heavy layers."
              : "- Temperature is moderate. A light layer may be appropriate depending on wind and rain.",
      wetRisk
        ? "- Wet conditions are likely. Use a waterproof or water-resistant outer layer and avoid delicate open footwear."
        : "- Dry conditions are likely. Waterproof gear is optional unless wind or cold makes it useful.",
      Number(resolvedWeather.wind ?? 0) >= 25
        ? "- It is windy. Add a protective layer and avoid outfits that feel too exposed."
        : "- Wind is not a dominant factor right now.",
      Number(resolvedWeather.uv ?? 0) >= 7
        ? "- UV is high. Favor sun-protective accessories when sensible."
        : "- UV is not a major driver.",
    ].join("\n");

    const imageCatalogDesc = Object.entries(STOCK_IMAGE_CATALOG)
      .map(([key, entry]) => `- ${key} (${entry.slot})`)
      .join("\n");

    const prompt = `You are WearCast, a smart clothing recommendation assistant.

Suggest a specific outfit for the rest of today.${hasWardrobe ? " Use wardrobe items only when they are genuinely suitable for the weather and forecast. If the saved wardrobe does not contain weather-appropriate pieces for a slot, give a general recommendation instead of forcing a wardrobe match." : " The user has no wardrobe saved, so suggest a generic outfit."}

## Current Weather
- Location: ${location?.name || "Unknown"}
- Temp: ${resolvedWeather.temperature}°C, feels like ${resolvedWeather.feelsLike}°C
- Wind: ${resolvedWeather.wind} km/h, gusts ${resolvedWeather.gusts} km/h
- Humidity: ${resolvedWeather.humidity}%
- Precip probability: ${resolvedWeather.precipProb ?? "unknown"}%
- UV: ${resolvedWeather.uv}
- Condition: ${resolvedWeather.weatherLabel}
- Daytime: ${resolvedWeather.isDay ? "yes" : "no"}

${dayForecastDesc}

## User Preferences
${prefsDesc.length ? prefsDesc.join("\n") : "No special preferences set."}

## User's Wardrobe
${wardrobeDesc}

## Weather Forcing Rules
${weatherRules}

## Available Stock Image Keys
Choose the best matching local stock image key for each outfit slot from this list:
${imageCatalogDesc}

## Instructions
1. Recommend a COMPLETE outfit using short item names only.
2. Consider ONLY the forecast from now onward today.
3. ${hasWardrobe ? "Reference SPECIFIC wardrobe items by name only when they clearly fit the weather. Do not force wardrobe usage just because an item exists." : "Do not mention missing wardrobe pieces beyond one short missing-item suggestion."}
4. Make reasoning ONE natural recommendation subline that summarizes the weather story in words and explains the outfit direction. Do not use raw stats, numbers, units, percentages, or symbols.
5. Return detailsOverview as a richer modal explanation: what the outfit is doing overall, why it fits the weather, and one optional practical note.
6. Return at most ONE accessory, ONE warning, and ONE missing item.
7. Do not explain each clothing piece separately in detailsOverview.
8. For each clothing slot, choose the most appropriate stock image key from the provided list.
9. Also return one short slot-specific reason for top, bottom, outer, shoes, and accessory when present.
10. Always return all five categories: top, bottom, outer, shoes, and exactly one accessory.
11. Make the outfit meaningfully reflect the actual weather severity and not just a generic everyday look.
12. If a wardrobe item is unsuitable for the weather, prefer a generic weather-appropriate recommendation.
13. Do not use generic phrases like "chosen to match today's weather", "keep you comfortable through the day", or "built around today's conditions".
14. Return JSON only.

Return ONLY valid JSON (no markdown fences):
{
  "outfit": {
    "top": "short item name",
    "bottom": "short item name",
    "outer": "short item name",
    "shoes": "short item name",
    "accessories": ["one item"]
  },
  "outfitImageKeys": {
    "top": "matching stock image key",
    "bottom": "matching stock image key",
    "outer": "matching stock image key",
    "shoes": "matching stock image key",
    "accessory": "matching stock image key"
  },
  "slotReasons": {
    "top": "one short reason",
    "bottom": "one short reason",
    "outer": "one short reason",
    "shoes": "one short reason",
    "accessory": "one short reason"
  },
  "reasoning": "One natural weather-overview subline shown under the recommendation heading",
  "detailsOverview": {
    "what": "One or two sentences describing the full outfit strategy without repeating each card blurb",
    "why": "One or two sentences explaining the weather logic and comfort tradeoff",
    "note": "One optional practical note about timing, layering, rain, UV, wind, or missing coverage"
  },
  "warnings": ["one short warning if needed"],
  "missingItems": ["one short missing item if needed"]
}`;

    let text = "";
    try {
      const recommendationMaxTokens = hasWardrobe ? 680 : 560;
      const recommendationTimeoutMs = 30000;
      console.info("[recommend] ai-request", {
        requestId,
        durationMs: Date.now() - startedAt,
        promptChars: prompt.length,
        maxTokens: recommendationMaxTokens,
        timeoutMs: recommendationTimeoutMs,
      });
      text = await chatCompletion(
        [{ role: "user", content: prompt }],
        {
          maxTokens: recommendationMaxTokens,
          requestId,
          traceLabel: "recommendation",
          timeoutMs: recommendationTimeoutMs,
        }
      );
    } catch (aiErr) {
      console.warn("[recommend] ai-fallback", {
        requestId,
        durationMs: Date.now() - startedAt,
        errorName: aiErr?.name || "Error",
        errorMessage: aiErr?.message || String(aiErr),
      });
      const response = buildFallbackRecommendation(resolvedWeather);
      setCachedRecommendation(cacheKey, response);
      return res.json(response);
    }
    console.info("[recommend] ai-response", {
      requestId,
      durationMs: Date.now() - startedAt,
      responseChars: text.length,
      preview: text.slice(0, 500),
    });

    try {
      const parsed = parseModelJson(text);
      const normalized = ensureFiveCategoryOutfit(normalizeRecommendationResponse(parsed), resolvedWeather);
      const withReasoning = await ensureAiRecommendationReasoning(normalized, resolvedWeather, preferences, location);
      const response = ensureFiveCategoryOutfit(await ensureAiSlotReasons(withReasoning, resolvedWeather, preferences, location), resolvedWeather);
      console.info("[recommend] success", {
        requestId,
        durationMs: Date.now() - startedAt,
        outfit: response?.outfit || null,
        warnings: response?.warnings?.length || 0,
        missingItems: response?.missingItems?.length || 0,
      });
      setCachedRecommendation(cacheKey, response);
      res.json(response);
    } catch (parseErr) {
      console.warn("[recommend] parse-fallback", {
        requestId,
        durationMs: Date.now() - startedAt,
        errorName: parseErr?.name || "Error",
        errorMessage: parseErr?.message || String(parseErr),
      });
      const salvaged = salvageRecommendationFromText(text);
      if (salvaged) {
        const normalized = ensureFiveCategoryOutfit(normalizeRecommendationResponse(salvaged), resolvedWeather);
        const withReasoning = await ensureAiRecommendationReasoning(normalized, resolvedWeather, preferences, location);
        const response = ensureFiveCategoryOutfit(await ensureAiSlotReasons(withReasoning, resolvedWeather, preferences, location), resolvedWeather);
        console.info("[recommend] salvaged-success", {
          requestId,
          durationMs: Date.now() - startedAt,
          outfit: response?.outfit || null,
        });
        setCachedRecommendation(cacheKey, response);
        return res.json(response);
      }
      const response = buildFallbackRecommendation(resolvedWeather);
      setCachedRecommendation(cacheKey, response);
      res.json(response);
    }
  } catch (err) {
    console.error("[recommend] fatal", {
      errorName: err?.name || "Error",
      errorMessage: err?.message || String(err),
      stack: err?.stack || null,
    });
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
