import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, readFileSync } from "fs";
import { appendFile, mkdir, writeFile, unlink } from "fs/promises";
import https from "https";
import { randomUUID } from "crypto";
import express from "express";
import cors from "cors";
import { Jimp } from "jimp";
import * as Sentry from "@sentry/node";
import dbPool, { initDB } from "./db.js";
import authRoutes from "./routes/auth.js";
import wardrobeRoutes from "./routes/wardrobe.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STOCK_IMAGE_ASSET_ROOT = join(__dirname, "..", "www");
config({ path: join(__dirname, ".env") });
const STOCK_GAP_LOG_PATH = process.env.STOCK_GAP_LOG_PATH || join(__dirname, "..", "tmp", "recommendation-stock-gaps.ndjson");

const app = express();
const PORT = process.env.PORT || 3001;
const SERVER_STARTED_AT = Date.now();
const SENTRY_DSN = process.env.SENTRY_DSN || "";
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || process.env.RELEASE || "wearcast-local";
const SENTRY_ENABLED = !!SENTRY_DSN;

app.use(cors());
// Keep the JSON limit tight. Wardrobe sync payloads can batch a handful of
// base64-encoded thumbnails; 8mb covers that comfortably while giving us
// meaningful backpressure against accidental huge uploads that previously
// contributed to RSS spikes / OOM kills.
app.use(express.json({ limit: "8mb" }));

// Simple in-process concurrency guard for the ML-heavy endpoints. Running
// transformers.js segmentation + @imgly/background-removal-node concurrently
// is the main source of memory spikes. Serializing them keeps the working
// set bounded without materially hurting p95 latency on this instance.
const HEAVY_ML_CONCURRENCY = Number(process.env.HEAVY_ML_CONCURRENCY || 1);
let heavyMlInFlight = 0;
const heavyMlQueue = [];
function acquireHeavyMlSlot() {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (heavyMlInFlight < HEAVY_ML_CONCURRENCY) {
        heavyMlInFlight += 1;
        resolve(() => {
          heavyMlInFlight -= 1;
          const next = heavyMlQueue.shift();
          if (next) next();
        });
      } else {
        heavyMlQueue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

// Log process memory warnings so we can tell whether future crashes are still
// OOM vs something else. Noisy-but-useful during the memory stabilization
// window; fine to leave in production.
if (process.env.NODE_ENV === "production") {
  setInterval(() => {
    const mem = process.memoryUsage();
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    if (rssMb > 800) {
      console.warn("[memory] high-rss", { rssMb, heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024) });
    }
  }, 30_000).unref();
}

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    sendDefaultPii: false,
  });
}

function getRequestId(req) {
  return req.headers["x-wearcast-request-id"]
    || req.headers["x-request-id"]
    || randomUUID();
}

function sanitizeLogValue(value) {
  if (value == null) return value;
  if (typeof value === "string") return value.slice(0, 300);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 8).map((entry) => sanitizeLogValue(entry));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 20)
        .map(([key, entry]) => [key, sanitizeLogValue(entry)])
    );
  }
  return String(value).slice(0, 300);
}

function captureServerException(error, context = {}) {
  if (!SENTRY_ENABLED || !error) return;
  const normalized = error instanceof Error ? error : new Error(String(error));
  Sentry.withScope((scope) => {
    Object.entries(context || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) scope.setExtra(key, sanitizeLogValue(value));
    });
    Sentry.captureException(normalized);
  });
}

function logApiEvent(level, event, metadata = {}) {
  const payload = sanitizeLogValue({
    event,
    at: new Date().toISOString(),
    ...metadata,
  });
  const line = `[api] ${JSON.stringify(payload)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

app.use((req, res, next) => {
  const requestId = getRequestId(req);
  req.requestId = requestId;
  res.set("X-WearCast-Request-Id", requestId);
  const startedAt = Date.now();
  res.on("finish", () => {
    if (!req.path.startsWith("/api/")) return;
    logApiEvent(res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info", "request_finished", {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });
  });
  next();
});

app.get("/app-config.js", (req, res) => {
  res.type("application/javascript");
  res.send(`window.WEARCAST_RUNTIME_CONFIG=${JSON.stringify({
    sentryBrowserDsn: process.env.SENTRY_BROWSER_DSN || "",
    sentryEnvironment: SENTRY_ENVIRONMENT,
    sentryRelease: SENTRY_RELEASE,
  })};`);
});

// Serve the frontend static files from the 'www' directory
app.use(express.static(join(__dirname, "..", "www")));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "auto";
const RECOMMENDATION_FAST_MODEL = process.env.OPENROUTER_RECOMMENDATION_FAST_MODEL || process.env.OPENROUTER_FAST_MODEL || MODEL;
const OPENROUTER_REASONING_EFFORT = process.env.OPENROUTER_REASONING_EFFORT || "";
const STOCK_GAP_ADMIN_TOKEN = process.env.STOCK_GAP_ADMIN_TOKEN || "";
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;
const RECOMMENDATION_CACHE_TTL_MS = 2 * 60 * 1000;
const RECOMMENDATION_COPY_VERSION = 28;
const DEBUG_LOGS = String(process.env.DEBUG || "").toLowerCase() === "true";
const weatherCache = new Map();
const recommendationCache = new Map();
const STOCK_IMAGE_CATALOG = {
  top_white_tshirt_studio: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-white-tshirt-studio.jpg",
    description: "white crew-neck T-shirt in a clean studio flat lay",
    keywords: ["t-shirt", "tee", "tee shirt", "tshirt", "short sleeve", "crew neck", "basic tee", "cotton t-shirt", "lightweight t-shirt", "oversized tee", "white performance tee"],
    fallback: true,
  },
  top_white_long_sleeve_tshirt_studio: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-white-long-sleeve-tshirt-studio.jpg",
    description: "white long sleeve T-shirt on a clean studio background",
    keywords: ["long-sleeve t-shirt", "long sleeve t-shirt", "long-sleeve tshirt", "long sleeve tshirt", "long sleeve tee", "long-sleeve tee", "long sleeve top", "long-sleeve top"],
  },
  top_white_hoodie_studio: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-white-hoodie-studio.jpg",
    description: "white hoodie in a minimal studio shot",
    keywords: ["hoodie", "casual hoodie", "pullover hoodie", "light hoodie"],
  },
  top_white_button_up_shirt: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-white-button-up-shirt-studio.jpg",
    description: "white button-up shirt in soft studio light",
    keywords: ["button-up", "button down", "button-up shirt", "button-down", "oxford", "oxford shirt", "dress shirt", "collared shirt", "white shirt", "long-sleeve shirt", "polo shirt", "linen shirt"],
  },
  top_linen_shirt_warm: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-linen-shirt-warm-studio.jpg",
    description: "warm ivory linen shirt in a studio product shot",
    keywords: ["linen shirt", "short-sleeve linen shirt", "short sleeve linen shirt", "camp shirt", "lightweight linen shirt", "breathable shirt", "hot weather shirt", "polished warm-weather shirt"],
  },
  top_lightweight_knit_tee: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-lightweight-knit-tee-studio.jpg",
    description: "lightweight knit tee in a soft neutral studio shot",
    keywords: ["knit tee", "lightweight knit tee", "clean knit tee", "cotton knit tee", "fine gauge tee", "lightweight knit", "minimal knit top"],
  },
  top_white_polo_studio: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-white-polo-studio.jpg",
    description: "white polo shirt against a clean white background",
    keywords: ["polo", "polo shirt", "white polo", "collared polo", "smart polo"],
  },
  top_black_graphic_tee_studio: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-black-graphic-tee-studio.jpg",
    description: "black graphic t-shirt in a clean studio shot",
    keywords: ["graphic tee", "graphic t-shirt", "graphic tee shirt", "printed tee", "streetwear tee", "oversized graphic tee", "graphic shirt"],
  },
  top_knit_sweater_hanger: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-knit-sweater-hanger-studio.jpg",
    description: "cream knit sweater in a studio product shot",
    keywords: ["cream sweater", "cream knit sweater", "sweater", "knit", "jumper", "pullover", "crewneck", "thermal", "base layer", "thermal shirt", "long-sleeve thermal shirt"],
  },
  top_white_tank_top_studio: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-white-tank-top-studio.jpg",
    description: "white tank top on a bright studio background",
    keywords: ["tank top", "white tank top", "linen tank top", "lightweight tank top", "sleeveless top", "summer tank"],
  },
  bottom_blue_jeans_stack: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-navy-jeans-denim-studio.jpg",
    description: "navy denim jeans in a studio product shot",
    keywords: ["jeans", "denim", "pants", "trousers", "bottoms", "warm jeans"],
    fallback: true,
  },
  bottom_blue_denim_shorts_studio: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-blue-denim-shorts-studio.jpg",
    description: "blue denim shorts on a clean white background",
    keywords: ["shorts", "denim shorts", "loose shorts", "summer shorts"],
  },
  bottom_cotton_shorts_warm: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-cotton-shorts-warm-studio.jpg",
    description: "Cotton Shorts in a clean studio product-style asset",
    keywords: ["cotton shorts", "chino shorts", "tailored shorts", "linen shorts", "lightweight shorts", "summer shorts", "warm-weather shorts"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_athletic_running_shorts_studio: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-athletic-running-shorts-studio.jpg",
    description: "athletic running shorts styled in a studio fashion shot",
    keywords: ["running shorts", "athletic shorts", "sport shorts", "training shorts", "performance shorts"],
  },
  bottom_black_trousers_studio: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-black-trousers-studio.jpg",
    description: "black tailored trousers on a white studio background",
    keywords: ["tailored trousers", "trousers", "dress pants", "slacks", "tailored pants", "charcoal chinos", "warm trousers", "wool trousers", "tailored wool trousers"],
  },
  bottom_linen_trousers_warm: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-black-linen-trousers-linen-studio.jpg",
    description: "lightweight linen trousers in a clean studio product shot",
    keywords: ["linen trousers", "lightweight linen trousers", "lightweight trousers", "tailored cotton trousers", "breathable trousers", "warm-weather trousers", "tropical trousers"],
  },
  bottom_navy_chinos_polished: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-tan-chinos-cotton-studio.jpg",
    description: "tailored cotton chinos in a clean studio product shot",
    keywords: ["chinos", "navy chinos", "lightweight chinos", "slim chinos", "tailored chinos", "cotton chinos", "clean chinos", "chino trousers"],
  },
  bottom_black_tech_joggers_studio: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-black-trousers-studio.jpg",
    description: "black technical jogger-style trousers in a clean product shot",
    keywords: ["black tech joggers", "tech joggers", "performance joggers", "joggers", "fleece-lined trousers"],
  },
  bottom_athletic_leggings_studio: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-athletic-leggings-studio.jpg",
    description: "athletic leggings in a clean studio shot",
    keywords: ["athletic leggings", "leggings", "running leggings", "fleece-lined leggings", "active leggings"],
  },
  bottom_magenta_leggings_studio: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-magenta-leggings-studio.jpg",
    description: "magenta athletic leggings in a studio shot",
    keywords: ["magenta leggings", "pink leggings", "athletic leggings", "running leggings", "active leggings", "leggings"],
  },
  bottom_cargo_pants_studio: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-cargo-pants-studio.jpg",
    description: "cargo-style pants in a clean fashion shot",
    keywords: ["cargo pants", "water-resistant pants", "insulated pants", "fleece-lined pants", "rain pants", "utility pants"],
  },
  bottom_plaid_trousers_street: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-plaid-trousers-street-studio.jpg",
    description: "Plaid Trousers in a clean studio product-style asset",
    keywords: ["plaid trousers", "checked trousers", "tailored trousers", "smart trousers", "dress pants", "slacks"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_gray_jacket_studio: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-gray-jacket-studio.jpg",
    description: "gray lightweight jacket on a white studio background",
    keywords: ["jacket", "coat", "outerwear", "outer", "blazer", "shell", "windbreaker", "parka", "cardigan", "layer"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
    fallback: true,
  },
  outer_black_blazer_studio: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-black-blazer-studio.jpg",
    description: "tailored blazer detail in clean studio styling",
    keywords: ["blazer", "light blazer", "tailored blazer", "smart blazer", "lightweight blazer"],
  },
  outer_white_hoodie_studio: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-white-hoodie-studio.jpg",
    description: "white hoodie in a minimal studio shot",
    keywords: ["hoodie", "zip hoodie", "hooded layer", "casual hoodie"],
  },
  outer_black_windbreaker_studio: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-black-windbreaker-studio.jpg",
    description: "black windbreaker style jacket in studio light",
    keywords: ["windbreaker", "lightweight windbreaker", "windproof jacket", "waterproof jacket", "windbreaker jacket"],
  },
  outer_black_shell_jacket_city: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-black-shell-jacket-city-studio.jpg",
    description: "Shell Jacket in a clean studio product-style asset",
    keywords: ["shell jacket", "black shell jacket", "running jacket", "light shell", "windbreaker", "technical jacket", "rain jacket", "waterproof jacket", "weatherproof jacket"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_charcoal_overshirt_studio: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-charcoal-overshirt-studio.jpg",
    description: "charcoal overshirt jacket over a knit top",
    keywords: ["overshirt", "shirt jacket", "charcoal overshirt", "light jacket", "casual jacket", "overshirt jacket"],
  },
  outer_black_light_overshirt_street: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-black-light-overshirt-street-studio.jpg",
    description: "Light Overshirt in a clean studio product-style asset",
    keywords: ["light overshirt", "breathable overshirt", "lightweight overshirt", "black overshirt", "shacket", "light shacket"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_rust_parka_outdoors: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-rust-parka-outdoors-studio.jpg",
    description: "rust hooded parka in a studio product shot",
    keywords: ["rust parka", "hooded parka", "parka", "rain parka", "weatherproof parka", "hooded jacket"],
  },
  outer_winter_coat_studio: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-winter-coat-studio.jpg",
    description: "heavy winter coat detail in a cold-weather fashion shot",
    keywords: ["waterproof parka", "parka", "winter coat", "waterproof winter coat", "insulated jacket", "insulated coat", "wool overcoat", "overcoat", "long coat"],
  },
  outer_white_overcoat_studio: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-white-overcoat-studio.jpg",
    description: "white overcoat in a minimal fashion studio portrait",
    keywords: ["overcoat", "wool overcoat", "long overcoat", "smart overcoat", "tailored coat"],
  },
  shoes_white_sneakers_minimal: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-white-sneakers-studio.jpg",
    description: "minimal black-and-white sneakers in studio lighting",
    keywords: ["sneakers", "trainers", "tennis shoes", "casual shoes", "white sneakers", "casual sneakers", "low-top sneakers", "white leather sneakers", "supportive sneakers", "canvas sneakers"],
    fallback: true,
  },
  shoes_black_white_sneakers_studio: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-white-sneakers-studio.jpg",
    description: "black and white statement sneakers in studio lighting",
    keywords: ["streetwear sneakers", "sporty sneakers", "fashion sneakers", "black sneakers", "retro sneakers"],
  },
  shoes_white_running_sneakers: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-white-running-sneakers-studio.jpg",
    description: "Running Sneakers in a clean studio product-style asset",
    keywords: ["running sneakers", "running shoes", "athletic shoes", "water-resistant athletic shoes", "breathable sneakers", "waterproof sneakers", "breathable running sneakers", "athleisure sneakers"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_white_performance_runner_studio: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-white-performance-runner-studio.jpg",
    description: "white performance running shoe in a dramatic product shot",
    keywords: ["performance runner", "running sneakers", "running shoes", "white running shoe", "athletic shoes", "technical sneakers", "white running shoes"],
  },
  shoes_gray_trail_runners_studio: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-gray-trail-runners-studio.jpg",
    description: "gray trail running shoes in a product-style shot",
    keywords: ["trail runners", "trail running shoes", "trail shoes", "grip runners"],
  },
  shoes_black_loafers_studio: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-loafers-studio.jpg",
    description: "black loafers in a studio product shot",
    keywords: ["loafers", "dress loafers", "smart loafers", "leather loafers"],
  },
  shoes_brown_loafers_polished: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-loafers-polished-studio.jpg",
    description: "brown leather loafers in a polished studio product shot",
    keywords: ["brown loafers", "tan loafers", "brown leather loafers", "leather loafers", "soft loafers", "polished leather loafers"],
  },
  shoes_black_dress_loafers_studio: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-dress-loafers-studio.jpg",
    description: "black leather dress loafers on a white background",
    keywords: ["dress shoes", "dress loafers", "formal shoes", "smart shoes", "office shoes"],
  },
  shoes_tan_winter_boots: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-tan-winter-boots-studio.jpg",
    description: "Ankle Boots in a clean studio product-style asset",
    keywords: ["boots", "ankle boots", "winter boots", "suede boots", "waterproof boots", "water-resistant boots", "insulated boots", "waterproof hiking boots", "insulated walking boots"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_brown_ankle_boots_studio: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-ankle-boots-studio.jpg",
    description: "brown ankle boots on a clean studio backdrop",
    keywords: ["ankle boots", "leather ankle boots", "brown ankle boots", "smart ankle boots", "heeled ankle boots"],
  },
  accessory_white_umbrella_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-white-umbrella-studio.jpg",
    description: "umbrella silhouette in a clean dramatic product-style scene",
    keywords: ["umbrella", "compact umbrella", "rain umbrella"],
  },
  accessory_black_sunglasses_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-black-sunglasses-studio.jpg",
    description: "black sunglasses on a clean white surface",
    keywords: ["black sunglasses", "sunglasses", "dark sunglasses", "shades"],
  },
  accessory_pattern_scarf_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-pattern-scarf-studio.jpg",
    description: "patterned silk scarf on a white background",
    keywords: ["scarf", "neck scarf", "silk scarf", "wrap", "light scarf", "lightweight scarf", "wool scarf"],
  },
  accessory_yellow_silk_scarf_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-yellow-silk-scarf-studio.jpg",
    description: "yellow silk scarf styled over a white shirt",
    keywords: ["yellow scarf", "silk scarf", "neck scarf", "pattern scarf", "scarf"],
  },
  accessory_white_beanie_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-white-beanie-studio.jpg",
    description: "knit beanie in a clean product-style shot",
    keywords: ["beanie", "warm hat", "knit hat", "winter hat", "winter beanie", "wool beanie"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_knit_beanies_outdoors: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-knit-beanies-outdoors-studio.jpg",
    description: "Knit Beanie in a clean studio product-style asset",
    keywords: ["knit beanie", "beanie", "winter hat", "warm hat", "knit hat"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_black_baseball_cap_outdoors: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-black-baseball-cap-outdoors-studio.jpg",
    description: "Black Baseball Cap in a clean studio product-style asset",
    keywords: ["black baseball cap", "black cap", "baseball cap", "cap", "dad cap", "sport cap", "snapback cap", "compact cap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_black_sports_cap_outdoors: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-black-sports-cap-outdoors-studio.jpg",
    description: "Sports Cap in a clean studio product-style asset",
    keywords: ["sports cap", "black sport cap", "sport cap", "running cap", "athletic cap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_white_sun_hat_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-white-sun-hat-studio.jpg",
    description: "white wide-brim sun hat on a clean background",
    keywords: ["sun hat", "wide-brim sun hat", "wide brim hat", "beach hat", "sun hat with brim"],
  },
  accessory_watch_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-watch-studio.jpg",
    description: "wristwatch on a white product background",
    keywords: ["watch", "wristwatch", "classic watch"],
  },
  accessory_tote_bag_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tote-bag-studio.jpg",
    description: "leather tote bag on a clean white background",
    keywords: ["tote bag", "tote", "carryall", "shopper bag", "bag", "waterproof bag", "bag for essentials", "everyday bag"],
  },
  accessory_belt_bag_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-belt-bag-studio.jpg",
    description: "belt bag on a white background",
    keywords: ["belt bag", "crossbody bag", "waist bag", "bag", "small waterproof bag", "compact essentials bag"],
  },
  accessory_socks_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-socks-studio.jpg",
    description: "rolled socks on a white surface",
    keywords: ["socks", "crew socks", "wool socks"],
  },
  accessory_white_gloves_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-white-gloves-studio.jpg",
    description: "white gloves on a white background",
    keywords: ["gloves", "light gloves", "warm gloves", "lightweight gloves", "waterproof insulated gloves"],
  },
  accessory_baseball_cap_studio: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-baseball-cap-studio.jpg",
    description: "Baseball Cap in a clean studio product-style asset",
    keywords: ["baseball cap", "cap", "dad cap", "sport cap", "snapback cap", "cotton cap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
    fallback: true,
  },
  accessory_black_backpack_nylon_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-black-backpack-nylon-studio.jpg",
    description: "Black Backpack in a clean studio product-style asset",
    keywords: ["black backpack", "black nylon backpack", "nylon backpack", "backpack", "rucksack", "daypack"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Arcteryx_Alpha_Fast_light_40_black_backpack.jpg
  },
  accessory_navy_bow_tie_silk_v1: {
    slot: "accessory",
    gender: "masculine",
    path: "assets/recommendation-stock/accessory-navy-bow-tie-silk-studio.jpg",
    description: "Navy Bow Tie in a clean studio product-style asset",
    keywords: ["navy bow tie", "navy silk bow tie", "silk bow tie", "bow tie", "bowtie"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Suit,_hat_and_blouse_by_Hattie_Carnegie,_1948.jpg
  },
  accessory_silver_bracelet_metal_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-silver-bracelet-metal-studio.jpg",
    description: "Silver Bracelet in a clean studio product-style asset",
    keywords: ["silver bracelet", "silver metal bracelet", "metal bracelet", "bracelet", "bangle", "cuff bracelet"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Silver_bracelet_(FindID_599796).jpg
  },
  accessory_tan_fedora_wool_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tan-fedora-wool-studio.jpg",
    description: "tan wool fedora (Wikimedia Commons, CC0)",
    keywords: ["tan fedora", "tan wool fedora", "wool fedora", "fedora", "felt hat", "trilby"],
    // attribution: "\nDavid Ring"
    // source: https://commons.wikimedia.org/wiki/File:Fedora_(clothing).jpg
  },
  accessory_silver_necklace_metal_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-silver-necklace-metal-studio.jpg",
    description: "silver metal necklace (Wikimedia Commons, CC BY-SA 4.0)",
    keywords: ["silver necklace", "silver metal necklace", "metal necklace", "necklace", "chain", "pendant"],
    // attribution: "Mauro Cateb"
    // source: https://commons.wikimedia.org/wiki/File:Making_a_silver_necklace_-_A.jpg
  },
  accessory_navy_pocket_square_silk_v1: {
    slot: "accessory",
    gender: "masculine",
    path: "assets/recommendation-stock/accessory-navy-pocket-square-silk-studio.jpg",
    description: "Navy Pocket Square in a clean studio product-style asset",
    keywords: ["navy pocket square", "navy silk pocket square", "silk pocket square", "pocket square", "handkerchief"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:16_pocket_squares.jpg
  },
  accessory_navy_tie_silk_v1: {
    slot: "accessory",
    gender: "masculine",
    path: "assets/recommendation-stock/accessory-navy-tie-silk-studio.jpg",
    description: "Navy Tie in a clean studio product-style asset",
    keywords: ["navy tie", "navy silk tie", "silk tie", "tie", "necktie"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Black,_Blue_and_Navy_Silk_Tie_of_Charles_Lindbergh_-_DPLA_-_fe38c4aaa4787eeddbb2b1da59bc3985_(page_12).jpg
  },
  shoes_brown_brogues_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-brogues-leather-studio.jpg",
    description: "Brown Brogues in a clean studio product-style asset",
    keywords: ["brown brogues", "brown leather brogues", "leather brogues", "brogues", "wingtips", "oxford brogues"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:A_Derby_of_suede_leather_with_brogues.jpg
  },
  shoes_tan_espadrilles_canvas_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-tan-espadrilles-canvas-studio.jpg",
    description: "Tan Espadrilles in a clean studio product-style asset",
    keywords: ["tan espadrilles", "tan canvas espadrilles", "canvas espadrilles", "espadrilles"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Espadrilles_(drawing).jpg
  },
  shoes_brown_sandals_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-sandals-leather-studio.jpg",
    description: "brown leather sandals in a studio product shot",
    keywords: ["brown sandals", "brown leather sandals", "leather sandals", "sandals", "summer sandals"],
    // attribution: "Wyetts"
    // source: https://commons.wikimedia.org/wiki/File:Man_in_sandals_side_view.jpg
  },
  shoes_black_slides_rubber_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-slides-rubber-studio.jpg",
    description: "black rubber slides in a studio product shot",
    keywords: ["black slides", "black rubber slides", "rubber slides", "slides", "slip-on slides"],
    // attribution: "Globetrotter19"
    // source: https://commons.wikimedia.org/wiki/File:Waterpark,_anaconda,_kamikaze_and_black_hole_slides,_2016_Szekszard.jpg
  },
  top_navy_cardigan_wool_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-navy-cardigan-wool-studio.jpg",
    description: "navy cardigan in a studio product shot",
    keywords: ["navy cardigan", "navy wool cardigan", "wool cardigan", "cardigan", "button cardigan", "knit cardigan"],
    // attribution: "Jamie"
    // source: https://commons.wikimedia.org/wiki/File:Tortoiseshell_Glasses,_Red_Boyfriend_Cardigan,_Navy_Blue_Striped_Cotton_Dress_(19175221980).jpg
  },
  top_white_henley_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-white-henley-cotton-studio.jpg",
    description: "White Henley in a clean studio product-style asset",
    keywords: ["white henley", "white cotton henley", "cotton henley", "henley", "henley shirt", "henley top"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Mary_Henley_White_Gile_by_Osgood_(page_273_crop).jpg
  },
  top_charcoal_wool_turtleneck_wool_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-charcoal-wool-turtleneck-wool-studio.jpg",
    description: "Charcoal Wool Turtleneck in a clean studio product-style asset",
    keywords: ["charcoal wool turtleneck", "charcoal wool wool turtleneck", "wool wool turtleneck", "wool turtleneck", "turtleneck", "roll neck", "mock turtleneck"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Houndstooth_Mini_Skirt,_Dotted_Tights,_Black_Mock_Turtleneck,_and_a_Wool_Beret_(22632544598).jpg
  },
  accessory_brown_backpack_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-brown-backpack-leather-studio.jpg",
    description: "Brown Backpack in a clean studio product-style asset",
    keywords: ["brown backpack", "brown leather backpack", "leather backpack", "backpack", "rucksack", "daypack"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Trendy_Backpack_(Unsplash).jpg
  },
  accessory_gray_backpack_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-gray-backpack-leather-studio.jpg",
    description: "Gray Backpack in a clean studio product-style asset",
    keywords: ["gray backpack", "gray leather backpack", "leather backpack", "backpack", "rucksack", "daypack"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Ryan_Wesley_Routh%27s_Backpack_And_Rifle.png
  },
  accessory_navy_backpack_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-navy-backpack-leather-studio.jpg",
    description: "Navy Backpack in a clean studio product-style asset",
    keywords: ["navy backpack", "navy leather backpack", "leather backpack", "backpack", "rucksack", "daypack"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Flickr_-_Official_U.S._Navy_Imagery_-_A_Sailor_helps_a_guest_don_a_self-contained_breathing_apparatus_backpack_in_the_hangar_bay..jpg
  },
  accessory_tan_backpack_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tan-backpack-leather-studio.jpg",
    description: "Tan Backpack in a clean studio product-style asset",
    keywords: ["tan backpack", "tan leather backpack", "leather backpack", "backpack", "rucksack", "daypack"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Woman_wearing_red_backpack_(Unsplash).jpg
  },
  accessory_brown_baseball_cap_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-brown-baseball-cap-cotton-studio.jpg",
    description: "Brown Baseball Cap in a clean studio product-style asset",
    keywords: ["brown baseball cap", "brown cotton baseball cap", "cotton baseball cap", "baseball cap", "cap", "dad cap"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Baseball_cap.png
  },
  accessory_cream_baseball_cap_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-cream-baseball-cap-cotton-studio.jpg",
    description: "Cream Baseball Cap in a clean studio product-style asset",
    keywords: ["cream baseball cap", "cream cotton baseball cap", "cotton baseball cap", "baseball cap", "cap", "dad cap"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Baseball_cap.png
  },
  accessory_gray_baseball_cap_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-gray-baseball-cap-cotton-studio.jpg",
    description: "Gray Baseball Cap in a clean studio product-style asset",
    keywords: ["gray baseball cap", "gray cotton baseball cap", "cotton baseball cap", "baseball cap", "cap", "dad cap"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Selfie_man_with_cap_and_glasses_in_Paris.jpg
  },
  accessory_navy_baseball_cap_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-navy-baseball-cap-cotton-studio.jpg",
    description: "Navy Baseball Cap in a clean studio product-style asset",
    keywords: ["navy baseball cap", "navy cotton baseball cap", "cotton baseball cap", "baseball cap", "cap", "dad cap"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Baseball_cap.png
  },
  accessory_tan_baseball_cap_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tan-baseball-cap-cotton-studio.jpg",
    description: "Tan Baseball Cap in a clean studio product-style asset",
    keywords: ["tan baseball cap", "tan cotton baseball cap", "cotton baseball cap", "baseball cap", "cap", "dad cap"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Female_chihuahua_and_baseball_cap_(crop).jpg
  },
  accessory_white_baseball_cap_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-white-baseball-cap-cotton-studio.jpg",
    description: "White Baseball Cap in a clean studio product-style asset",
    keywords: ["white baseball cap", "white cotton baseball cap", "cotton baseball cap", "baseball cap", "cap", "dad cap"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Niksun_baseball_cap_-_Know_the_Unknown.jpg
  },
  accessory_brown_belt_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-brown-belt-leather-studio.jpg",
    description: "Brown Belt in a clean studio product-style asset",
    keywords: ["brown belt", "brown leather belt", "leather belt", "belt"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Leather_belt_%26_buckle.jpg
  },
  accessory_gray_belt_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-gray-belt-leather-studio.jpg",
    description: "Gray Belt in a clean studio product-style asset",
    keywords: ["gray belt", "gray leather belt", "leather belt", "belt"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Germany_Belt-and-Buckle-02.jpg
  },
  accessory_navy_belt_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-navy-belt-leather-studio.jpg",
    description: "Navy Belt in a clean studio product-style asset",
    keywords: ["navy belt", "navy leather belt", "leather belt", "belt"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:President_and_HMS_Little_Belt_1811_BRM1682.jpg
  },
  accessory_tan_belt_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tan-belt-leather-studio.jpg",
    description: "Tan Belt in a clean studio product-style asset",
    keywords: ["tan belt", "tan leather belt", "leather belt", "belt"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Trans_Mexican_Volcanic_Belt_extension.png
  },
  accessory_black_gloves_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-black-gloves-cotton-studio.jpg",
    description: "Black Gloves in a clean studio product-style asset",
    keywords: ["black gloves", "black cotton gloves", "cotton gloves", "gloves", "light gloves"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:The_woman_with_the_black_glove_(1881),_by_Giuseppe_De_Nittis.png
  },
  accessory_brown_gloves_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-brown-gloves-cotton-studio.jpg",
    description: "Brown Gloves in a clean studio product-style asset",
    keywords: ["brown gloves", "brown cotton gloves", "cotton gloves", "gloves", "light gloves"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Wedding_gloves_MET_CIX55.23.2ab.jpg
  },
  accessory_gray_gloves_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-gray-gloves-cotton-studio.jpg",
    description: "Gray Gloves in a clean studio product-style asset",
    keywords: ["gray gloves", "gray cotton gloves", "cotton gloves", "gloves", "light gloves"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Grey_leather_and_fur_gloves_by_Christian_Dior_in_box.jpg
  },
  accessory_navy_gloves_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-navy-gloves-cotton-studio.jpg",
    description: "Navy Gloves in a clean studio product-style asset",
    keywords: ["navy gloves", "navy cotton gloves", "cotton gloves", "gloves", "light gloves"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:John_Hawley_Glover.jpg
  },
  accessory_tan_gloves_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tan-gloves-cotton-studio.jpg",
    description: "Tan Gloves in a clean studio product-style asset",
    keywords: ["tan gloves", "tan cotton gloves", "cotton gloves", "gloves", "light gloves"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:BMX_gloves_-_palm.jpg
  },
  accessory_black_scarf_silk_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-black-scarf-silk-studio.jpg",
    description: "Black Scarf in a clean studio product-style asset",
    keywords: ["black scarf", "black silk scarf", "silk scarf", "scarf", "neck scarf"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Black_and_Gold_Silk_Scarf_of_Charles_Lindbergh_-_DPLA_-_416b7a60b518853e77b845423a245a39_(page_7).jpg
  },
  accessory_brown_scarf_silk_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-brown-scarf-silk-studio.jpg",
    description: "Brown Scarf in a clean studio product-style asset",
    keywords: ["brown scarf", "brown silk scarf", "silk scarf", "scarf", "neck scarf"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Scarf_(AM_1955.16.2-4).jpg
  },
  accessory_gray_scarf_silk_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-gray-scarf-silk-studio.jpg",
    description: "Gray Scarf in a clean studio product-style asset",
    keywords: ["gray scarf", "gray silk scarf", "silk scarf", "scarf", "neck scarf"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Casol_square_silk_scarf_as_head_scarf.jpg
  },
  accessory_navy_scarf_silk_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-navy-scarf-silk-studio.jpg",
    description: "Navy Scarf in a clean studio product-style asset",
    keywords: ["navy scarf", "navy silk scarf", "silk scarf", "scarf", "neck scarf"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:SENIOR_AIRMAN_Owen_Davies_models_the_proposed_Formal_Service_uniform_with_Navy_points,_Navy_scarf,_white_buttons_and_tall_hat_-_DPLA_-_3b17d53a73e26a763b95441bdf6e7ce9.jpeg
  },
  accessory_tan_scarf_silk_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tan-scarf-silk-studio.jpg",
    description: "Tan Scarf in a clean studio product-style asset",
    keywords: ["tan scarf", "tan silk scarf", "silk scarf", "scarf", "neck scarf"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Scarf_(AM_1955.16.2-4).jpg
  },
  accessory_black_sun_hat_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-black-sun-hat-cotton-studio.jpg",
    description: "Black Sun Hat in a clean studio product-style asset",
    keywords: ["black sun hat", "black cotton sun hat", "cotton sun hat", "sun hat", "wide-brim sun hat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Woman_in_sun-hat,_Bondi_Beach_(31668995355)_(cropped).jpg
  },
  accessory_brown_sun_hat_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-brown-sun-hat-cotton-studio.jpg",
    description: "Brown Sun Hat in a clean studio product-style asset",
    keywords: ["brown sun hat", "brown cotton sun hat", "cotton sun hat", "sun hat", "wide-brim sun hat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Woman_in_sun-hat,_Bondi_Beach_(31668995355)_(cropped).jpg
  },
  accessory_gray_sun_hat_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-gray-sun-hat-cotton-studio.jpg",
    description: "Gray Sun Hat in a clean studio product-style asset",
    keywords: ["gray sun hat", "gray cotton sun hat", "cotton sun hat", "sun hat", "wide-brim sun hat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Woman_in_sun-hat,_Bondi_Beach_(31668995355)_(cropped).jpg
  },
  accessory_navy_sun_hat_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-navy-sun-hat-cotton-studio.jpg",
    description: "Navy Sun Hat in a clean studio product-style asset",
    keywords: ["navy sun hat", "navy cotton sun hat", "cotton sun hat", "sun hat", "wide-brim sun hat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:US_Navy_030217-M-3692W-051_U.S._Marines_from_the_combat_engineer_detachment,_Battalion_Landing_Team_2-1,_15th_Marine_Expeditionary_Unit_(Special_Operations_Capable),_stand_silhouetted_against_the_setting_sun_in_Kuwait.jpg
  },
  accessory_tan_sun_hat_cotton_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tan-sun-hat-cotton-studio.jpg",
    description: "Tan Sun Hat in a clean studio product-style asset",
    keywords: ["tan sun hat", "tan cotton sun hat", "cotton sun hat", "sun hat", "wide-brim sun hat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Woman_in_sun-hat,_Bondi_Beach_(31668995355)_(cropped).jpg
  },
  accessory_black_sunglasses_acetate_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-black-sunglasses-acetate-studio.jpg",
    description: "Black Sunglasses in a clean studio product-style asset",
    keywords: ["black sunglasses", "black acetate sunglasses", "acetate sunglasses", "sunglasses", "shades"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Black-and-white_Oakley_sunglasses_model.jpg
  },
  accessory_brown_sunglasses_acetate_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-brown-sunglasses-acetate-studio.jpg",
    description: "Brown Sunglasses in a clean studio product-style asset",
    keywords: ["brown sunglasses", "brown acetate sunglasses", "acetate sunglasses", "sunglasses", "shades"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Oakley_sunglasses_model_long_brown_hair.jpg
  },
  accessory_gray_sunglasses_acetate_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-gray-sunglasses-acetate-studio.jpg",
    description: "Gray Sunglasses in a clean studio product-style asset",
    keywords: ["gray sunglasses", "gray acetate sunglasses", "acetate sunglasses", "sunglasses", "shades"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Tom_ford_anouk_sunglasses%2Bfloral_blazer%2Bleyendecker_fringe_nude_dress%2Bgray_jeans_(4814213165).jpg
  },
  accessory_tan_sunglasses_acetate_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tan-sunglasses-acetate-studio.jpg",
    description: "Tan Sunglasses in a clean studio product-style asset",
    keywords: ["tan sunglasses", "tan acetate sunglasses", "acetate sunglasses", "sunglasses", "shades"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Toronto_Pride_2011_-_Topless_woman_with_sunglasses.jpg
  },
  accessory_black_tote_bag_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-black-tote-bag-leather-studio.jpg",
    description: "Black Tote Bag in a clean studio product-style asset",
    keywords: ["black tote bag", "black leather tote bag", "leather tote bag", "tote bag", "tote", "carryall", "everyday bag"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Konomiya_Shoping_Bag.jpg
  },
  accessory_brown_tote_bag_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-brown-tote-bag-leather-studio.jpg",
    description: "Brown Tote Bag in a clean studio product-style asset",
    keywords: ["brown tote bag", "brown leather tote bag", "leather tote bag", "tote bag", "tote", "carryall", "everyday bag"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Brown_Tote_Bag_with_a_John_Pils_Print_on_Front_-_DPLA_-_d36ce76840c85b3d681faf3d39770683_(page_4).jpg
  },
  accessory_gray_tote_bag_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-gray-tote-bag-leather-studio.jpg",
    description: "Gray Tote Bag in a clean studio product-style asset",
    keywords: ["gray tote bag", "gray leather tote bag", "leather tote bag", "tote bag", "tote", "carryall", "everyday bag"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Gray_Tote_Bag_and_Nine_West_Leopard_Print_Heels_(22129379968).jpg
  },
  accessory_navy_tote_bag_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-navy-tote-bag-leather-studio.jpg",
    description: "Navy Tote Bag in a clean studio product-style asset",
    keywords: ["navy tote bag", "navy leather tote bag", "leather tote bag", "tote bag", "tote", "carryall", "everyday bag"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Tote_bag-making_18.jpg
  },
  accessory_tan_tote_bag_leather_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tan-tote-bag-leather-studio.jpg",
    description: "Tan Tote Bag in a clean studio product-style asset",
    keywords: ["tan tote bag", "tan leather tote bag", "leather tote bag", "tote bag", "tote", "carryall", "everyday bag"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Last_Drip_Designs_Tote_Bag.png
  },
  accessory_black_watch_metal_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-black-watch-metal-studio.jpg",
    description: "Black Watch in a clean studio product-style asset",
    keywords: ["black watch", "black metal watch", "metal watch", "watch", "wristwatch", "classic watch"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Black_Watch_statue_description_plaque.jpg
  },
  accessory_gray_watch_metal_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-gray-watch-metal-studio.jpg",
    description: "gray metal watch (Wikimedia Commons, No restrictions)",
    keywords: ["gray watch", "gray metal watch", "metal watch", "watch", "wristwatch", "classic watch"],
    // attribution: "Internet Archive Book Images"
    // source: https://commons.wikimedia.org/wiki/File:Coast_watch_(1979)_(20651129222).jpg
  },
  accessory_navy_watch_metal_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-navy-watch-metal-studio.jpg",
    description: "Navy Watch in a clean studio product-style asset",
    keywords: ["navy watch", "navy metal watch", "metal watch", "watch", "wristwatch", "classic watch"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:US_Navy_040522-N-2820Z-003_Pre-commissioning_Unit_(PCU)_North_Carolina_(SSN_777)_sponsor_Mrs._Linda_R._Bowman,_watch_as_Northrop_Grumman_welder_Stanley_Britt_welds_Mrs._Bowman%27s_initials_on_a_metal_plate.jpg
  },
  accessory_tan_watch_metal_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tan-watch-metal-studio.jpg",
    description: "Tan Watch in a clean studio product-style asset",
    keywords: ["tan watch", "tan metal watch", "metal watch", "watch", "wristwatch", "classic watch"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Pocket_watch_with_chain.jpg
  },
  accessory_black_wool_scarf_silk_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-black-wool-scarf-silk-studio.jpg",
    description: "Black Wool Scarf in a clean studio product-style asset",
    keywords: ["black wool scarf", "black silk wool scarf", "silk wool scarf", "wool scarf", "warm scarf"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Tiias_scarf_(5282068621).jpg
  },
  accessory_brown_wool_scarf_silk_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-brown-wool-scarf-silk-studio.jpg",
    description: "Brown Wool Scarf in a clean studio product-style asset",
    keywords: ["brown wool scarf", "brown silk wool scarf", "silk wool scarf", "wool scarf", "warm scarf"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Purple_heather_pure_wool_infinity_scarf.jpg
  },
  accessory_gray_wool_scarf_silk_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-gray-wool-scarf-silk-studio.jpg",
    description: "Gray Wool Scarf in a clean studio product-style asset",
    keywords: ["gray wool scarf", "gray silk wool scarf", "silk wool scarf", "wool scarf", "warm scarf"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Purple_heather_pure_wool_infinity_scarf.jpg
  },
  accessory_navy_wool_scarf_silk_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-navy-wool-scarf-silk-studio.jpg",
    description: "Navy Wool Scarf in a clean studio product-style asset",
    keywords: ["navy wool scarf", "navy silk wool scarf", "silk wool scarf", "wool scarf", "warm scarf"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Purple_heather_pure_wool_infinity_scarf.jpg
  },
  accessory_tan_wool_scarf_silk_v1: {
    slot: "accessory",
    gender: "unisex",
    path: "assets/recommendation-stock/accessory-tan-wool-scarf-silk-studio.jpg",
    description: "Tan Wool Scarf in a clean studio product-style asset",
    keywords: ["tan wool scarf", "tan silk wool scarf", "silk wool scarf", "wool scarf", "warm scarf"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Purple_heather_pure_wool_infinity_scarf.jpg
  },
  bottom_beige_chinos_cotton_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-beige-chinos-cotton-studio.jpg",
    description: "Beige Chinos in a clean studio product-style asset",
    keywords: ["beige chinos", "beige cotton chinos", "cotton chinos", "chinos", "chino trousers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Chino_pants.jpg
  },
  bottom_black_chinos_cotton_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-black-chinos-cotton-studio.jpg",
    description: "black cotton chinos in a studio product shot",
    keywords: ["black chinos", "black cotton chinos", "cotton chinos", "chinos", "chino trousers"],
    // attribution: "Unknown authorUnknown author"
    // source: https://commons.wikimedia.org/wiki/File:Wendell_Chino_1975.jpg
  },
  bottom_brown_chinos_cotton_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-brown-chinos-cotton-studio.jpg",
    description: "Brown Chinos in a clean studio product-style asset",
    keywords: ["brown chinos", "brown cotton chinos", "cotton chinos", "chinos", "chino trousers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Man_wearing_blue_denim_shirt_with_rolled_sleeves,_tan_chinos_1.jpg
  },
  bottom_charcoal_chinos_cotton_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-charcoal-chinos-cotton-studio.jpg",
    description: "charcoal chinos in a studio product shot",
    keywords: ["charcoal chinos", "charcoal cotton chinos", "cotton chinos", "chinos", "chino trousers"],
    // attribution: "Kuha455405"
    // source: https://commons.wikimedia.org/wiki/File:Chino_pants.jpg
  },
  bottom_cream_chinos_cotton_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-cream-chinos-cotton-studio.jpg",
    description: "Cream Chinos in a clean studio product-style asset",
    keywords: ["cream chinos", "cream cotton chinos", "cotton chinos", "chinos", "chino trousers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Chino_pants.jpg
  },
  bottom_gray_chinos_cotton_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-gray-chinos-cotton-studio.jpg",
    description: "gray chinos in a studio product shot",
    keywords: ["gray chinos", "gray cotton chinos", "cotton chinos", "chinos", "chino trousers"],
    // attribution: "Kuha455405"
    // source: https://commons.wikimedia.org/wiki/File:Chino_pants.jpg
  },
  bottom_olive_chinos_cotton_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-olive-chinos-cotton-studio.jpg",
    description: "Olive Chinos in a clean studio product-style asset",
    keywords: ["olive chinos", "olive cotton chinos", "cotton chinos", "chinos", "chino trousers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Chino_pants.jpg
  },
  bottom_tan_chinos_cotton_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-tan-chinos-cotton-studio.jpg",
    description: "tan cotton chinos in a studio product shot",
    keywords: ["tan chinos", "tan cotton chinos", "cotton chinos", "chinos", "chino trousers"],
    // attribution: "Kuha455405"
    // source: https://commons.wikimedia.org/wiki/File:Chino_pants.jpg
  },
  bottom_white_chinos_cotton_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-white-chinos-cotton-studio.jpg",
    description: "White Chinos in a clean studio product-style asset",
    keywords: ["white chinos", "white cotton chinos", "cotton chinos", "chinos", "chino trousers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Chino_pants.jpg
  },
  bottom_beige_jeans_denim_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-beige-jeans-denim-studio.jpg",
    description: "beige jeans in a studio product shot",
    keywords: ["beige jeans", "beige denim jeans", "denim jeans", "jeans", "denim", "denim pants"],
    // attribution: "Alfredo Rendón"
    // source: https://commons.wikimedia.org/wiki/File:Grupo_Jeans_Reencuentro.jpg
  },
  bottom_black_jeans_denim_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-black-jeans-denim-studio.jpg",
    description: "black jeans in a studio product shot",
    keywords: ["black jeans", "black denim jeans", "denim jeans", "jeans", "denim", "denim pants"],
    // attribution: "Alfredo Rendón"
    // source: https://commons.wikimedia.org/wiki/File:Grupo_Jeans_Reencuentro.jpg
  },
  bottom_brown_jeans_denim_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-brown-jeans-denim-studio.jpg",
    description: "brown jeans in a studio product shot",
    keywords: ["brown jeans", "brown denim jeans", "denim jeans", "jeans", "denim", "denim pants"],
    // attribution: "Alfredo Rendón"
    // source: https://commons.wikimedia.org/wiki/File:Grupo_Jeans_Reencuentro.jpg
  },
  bottom_charcoal_jeans_denim_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-charcoal-jeans-denim-studio.jpg",
    description: "charcoal jeans in a studio product shot",
    keywords: ["charcoal jeans", "charcoal denim jeans", "denim jeans", "jeans", "denim", "denim pants"],
    // attribution: "Alfredo Rendón"
    // source: https://commons.wikimedia.org/wiki/File:Grupo_Jeans_Reencuentro.jpg
  },
  bottom_cream_jeans_denim_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-cream-jeans-denim-studio.jpg",
    description: "Cream Jeans in a clean studio product-style asset",
    keywords: ["cream jeans", "cream denim jeans", "denim jeans", "jeans", "denim", "denim pants"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Lechenaultia_hortii_-_Flickr_-_jeans_Photos.jpg
  },
  bottom_gray_jeans_denim_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-gray-jeans-denim-studio.jpg",
    description: "gray jeans in a studio product shot",
    keywords: ["gray jeans", "gray denim jeans", "denim jeans", "jeans", "denim", "denim pants"],
    // attribution: "MHM55"
    // source: https://commons.wikimedia.org/wiki/File:Gr%C3%A8veClimatGen%C3%A8ve-15mars2019-058_(cropped;_grey_and_blue_jeans,_female).jpg
  },
  bottom_navy_jeans_denim_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-navy-jeans-denim-studio.jpg",
    description: "navy denim jeans in a studio product shot",
    keywords: ["navy jeans", "navy denim jeans", "denim jeans", "jeans", "denim", "denim pants"],
    // attribution: "E(dward) S(mith) Hodgson (25 April 1866-15 April 1937)"
    // source: https://commons.wikimedia.org/wiki/File:Illustration_by_E._S._Hodgson_for_Mr._Midshipman_Glover_(1908)_by_T._T._Jeans-by_courtesy_of_Project_Gutenberg-4.jpg
  },
  bottom_olive_jeans_denim_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-olive-jeans-denim-studio.jpg",
    description: "olive jeans in a studio product shot",
    keywords: ["olive jeans", "olive denim jeans", "denim jeans", "jeans", "denim", "denim pants"],
    // attribution: "Alfredo Rendón"
    // source: https://commons.wikimedia.org/wiki/File:Grupo_Jeans_Reencuentro.jpg
  },
  bottom_tan_jeans_denim_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-tan-jeans-denim-studio.jpg",
    description: "tan jeans in a studio product shot",
    keywords: ["tan jeans", "tan denim jeans", "denim jeans", "jeans", "denim", "denim pants"],
    // attribution: "Alfredo Rendón"
    // source: https://commons.wikimedia.org/wiki/File:Grupo_Jeans_Reencuentro.jpg
  },
  bottom_white_jeans_denim_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-white-jeans-denim-studio.jpg",
    description: "White Jeans in a clean studio product-style asset",
    keywords: ["white jeans", "white denim jeans", "denim jeans", "jeans", "denim", "denim pants"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:18_,_sin_dudarlo_(51089493137)_(cropped;_white_ripped_skinny_jeans).jpg
  },
  bottom_gray_joggers_tech_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-gray-joggers-tech-studio.jpg",
    description: "gray joggers in a studio product shot",
    keywords: ["gray joggers", "gray tech joggers", "tech joggers", "joggers", "jogger pants", "sweatpants"],
    // attribution: "Pr0m37h3u$"
    // source: https://commons.wikimedia.org/wiki/File:Corteiz_Alcatraz_Joggers.jpg
  },
  bottom_white_joggers_tech_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-white-joggers-tech-studio.jpg",
    description: "white joggers in a studio product shot",
    keywords: ["white joggers", "white tech joggers", "tech joggers", "joggers", "jogger pants", "sweatpants"],
    // attribution: "Mike Baird from Morro Bay, USA"
    // source: https://commons.wikimedia.org/wiki/File:Female_joggers_on_foggy_Morro_Strand_State_Beach.jpg
  },
  bottom_black_linen_trousers_linen_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-black-linen-trousers-linen-studio.jpg",
    description: "black trousers in a studio product shot",
    keywords: ["black linen trousers", "black linen linen trousers", "linen linen trousers", "linen trousers", "summer trousers"],
    // attribution: ""
    // source: https://commons.wikimedia.org/wiki/File:Trousers_MET_10.124.4_F.jpg
  },
  bottom_charcoal_linen_trousers_linen_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-charcoal-linen-trousers-linen-studio.jpg",
    description: "charcoal trousers in a studio product shot",
    keywords: ["charcoal linen trousers", "charcoal linen linen trousers", "linen linen trousers", "linen trousers", "summer trousers"],
    // attribution: ""
    // source: https://commons.wikimedia.org/wiki/File:Trousers_MET_10.124.4_F.jpg
  },
  bottom_black_tailored_trousers_wool_v1: {
    slot: "bottom",
    gender: "unisex",
    path: "assets/recommendation-stock/bottom-black-tailored-trousers-wool-studio.jpg",
    description: "Black Tailored Trousers in a clean studio product-style asset",
    keywords: ["black tailored trousers", "black wool tailored trousers", "wool tailored trousers", "tailored trousers", "trousers", "slacks", "dress pants"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Black_Wool_Pants_Belonging_to_Charles_Lindbergh_-_DPLA_-_76d8e7969a4fcab57c334095959d95b3_(page_8).jpg
  },
  bottom_brown_tailored_trousers_wool_v1: {
    slot: "bottom",
    gender: "masculine",
    path: "assets/recommendation-stock/bottom-brown-tailored-trousers-wool-studio.jpg",
    description: "Brown Tailored Trousers in a clean studio product-style asset",
    keywords: ["brown tailored trousers", "brown wool tailored trousers", "wool tailored trousers", "tailored trousers", "trousers", "slacks", "dress pants"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Box_containing_suit_jacket_and_trousers.jpg
  },
  outer_beige_bomber_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-beige-bomber-jacket-cotton-studio.jpg",
    description: "Beige Bomber Jacket in a clean studio product-style asset",
    keywords: ["beige bomber jacket", "beige cotton bomber jacket", "cotton bomber jacket", "bomber jacket", "bomber"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Polo_Ralph_Lauren_bomber_jacket,_stone_coloured.jpg
  },
  outer_brown_bomber_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-brown-bomber-jacket-cotton-studio.jpg",
    description: "brown bomber jacket in a studio product shot",
    keywords: ["brown bomber jacket", "brown cotton bomber jacket", "cotton bomber jacket", "bomber jacket", "bomber"],
    // attribution: "Cici water"
    // source: https://commons.wikimedia.org/wiki/File:Women_Bomber_Jacket_Back.jpg
  },
  outer_charcoal_bomber_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-charcoal-bomber-jacket-cotton-studio.jpg",
    description: "charcoal bomber jacket in a studio product shot",
    keywords: ["charcoal bomber jacket", "charcoal cotton bomber jacket", "cotton bomber jacket", "bomber jacket", "bomber"],
    // attribution: "The original uploader was Spuggie at English Wikipedia."
    // source: https://commons.wikimedia.org/wiki/File:MA-1_Jacket_in_petrol.jpg
  },
  outer_cream_bomber_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-cream-bomber-jacket-cotton-studio.jpg",
    description: "cream bomber jacket in a studio product shot",
    keywords: ["cream bomber jacket", "cream cotton bomber jacket", "cotton bomber jacket", "bomber jacket", "bomber"],
    // attribution: ""
    // source: https://commons.wikimedia.org/wiki/File:Jacket,_flying_(AM_1979.118-1).jpg
  },
  outer_gray_bomber_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-gray-bomber-jacket-cotton-studio.jpg",
    description: "gray bomber jacket in a studio product shot",
    keywords: ["gray bomber jacket", "gray cotton bomber jacket", "cotton bomber jacket", "bomber jacket", "bomber"],
    // attribution: "The original uploader was Spuggie at English Wikipedia."
    // source: https://commons.wikimedia.org/wiki/File:MA-1_Jacket_in_petrol.jpg
  },
  outer_navy_bomber_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-navy-bomber-jacket-cotton-studio.jpg",
    description: "navy bomber jacket in a studio product shot",
    keywords: ["navy bomber jacket", "navy cotton bomber jacket", "cotton bomber jacket", "bomber jacket", "bomber"],
    // attribution: "United States Holocaust Memorial Museum Collection"
    // source: https://commons.wikimedia.org/wiki/File:Concentration_camp_uniform_jacket_Lithuanian_Jewish_inmate_Getzel_Fingerhut_Utting_Kaufering.jpg
  },
  outer_olive_bomber_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-olive-bomber-jacket-cotton-studio.jpg",
    description: "olive bomber jacket in a studio product shot",
    keywords: ["olive bomber jacket", "olive cotton bomber jacket", "cotton bomber jacket", "bomber jacket", "bomber"],
    // attribution: "The original uploader was Spuggie at English Wikipedia."
    // source: https://commons.wikimedia.org/wiki/File:MA-1_Jacket_in_petrol.jpg
  },
  outer_tan_bomber_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-tan-bomber-jacket-cotton-studio.jpg",
    description: "tan bomber jacket in a studio product shot",
    keywords: ["tan bomber jacket", "tan cotton bomber jacket", "cotton bomber jacket", "bomber jacket", "bomber"],
    // attribution: "The original uploader was Spuggie at English Wikipedia."
    // source: https://commons.wikimedia.org/wiki/File:MA-1_Jacket_in_petrol.jpg
  },
  outer_beige_field_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-beige-field-jacket-cotton-studio.jpg",
    description: "Beige Field Jacket in a clean studio product-style asset",
    keywords: ["beige field jacket", "beige cotton field jacket", "cotton field jacket", "field jacket", "utility jacket", "m-65"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Jacket,_field_(AM_1994.154-14).jpg
  },
  outer_brown_field_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-brown-field-jacket-cotton-studio.jpg",
    description: "brown field jacket in a studio product shot",
    keywords: ["brown field jacket", "brown cotton field jacket", "cotton field jacket", "field jacket", "utility jacket", "m-65"],
    // attribution: "Abercrombie and Fitch"
    // source: https://commons.wikimedia.org/wiki/File:Brown_Leather_Double_Breasted_Flight_Jacket_Belonging_to_Charles_Lindbergh_-_DPLA_-_cb7f8df8477f3c68022081ec8c3e5282_(page_10).jpg
  },
  outer_charcoal_field_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-charcoal-field-jacket-cotton-studio.jpg",
    description: "charcoal field jacket in a studio product shot",
    keywords: ["charcoal field jacket", "charcoal cotton field jacket", "cotton field jacket", "field jacket", "utility jacket", "m-65"],
    // attribution: "Godzilla0936"
    // source: https://commons.wikimedia.org/wiki/File:M-65_field_jacket.jpg
  },
  outer_cream_field_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-cream-field-jacket-cotton-studio.jpg",
    description: "cream field jacket in a studio product shot",
    keywords: ["cream field jacket", "cream cotton field jacket", "cotton field jacket", "field jacket", "utility jacket", "m-65"],
    // attribution: ""
    // source: https://commons.wikimedia.org/wiki/File:Cream_lace_jacket_-_DPLA_-_b417a64c87acf2a86b34df77bf5e8167_(page_2).jpg
  },
  outer_gray_field_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-gray-field-jacket-cotton-studio.jpg",
    description: "Gray Field Jacket in a clean studio product-style asset",
    keywords: ["gray field jacket", "gray cotton field jacket", "cotton field jacket", "field jacket", "utility jacket", "m-65"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Gray_Zipper_Jacket_Belonging_to_Lee_Harvey_Oswald_-_NARA_-_305140_(page_4).gif
  },
  outer_navy_field_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-navy-field-jacket-cotton-studio.jpg",
    description: "navy cotton field jacket in a studio product shot",
    keywords: ["navy field jacket", "navy cotton field jacket", "cotton field jacket", "field jacket", "utility jacket", "m-65"],
    // attribution: "ArmyParatrooper436"
    // source: https://commons.wikimedia.org/wiki/File:Clothing_tag_on_Navy_Issued_Jacket,_Cold_Weather,_Permeable_built_by_the_Vanderbilt_Shirt_Company.jpg
  },
  outer_olive_field_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-olive-field-jacket-cotton-studio.jpg",
    description: "olive field jacket in a studio product shot",
    keywords: ["olive field jacket", "olive cotton field jacket", "cotton field jacket", "field jacket", "utility jacket", "m-65"],
    // attribution: "Gieves Limited"
    // source: https://commons.wikimedia.org/wiki/File:Flight_Jacket_Worn_by_Anne_Morrow_Lindbergh_-_DPLA_-_b1dacaee9fd5ef1cc5ddab0e6963fb75_(page_20).jpg
  },
  outer_tan_field_jacket_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-tan-field-jacket-cotton-studio.jpg",
    description: "tan field jacket in a studio product shot",
    keywords: ["tan field jacket", "tan cotton field jacket", "cotton field jacket", "field jacket", "utility jacket", "m-65"],
    // attribution: "San Diego Air &amp; Space Museum Archives"
    // source: https://commons.wikimedia.org/wiki/File:70137e_Curatorial_Collection_Image_-_Jacket,_Jacqueline_Cochran%27s_War_Correspondent_U_S_Army_Air_Force_uniform_jacket;_Tan,_single_breasted_jacket_with_%22War_Correspondent%22_embroidered_on_badge_above_left_breast_pocket,_(53898051370).jpg
  },
  outer_beige_hooded_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-beige-hooded-parka-down-studio.jpg",
    description: "Beige Hooded Parka in a clean studio product-style asset",
    keywords: ["beige hooded parka", "beige down hooded parka", "down hooded parka", "hooded parka", "parka"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Anorak.jpg
  },
  outer_black_hooded_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-black-hooded-parka-down-studio.jpg",
    description: "Black Hooded Parka in a clean studio product-style asset",
    keywords: ["black hooded parka", "black down hooded parka", "down hooded parka", "hooded parka", "parka"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Anorak.jpg
  },
  outer_brown_hooded_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-brown-hooded-parka-down-studio.jpg",
    description: "Brown Hooded Parka in a clean studio product-style asset",
    keywords: ["brown hooded parka", "brown down hooded parka", "down hooded parka", "hooded parka", "parka"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Anorak.jpg
  },
  outer_charcoal_hooded_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-charcoal-hooded-parka-down-studio.jpg",
    description: "Charcoal Hooded Parka in a clean studio product-style asset",
    keywords: ["charcoal hooded parka", "charcoal down hooded parka", "down hooded parka", "hooded parka", "parka"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Anorak.jpg
  },
  outer_cream_hooded_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-cream-hooded-parka-down-studio.jpg",
    description: "Cream Hooded Parka in a clean studio product-style asset",
    keywords: ["cream hooded parka", "cream down hooded parka", "down hooded parka", "hooded parka", "parka"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Anorak.jpg
  },
  outer_gray_hooded_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-gray-hooded-parka-down-studio.jpg",
    description: "Gray Hooded Parka in a clean studio product-style asset",
    keywords: ["gray hooded parka", "gray down hooded parka", "down hooded parka", "hooded parka", "parka"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Anorak.jpg
  },
  outer_navy_hooded_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-navy-hooded-parka-down-studio.jpg",
    description: "Navy Hooded Parka in a clean studio product-style asset",
    keywords: ["navy hooded parka", "navy down hooded parka", "down hooded parka", "hooded parka", "parka"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Anorak.jpg
  },
  outer_olive_hooded_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-olive-hooded-parka-down-studio.jpg",
    description: "olive hooded parka in a studio product shot",
    keywords: ["olive hooded parka", "olive down hooded parka", "down hooded parka", "hooded parka", "parka"],
    // attribution: "\nDavid Ring"
    // source: https://commons.wikimedia.org/wiki/File:Anorak.jpg
  },
  outer_tan_hooded_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-tan-hooded-parka-down-studio.jpg",
    description: "tan hooded parka in a studio product shot",
    keywords: ["tan hooded parka", "tan down hooded parka", "down hooded parka", "hooded parka", "parka"],
    // attribution: "\nDavid Ring"
    // source: https://commons.wikimedia.org/wiki/File:Anorak.jpg
  },
  outer_white_hooded_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-white-hooded-parka-down-studio.jpg",
    description: "white hooded parka in a studio product shot",
    keywords: ["white hooded parka", "white down hooded parka", "down hooded parka", "hooded parka", "parka"],
    // attribution: "\nDavid Ring"
    // source: https://commons.wikimedia.org/wiki/File:Anorak.jpg
  },
  outer_black_hoodie_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-black-hoodie-cotton-studio.jpg",
    description: "Black Hoodie in a clean studio product-style asset",
    keywords: ["black hoodie", "black cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Spenser_Olson_Hoodie_Black_and_White.png
  },
  outer_brown_hoodie_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-brown-hoodie-cotton-studio.jpg",
    description: "brown hoodie in a studio product shot",
    keywords: ["brown hoodie", "brown cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    // attribution: "Kinghoodie"
    // source: https://commons.wikimedia.org/wiki/File:King_Hoodie_Live_in_Miami_At_Wynwood_Radio_3.jpg
  },
  outer_charcoal_hoodie_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-charcoal-hoodie-cotton-studio.jpg",
    description: "charcoal hoodie in a studio product shot",
    keywords: ["charcoal hoodie", "charcoal cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    // attribution: "YoussefTahoun"
    // source: https://commons.wikimedia.org/wiki/File:Hoodie_m7agar.jpg
  },
  outer_gray_hoodie_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-gray-hoodie-cotton-studio.jpg",
    description: "gray cotton hoodie in a studio product shot",
    keywords: ["gray hoodie", "gray cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    // attribution: "YoussefTahoun"
    // source: https://commons.wikimedia.org/wiki/File:Hoodie_m7agar.jpg
  },
  outer_navy_hoodie_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-navy-hoodie-cotton-studio.jpg",
    description: "navy hoodie in a studio product shot",
    keywords: ["navy hoodie", "navy cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    // attribution: "YoussefTahoun"
    // source: https://commons.wikimedia.org/wiki/File:Hoodie_m7agar.jpg
  },
  outer_olive_hoodie_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-olive-hoodie-cotton-studio.jpg",
    description: "olive hoodie in a studio product shot",
    keywords: ["olive hoodie", "olive cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    // attribution: "YoussefTahoun"
    // source: https://commons.wikimedia.org/wiki/File:Hoodie_m7agar.jpg
  },
  outer_tan_hoodie_cotton_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-tan-hoodie-cotton-studio.jpg",
    description: "tan hoodie in a studio product shot",
    keywords: ["tan hoodie", "tan cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    // attribution: "YoussefTahoun"
    // source: https://commons.wikimedia.org/wiki/File:Hoodie_m7agar.jpg
  },
  outer_beige_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-beige-parka-down-studio.jpg",
    description: "beige parka in a studio product shot",
    keywords: ["beige parka", "beige down parka", "down parka", "parka", "hooded parka"],
    // attribution: "Hectonichus"
    // source: https://commons.wikimedia.org/wiki/File:Charophyta_-_Parka_decipiens.JPG
  },
  outer_black_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-black-parka-down-studio.jpg",
    description: "black parka in a studio product shot",
    keywords: ["black parka", "black down parka", "down parka", "parka", "hooded parka"],
    // attribution: "Hectonichus"
    // source: https://commons.wikimedia.org/wiki/File:Charophyta_-_Parka_decipiens.JPG
  },
  outer_brown_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-brown-parka-down-studio.jpg",
    description: "Brown Parka in a clean studio product-style asset",
    keywords: ["brown parka", "brown down parka", "down parka", "parka", "hooded parka"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Eisenhower_Parka_Front_View_(fc7f134e-b386-4e61-a4ed-98bd2b35b66c).JPG
  },
  outer_charcoal_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-charcoal-parka-down-studio.jpg",
    description: "charcoal parka in a studio product shot",
    keywords: ["charcoal parka", "charcoal down parka", "down parka", "parka", "hooded parka"],
    // attribution: "Hectonichus"
    // source: https://commons.wikimedia.org/wiki/File:Charophyta_-_Parka_decipiens.JPG
  },
  outer_cream_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-cream-parka-down-studio.jpg",
    description: "cream parka in a studio product shot",
    keywords: ["cream parka", "cream down parka", "down parka", "parka", "hooded parka"],
    // attribution: "Hectonichus"
    // source: https://commons.wikimedia.org/wiki/File:Charophyta_-_Parka_decipiens.JPG
  },
  outer_gray_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-gray-parka-down-studio.jpg",
    description: "gray parka in a studio product shot",
    keywords: ["gray parka", "gray down parka", "down parka", "parka", "hooded parka"],
    // attribution: "Stephanie Metz"
    // source: https://commons.wikimedia.org/wiki/File:Raab_%26_Metz,_pink_Nerzpfotenparka_mit_grauem_Stoff.jpg
  },
  outer_navy_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-navy-parka-down-studio.jpg",
    description: "navy parka in a studio product shot",
    keywords: ["navy parka", "navy down parka", "down parka", "parka", "hooded parka"],
    // attribution: "Hectonichus"
    // source: https://commons.wikimedia.org/wiki/File:Charophyta_-_Parka_decipiens.JPG
  },
  outer_olive_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-olive-parka-down-studio.jpg",
    description: "olive parka in a studio product shot",
    keywords: ["olive parka", "olive down parka", "down parka", "parka", "hooded parka"],
    // attribution: "Brandon Oliver"
    // source: https://commons.wikimedia.org/wiki/File:Las_Parkas.jpg
  },
  outer_tan_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-tan-parka-down-studio.jpg",
    description: "tan parka in a studio product shot",
    keywords: ["tan parka", "tan down parka", "down parka", "parka", "hooded parka"],
    // attribution: "Nationalmuseet - National Museum of Denmark from Denmark"
    // source: https://commons.wikimedia.org/wiki/File:Mandspels_fra_inuit_i_det_%C3%B8stlige_Sibirien_-_Man%E2%80%99s_parka_from_Inuit_of_eastern_Siberia_(15331621335).jpg
  },
  outer_white_parka_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-white-parka-down-studio.jpg",
    description: "white parka in a studio product shot",
    keywords: ["white parka", "white down parka", "down parka", "parka", "hooded parka"],
    // attribution: "NPS Photo"
    // source: https://commons.wikimedia.org/wiki/File:Eisenhower_Parka_Front_View_(fc7f134e-b386-4e61-a4ed-98bd2b35b66c).JPG
  },
  outer_black_pea_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-black-pea-coat-wool-studio.jpg",
    description: "Black Pea Coat in a clean studio product-style asset",
    keywords: ["black pea coat", "black wool pea coat", "wool pea coat", "pea coat", "peacoat", "wool peacoat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Man_in_pea_coat.jpg
  },
  outer_brown_pea_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-brown-pea-coat-wool-studio.jpg",
    description: "brown pea coat in a studio product shot",
    keywords: ["brown pea coat", "brown wool pea coat", "wool pea coat", "pea coat", "peacoat", "wool peacoat"],
    // attribution: "Matt from USA"
    // source: https://commons.wikimedia.org/wiki/File:Man_in_pea_coat.jpg
  },
  outer_charcoal_pea_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-charcoal-pea-coat-wool-studio.jpg",
    description: "Charcoal Pea Coat in a clean studio product-style asset",
    keywords: ["charcoal pea coat", "charcoal wool pea coat", "wool pea coat", "pea coat", "peacoat", "wool peacoat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Man_in_pea_coat.jpg
  },
  outer_gray_pea_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-gray-pea-coat-wool-studio.jpg",
    description: "gray pea coat in a studio product shot",
    keywords: ["gray pea coat", "gray wool pea coat", "wool pea coat", "pea coat", "peacoat", "wool peacoat"],
    // attribution: "Matt from USA"
    // source: https://commons.wikimedia.org/wiki/File:Man_in_pea_coat.jpg
  },
  outer_navy_pea_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-navy-pea-coat-wool-studio.jpg",
    description: "Navy Pea Coat in a clean studio product-style asset",
    keywords: ["navy pea coat", "navy wool pea coat", "wool pea coat", "pea coat", "peacoat", "wool peacoat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Navy_man_in_pea_coat.jpg
  },
  outer_olive_pea_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-olive-pea-coat-wool-studio.jpg",
    description: "Olive Pea Coat in a clean studio product-style asset",
    keywords: ["olive pea coat", "olive wool pea coat", "wool pea coat", "pea coat", "peacoat", "wool peacoat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Man_in_pea_coat.jpg
  },
  outer_tan_pea_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-tan-pea-coat-wool-studio.jpg",
    description: "Tan Pea Coat in a clean studio product-style asset",
    keywords: ["tan pea coat", "tan wool pea coat", "wool pea coat", "pea coat", "peacoat", "wool peacoat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Man_in_pea_coat.jpg
  },
  outer_beige_puffer_jacket_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-beige-puffer-jacket-down-studio.jpg",
    description: "Beige Puffer Jacket in a clean studio product-style asset",
    keywords: ["beige puffer jacket", "beige down puffer jacket", "down puffer jacket", "puffer jacket", "puffer", "quilted jacket"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:EFTA00000087_-_Wooden_closet_holds_several_puffer_jackets_including_red_black_white_and_beige_neatly_hung_on_a_rod_against_warm-toned_wood_paneling.jpg
  },
  outer_brown_puffer_jacket_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-brown-puffer-jacket-down-studio.jpg",
    description: "Brown Puffer Jacket in a clean studio product-style asset",
    keywords: ["brown puffer jacket", "brown down puffer jacket", "down puffer jacket", "puffer jacket", "puffer", "quilted jacket"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Polo_Ralph_Lauren_down_jacket_with_Aztec_style_print.jpg
  },
  outer_navy_puffer_jacket_down_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-navy-puffer-jacket-down-studio.jpg",
    description: "Navy Puffer Jacket in a clean studio product-style asset",
    keywords: ["navy puffer jacket", "navy down puffer jacket", "down puffer jacket", "puffer jacket", "puffer", "quilted jacket"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Polo_Ralph_Lauren_down_jacket_with_Aztec_style_print.jpg
  },
  outer_beige_rain_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-beige-rain-jacket-tech-studio.jpg",
    description: "Beige Rain Jacket in a clean studio product-style asset",
    keywords: ["beige rain jacket", "beige tech rain jacket", "tech rain jacket", "rain jacket", "waterproof jacket", "weather shell"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Raincoat_(drawing).jpg
  },
  outer_brown_rain_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-brown-rain-jacket-tech-studio.jpg",
    description: "Brown Rain Jacket in a clean studio product-style asset",
    keywords: ["brown rain jacket", "brown tech rain jacket", "tech rain jacket", "rain jacket", "waterproof jacket", "weather shell"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Raincoat_(drawing).jpg
  },
  outer_charcoal_rain_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-charcoal-rain-jacket-tech-studio.jpg",
    description: "Charcoal Rain Jacket in a clean studio product-style asset",
    keywords: ["charcoal rain jacket", "charcoal tech rain jacket", "tech rain jacket", "rain jacket", "waterproof jacket", "weather shell"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Raincoat_(drawing).jpg
  },
  outer_cream_rain_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-cream-rain-jacket-tech-studio.jpg",
    description: "Cream Rain Jacket in a clean studio product-style asset",
    keywords: ["cream rain jacket", "cream tech rain jacket", "tech rain jacket", "rain jacket", "waterproof jacket", "weather shell"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Raincoat_(drawing).jpg
  },
  outer_gray_rain_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-gray-rain-jacket-tech-studio.jpg",
    description: "Gray Rain Jacket in a clean studio product-style asset",
    keywords: ["gray rain jacket", "gray tech rain jacket", "tech rain jacket", "rain jacket", "waterproof jacket", "weather shell"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Raincoat_(drawing).jpg
  },
  outer_navy_rain_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-navy-rain-jacket-tech-studio.jpg",
    description: "navy rain jacket in a studio product shot",
    keywords: ["navy rain jacket", "navy tech rain jacket", "tech rain jacket", "rain jacket", "waterproof jacket", "weather shell"],
    // attribution: "U.S. Navy photo by Mass Communication Specialist 2nd Class Christopher D. Blachly"
    // source: https://commons.wikimedia.org/wiki/File:US_Navy_070130-N-0555B-129_Safe_from_the_pouring_rain_in_a_Gore-tex_jacket,_an_aviation_boatswain%27s_mate_(equipment)_keeps_a_watchful_eye_on_the_activities_on_the_flight_deck_aboard_USS_Ronald_Reagan_(CVN_76).jpg
  },
  outer_olive_rain_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-olive-rain-jacket-tech-studio.jpg",
    description: "olive rain jacket in a studio product shot",
    keywords: ["olive rain jacket", "olive tech rain jacket", "tech rain jacket", "rain jacket", "waterproof jacket", "weather shell"],
    // attribution: "\nDavid Ring"
    // source: https://commons.wikimedia.org/wiki/File:Raincoat_(drawing).jpg
  },
  outer_tan_rain_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-tan-rain-jacket-tech-studio.jpg",
    description: "tan rain jacket in a studio product shot",
    keywords: ["tan rain jacket", "tan tech rain jacket", "tech rain jacket", "rain jacket", "waterproof jacket", "weather shell"],
    // attribution: "\nDavid Ring"
    // source: https://commons.wikimedia.org/wiki/File:Raincoat_(drawing).jpg
  },
  outer_white_rain_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-white-rain-jacket-tech-studio.jpg",
    description: "white rain jacket in a studio product shot",
    keywords: ["white rain jacket", "white tech rain jacket", "tech rain jacket", "rain jacket", "waterproof jacket", "weather shell"],
    // attribution: "\nDavid Ring"
    // source: https://commons.wikimedia.org/wiki/File:Raincoat_(drawing).jpg
  },
  outer_beige_shell_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-beige-shell-jacket-tech-studio.jpg",
    description: "beige shell jacket in a studio product shot",
    keywords: ["beige shell jacket", "beige tech shell jacket", "tech shell jacket", "shell jacket", "technical shell", "light shell"],
    // attribution: "\nnot researched"
    // source: https://commons.wikimedia.org/wiki/File:Jacket,_shell_(AM_741200-25).jpg
  },
  outer_brown_shell_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-brown-shell-jacket-tech-studio.jpg",
    description: "brown shell jacket in a studio product shot",
    keywords: ["brown shell jacket", "brown tech shell jacket", "tech shell jacket", "shell jacket", "technical shell", "light shell"],
    // attribution: "\nnot researched"
    // source: https://commons.wikimedia.org/wiki/File:Jacket,_shell_(AM_741200-25).jpg
  },
  outer_charcoal_shell_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-charcoal-shell-jacket-tech-studio.jpg",
    description: "charcoal shell jacket in a studio product shot",
    keywords: ["charcoal shell jacket", "charcoal tech shell jacket", "tech shell jacket", "shell jacket", "technical shell", "light shell"],
    // attribution: "\nnot researched"
    // source: https://commons.wikimedia.org/wiki/File:Jacket,_shell_(AM_741200-25).jpg
  },
  outer_cream_shell_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-cream-shell-jacket-tech-studio.jpg",
    description: "cream shell jacket in a studio product shot",
    keywords: ["cream shell jacket", "cream tech shell jacket", "tech shell jacket", "shell jacket", "technical shell", "light shell"],
    // attribution: "\nnot researched"
    // source: https://commons.wikimedia.org/wiki/File:Jacket,_shell_(AM_741200-23).jpg
  },
  outer_gray_shell_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-gray-shell-jacket-tech-studio.jpg",
    description: "Gray Shell Jacket in a clean studio product-style asset",
    keywords: ["gray shell jacket", "gray tech shell jacket", "tech shell jacket", "shell jacket", "technical shell", "light shell"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Hard-shell-jacket.jpg
  },
  outer_navy_shell_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-navy-shell-jacket-tech-studio.jpg",
    description: "navy shell jacket in a studio product shot",
    keywords: ["navy shell jacket", "navy tech shell jacket", "tech shell jacket", "shell jacket", "technical shell", "light shell"],
    // attribution: "\nnot researched"
    // source: https://commons.wikimedia.org/wiki/File:Jacket,_shell_(AM_741200-25).jpg
  },
  outer_olive_shell_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-olive-shell-jacket-tech-studio.jpg",
    description: "olive shell jacket in a studio product shot",
    keywords: ["olive shell jacket", "olive tech shell jacket", "tech shell jacket", "shell jacket", "technical shell", "light shell"],
    // attribution: "Gieves Limited"
    // source: https://commons.wikimedia.org/wiki/File:Flight_Jacket_Worn_by_Anne_Morrow_Lindbergh_-_DPLA_-_b1dacaee9fd5ef1cc5ddab0e6963fb75_(page_20).jpg
  },
  outer_tan_shell_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-tan-shell-jacket-tech-studio.jpg",
    description: "tan shell jacket in a studio product shot",
    keywords: ["tan shell jacket", "tan tech shell jacket", "tech shell jacket", "shell jacket", "technical shell", "light shell"],
    // attribution: "\nnot researched"
    // source: https://commons.wikimedia.org/wiki/File:Jacket,_shell_(AM_741200-25).jpg
  },
  outer_white_shell_jacket_tech_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-white-shell-jacket-tech-studio.jpg",
    description: "white shell jacket in a studio product shot",
    keywords: ["white shell jacket", "white tech shell jacket", "tech shell jacket", "shell jacket", "technical shell", "light shell"],
    // attribution: "\nnot researched"
    // source: https://commons.wikimedia.org/wiki/File:Jacket,_shell_(AM_741200-25).jpg
  },
  outer_black_trench_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-black-trench-coat-wool-studio.jpg",
    description: "Black Trench Coat in a clean studio product-style asset",
    keywords: ["black trench coat", "black wool trench coat", "wool trench coat", "trench coat", "trench"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Leather-trench-coat.jpg
  },
  outer_brown_trench_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-brown-trench-coat-wool-studio.jpg",
    description: "Brown Trench Coat in a clean studio product-style asset",
    keywords: ["brown trench coat", "brown wool trench coat", "wool trench coat", "trench coat", "trench"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:2019_Acne_Studios_coat,_jacquard_woven_toile-de-Jouy_pattern_04.jpg
  },
  outer_charcoal_trench_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-charcoal-trench-coat-wool-studio.jpg",
    description: "Charcoal Trench Coat in a clean studio product-style asset",
    keywords: ["charcoal trench coat", "charcoal wool trench coat", "wool trench coat", "trench coat", "trench"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Woman_wearing_trench_coat.jpg
  },
  outer_gray_trench_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-gray-trench-coat-wool-studio.jpg",
    description: "Gray Trench Coat in a clean studio product-style asset",
    keywords: ["gray trench coat", "gray wool trench coat", "wool trench coat", "trench coat", "trench"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Woman_wearing_trench_coat.jpg
  },
  outer_navy_trench_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-navy-trench-coat-wool-studio.jpg",
    description: "Navy Trench Coat in a clean studio product-style asset",
    keywords: ["navy trench coat", "navy wool trench coat", "wool trench coat", "trench coat", "trench"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Uniformes_de_l%27arm%C3%A9e_fran%C3%A7aise_1937_%E2%80%93_00_Jacket_cover._Minist%C3%A8re_de_la_Guerre._L%27Uniforme_Officiel,_Paris._French_army_uniforms_Uncredited_artist_No_known_copyright.jpg
  },
  outer_olive_trench_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-olive-trench-coat-wool-studio.jpg",
    description: "Olive Trench Coat in a clean studio product-style asset",
    keywords: ["olive trench coat", "olive wool trench coat", "wool trench coat", "trench coat", "trench"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Woman_wearing_trench_coat.jpg
  },
  outer_tan_trench_coat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-tan-trench-coat-wool-studio.jpg",
    description: "Tan Trench Coat in a clean studio product-style asset",
    keywords: ["tan trench coat", "tan wool trench coat", "wool trench coat", "trench coat", "trench"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Woman_wearing_trench_coat.jpg
  },
  outer_black_wool_overcoat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-black-wool-overcoat-wool-studio.jpg",
    description: "Black Wool Overcoat in a clean studio product-style asset",
    keywords: ["black wool overcoat", "black wool wool overcoat", "wool wool overcoat", "wool overcoat", "overcoat", "long coat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:New_York_City_workers_during_WWI_-_Industries_of_War_-_MANUFACTURE_OF_WOOL_SERVICE_Coats_for_U.S._Army_at_the_Milton_Simpson_%26_Co._Plant,_New_York_City._View_in_overcoat_section_of_factory_-_NARA_-_45490290_(cropped).jpg
  },
  outer_brown_wool_overcoat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-brown-wool-overcoat-wool-studio.jpg",
    description: "Brown Wool Overcoat in a clean studio product-style asset",
    keywords: ["brown wool overcoat", "brown wool wool overcoat", "wool wool overcoat", "wool overcoat", "overcoat", "long coat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Overcoat_MET_1973.65.1_B.jpg
  },
  outer_charcoal_wool_overcoat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-charcoal-wool-overcoat-wool-studio.jpg",
    description: "Charcoal Wool Overcoat in a clean studio product-style asset",
    keywords: ["charcoal wool overcoat", "charcoal wool wool overcoat", "wool wool overcoat", "wool overcoat", "overcoat", "long coat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Overcoat_MET_1973.65.1_B.jpg
  },
  outer_gray_wool_overcoat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-gray-wool-overcoat-wool-studio.jpg",
    description: "Gray Wool Overcoat in a clean studio product-style asset",
    keywords: ["gray wool overcoat", "gray wool wool overcoat", "wool wool overcoat", "wool overcoat", "overcoat", "long coat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Overcoat_MET_1973.65.1_B.jpg
  },
  outer_navy_wool_overcoat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-navy-wool-overcoat-wool-studio.jpg",
    description: "Navy Wool Overcoat in a clean studio product-style asset",
    keywords: ["navy wool overcoat", "navy wool wool overcoat", "wool wool overcoat", "wool overcoat", "overcoat", "long coat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:ONI_JAN_1_Uniforms_and_Insignia_Page_062_Italian_Army_WW2_Tropical_uniforms._Officers_and_men._Bersaglieri_tropical_dress,_breeches_or_slacks,_leggins,_wool_od_dress,_pack_shorts_blouse_overcoat_Sept_1943_US_field_recognition_No_copyrig.jpg
  },
  outer_olive_wool_overcoat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-olive-wool-overcoat-wool-studio.jpg",
    description: "Olive Wool Overcoat in a clean studio product-style asset",
    keywords: ["olive wool overcoat", "olive wool wool overcoat", "wool wool overcoat", "wool overcoat", "overcoat", "long coat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Overcoat_MET_1973.65.1_B.jpg
  },
  outer_tan_wool_overcoat_wool_v1: {
    slot: "outer",
    gender: "unisex",
    path: "assets/recommendation-stock/outer-tan-wool-overcoat-wool-studio.jpg",
    description: "Tan Wool Overcoat in a clean studio product-style asset",
    keywords: ["tan wool overcoat", "tan wool wool overcoat", "wool wool overcoat", "wool overcoat", "overcoat", "long coat"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Overcoat_MET_1973.65.1_B.jpg
  },
  shoes_black_ankle_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-ankle-boots-leather-studio.jpg",
    description: "black ankle boots in a studio product shot",
    keywords: ["black ankle boots", "black leather ankle boots", "leather ankle boots", "ankle boots"],
    // attribution: "Danÿa"
    // source: https://commons.wikimedia.org/wiki/File:Ankle_boot.jpg
  },
  shoes_brown_ankle_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-ankle-boots-leather-studio.jpg",
    description: "brown ankle boots in a studio product shot",
    keywords: ["brown ankle boots", "brown leather ankle boots", "leather ankle boots", "ankle boots"],
    // attribution: "Oxfordian Kissuth"
    // source: https://commons.wikimedia.org/wiki/File:Ankle_Boot_and_Dip_Pen.jpg
  },
  shoes_gray_ankle_boots_leather_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-gray-ankle-boots-leather-studio.jpg",
    description: "Gray Ankle Boots in a clean studio product-style asset",
    keywords: ["gray ankle boots", "gray leather ankle boots", "leather ankle boots", "ankle boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Pair_of_Woman%27s_Ankle_Boots_(Wedding)_LACMA_AC1994.213.2.1-.2.jpg
  },
  shoes_navy_ankle_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-navy-ankle-boots-leather-studio.jpg",
    description: "navy ankle boots in a studio product shot",
    keywords: ["navy ankle boots", "navy leather ankle boots", "leather ankle boots", "ankle boots"],
    // attribution: "Military Intelligence Division of the United States Department of War during World War II"
    // source: https://commons.wikimedia.org/wiki/File:ONI_JAN_1_Uniforms_and_Insignia_Page_007_German_Army_Wehrmacht_Heer_WW2_Mobile_troops._Saddle_bags,_Panzer_Grenadier_armored_infantry,_boots,_high_shoe,_etc._June_1943_Field_recognition._US_public_doc._No_known_copyright.jpg
  },
  shoes_olive_ankle_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-olive-ankle-boots-leather-studio.jpg",
    description: "olive ankle boots in a studio product shot",
    keywords: ["olive ankle boots", "olive leather ankle boots", "leather ankle boots", "ankle boots"],
    // attribution: "Military Intelligence Division of the United States Department of War during World War II"
    // source: https://commons.wikimedia.org/wiki/File:ONI_JAN_1_Uniforms_and_Insignia_Page_028_German_Air_Force_Luftwaffe_WW2_Tropical_and_summer_uniforms._Officers,_men._Pith_and_steel_helmets,_field_caps,_national_emblem,_Flak_troops,_linen_boots,_etc_Aug._1943_Field_recognition._No_copy.jpg
  },
  shoes_tan_ankle_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-tan-ankle-boots-leather-studio.jpg",
    description: "tan ankle boots in a studio product shot",
    keywords: ["tan ankle boots", "tan leather ankle boots", "leather ankle boots", "ankle boots"],
    // attribution: "Danÿa"
    // source: https://commons.wikimedia.org/wiki/File:Laced_ankle_boot.jpg
  },
  shoes_black_black_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-black-sneakers-leather-studio.jpg",
    description: "black black sneakers in a studio product shot",
    keywords: ["black black sneakers", "black leather black sneakers", "leather black sneakers", "black sneakers", "black leather sneakers"],
    // attribution: "Tara_St"
    // source: https://commons.wikimedia.org/wiki/File:Glam_sneakers,_faux_leather_leggings,_and_floral_bomber_3.jpg
  },
  shoes_brown_black_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-black-sneakers-leather-studio.jpg",
    description: "brown black sneakers in a studio product shot",
    keywords: ["brown black sneakers", "brown leather black sneakers", "leather black sneakers", "black sneakers", "black leather sneakers"],
    // attribution: "Brenleyman"
    // source: https://commons.wikimedia.org/wiki/File:PF_Flyers_Center_High_Re-Issue_sneakers_black.jpg
  },
  shoes_gray_black_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-gray-black-sneakers-leather-studio.jpg",
    description: "Gray Black Sneakers in a clean studio product-style asset",
    keywords: ["gray black sneakers", "gray leather black sneakers", "leather black sneakers", "black sneakers", "black leather sneakers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Black_avia_shoes.jpg
  },
  shoes_navy_black_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-navy-black-sneakers-leather-studio.jpg",
    description: "Navy Black Sneakers in a clean studio product-style asset",
    keywords: ["navy black sneakers", "navy leather black sneakers", "leather black sneakers", "black sneakers", "black leather sneakers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:PF_Flyers_Center_High_Re-Issue_sneakers_black.jpg
  },
  shoes_olive_black_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-olive-black-sneakers-leather-studio.jpg",
    description: "olive black sneakers in a studio product shot",
    keywords: ["olive black sneakers", "olive leather black sneakers", "leather black sneakers", "black sneakers", "black leather sneakers"],
    // attribution: "Brenleyman"
    // source: https://commons.wikimedia.org/wiki/File:PF_Flyers_Center_High_Re-Issue_sneakers_black.jpg
  },
  shoes_tan_black_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-tan-black-sneakers-leather-studio.jpg",
    description: "Tan Black Sneakers in a clean studio product-style asset",
    keywords: ["tan black sneakers", "tan leather black sneakers", "leather black sneakers", "black sneakers", "black leather sneakers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:PF_Flyers_Center_High_Re-Issue_sneakers_black.jpg
  },
  shoes_black_brown_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-brown-loafers-leather-studio.jpg",
    description: "Black Brown Loafers in a clean studio product-style asset",
    keywords: ["black brown loafers", "black leather brown loafers", "leather brown loafers", "brown loafers", "tan loafers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Brown_Loafers_From_the_%2790s.JPG
  },
  shoes_cream_brown_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-cream-brown-loafers-leather-studio.jpg",
    description: "Cream Brown Loafers in a clean studio product-style asset",
    keywords: ["cream brown loafers", "cream leather brown loafers", "leather brown loafers", "brown loafers", "tan loafers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Brown_Loafers_From_the_%2790s.JPG
  },
  shoes_gray_brown_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-gray-brown-loafers-leather-studio.jpg",
    description: "Gray Brown Loafers in a clean studio product-style asset",
    keywords: ["gray brown loafers", "gray leather brown loafers", "leather brown loafers", "brown loafers", "tan loafers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Brown_Loafers_From_the_%2790s.JPG
  },
  shoes_navy_brown_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-navy-brown-loafers-leather-studio.jpg",
    description: "Navy Brown Loafers in a clean studio product-style asset",
    keywords: ["navy brown loafers", "navy leather brown loafers", "leather brown loafers", "brown loafers", "tan loafers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Brown_Loafers_From_the_%2790s.JPG
  },
  shoes_olive_brown_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-olive-brown-loafers-leather-studio.jpg",
    description: "Olive Brown Loafers in a clean studio product-style asset",
    keywords: ["olive brown loafers", "olive leather brown loafers", "leather brown loafers", "brown loafers", "tan loafers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Brown_Loafers_From_the_%2790s.JPG
  },
  shoes_white_brown_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-white-brown-loafers-leather-studio.jpg",
    description: "White Brown Loafers in a clean studio product-style asset",
    keywords: ["white brown loafers", "white leather brown loafers", "leather brown loafers", "brown loafers", "tan loafers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Brown_Loafers_From_the_%2790s.JPG
  },
  shoes_black_chelsea_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-chelsea-boots-leather-studio.jpg",
    description: "Black Chelsea Boots in a clean studio product-style asset",
    keywords: ["black chelsea boots", "black leather chelsea boots", "leather chelsea boots", "chelsea boots", "ankle boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Person_wearing_black_Chelsea_boots_on_a_textured_pavement.jpg
  },
  shoes_brown_chelsea_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-chelsea-boots-leather-studio.jpg",
    description: "brown chelsea boots in a studio product shot",
    keywords: ["brown chelsea boots", "brown leather chelsea boots", "leather chelsea boots", "chelsea boots", "ankle boots"],
    // attribution: "Best For My Feet"
    // source: https://commons.wikimedia.org/wiki/File:Avenger_A7505_wedge_sole_work_boots.jpg
  },
  shoes_gray_chelsea_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-gray-chelsea-boots-leather-studio.jpg",
    description: "Gray Chelsea Boots in a clean studio product-style asset",
    keywords: ["gray chelsea boots", "gray leather chelsea boots", "leather chelsea boots", "chelsea boots", "ankle boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Chelsea_boot,_black.jpg
  },
  shoes_navy_chelsea_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-navy-chelsea-boots-leather-studio.jpg",
    description: "Navy Chelsea Boots in a clean studio product-style asset",
    keywords: ["navy chelsea boots", "navy leather chelsea boots", "leather chelsea boots", "chelsea boots", "ankle boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Chelsea_boot,_black.jpg
  },
  shoes_olive_chelsea_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-olive-chelsea-boots-leather-studio.jpg",
    description: "Olive Chelsea Boots in a clean studio product-style asset",
    keywords: ["olive chelsea boots", "olive leather chelsea boots", "leather chelsea boots", "chelsea boots", "ankle boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Chelsea_boot,_black.jpg
  },
  shoes_tan_chelsea_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-tan-chelsea-boots-leather-studio.jpg",
    description: "Tan Chelsea Boots in a clean studio product-style asset",
    keywords: ["tan chelsea boots", "tan leather chelsea boots", "leather chelsea boots", "chelsea boots", "ankle boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Chelsea_boot,_black.jpg
  },
  shoes_black_hiking_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-hiking-boots-leather-studio.jpg",
    description: "Black Hiking Boots in a clean studio product-style asset",
    keywords: ["black hiking boots", "black leather hiking boots", "leather hiking boots", "hiking boots", "trail boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Armani_Jeans_Hiking_Boot.jpg
  },
  shoes_brown_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-loafers-leather-studio.jpg",
    description: "Brown Loafers in a clean studio product-style asset",
    keywords: ["brown loafers", "brown leather loafers", "leather loafers", "loafers", "slip-on loafers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Brown_Loafers_From_the_%2790s.JPG
  },
  shoes_cream_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-cream-loafers-leather-studio.jpg",
    description: "Cream Loafers in a clean studio product-style asset",
    keywords: ["cream loafers", "cream leather loafers", "leather loafers", "loafers", "slip-on loafers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Loafers_(drawing).jpg
  },
  shoes_gray_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-gray-loafers-leather-studio.jpg",
    description: "gray loafers in a studio product shot",
    keywords: ["gray loafers", "gray leather loafers", "leather loafers", "loafers", "slip-on loafers"],
    // attribution: "Dieter Philippi"
    // source: https://commons.wikimedia.org/wiki/File:Rote_Loafer_Papst_Benedikt.jpg
  },
  shoes_navy_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-navy-loafers-leather-studio.jpg",
    description: "navy loafers in a studio product shot",
    keywords: ["navy loafers", "navy leather loafers", "leather loafers", "loafers", "slip-on loafers"],
    // attribution: "Ana Ljubinkovic"
    // source: https://commons.wikimedia.org/wiki/File:ABO_kiltie_loafers.jpg
  },
  shoes_olive_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-olive-loafers-leather-studio.jpg",
    description: "Olive Loafers in a clean studio product-style asset",
    keywords: ["olive loafers", "olive leather loafers", "leather loafers", "loafers", "slip-on loafers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Loafers_(drawing).jpg
  },
  shoes_tan_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-tan-loafers-leather-studio.jpg",
    description: "tan loafers in a studio product shot",
    keywords: ["tan loafers", "tan leather loafers", "leather loafers", "loafers", "slip-on loafers"],
    // attribution: "Jamie"
    // source: https://commons.wikimedia.org/wiki/File:Tan_Tassel_Loafers_(19449141738).jpg
  },
  shoes_white_loafers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-white-loafers-leather-studio.jpg",
    description: "White Loafers in a clean studio product-style asset",
    keywords: ["white loafers", "white leather loafers", "leather loafers", "loafers", "slip-on loafers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:A_Penny_Loafer.jpg
  },
  shoes_black_running_shoes_mesh_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-running-shoes-mesh-studio.jpg",
    description: "Black Running Shoes in a clean studio product-style asset",
    keywords: ["black running shoes", "black mesh running shoes", "mesh running shoes", "running shoes", "running sneakers", "athletic shoes"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:On_Clouds_running_shoes.jpg
  },
  shoes_brown_running_shoes_mesh_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-running-shoes-mesh-studio.jpg",
    description: "brown running shoes in a studio product shot",
    keywords: ["brown running shoes", "brown mesh running shoes", "mesh running shoes", "running shoes", "running sneakers", "athletic shoes"],
    // attribution: "\nBirmingham Museums Trust, Caroline Johnson, 2005-08-22 15:00:03"
    // source: https://commons.wikimedia.org/wiki/File:The_back_of_a_rectangular_shoe_buckle,_dating_to_the_17th-_18th_century_AD._(FindID_104963).jpg
  },
  shoes_gray_running_shoes_mesh_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-gray-running-shoes-mesh-studio.jpg",
    description: "Gray Running Shoes in a clean studio product-style asset",
    keywords: ["gray running shoes", "gray mesh running shoes", "mesh running shoes", "running shoes", "running sneakers", "athletic shoes"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:High_Beam_Led_Running_Shoes_01.jpg
  },
  shoes_navy_running_shoes_mesh_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-navy-running-shoes-mesh-studio.jpg",
    description: "navy running shoes in a studio product shot",
    keywords: ["navy running shoes", "navy mesh running shoes", "mesh running shoes", "running shoes", "running sneakers", "athletic shoes"],
    // attribution: "U.S. Navy photo by Mass Communication Specialist 1st Class Felix Garza Jr."
    // source: https://commons.wikimedia.org/wiki/File:US_Navy_091213-N-4142G-138_Vice_Adm._Bill_Gortney_presents_Gen._David_H._Petraeus_a_pair_of_navy_blue_and_gold_running_shoes_at_Naval_Support_Activity_Bahrain.jpg
  },
  shoes_black_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-sneakers-leather-studio.jpg",
    description: "black sneakers in a studio product shot",
    keywords: ["black sneakers", "black leather sneakers", "leather sneakers", "sneakers", "trainers", "casual shoes"],
    // attribution: "Tara_St"
    // source: https://commons.wikimedia.org/wiki/File:Glam_sneakers,_faux_leather_leggings,_and_floral_bomber_3.jpg
  },
  shoes_brown_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-sneakers-leather-studio.jpg",
    description: "Brown Sneakers in a clean studio product-style asset",
    keywords: ["brown sneakers", "brown leather sneakers", "leather sneakers", "sneakers", "trainers", "casual shoes"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Michael_Kors_Kristy_Lace_Up_Sneaker_43S4KRFS2E_Kalbsleder_braun_(1)_(16286299927).jpg
  },
  shoes_gray_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-gray-sneakers-leather-studio.jpg",
    description: "gray sneakers in a studio product shot",
    keywords: ["gray sneakers", "gray leather sneakers", "leather sneakers", "sneakers", "trainers", "casual shoes"],
    // attribution: "Downtowngal"
    // source: https://commons.wikimedia.org/wiki/File:Vans_sneakers_and_socks.jpg
  },
  shoes_navy_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-navy-sneakers-leather-studio.jpg",
    description: "navy sneakers in a studio product shot",
    keywords: ["navy sneakers", "navy leather sneakers", "leather sneakers", "sneakers", "trainers", "casual shoes"],
    // attribution: "U.S. Navy photo by Mass Communication Specialist 1st Class Felix Garza Jr."
    // source: https://commons.wikimedia.org/wiki/File:US_Navy_091213-N-4142G-138_Vice_Adm._Bill_Gortney_presents_Gen._David_H._Petraeus_a_pair_of_navy_blue_and_gold_running_shoes_at_Naval_Support_Activity_Bahrain.jpg
  },
  shoes_olive_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-olive-sneakers-leather-studio.jpg",
    description: "olive sneakers in a studio product shot",
    keywords: ["olive sneakers", "olive leather sneakers", "leather sneakers", "sneakers", "trainers", "casual shoes"],
    // attribution: "Downtowngal"
    // source: https://commons.wikimedia.org/wiki/File:Vans_sneakers_and_socks.jpg
  },
  shoes_tan_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-tan-sneakers-leather-studio.jpg",
    description: "Tan Sneakers in a clean studio product-style asset",
    keywords: ["tan sneakers", "tan leather sneakers", "leather sneakers", "sneakers", "trainers", "casual shoes"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:CBP_at_JFK_Seizes_Heroin_in_Sneakers_(24847342213).jpg
  },
  shoes_black_white_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-white-sneakers-leather-studio.jpg",
    description: "Black White Sneakers in a clean studio product-style asset",
    keywords: ["black white sneakers", "black leather white sneakers", "leather white sneakers", "white sneakers", "white leather sneakers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Oca-low-washed-black-contrast-thread-canvas-sneaker.png
  },
  shoes_brown_white_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-white-sneakers-leather-studio.jpg",
    description: "Brown White Sneakers in a clean studio product-style asset",
    keywords: ["brown white sneakers", "brown leather white sneakers", "leather white sneakers", "white sneakers", "white leather sneakers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Converse_Jack_Purcell_sneakers_on_white_canvas.jpg
  },
  shoes_gray_white_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-gray-white-sneakers-leather-studio.jpg",
    description: "Gray White Sneakers in a clean studio product-style asset",
    keywords: ["gray white sneakers", "gray leather white sneakers", "leather white sneakers", "white sneakers", "white leather sneakers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Converse_Jack_Purcell_sneakers_on_white_canvas.jpg
  },
  shoes_navy_white_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-navy-white-sneakers-leather-studio.jpg",
    description: "Navy White Sneakers in a clean studio product-style asset",
    keywords: ["navy white sneakers", "navy leather white sneakers", "leather white sneakers", "white sneakers", "white leather sneakers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Converse_Jack_Purcell_sneakers_on_white_canvas.jpg
  },
  shoes_olive_white_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-olive-white-sneakers-leather-studio.jpg",
    description: "Olive White Sneakers in a clean studio product-style asset",
    keywords: ["olive white sneakers", "olive leather white sneakers", "leather white sneakers", "white sneakers", "white leather sneakers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Converse_Jack_Purcell_sneakers_on_white_canvas.jpg
  },
  shoes_tan_white_sneakers_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-tan-white-sneakers-leather-studio.jpg",
    description: "Tan White Sneakers in a clean studio product-style asset",
    keywords: ["tan white sneakers", "tan leather white sneakers", "leather white sneakers", "white sneakers", "white leather sneakers"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Converse_Jack_Purcell_sneakers_on_white_canvas.jpg
  },
  shoes_black_winter_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-black-winter-boots-leather-studio.jpg",
    description: "Black Winter Boots in a clean studio product-style asset",
    keywords: ["black winter boots", "black leather winter boots", "leather winter boots", "winter boots", "insulated boots", "waterproof boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Boots_winter_2009.JPG
  },
  shoes_brown_winter_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-brown-winter-boots-leather-studio.jpg",
    description: "Brown Winter Boots in a clean studio product-style asset",
    keywords: ["brown winter boots", "brown leather winter boots", "leather winter boots", "winter boots", "insulated boots", "waterproof boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Apr%C3%A8s-ski_boots.jpg
  },
  shoes_gray_winter_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-gray-winter-boots-leather-studio.jpg",
    description: "Gray Winter Boots in a clean studio product-style asset",
    keywords: ["gray winter boots", "gray leather winter boots", "leather winter boots", "winter boots", "insulated boots", "waterproof boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Apr%C3%A8s-ski_boots.jpg
  },
  shoes_navy_winter_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-navy-winter-boots-leather-studio.jpg",
    description: "Navy Winter Boots in a clean studio product-style asset",
    keywords: ["navy winter boots", "navy leather winter boots", "leather winter boots", "winter boots", "insulated boots", "waterproof boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Apr%C3%A8s-ski_boots.jpg
  },
  shoes_olive_winter_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-olive-winter-boots-leather-studio.jpg",
    description: "Olive Winter Boots in a clean studio product-style asset",
    keywords: ["olive winter boots", "olive leather winter boots", "leather winter boots", "winter boots", "insulated boots", "waterproof boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Apr%C3%A8s-ski_boots.jpg
  },
  shoes_tan_winter_boots_leather_v1: {
    slot: "shoes",
    gender: "unisex",
    path: "assets/recommendation-stock/shoes-tan-winter-boots-leather-studio.jpg",
    description: "Tan Winter Boots in a clean studio product-style asset",
    keywords: ["tan winter boots", "tan leather winter boots", "leather winter boots", "winter boots", "insulated boots", "waterproof boots"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Apr%C3%A8s-ski_boots.jpg
  },
  top_black_button_up_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-black-button-up-shirt-cotton-studio.jpg",
    description: "black button up shirt in a studio product shot",
    keywords: ["black button-up shirt", "black cotton button-up shirt", "cotton button-up shirt", "button-up", "button-down", "oxford", "dress shirt", "collared shirt", "button-up shirt"],
    // attribution: "\nMagrath The Shirt Company; New Zealand Defence Force"
    // source: https://commons.wikimedia.org/wiki/File:Shirt_(AM_2002.94.3.1-2).jpg
  },
  top_brown_button_up_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-brown-button-up-shirt-cotton-studio.jpg",
    description: "brown button up shirt in a studio product shot",
    keywords: ["brown button-up shirt", "brown cotton button-up shirt", "cotton button-up shirt", "button-up", "button-down", "oxford", "dress shirt", "collared shirt", "button-up shirt"],
    // attribution: "\nUnknown authorUnknown author"
    // source: https://commons.wikimedia.org/wiki/File:Shirt,_dress_(AM_1967.118-2).jpg
  },
  top_gray_button_up_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-gray-button-up-shirt-cotton-studio.jpg",
    description: "gray button up shirt in a studio product shot",
    keywords: ["gray button-up shirt", "gray cotton button-up shirt", "cotton button-up shirt", "button-up", "button-down", "oxford", "dress shirt", "collared shirt", "button-up shirt"],
    // attribution: "Carlquist, Sherwin John, 1930-2021"
    // source: https://commons.wikimedia.org/wiki/File:(Man_in_white_shirt_in_Bangkok,_Thailand)_-_DPLA_-_0466e3a34404f93fc25258676c4843f0.jpg
  },
  top_navy_button_up_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-navy-button-up-shirt-cotton-studio.jpg",
    description: "navy button up shirt in a studio product shot",
    keywords: ["navy button-up shirt", "navy cotton button-up shirt", "cotton button-up shirt", "button-up", "button-down", "oxford", "dress shirt", "collared shirt", "button-up shirt"],
    // attribution: "\nUnknown authorUnknown author"
    // source: https://commons.wikimedia.org/wiki/File:Shirt,_dress_(AM_1967.118-2).jpg
  },
  top_olive_button_up_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-olive-button-up-shirt-cotton-studio.jpg",
    description: "olive button up shirt in a studio product shot",
    keywords: ["olive button-up shirt", "olive cotton button-up shirt", "cotton button-up shirt", "button-up", "button-down", "oxford", "dress shirt", "collared shirt", "button-up shirt"],
    // attribution: "\nUnknown authorUnknown author"
    // source: https://commons.wikimedia.org/wiki/File:Shirt,_dress_(AM_1967.118-2).jpg
  },
  top_black_hoodie_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-black-hoodie-cotton-studio.jpg",
    description: "Black Hoodie in a clean studio product-style asset",
    keywords: ["black hoodie", "black cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Spenser_Olson_Hoodie_Black_and_White.png
  },
  top_brown_hoodie_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-brown-hoodie-cotton-studio.jpg",
    description: "brown hoodie in a studio product shot",
    keywords: ["brown hoodie", "brown cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    // attribution: "Kinghoodie"
    // source: https://commons.wikimedia.org/wiki/File:King_Hoodie_Live_in_Miami_At_Wynwood_Radio_3.jpg
  },
  top_gray_hoodie_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-gray-hoodie-cotton-studio.jpg",
    description: "gray hoodie in a studio product shot",
    keywords: ["gray hoodie", "gray cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    // attribution: "YoussefTahoun"
    // source: https://commons.wikimedia.org/wiki/File:Hoodie_m7agar.jpg
  },
  top_navy_hoodie_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-navy-hoodie-cotton-studio.jpg",
    description: "navy hoodie in a studio product shot",
    keywords: ["navy hoodie", "navy cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    // attribution: "YoussefTahoun"
    // source: https://commons.wikimedia.org/wiki/File:Hoodie_m7agar.jpg
  },
  top_olive_hoodie_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-olive-hoodie-cotton-studio.jpg",
    description: "olive hoodie in a studio product shot",
    keywords: ["olive hoodie", "olive cotton hoodie", "cotton hoodie", "hoodie", "pullover hoodie", "casual hoodie"],
    // attribution: "YoussefTahoun"
    // source: https://commons.wikimedia.org/wiki/File:Hoodie_m7agar.jpg
  },
  top_black_linen_shirt_linen_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-black-linen-shirt-linen-studio.jpg",
    description: "black shirt in a studio product shot",
    keywords: ["black linen shirt", "black linen linen shirt", "linen linen shirt", "linen shirt", "camp shirt", "summer shirt", "short-sleeve linen shirt"],
    // attribution: ""
    // source: https://commons.wikimedia.org/wiki/File:White_linen_shirt_-_DPLA_-_002d7b0f3bd5a526048f91834b4e1b32_(page_2).jpg
  },
  top_brown_linen_shirt_linen_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-brown-linen-shirt-linen-studio.jpg",
    description: "brown shirt in a studio product shot",
    keywords: ["brown linen shirt", "brown linen linen shirt", "linen linen shirt", "linen shirt", "camp shirt", "summer shirt", "short-sleeve linen shirt"],
    // attribution: ""
    // source: https://commons.wikimedia.org/wiki/File:Wedding_shirt_MET_55.207.8_CP2.jpg
  },
  top_gray_linen_shirt_linen_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-gray-linen-shirt-linen-studio.jpg",
    description: "gray shirt in a studio product shot",
    keywords: ["gray linen shirt", "gray linen linen shirt", "linen linen shirt", "linen shirt", "camp shirt", "summer shirt", "short-sleeve linen shirt"],
    // attribution: "Military Intelligence Division of the United States Department of War during World War II"
    // source: https://commons.wikimedia.org/wiki/File:ONI_JAN_1_Uniforms_and_Insignia_Page_029_German_Air_Force_Luftwaffe_WW2_Tropical_and_summer_uniforms._Shorts,_khaki,_fatigues,_cloth_colors,_summer_whites,_service_caps,_shirt_sleeves,_etc_Aug._1943_Field_recognition._No_copyright.jpg
  },
  top_navy_linen_shirt_linen_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-navy-linen-shirt-linen-studio.jpg",
    description: "navy shirt in a studio product shot",
    keywords: ["navy linen shirt", "navy linen linen shirt", "linen linen shirt", "linen shirt", "camp shirt", "summer shirt", "short-sleeve linen shirt"],
    // attribution: "Military Intelligence Division of the United States Department of War during World War II"
    // source: https://commons.wikimedia.org/wiki/File:ONI_JAN_1_Uniforms_and_Insignia_Page_029_German_Air_Force_Luftwaffe_WW2_Tropical_and_summer_uniforms._Shorts,_khaki,_fatigues,_cloth_colors,_summer_whites,_service_caps,_shirt_sleeves,_etc_Aug._1943_Field_recognition._No_copyright.jpg
  },
  top_olive_linen_shirt_linen_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-olive-linen-shirt-linen-studio.jpg",
    description: "olive shirt in a studio product shot",
    keywords: ["olive linen shirt", "olive linen linen shirt", "linen linen shirt", "linen shirt", "camp shirt", "summer shirt", "short-sleeve linen shirt"],
    // attribution: ""
    // source: https://commons.wikimedia.org/wiki/File:White_linen_shirt_-_DPLA_-_002d7b0f3bd5a526048f91834b4e1b32_(page_2).jpg
  },
  top_black_long_sleeve_t_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-black-long-sleeve-t-shirt-cotton-studio.jpg",
    description: "black long sleeve T-shirt in a studio product shot",
    keywords: ["black long-sleeve t-shirt", "black cotton long-sleeve t-shirt", "cotton long-sleeve t-shirt", "long-sleeve t-shirt", "long sleeve tee", "long sleeve top"],
    // attribution: "Antoine K from Moscow, Russia"
    // source: https://commons.wikimedia.org/wiki/File:Pregnant_woman_in_striped_shirt.jpg
  },
  top_brown_long_sleeve_t_shirt_cotton_v1: {
    slot: "top",
    gender: "masculine",
    path: "assets/recommendation-stock/top-brown-long-sleeve-t-shirt-cotton-studio.jpg",
    description: "Brown Long-Sleeve T-Shirt in a clean studio product-style asset",
    keywords: ["brown long-sleeve t-shirt", "brown cotton long-sleeve t-shirt", "cotton long-sleeve t-shirt", "long-sleeve t-shirt", "long sleeve tee", "long sleeve top"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Men%27s_long-sleeve_T-shirt.jpg
  },
  top_gray_long_sleeve_t_shirt_cotton_v1: {
    slot: "top",
    gender: "masculine",
    path: "assets/recommendation-stock/top-gray-long-sleeve-t-shirt-cotton-studio.jpg",
    description: "Gray Long-Sleeve T-Shirt in a clean studio product-style asset",
    keywords: ["gray long-sleeve t-shirt", "gray cotton long-sleeve t-shirt", "cotton long-sleeve t-shirt", "long-sleeve t-shirt", "long sleeve tee", "long sleeve top"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Men%27s_long-sleeve_T-shirt.jpg
  },
  top_navy_long_sleeve_t_shirt_cotton_v1: {
    slot: "top",
    gender: "masculine",
    path: "assets/recommendation-stock/top-navy-long-sleeve-t-shirt-cotton-studio.jpg",
    description: "Navy Long-Sleeve T-Shirt in a clean studio product-style asset",
    keywords: ["navy long-sleeve t-shirt", "navy cotton long-sleeve t-shirt", "cotton long-sleeve t-shirt", "long-sleeve t-shirt", "long sleeve tee", "long sleeve top"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Men%27s_long-sleeve_T-shirt.jpg
  },
  top_olive_long_sleeve_t_shirt_cotton_v1: {
    slot: "top",
    gender: "masculine",
    path: "assets/recommendation-stock/top-olive-long-sleeve-t-shirt-cotton-studio.jpg",
    description: "Olive Long-Sleeve T-Shirt in a clean studio product-style asset",
    keywords: ["olive long-sleeve t-shirt", "olive cotton long-sleeve t-shirt", "cotton long-sleeve t-shirt", "long-sleeve t-shirt", "long sleeve tee", "long sleeve top"],
    source: "generated",
    license: "Project-generated asset",
    // attribution: "WearCast generated studio asset"
    // source: https://commons.wikimedia.org/wiki/File:Men%27s_long-sleeve_T-shirt.jpg
  },
  top_black_polo_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-black-polo-shirt-cotton-studio.jpg",
    description: "black polo shirt in a studio product shot",
    keywords: ["black polo shirt", "black cotton polo shirt", "cotton polo shirt", "polo", "polo shirt", "collared polo"],
    // attribution: ""
    // source: https://commons.wikimedia.org/wiki/File:Shirt_(AM_2017.66.34-18).jpg
  },
  top_brown_polo_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-brown-polo-shirt-cotton-studio.jpg",
    description: "brown polo shirt in a studio product shot",
    keywords: ["brown polo shirt", "brown cotton polo shirt", "cotton polo shirt", "polo", "polo shirt", "collared polo"],
    // attribution: "Wikimedia Foundation"
    // source: https://commons.wikimedia.org/wiki/File:WP_polo_shirt_FRONT_Merchandise_shots-24_cropped.jpg
  },
  top_gray_polo_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-gray-polo-shirt-cotton-studio.jpg",
    description: "gray polo shirt in a studio product shot",
    keywords: ["gray polo shirt", "gray cotton polo shirt", "cotton polo shirt", "polo", "polo shirt", "collared polo"],
    // attribution: "Wikimedia Foundation"
    // source: https://commons.wikimedia.org/wiki/File:WP_polo_shirt_FRONT_Merchandise_shots-24_cropped.jpg
  },
  top_navy_polo_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-navy-polo-shirt-cotton-studio.jpg",
    description: "navy polo shirt in a studio product shot",
    keywords: ["navy polo shirt", "navy cotton polo shirt", "cotton polo shirt", "polo", "polo shirt", "collared polo"],
    // attribution: "Jonathan Schilling"
    // source: https://commons.wikimedia.org/wiki/File:Caldera_Systems_polo_shirt_and_T_shirt.jpg
  },
  top_olive_polo_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-olive-polo-shirt-cotton-studio.jpg",
    description: "olive polo shirt in a studio product shot",
    keywords: ["olive polo shirt", "olive cotton polo shirt", "cotton polo shirt", "polo", "polo shirt", "collared polo"],
    // attribution: "Wikimedia Foundation"
    // source: https://commons.wikimedia.org/wiki/File:WP_polo_shirt_FRONT_Merchandise_shots-24_cropped.jpg
  },
  top_black_t_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-black-t-shirt-cotton-studio.jpg",
    description: "black T-shirt in a studio product shot",
    keywords: ["black t-shirt", "black cotton t-shirt", "cotton t-shirt", "t-shirt", "tee", "tshirt", "crew neck", "short sleeve"],
    // attribution: "Roberto Fortuna"
    // source: https://commons.wikimedia.org/wiki/File:Inuit_t-shirt_from_Greenland.png
  },
  top_brown_t_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-brown-t-shirt-cotton-studio.jpg",
    description: "brown T-shirt in a studio product shot",
    keywords: ["brown t-shirt", "brown cotton t-shirt", "cotton t-shirt", "t-shirt", "tee", "tshirt", "crew neck", "short sleeve"],
    // attribution: "Alex Neman"
    // source: https://commons.wikimedia.org/wiki/File:Young_man_with_short_brown_hair_in_pink_T-shirt_from_behind.jpg
  },
  top_gray_t_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-gray-t-shirt-cotton-studio.jpg",
    description: "gray T-shirt in a studio product shot",
    keywords: ["gray t-shirt", "gray cotton t-shirt", "cotton t-shirt", "t-shirt", "tee", "tshirt", "crew neck", "short sleeve"],
    // attribution: "Artaxerxes"
    // source: https://commons.wikimedia.org/wiki/File:S.W.A.T._T-Shirt_Lyndonville_VT_July_2018.jpg
  },
  top_navy_t_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-navy-t-shirt-cotton-studio.jpg",
    description: "navy T-shirt in a studio product shot",
    keywords: ["navy t-shirt", "navy cotton t-shirt", "cotton t-shirt", "t-shirt", "tee", "tshirt", "crew neck", "short sleeve"],
    // attribution: "U.S. Navy photo by Lt. Karin R. Burzynski"
    // source: https://commons.wikimedia.org/wiki/File:US_Navy_070319-N-4034B-015_Chief_of_Navy_Reserve,_Vice_Adm._John_G._Cotton_addresses_Navy_Customs_Battalion_Sierra_wearing_a_Navy_customs_t-shirt.jpg
  },
  top_olive_t_shirt_cotton_v1: {
    slot: "top",
    gender: "unisex",
    path: "assets/recommendation-stock/top-olive-t-shirt-cotton-studio.jpg",
    description: "olive T-shirt in a studio product shot",
    keywords: ["olive t-shirt", "olive cotton t-shirt", "cotton t-shirt", "t-shirt", "tee", "tshirt", "crew neck", "short sleeve"],
    // attribution: "Oliver C. Mallorca skapheandros  talk to me"
    // source: https://commons.wikimedia.org/wiki/File:T-shirt-lamp.jpg
  },
  top_white_blouse_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-blouse-silk-studio-fem.jpg",
    description: "White silk blouse in a clean studio product-style asset",
    keywords: ["white blouse","silk blouse","white silk blouse","blouse","top","shirt","collared shirt","button-up blouse"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_blouse_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-blouse-silk-studio-fem.jpg",
    description: "Black silk blouse in a clean studio product-style asset",
    keywords: ["black blouse","silk blouse","black silk blouse","blouse","top","shirt","collared shirt","button-up blouse"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_cream_blouse_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-cream-blouse-silk-studio-fem.jpg",
    description: "Cream silk blouse in a clean studio product-style asset",
    keywords: ["cream blouse","silk blouse","cream silk blouse","blouse","top","shirt","collared shirt","button-up blouse"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_navy_blouse_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-navy-blouse-silk-studio-fem.jpg",
    description: "Navy silk blouse in a clean studio product-style asset",
    keywords: ["navy blouse","silk blouse","navy silk blouse","blouse","top","shirt","collared shirt","button-up blouse"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_silk_blouse_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-silk-blouse-silk-fem-studio.jpg",
    description: "White Silk Blouse in a clean studio product-style asset",
    keywords: ["white silk blouse","silk silk blouse","white silk silk blouse","silk blouse","blouse","silk top","top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_silk_blouse_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-silk-blouse-silk-fem-studio.jpg",
    description: "Black Silk Blouse in a clean studio product-style asset",
    keywords: ["black silk blouse","silk silk blouse","black silk silk blouse","silk blouse","blouse","silk top","top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_cream_silk_blouse_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-cream-silk-blouse-silk-fem-studio.jpg",
    description: "Cream Silk Blouse in a clean studio product-style asset",
    keywords: ["cream silk blouse","silk silk blouse","cream silk silk blouse","silk blouse","blouse","silk top","top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_cream_camisole_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-cream-camisole-silk-studio-fem.jpg",
    description: "Cream silk camisole in a clean studio product-style asset",
    keywords: ["cream camisole","silk camisole","cream silk camisole","camisole","cami","tank","sleeveless top","top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_halter_top_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-halter-top-silk-studio-fem.jpg",
    description: "Black silk halter top in a clean studio product-style asset",
    keywords: ["black halter top","silk halter top","black silk halter top","halter top","halter","top","tank top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_halter_top_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-halter-top-silk-studio-fem.jpg",
    description: "White silk halter top in a clean studio product-style asset",
    keywords: ["white halter top","silk halter top","white silk halter top","halter top","halter","top","tank top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_red_halter_top_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-red-halter-top-silk-fem-studio.jpg",
    description: "Red Halter Top in a clean studio product-style asset",
    keywords: ["red halter top","silk halter top","red silk halter top","halter top","halter","top","tank top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_off_shoulder_top_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-off-shoulder-top-cotton-studio-fem.jpg",
    description: "White off-shoulder top in a clean studio product-style asset",
    keywords: ["white off-shoulder top","cotton off-shoulder top","white cotton off-shoulder top","off-shoulder top","off shoulder top","top","off-shoulder blouse"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_off_shoulder_top_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-off-shoulder-top-cotton-studio-fem.jpg",
    description: "Black off-shoulder top in a clean studio product-style asset",
    keywords: ["black off-shoulder top","cotton off-shoulder top","black cotton off-shoulder top","off-shoulder top","off shoulder top","top","off-shoulder blouse"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_cream_off_shoulder_top_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-cream-off-shoulder-top-cotton-fem-studio.jpg",
    description: "Cream Off-Shoulder Top in a clean studio product-style asset",
    keywords: ["cream off-shoulder top","cotton off-shoulder top","cream cotton off-shoulder top","off-shoulder top","off shoulder top","top","off-shoulder blouse"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_crop_top_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-crop-top-cotton-studio-fem.jpg",
    description: "White crop top in a clean studio product-style asset",
    keywords: ["white crop top","cotton crop top","white cotton crop top","crop top","cropped top","top","tee"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_crop_top_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-crop-top-cotton-studio-fem.jpg",
    description: "Black crop top in a clean studio product-style asset",
    keywords: ["black crop top","cotton crop top","black cotton crop top","crop top","cropped top","top","tee"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_beige_crop_top_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-beige-crop-top-cotton-fem-studio.jpg",
    description: "Beige Crop Top in a clean studio product-style asset",
    keywords: ["beige crop top","cotton crop top","beige cotton crop top","crop top","cropped top","top","tee"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_bodysuit_jersey_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-bodysuit-jersey-studio-fem.jpg",
    description: "White jersey bodysuit in a clean studio product-style asset",
    keywords: ["white bodysuit","jersey bodysuit","white jersey bodysuit","bodysuit","bodysuit top","top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_tunic_linen_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-tunic-linen-studio-fem.jpg",
    description: "Black linen tunic in a clean studio product-style asset",
    keywords: ["black tunic","linen tunic","black linen tunic","tunic","long top","tunic top","top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_cream_tunic_linen_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-cream-tunic-linen-studio-fem.jpg",
    description: "Cream linen tunic in a clean studio product-style asset",
    keywords: ["cream tunic","linen tunic","cream linen tunic","tunic","long top","tunic top","top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_cream_knit_cardigan_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-cream-knit-cardigan-wool-studio-fem.jpg",
    description: "Cream knit cardigan in a clean studio product-style asset",
    keywords: ["cream knit cardigan","wool knit cardigan","cream wool knit cardigan","knit cardigan","cardigan","knit top","sweater"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_knit_cardigan_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-knit-cardigan-wool-studio-fem.jpg",
    description: "Black knit cardigan in a clean studio product-style asset",
    keywords: ["black knit cardigan","wool knit cardigan","black wool knit cardigan","knit cardigan","cardigan","knit top","sweater"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_navy_knit_cardigan_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-navy-knit-cardigan-wool-studio-fem.jpg",
    description: "Navy knit cardigan in a clean studio product-style asset",
    keywords: ["navy knit cardigan","wool knit cardigan","navy wool knit cardigan","knit cardigan","cardigan","knit top","sweater"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_beige_knit_cardigan_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-beige-knit-cardigan-wool-fem-studio.jpg",
    description: "Beige Knit Cardigan in a clean studio product-style asset",
    keywords: ["beige knit cardigan","wool knit cardigan","beige wool knit cardigan","knit cardigan","cardigan","knit top","sweater"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_cream_long_cardigan_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-cream-long-cardigan-wool-fem-studio.jpg",
    description: "Cream Long Cardigan in a clean studio product-style asset",
    keywords: ["cream long cardigan","wool long cardigan","cream wool long cardigan","long cardigan","duster cardigan","cardigan","long sweater"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_long_cardigan_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-long-cardigan-wool-fem-studio.jpg",
    description: "Black Long Cardigan in a clean studio product-style asset",
    keywords: ["black long cardigan","wool long cardigan","black wool long cardigan","long cardigan","duster cardigan","cardigan","long sweater"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_beige_long_cardigan_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-beige-long-cardigan-wool-fem-studio.jpg",
    description: "Beige Long Cardigan in a clean studio product-style asset",
    keywords: ["beige long cardigan","wool long cardigan","beige wool long cardigan","long cardigan","duster cardigan","cardigan","long sweater"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_ruffled_blouse_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-ruffled-blouse-silk-studio-fem.jpg",
    description: "White ruffled blouse in a clean studio product-style asset",
    keywords: ["white ruffled blouse","silk ruffled blouse","white silk ruffled blouse","ruffled blouse","ruffle blouse","ruffled top","top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_ruffled_blouse_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-ruffled-blouse-silk-studio-fem.jpg",
    description: "Black ruffled blouse in a clean studio product-style asset",
    keywords: ["black ruffled blouse","silk ruffled blouse","black silk ruffled blouse","ruffled blouse","ruffle blouse","ruffled top","top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_navy_ruffled_blouse_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-navy-ruffled-blouse-silk-studio-fem.jpg",
    description: "Navy ruffled blouse in a clean studio product-style asset",
    keywords: ["navy ruffled blouse","silk ruffled blouse","navy silk ruffled blouse","ruffled blouse","ruffle blouse","ruffled top","top"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_wrap_dress_jersey_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-wrap-dress-jersey-studio-fem.jpg",
    description: "Black wrap dress in a clean studio product-style asset",
    keywords: ["black wrap dress","jersey wrap dress","black jersey wrap dress","wrap dress","dress","midi dress","jersey dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_navy_wrap_dress_jersey_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-navy-wrap-dress-jersey-studio-fem.jpg",
    description: "Navy wrap dress in a clean studio product-style asset",
    keywords: ["navy wrap dress","jersey wrap dress","navy jersey wrap dress","wrap dress","dress","midi dress","jersey dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_red_wrap_dress_jersey_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-red-wrap-dress-jersey-fem-studio.jpg",
    description: "Red Wrap Dress in a clean studio product-style asset",
    keywords: ["red wrap dress","jersey wrap dress","red jersey wrap dress","wrap dress","dress","midi dress","jersey dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_green_wrap_dress_jersey_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-green-wrap-dress-jersey-fem-studio.jpg",
    description: "Green Wrap Dress in a clean studio product-style asset",
    keywords: ["green wrap dress","jersey wrap dress","green jersey wrap dress","wrap dress","dress","midi dress","jersey dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_slip_dress_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-slip-dress-silk-studio-fem.jpg",
    description: "Black slip dress in a clean studio product-style asset",
    keywords: ["black slip dress","silk slip dress","black silk slip dress","slip dress","dress","slip","silk dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_cream_slip_dress_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-cream-slip-dress-silk-studio-fem.jpg",
    description: "Cream slip dress in a clean studio product-style asset",
    keywords: ["cream slip dress","silk slip dress","cream silk slip dress","slip dress","dress","slip","silk dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_navy_slip_dress_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-navy-slip-dress-silk-studio-fem.jpg",
    description: "Navy slip dress in a clean studio product-style asset",
    keywords: ["navy slip dress","silk slip dress","navy silk slip dress","slip dress","dress","slip","silk dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_sundress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-sundress-cotton-studio-fem.jpg",
    description: "White sundress in a clean studio product-style asset",
    keywords: ["white sundress","cotton sundress","white cotton sundress","sundress","dress","summer dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_blue_sundress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-blue-sundress-cotton-studio-fem.jpg",
    description: "Blue sundress in a clean studio product-style asset",
    keywords: ["blue sundress","cotton sundress","blue cotton sundress","sundress","dress","summer dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_yellow_sundress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-yellow-sundress-cotton-fem-studio.jpg",
    description: "Yellow Sundress in a clean studio product-style asset",
    keywords: ["yellow sundress","cotton sundress","yellow cotton sundress","sundress","dress","summer dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_floral_sundress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-floral-sundress-cotton-studio-fem.jpg",
    description: "Floral floral sundress in a clean studio product-style asset",
    keywords: ["floral sundress","cotton sundress","floral cotton sundress","sundress","dress","summer dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_maxi_dress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-maxi-dress-cotton-studio-fem.jpg",
    description: "Black maxi dress in a clean studio product-style asset",
    keywords: ["black maxi dress","cotton maxi dress","black cotton maxi dress","maxi dress","dress","maxi","long dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_maxi_dress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-maxi-dress-cotton-studio-fem.jpg",
    description: "White maxi dress in a clean studio product-style asset",
    keywords: ["white maxi dress","cotton maxi dress","white cotton maxi dress","maxi dress","dress","maxi","long dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_cream_maxi_dress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-cream-maxi-dress-cotton-fem-studio.jpg",
    description: "Cream Maxi Dress in a clean studio product-style asset",
    keywords: ["cream maxi dress","cotton maxi dress","cream cotton maxi dress","maxi dress","dress","maxi","long dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_mini_dress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-mini-dress-cotton-studio-fem.jpg",
    description: "Black mini dress in a clean studio product-style asset",
    keywords: ["black mini dress","cotton mini dress","black cotton mini dress","mini dress","dress","mini","short dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_red_mini_dress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-red-mini-dress-cotton-fem-studio.jpg",
    description: "Red Mini Dress in a clean studio product-style asset",
    keywords: ["red mini dress","cotton mini dress","red cotton mini dress","mini dress","dress","mini","short dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_mini_dress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-mini-dress-cotton-fem-studio.jpg",
    description: "White Mini Dress in a clean studio product-style asset",
    keywords: ["white mini dress","cotton mini dress","white cotton mini dress","mini dress","dress","mini","short dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_sheath_dress_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-sheath-dress-wool-studio-fem.jpg",
    description: "Black sheath dress in a clean studio product-style asset",
    keywords: ["black sheath dress","wool sheath dress","black wool sheath dress","sheath dress","dress","tailored dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_navy_sheath_dress_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-navy-sheath-dress-wool-studio-fem.jpg",
    description: "Navy sheath dress in a clean studio product-style asset",
    keywords: ["navy sheath dress","wool sheath dress","navy wool sheath dress","sheath dress","dress","tailored dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_red_sheath_dress_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-red-sheath-dress-wool-fem-studio.jpg",
    description: "Red Sheath Dress in a clean studio product-style asset",
    keywords: ["red sheath dress","wool sheath dress","red wool sheath dress","sheath dress","dress","tailored dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_shirtdress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-shirtdress-cotton-studio-fem.jpg",
    description: "White shirtdress in a clean studio product-style asset",
    keywords: ["white shirtdress","cotton shirtdress","white cotton shirtdress","shirtdress","dress","shirt dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_blue_shirtdress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-blue-shirtdress-cotton-studio-fem.jpg",
    description: "Blue shirtdress in a clean studio product-style asset",
    keywords: ["blue shirtdress","cotton shirtdress","blue cotton shirtdress","shirtdress","dress","shirt dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_khaki_shirtdress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-khaki-shirtdress-cotton-fem-studio.jpg",
    description: "Khaki Shirtdress in a clean studio product-style asset",
    keywords: ["khaki shirtdress","cotton shirtdress","khaki cotton shirtdress","shirtdress","dress","shirt dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_cocktail_dress_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-cocktail-dress-silk-fem-studio.jpg",
    description: "Black Cocktail Dress in a clean studio product-style asset",
    keywords: ["black cocktail dress","silk cocktail dress","black silk cocktail dress","cocktail dress","dress","party dress","evening dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_navy_cocktail_dress_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-navy-cocktail-dress-silk-fem-studio.jpg",
    description: "Navy Cocktail Dress in a clean studio product-style asset",
    keywords: ["navy cocktail dress","silk cocktail dress","navy silk cocktail dress","cocktail dress","dress","party dress","evening dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_red_cocktail_dress_silk_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-red-cocktail-dress-silk-fem-studio.jpg",
    description: "Red Cocktail Dress in a clean studio product-style asset",
    keywords: ["red cocktail dress","silk cocktail dress","red silk cocktail dress","cocktail dress","dress","party dress","evening dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_sweater_dress_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-sweater-dress-wool-studio-fem.jpg",
    description: "Black sweater dress in a clean studio product-style asset",
    keywords: ["black sweater dress","wool sweater dress","black wool sweater dress","sweater dress","dress","knit dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_cream_sweater_dress_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-cream-sweater-dress-wool-fem-studio.jpg",
    description: "Cream Sweater Dress in a clean studio product-style asset",
    keywords: ["cream sweater dress","wool sweater dress","cream wool sweater dress","sweater dress","dress","knit dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_camel_sweater_dress_wool_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-camel-sweater-dress-wool-fem-studio.jpg",
    description: "Camel Sweater Dress in a clean studio product-style asset",
    keywords: ["camel sweater dress","wool sweater dress","camel wool sweater dress","sweater dress","dress","knit dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_t_shirt_dress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-t-shirt-dress-cotton-fem-studio.jpg",
    description: "White T-Shirt Dress in a clean studio product-style asset",
    keywords: ["white t-shirt dress","cotton t-shirt dress","white cotton t-shirt dress","t-shirt dress","dress","tee dress","casual dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_t_shirt_dress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-t-shirt-dress-cotton-studio-fem.jpg",
    description: "Black t-shirt dress in a clean studio product-style asset",
    keywords: ["black t-shirt dress","cotton t-shirt dress","black cotton t-shirt dress","t-shirt dress","dress","tee dress","casual dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_gray_t_shirt_dress_cotton_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-gray-t-shirt-dress-cotton-fem-studio.jpg",
    description: "Gray T-Shirt Dress in a clean studio product-style asset",
    keywords: ["gray t-shirt dress","cotton t-shirt dress","gray cotton t-shirt dress","t-shirt dress","dress","tee dress","casual dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_black_bodycon_dress_jersey_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-black-bodycon-dress-jersey-studio-fem.jpg",
    description: "Black bodycon dress in a clean studio product-style asset",
    keywords: ["black bodycon dress","jersey bodycon dress","black jersey bodycon dress","bodycon dress","dress","fitted dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_red_bodycon_dress_jersey_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-red-bodycon-dress-jersey-fem-studio.jpg",
    description: "Red Bodycon Dress in a clean studio product-style asset",
    keywords: ["red bodycon dress","jersey bodycon dress","red jersey bodycon dress","bodycon dress","dress","fitted dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  top_white_bodycon_dress_jersey_fem_v1: {
    slot: "top",
    gender: "feminine",
    path: "assets/recommendation-stock/top-white-bodycon-dress-jersey-fem-studio.jpg",
    description: "White Bodycon Dress in a clean studio product-style asset",
    keywords: ["white bodycon dress","jersey bodycon dress","white jersey bodycon dress","bodycon dress","dress","fitted dress"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_a_line_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-a-line-skirt-cotton-studio-fem.jpg",
    description: "Black a-line skirt in a clean studio product-style asset",
    keywords: ["black a-line skirt","cotton a-line skirt","black cotton a-line skirt","a-line skirt","skirt","a line skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_navy_a_line_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-navy-a-line-skirt-cotton-studio-fem.jpg",
    description: "Navy a-line skirt in a clean studio product-style asset",
    keywords: ["navy a-line skirt","cotton a-line skirt","navy cotton a-line skirt","a-line skirt","skirt","a line skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_beige_a_line_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-beige-a-line-skirt-cotton-studio-fem.jpg",
    description: "Beige a-line skirt in a clean studio product-style asset",
    keywords: ["beige a-line skirt","cotton a-line skirt","beige cotton a-line skirt","a-line skirt","skirt","a line skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_pencil_skirt_wool_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-pencil-skirt-wool-studio-fem.jpg",
    description: "Black pencil skirt in a clean studio product-style asset",
    keywords: ["black pencil skirt","wool pencil skirt","black wool pencil skirt","pencil skirt","skirt","tailored skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_navy_pencil_skirt_wool_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-navy-pencil-skirt-wool-studio-fem.jpg",
    description: "Navy pencil skirt in a clean studio product-style asset",
    keywords: ["navy pencil skirt","wool pencil skirt","navy wool pencil skirt","pencil skirt","skirt","tailored skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_beige_pencil_skirt_wool_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-beige-pencil-skirt-wool-studio-fem.jpg",
    description: "Beige pencil skirt in a clean studio product-style asset",
    keywords: ["beige pencil skirt","wool pencil skirt","beige wool pencil skirt","pencil skirt","skirt","tailored skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_midi_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-midi-skirt-cotton-studio-fem.jpg",
    description: "Black midi skirt in a clean studio product-style asset",
    keywords: ["black midi skirt","cotton midi skirt","black cotton midi skirt","midi skirt","skirt","midi"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_white_midi_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-white-midi-skirt-cotton-studio-fem.jpg",
    description: "White midi skirt in a clean studio product-style asset",
    keywords: ["white midi skirt","cotton midi skirt","white cotton midi skirt","midi skirt","skirt","midi"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_beige_midi_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-beige-midi-skirt-cotton-studio-fem.jpg",
    description: "Beige midi skirt in a clean studio product-style asset",
    keywords: ["beige midi skirt","cotton midi skirt","beige cotton midi skirt","midi skirt","skirt","midi"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_blue_mini_skirt_denim_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-blue-mini-skirt-denim-studio-fem.jpg",
    description: "Blue denim mini skirt in a clean studio product-style asset",
    keywords: ["blue mini skirt","denim mini skirt","blue denim mini skirt","mini skirt","skirt","short skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_mini_skirt_denim_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-mini-skirt-denim-studio-fem.jpg",
    description: "Black denim mini skirt in a clean studio product-style asset",
    keywords: ["black mini skirt","denim mini skirt","black denim mini skirt","mini skirt","skirt","short skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_white_mini_skirt_denim_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-white-mini-skirt-denim-fem-studio.jpg",
    description: "White Mini Skirt in a clean studio product-style asset",
    keywords: ["white mini skirt","denim mini skirt","white denim mini skirt","mini skirt","skirt","short skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_maxi_skirt_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-maxi-skirt-linen-studio-fem.jpg",
    description: "Black maxi skirt in a clean studio product-style asset",
    keywords: ["black maxi skirt","linen maxi skirt","black linen maxi skirt","maxi skirt","skirt","long skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_cream_maxi_skirt_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-cream-maxi-skirt-linen-fem-studio.jpg",
    description: "Cream Maxi Skirt in a clean studio product-style asset",
    keywords: ["cream maxi skirt","linen maxi skirt","cream linen maxi skirt","maxi skirt","skirt","long skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_beige_maxi_skirt_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-beige-maxi-skirt-linen-studio-fem.jpg",
    description: "Beige maxi skirt in a clean studio product-style asset",
    keywords: ["beige maxi skirt","linen maxi skirt","beige linen maxi skirt","maxi skirt","skirt","long skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_pleated_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-pleated-skirt-cotton-studio-fem.jpg",
    description: "Black pleated skirt in a clean studio product-style asset",
    keywords: ["black pleated skirt","cotton pleated skirt","black cotton pleated skirt","pleated skirt","skirt","pleat skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_navy_pleated_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-navy-pleated-skirt-cotton-studio-fem.jpg",
    description: "Navy pleated skirt in a clean studio product-style asset",
    keywords: ["navy pleated skirt","cotton pleated skirt","navy cotton pleated skirt","pleated skirt","skirt","pleat skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_cream_pleated_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-cream-pleated-skirt-cotton-studio-fem.jpg",
    description: "Cream pleated skirt in a clean studio product-style asset",
    keywords: ["cream pleated skirt","cotton pleated skirt","cream cotton pleated skirt","pleated skirt","skirt","pleat skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_wrap_skirt_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-wrap-skirt-linen-fem-studio.jpg",
    description: "Black Wrap Skirt in a clean studio product-style asset",
    keywords: ["black wrap skirt","linen wrap skirt","black linen wrap skirt","wrap skirt","skirt","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_cream_wrap_skirt_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-cream-wrap-skirt-linen-fem-studio.jpg",
    description: "Cream Wrap Skirt in a clean studio product-style asset",
    keywords: ["cream wrap skirt","linen wrap skirt","cream linen wrap skirt","wrap skirt","skirt","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_navy_wrap_skirt_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-navy-wrap-skirt-linen-fem-studio.jpg",
    description: "Navy Wrap Skirt in a clean studio product-style asset",
    keywords: ["navy wrap skirt","linen wrap skirt","navy linen wrap skirt","wrap skirt","skirt","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_blue_denim_skirt_denim_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-blue-denim-skirt-denim-fem-studio.jpg",
    description: "Blue Denim Skirt in a clean studio product-style asset",
    keywords: ["blue denim skirt","denim denim skirt","blue denim denim skirt","denim skirt","skirt","jean skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_denim_skirt_denim_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-denim-skirt-denim-fem-studio.jpg",
    description: "Black Denim Skirt in a clean studio product-style asset",
    keywords: ["black denim skirt","denim denim skirt","black denim denim skirt","denim skirt","skirt","jean skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_white_denim_skirt_denim_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-white-denim-skirt-denim-fem-studio.jpg",
    description: "White Denim Skirt in a clean studio product-style asset",
    keywords: ["white denim skirt","denim denim skirt","white denim denim skirt","denim skirt","skirt","jean skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_leather_skirt_leather_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-leather-skirt-leather-fem-studio.jpg",
    description: "Black Leather Skirt in a clean studio product-style asset",
    keywords: ["black leather skirt","leather leather skirt","black leather leather skirt","leather skirt","skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_brown_leather_skirt_leather_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-brown-leather-skirt-leather-fem-studio.jpg",
    description: "Brown Leather Skirt in a clean studio product-style asset",
    keywords: ["brown leather skirt","leather leather skirt","brown leather leather skirt","leather skirt","skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_white_tennis_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-white-tennis-skirt-cotton-fem-studio.jpg",
    description: "White Tennis Skirt in a clean studio product-style asset",
    keywords: ["white tennis skirt","cotton tennis skirt","white cotton tennis skirt","tennis skirt","skirt","sport skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_navy_tennis_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-navy-tennis-skirt-cotton-fem-studio.jpg",
    description: "Navy Tennis Skirt in a clean studio product-style asset",
    keywords: ["navy tennis skirt","cotton tennis skirt","navy cotton tennis skirt","tennis skirt","skirt","sport skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_tennis_skirt_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-tennis-skirt-cotton-fem-studio.jpg",
    description: "Black Tennis Skirt in a clean studio product-style asset",
    keywords: ["black tennis skirt","cotton tennis skirt","black cotton tennis skirt","tennis skirt","skirt","sport skirt"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_blue_high_waist_jeans_denim_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-blue-high-waist-jeans-denim-studio-fem.jpg",
    description: "Blue high-waist jeans in a clean studio product-style asset",
    keywords: ["blue high-waist jeans","denim high-waist jeans","blue denim high-waist jeans","high-waist jeans","jeans","denim","high waisted jeans"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_high_waist_jeans_denim_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-high-waist-jeans-denim-studio-fem.jpg",
    description: "Black high-waist jeans in a clean studio product-style asset",
    keywords: ["black high-waist jeans","denim high-waist jeans","black denim high-waist jeans","high-waist jeans","jeans","denim","high waisted jeans"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_white_high_waist_jeans_denim_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-white-high-waist-jeans-denim-fem-studio.jpg",
    description: "White High-Waist Jeans in a clean studio product-style asset",
    keywords: ["white high-waist jeans","denim high-waist jeans","white denim high-waist jeans","high-waist jeans","jeans","denim","high waisted jeans"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_wide_leg_trousers_wool_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-wide-leg-trousers-wool-studio-fem.jpg",
    description: "Black wide-leg trousers in a clean studio product-style asset",
    keywords: ["black wide-leg trousers","wool wide-leg trousers","black wool wide-leg trousers","wide-leg trousers","trousers","pants","wide leg pants"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_cream_wide_leg_trousers_wool_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-cream-wide-leg-trousers-wool-studio-fem.jpg",
    description: "Cream wide-leg trousers in a clean studio product-style asset",
    keywords: ["cream wide-leg trousers","wool wide-leg trousers","cream wool wide-leg trousers","wide-leg trousers","trousers","pants","wide leg pants"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_navy_wide_leg_trousers_wool_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-navy-wide-leg-trousers-wool-fem-studio.jpg",
    description: "Navy Wide-Leg Trousers in a clean studio product-style asset",
    keywords: ["navy wide-leg trousers","wool wide-leg trousers","navy wool wide-leg trousers","wide-leg trousers","trousers","pants","wide leg pants"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_cigarette_pants_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-cigarette-pants-cotton-fem-studio.jpg",
    description: "Black Cigarette Pants in a clean studio product-style asset",
    keywords: ["black cigarette pants","cotton cigarette pants","black cotton cigarette pants","cigarette pants","trousers","pants","slim trousers"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_capri_pants_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-capri-pants-cotton-fem-studio.jpg",
    description: "Black Capri Pants in a clean studio product-style asset",
    keywords: ["black capri pants","cotton capri pants","black cotton capri pants","capri pants","pants","cropped pants"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_white_capri_pants_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-white-capri-pants-cotton-fem-studio.jpg",
    description: "White Capri Pants in a clean studio product-style asset",
    keywords: ["white capri pants","cotton capri pants","white cotton capri pants","capri pants","pants","cropped pants"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_navy_capri_pants_cotton_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-navy-capri-pants-cotton-fem-studio.jpg",
    description: "Navy Capri Pants in a clean studio product-style asset",
    keywords: ["navy capri pants","cotton capri pants","navy cotton capri pants","capri pants","pants","cropped pants"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_culottes_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-culottes-linen-fem-studio.jpg",
    description: "Black Culottes in a clean studio product-style asset",
    keywords: ["black culottes","linen culottes","black linen culottes","culottes","pants","wide trousers"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_cream_culottes_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-cream-culottes-linen-fem-studio.jpg",
    description: "Cream Culottes in a clean studio product-style asset",
    keywords: ["cream culottes","linen culottes","cream linen culottes","culottes","pants","wide trousers"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_navy_culottes_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-navy-culottes-linen-fem-studio.jpg",
    description: "Navy Culottes in a clean studio product-style asset",
    keywords: ["navy culottes","linen culottes","navy linen culottes","culottes","pants","wide trousers"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_palazzo_pants_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-palazzo-pants-linen-fem-studio.jpg",
    description: "Black Palazzo Pants in a clean studio product-style asset",
    keywords: ["black palazzo pants","linen palazzo pants","black linen palazzo pants","palazzo pants","pants","wide trousers","flowing trousers"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_cream_palazzo_pants_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-cream-palazzo-pants-linen-fem-studio.jpg",
    description: "Cream Palazzo Pants in a clean studio product-style asset",
    keywords: ["cream palazzo pants","linen palazzo pants","cream linen palazzo pants","palazzo pants","pants","wide trousers","flowing trousers"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_white_palazzo_pants_linen_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-white-palazzo-pants-linen-fem-studio.jpg",
    description: "White Palazzo Pants in a clean studio product-style asset",
    keywords: ["white palazzo pants","linen palazzo pants","white linen palazzo pants","palazzo pants","pants","wide trousers","flowing trousers"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_black_bike_shorts_jersey_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-black-bike-shorts-jersey-fem-studio.jpg",
    description: "Black Bike Shorts in a clean studio product-style asset",
    keywords: ["black bike shorts","jersey bike shorts","black jersey bike shorts","bike shorts","shorts","biker shorts","cycling shorts"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  bottom_navy_bike_shorts_jersey_fem_v1: {
    slot: "bottom",
    gender: "feminine",
    path: "assets/recommendation-stock/bottom-navy-bike-shorts-jersey-fem-studio.jpg",
    description: "Navy Bike Shorts in a clean studio product-style asset",
    keywords: ["navy bike shorts","jersey bike shorts","navy jersey bike shorts","bike shorts","shorts","biker shorts","cycling shorts"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_camel_wrap_coat_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-camel-wrap-coat-wool-fem-studio.jpg",
    description: "Camel Wrap Coat in a clean studio product-style asset",
    keywords: ["camel wrap coat","wool wrap coat","camel wool wrap coat","wrap coat","coat","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_black_wrap_coat_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-black-wrap-coat-wool-fem-studio.jpg",
    description: "Black Wrap Coat in a clean studio product-style asset",
    keywords: ["black wrap coat","wool wrap coat","black wool wrap coat","wrap coat","coat","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_beige_wrap_coat_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-beige-wrap-coat-wool-fem-studio.jpg",
    description: "Beige Wrap Coat in a clean studio product-style asset",
    keywords: ["beige wrap coat","wool wrap coat","beige wool wrap coat","wrap coat","coat","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_black_cropped_jacket_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-black-cropped-jacket-wool-fem-studio.jpg",
    description: "Black Cropped Jacket in a clean studio product-style asset",
    keywords: ["black cropped jacket","wool cropped jacket","black wool cropped jacket","cropped jacket","jacket","crop jacket","short jacket"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_cream_cropped_jacket_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-cream-cropped-jacket-wool-fem-studio.jpg",
    description: "Cream Cropped Jacket in a clean studio product-style asset",
    keywords: ["cream cropped jacket","wool cropped jacket","cream wool cropped jacket","cropped jacket","jacket","crop jacket","short jacket"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_red_cropped_jacket_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-red-cropped-jacket-wool-fem-studio.jpg",
    description: "Red Cropped Jacket in a clean studio product-style asset",
    keywords: ["red cropped jacket","wool cropped jacket","red wool cropped jacket","cropped jacket","jacket","crop jacket","short jacket"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_camel_cape_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-camel-cape-wool-fem-studio.jpg",
    description: "Camel Cape in a clean studio product-style asset",
    keywords: ["camel cape","wool cape","camel wool cape","cape","poncho","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_black_cape_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-black-cape-wool-fem-studio.jpg",
    description: "Black Cape in a clean studio product-style asset",
    keywords: ["black cape","wool cape","black wool cape","cape","poncho","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_navy_cape_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-navy-cape-wool-fem-studio.jpg",
    description: "Navy Cape in a clean studio product-style asset",
    keywords: ["navy cape","wool cape","navy wool cape","cape","poncho","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_beige_poncho_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-beige-poncho-wool-fem-studio.jpg",
    description: "Beige Poncho in a clean studio product-style asset",
    keywords: ["beige poncho","wool poncho","beige wool poncho","poncho","cape","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_black_poncho_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-black-poncho-wool-fem-studio.jpg",
    description: "Black Poncho in a clean studio product-style asset",
    keywords: ["black poncho","wool poncho","black wool poncho","poncho","cape","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_gray_poncho_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-gray-poncho-wool-fem-studio.jpg",
    description: "Gray Poncho in a clean studio product-style asset",
    keywords: ["gray poncho","wool poncho","gray wool poncho","poncho","cape","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_black_kimono_silk_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-black-kimono-silk-fem-studio.jpg",
    description: "Black Kimono in a clean studio product-style asset",
    keywords: ["black kimono","silk kimono","black silk kimono","kimono","robe","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_floral_kimono_silk_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-floral-kimono-silk-fem-studio.jpg",
    description: "Floral Kimono in a clean studio product-style asset",
    keywords: ["floral kimono","silk kimono","floral silk kimono","kimono","robe","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_cream_kimono_silk_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-cream-kimono-silk-fem-studio.jpg",
    description: "Cream Kimono in a clean studio product-style asset",
    keywords: ["cream kimono","silk kimono","cream silk kimono","kimono","robe","wrap"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_camel_duster_coat_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-camel-duster-coat-wool-fem-studio.jpg",
    description: "Camel Duster Coat in a clean studio product-style asset",
    keywords: ["camel duster coat","wool duster coat","camel wool duster coat","duster coat","duster","long coat","cardigan coat"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_black_duster_coat_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-black-duster-coat-wool-fem-studio.jpg",
    description: "Black Duster Coat in a clean studio product-style asset",
    keywords: ["black duster coat","wool duster coat","black wool duster coat","duster coat","duster","long coat","cardigan coat"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  outer_navy_duster_coat_wool_fem_v1: {
    slot: "outer",
    gender: "feminine",
    path: "assets/recommendation-stock/outer-navy-duster-coat-wool-fem-studio.jpg",
    description: "Navy Duster Coat in a clean studio product-style asset",
    keywords: ["navy duster coat","wool duster coat","navy wool duster coat","duster coat","duster","long coat","cardigan coat"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_heels_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-heels-leather-studio-fem.jpg",
    description: "Black heels in a clean studio product-style asset",
    keywords: ["black heels","leather heels","black leather heels","heels","heel","high heels","pump"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_nude_heels_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-nude-heels-leather-studio-fem.jpg",
    description: "Nude heels in a clean studio product-style asset",
    keywords: ["nude heels","leather heels","nude leather heels","heels","heel","high heels","pump"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_red_heels_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-red-heels-leather-fem-studio.jpg",
    description: "Red Heels in a clean studio product-style asset",
    keywords: ["red heels","leather heels","red leather heels","heels","heel","high heels","pump"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_stiletto_heels_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-stiletto-heels-leather-studio-fem.jpg",
    description: "Black stiletto heels in a clean studio product-style asset",
    keywords: ["black stiletto heels","leather stiletto heels","black leather stiletto heels","stiletto heels","heel","stiletto","pump"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_nude_stiletto_heels_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-nude-stiletto-heels-leather-studio-fem.jpg",
    description: "Nude stiletto heels in a clean studio product-style asset",
    keywords: ["nude stiletto heels","leather stiletto heels","nude leather stiletto heels","stiletto heels","heel","stiletto","pump"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_kitten_heels_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-kitten-heels-leather-fem-studio.jpg",
    description: "Black Kitten Heels in a clean studio product-style asset",
    keywords: ["black kitten heels","leather kitten heels","black leather kitten heels","kitten heels","heel","kitten heel"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_nude_kitten_heels_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-nude-kitten-heels-leather-fem-studio.jpg",
    description: "Nude Kitten Heels in a clean studio product-style asset",
    keywords: ["nude kitten heels","leather kitten heels","nude leather kitten heels","kitten heels","heel","kitten heel"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_block_heels_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-block-heels-leather-fem-studio.jpg",
    description: "Black Block Heels in a clean studio product-style asset",
    keywords: ["black block heels","leather block heels","black leather block heels","block heels","heel","block heel"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_tan_block_heels_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-tan-block-heels-leather-fem-studio.jpg",
    description: "Tan Block Heels in a clean studio product-style asset",
    keywords: ["tan block heels","leather block heels","tan leather block heels","block heels","heel","block heel"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_white_block_heels_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-white-block-heels-leather-fem-studio.jpg",
    description: "White Block Heels in a clean studio product-style asset",
    keywords: ["white block heels","leather block heels","white leather block heels","block heels","heel","block heel"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_pumps_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-pumps-leather-studio-fem.jpg",
    description: "Black pumps in a clean studio product-style asset",
    keywords: ["black pumps","leather pumps","black leather pumps","pumps","pump","heel","court shoe"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_nude_pumps_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-nude-pumps-leather-studio-fem.jpg",
    description: "Nude pumps in a clean studio product-style asset",
    keywords: ["nude pumps","leather pumps","nude leather pumps","pumps","pump","heel","court shoe"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_red_pumps_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-red-pumps-leather-fem-studio.jpg",
    description: "Red Pumps in a clean studio product-style asset",
    keywords: ["red pumps","leather pumps","red leather pumps","pumps","pump","heel","court shoe"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_ballet_flats_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-ballet-flats-leather-studio-fem.jpg",
    description: "Black ballet flats in a clean studio product-style asset",
    keywords: ["black ballet flats","leather ballet flats","black leather ballet flats","ballet flats","flat","ballerina flat","ballet flat"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_nude_ballet_flats_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-nude-ballet-flats-leather-studio-fem.jpg",
    description: "Nude ballet flats in a clean studio product-style asset",
    keywords: ["nude ballet flats","leather ballet flats","nude leather ballet flats","ballet flats","flat","ballerina flat","ballet flat"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_red_ballet_flats_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-red-ballet-flats-leather-fem-studio.jpg",
    description: "Red Ballet Flats in a clean studio product-style asset",
    keywords: ["red ballet flats","leather ballet flats","red leather ballet flats","ballet flats","flat","ballerina flat","ballet flat"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_mary_janes_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-mary-janes-leather-fem-studio.jpg",
    description: "Black Mary Janes in a clean studio product-style asset",
    keywords: ["black mary janes","leather mary janes","black leather mary janes","mary janes","mary jane","flat","strap shoe"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_red_mary_janes_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-red-mary-janes-leather-fem-studio.jpg",
    description: "Red Mary Janes in a clean studio product-style asset",
    keywords: ["red mary janes","leather mary janes","red leather mary janes","mary janes","mary jane","flat","strap shoe"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_mules_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-mules-leather-studio-fem.jpg",
    description: "Black mules in a clean studio product-style asset",
    keywords: ["black mules","leather mules","black leather mules","mules","mule","slide","slip on"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_tan_mules_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-tan-mules-leather-studio-fem.jpg",
    description: "Tan mules in a clean studio product-style asset",
    keywords: ["tan mules","leather mules","tan leather mules","mules","mule","slide","slip on"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_wedge_sandals_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-wedge-sandals-leather-studio-fem.jpg",
    description: "Black wedge sandals in a clean studio product-style asset",
    keywords: ["black wedge sandals","leather wedge sandals","black leather wedge sandals","wedge sandals","wedge","sandal"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_gold_wedge_sandals_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-gold-wedge-sandals-leather-fem-studio.jpg",
    description: "Wedge Sandals in a clean studio product-style asset",
    keywords: ["gold wedge sandals","leather wedge sandals","gold leather wedge sandals","wedge sandals","wedge","sandal"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_strappy_sandals_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-strappy-sandals-leather-studio-fem.jpg",
    description: "Black strappy sandals in a clean studio product-style asset",
    keywords: ["black strappy sandals","leather strappy sandals","black leather strappy sandals","strappy sandals","sandal","strappy sandal"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_gold_strappy_sandals_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-gold-strappy-sandals-leather-fem-studio.jpg",
    description: "Strappy Sandals in a clean studio product-style asset",
    keywords: ["gold strappy sandals","leather strappy sandals","gold leather strappy sandals","strappy sandals","sandal","strappy sandal"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_silver_strappy_sandals_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-silver-strappy-sandals-leather-fem-studio.jpg",
    description: "Strappy Sandals in a clean studio product-style asset",
    keywords: ["silver strappy sandals","leather strappy sandals","silver leather strappy sandals","strappy sandals","sandal","strappy sandal"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_knee_high_boots_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-knee-high-boots-leather-studio-fem.jpg",
    description: "Black knee-high boots in a clean studio product-style asset",
    keywords: ["black knee-high boots","leather knee-high boots","black leather knee-high boots","knee-high boots","boots","tall boots","over-the-knee boot"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_brown_knee_high_boots_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-brown-knee-high-boots-leather-fem-studio.jpg",
    description: "Brown Knee High Boots in a clean studio product-style asset",
    keywords: ["brown knee-high boots","leather knee-high boots","brown leather knee-high boots","knee-high boots","boots","tall boots","over-the-knee boot"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_brown_riding_boots_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-brown-riding-boots-leather-studio-fem.jpg",
    description: "Brown riding boots in a clean studio product-style asset",
    keywords: ["brown riding boots","leather riding boots","brown leather riding boots","riding boots","boots","tall boots"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  shoes_black_riding_boots_leather_fem_v1: {
    slot: "shoes",
    gender: "feminine",
    path: "assets/recommendation-stock/shoes-black-riding-boots-leather-fem-studio.jpg",
    description: "Black Riding Boots in a clean studio product-style asset",
    keywords: ["black riding boots","leather riding boots","black leather riding boots","riding boots","boots","tall boots"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_black_clutch_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-black-clutch-leather-studio-fem.jpg",
    description: "Black clutch in a clean studio product-style asset",
    keywords: ["black clutch","leather clutch","black leather clutch","clutch","bag","evening bag","clutch bag"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_gold_clutch_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-gold-clutch-leather-fem-studio.jpg",
    description: "Clutch in a clean studio product-style asset",
    keywords: ["gold clutch","leather clutch","gold leather clutch","clutch","bag","evening bag","clutch bag"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_silver_clutch_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-silver-clutch-leather-fem-studio.jpg",
    description: "Clutch in a clean studio product-style asset",
    keywords: ["silver clutch","leather clutch","silver leather clutch","clutch","bag","evening bag","clutch bag"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_black_mini_bag_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-black-mini-bag-leather-fem-studio.jpg",
    description: "Black Mini Bag in a clean studio product-style asset",
    keywords: ["black mini bag","leather mini bag","black leather mini bag","mini bag","bag","small bag","mini purse"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_tan_mini_bag_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-tan-mini-bag-leather-studio-fem.jpg",
    description: "Tan mini bag in a clean studio product-style asset",
    keywords: ["tan mini bag","leather mini bag","tan leather mini bag","mini bag","bag","small bag","mini purse"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_red_mini_bag_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-red-mini-bag-leather-fem-studio.jpg",
    description: "Red Mini Bag in a clean studio product-style asset",
    keywords: ["red mini bag","leather mini bag","red leather mini bag","mini bag","bag","small bag","mini purse"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_black_hobo_bag_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-black-hobo-bag-leather-fem-studio.jpg",
    description: "Black Hobo Bag in a clean studio product-style asset",
    keywords: ["black hobo bag","leather hobo bag","black leather hobo bag","hobo bag","bag","slouch bag"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_brown_hobo_bag_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-brown-hobo-bag-leather-fem-studio.jpg",
    description: "Brown Hobo Bag in a clean studio product-style asset",
    keywords: ["brown hobo bag","leather hobo bag","brown leather hobo bag","hobo bag","bag","slouch bag"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_tan_hobo_bag_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-tan-hobo-bag-leather-fem-studio.jpg",
    description: "Tan Hobo Bag in a clean studio product-style asset",
    keywords: ["tan hobo bag","leather hobo bag","tan leather hobo bag","hobo bag","bag","slouch bag"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_black_bucket_bag_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-black-bucket-bag-leather-fem-studio.jpg",
    description: "Black Bucket Bag in a clean studio product-style asset",
    keywords: ["black bucket bag","leather bucket bag","black leather bucket bag","bucket bag","bag","drawstring bag"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_tan_bucket_bag_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-tan-bucket-bag-leather-fem-studio.jpg",
    description: "Tan Bucket Bag in a clean studio product-style asset",
    keywords: ["tan bucket bag","leather bucket bag","tan leather bucket bag","bucket bag","bag","drawstring bag"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_cream_bucket_bag_leather_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-cream-bucket-bag-leather-fem-studio.jpg",
    description: "Cream Bucket Bag in a clean studio product-style asset",
    keywords: ["cream bucket bag","leather bucket bag","cream leather bucket bag","bucket bag","bag","drawstring bag"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_gold_hair_clip_metal_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-gold-hair-clip-metal-fem-studio.jpg",
    description: "Hair Clip in a clean studio product-style asset",
    keywords: ["gold hair clip","metal hair clip","gold metal hair clip","hair clip","barrette","hair pin","hair accessory"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_silver_hair_clip_metal_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-silver-hair-clip-metal-fem-studio.jpg",
    description: "Hair Clip in a clean studio product-style asset",
    keywords: ["silver hair clip","metal hair clip","silver metal hair clip","hair clip","barrette","hair pin","hair accessory"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_tortoiseshell_hair_clip_metal_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-tortoiseshell-hair-clip-metal-fem-studio.jpg",
    description: "Tortoiseshell Hair Clip in a clean studio product-style asset",
    keywords: ["tortoiseshell hair clip","metal hair clip","tortoiseshell metal hair clip","hair clip","barrette","hair pin","hair accessory"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_black_headband_silk_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-black-headband-silk-fem-studio.jpg",
    description: "Black Headband in a clean studio product-style asset",
    keywords: ["black headband","silk headband","black silk headband","headband","hair band"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_red_headband_silk_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-red-headband-silk-fem-studio.jpg",
    description: "Red Headband in a clean studio product-style asset",
    keywords: ["red headband","silk headband","red silk headband","headband","hair band"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_gold_headband_silk_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-gold-headband-silk-fem-studio.jpg",
    description: "Headband in a clean studio product-style asset",
    keywords: ["gold headband","silk headband","gold silk headband","headband","hair band"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_red_hair_scarf_silk_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-red-hair-scarf-silk-fem-studio.jpg",
    description: "Red Hair Scarf in a clean studio product-style asset",
    keywords: ["red hair scarf","silk hair scarf","red silk hair scarf","hair scarf","scarf","head scarf","kerchief"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_navy_hair_scarf_silk_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-navy-hair-scarf-silk-fem-studio.jpg",
    description: "Navy Hair Scarf in a clean studio product-style asset",
    keywords: ["navy hair scarf","silk hair scarf","navy silk hair scarf","hair scarf","scarf","head scarf","kerchief"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_pearl_pearl_earrings_pearl_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-pearl-pearl-earrings-pearl-fem-studio.jpg",
    description: "Earrings in a clean studio product-style asset",
    keywords: ["pearl pearl earrings","pearl pearl pearl earrings","pearl earrings","earrings","pearls","jewelry"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_white_pearl_earrings_pearl_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-white-pearl-earrings-pearl-fem-studio.jpg",
    description: "White Earrings in a clean studio product-style asset",
    keywords: ["white pearl earrings","pearl pearl earrings","white pearl pearl earrings","pearl earrings","earrings","pearls","jewelry"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_silver_hoop_earrings_gold_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-silver-hoop-earrings-gold-studio-fem.jpg",
    description: "Silver hoop earrings in a clean studio product-style asset",
    keywords: ["silver hoop earrings","gold hoop earrings","silver gold hoop earrings","hoop earrings","earrings","hoops","jewelry"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_silver_drop_earrings_gold_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-silver-drop-earrings-gold-fem-studio.jpg",
    description: "Drop Earrings in a clean studio product-style asset",
    keywords: ["silver drop earrings","gold drop earrings","silver gold drop earrings","drop earrings","earrings","jewelry"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_gold_statement_necklace_metal_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-gold-statement-necklace-metal-fem-studio.jpg",
    description: "Statement Necklace in a clean studio product-style asset",
    keywords: ["gold statement necklace","metal statement necklace","gold metal statement necklace","statement necklace","necklace","jewelry","chain"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_silver_statement_necklace_metal_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-silver-statement-necklace-metal-fem-studio.jpg",
    description: "Statement Necklace in a clean studio product-style asset",
    keywords: ["silver statement necklace","metal statement necklace","silver metal statement necklace","statement necklace","necklace","jewelry","chain"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_gold_pendant_necklace_gold_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-gold-pendant-necklace-gold-fem-studio.jpg",
    description: "Pendant Necklace in a clean studio product-style asset",
    keywords: ["gold pendant necklace","gold gold pendant necklace","pendant necklace","necklace","pendant","jewelry"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_silver_pendant_necklace_gold_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-silver-pendant-necklace-gold-fem-studio.jpg",
    description: "Pendant Necklace in a clean studio product-style asset",
    keywords: ["silver pendant necklace","gold pendant necklace","silver gold pendant necklace","pendant necklace","necklace","pendant","jewelry"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_gold_brooch_metal_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-gold-brooch-metal-fem-studio.jpg",
    description: "Brooch in a clean studio product-style asset",
    keywords: ["gold brooch","metal brooch","gold metal brooch","brooch","pin","jewelry"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_silver_brooch_metal_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-silver-brooch-metal-fem-studio.jpg",
    description: "Brooch in a clean studio product-style asset",
    keywords: ["silver brooch","metal brooch","silver metal brooch","brooch","pin","jewelry"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_gold_stacked_bracelets_gold_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-gold-stacked-bracelets-gold-fem-studio.jpg",
    description: "Stacked Bracelets in a clean studio product-style asset",
    keywords: ["gold stacked bracelets","gold gold stacked bracelets","stacked bracelets","bracelet","jewelry","stack"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_silver_stacked_bracelets_gold_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-silver-stacked-bracelets-gold-fem-studio.jpg",
    description: "Stacked Bracelets in a clean studio product-style asset",
    keywords: ["silver stacked bracelets","gold stacked bracelets","silver gold stacked bracelets","stacked bracelets","bracelet","jewelry","stack"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_silver_charm_bracelet_silver_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-silver-charm-bracelet-silver-fem-studio.jpg",
    description: "Charm Bracelet in a clean studio product-style asset",
    keywords: ["silver charm bracelet","silver silver charm bracelet","charm bracelet","bracelet","jewelry"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_gold_charm_bracelet_silver_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-gold-charm-bracelet-silver-fem-studio.jpg",
    description: "Charm Bracelet in a clean studio product-style asset",
    keywords: ["gold charm bracelet","silver charm bracelet","gold silver charm bracelet","charm bracelet","bracelet","jewelry"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_black_beret_wool_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-black-beret-wool-fem-studio.jpg",
    description: "Black Beret in a clean studio product-style asset",
    keywords: ["black beret","wool beret","black wool beret","beret","hat","french hat"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_red_beret_wool_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-red-beret-wool-fem-studio.jpg",
    description: "Red Beret in a clean studio product-style asset",
    keywords: ["red beret","wool beret","red wool beret","beret","hat","french hat"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_navy_beret_wool_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-navy-beret-wool-fem-studio.jpg",
    description: "Navy Beret in a clean studio product-style asset",
    keywords: ["navy beret","wool beret","navy wool beret","beret","hat","french hat"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
  accessory_cream_beret_wool_fem_v1: {
    slot: "accessory",
    gender: "feminine",
    path: "assets/recommendation-stock/accessory-cream-beret-wool-fem-studio.jpg",
    description: "Cream Beret in a clean studio product-style asset",
    keywords: ["cream beret","wool beret","cream wool beret","beret","hat","french hat"],
    source: "generated",
    license: "Project-generated asset",
    attribution: "WearCast generated studio asset",
  },
};;

function isUsableStockImageCatalogEntry(entry = {}) {
  const imagePath = String(entry?.path || "");
  if (!imagePath) return false;
  const fileName = imagePath.split("/").pop() || "";
  const semanticFallback = entry?.fallback === true;
  if (!semanticFallback && !/studio/i.test(fileName)) return false;
  if (!semanticFallback && /\.svg(?:$|\?)/i.test(fileName)) return false;
  if (!/\.(png|jpe?g|webp|svg)(?:$|\?)/i.test(fileName)) return false;
  return existsSync(join(STOCK_IMAGE_ASSET_ROOT, imagePath));
}

function getUsableStockImageCatalogEntries() {
  return Object.entries(STOCK_IMAGE_CATALOG)
    .filter(([, entry]) => isUsableStockImageCatalogEntry(entry));
}

function decodeOAuthState(state) {
  if (!state || typeof state !== "string") return {};
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

async function chatCompletion(messages, {
  maxTokens = 560,
  requestId = null,
  traceLabel = "chat",
  timeoutMs = 18000,
  allowEmptyRetry = true,
  compactJsonRetry = false,
  model = MODEL,
} = {}) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`openrouter_timeout_${timeoutMs}ms`)), timeoutMs);
  const makeFailure = (message, failureClass, extra = {}) => {
    const err = new Error(message);
    err.wearcastFailureClass = failureClass;
    Object.entries(extra).forEach(([key, value]) => {
      err[key] = value;
    });
    return err;
  };
  try {
    if (!OPENROUTER_API_KEY) {
      console.error("[openrouter] missing api key", { requestId, traceLabel });
      throw makeFailure("OPENROUTER_API_KEY is not configured", "missing_api_key");
    }
    console.info("[openrouter] start", {
      requestId,
      traceLabel,
      model,
      reasoningEffort: OPENROUTER_REASONING_EFFORT || null,
      maxTokens,
      timeoutMs,
      retryMode: compactJsonRetry ? "compact_json" : "primary",
      messageCount: Array.isArray(messages) ? messages.length : 0,
      promptChars: Array.isArray(messages) ? messages.reduce((sum, msg) => sum + String(msg?.content || "").length, 0) : 0,
    });
    const requestMessages = compactJsonRetry
      ? [
          ...(Array.isArray(messages) ? messages : []),
          {
            role: "user",
            content: "Return compact valid JSON only. Keep every value short and finish the answer quickly.",
          },
        ]
      : messages;
    const body = {
      model,
      messages: requestMessages,
      max_tokens: maxTokens,
      temperature: compactJsonRetry ? 0 : 0.2,
    };
    if (OPENROUTER_REASONING_EFFORT && !compactJsonRetry) {
      body.reasoning = {
        effort: OPENROUTER_REASONING_EFFORT,
        exclude: true,
      };
    }
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://wearcast.app",
        "X-Title": "WearCast",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn("OpenRouter error response:", {
        status: res.status,
        statusText: res.statusText,
        body: err.slice(0, 3000),
      });
      if (allowEmptyRetry && [429, 500, 502, 503, 504].includes(res.status)) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        return chatCompletion(messages, {
          maxTokens: Math.max(260, Math.min(maxTokens, 900)),
          requestId,
          traceLabel: `${traceLabel}-http-retry`,
          timeoutMs: Math.min(timeoutMs, 18000),
          allowEmptyRetry: false,
          compactJsonRetry: true,
          model,
        });
      }
      throw makeFailure(`OpenRouter ${res.status}: ${err}`, "provider_http_error", { statusCode: res.status });
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      const finishReason = data?.choices?.[0]?.finish_reason || data?.choices?.[0]?.native_finish_reason || null;
      console.warn("OpenRouter empty content response:", JSON.stringify({
        id: data?.id,
        model: data?.model,
        created: data?.created,
        choices: data?.choices,
        usage: data?.usage,
        error: data?.error,
      }).slice(0, 3000));
      if (allowEmptyRetry) {
        const retryMaxTokens = Math.max(220, Math.min(360, Math.round(maxTokens * 0.55)));
        console.warn("[openrouter] retrying after empty content", {
          requestId,
          traceLabel,
          finishReason,
          previousMaxTokens: maxTokens,
          retryMaxTokens,
        });
        return chatCompletion(messages, {
          maxTokens: retryMaxTokens,
          requestId,
          traceLabel: `${traceLabel}-retry`,
          timeoutMs: Math.min(timeoutMs, 16000),
          allowEmptyRetry: false,
          compactJsonRetry: true,
          model,
        });
      }
      throw makeFailure(`OpenRouter returned empty content${finishReason ? ` (${finishReason})` : ""}`, "empty_response", { finishReason });
    }
    console.info("[openrouter] success", {
      requestId,
      traceLabel,
      durationMs: Date.now() - startedAt,
      maxTokens,
      contentLength: content.length,
      model: data?.model || model,
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
      model,
      aborted: controller.signal.aborted,
      abortReason,
      errorName: err?.name || "Error",
      errorMessage: err?.message || String(err),
      failureClass: classifyLlmFailure(err),
    });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function classifyLlmFailure(err) {
  if (err?.wearcastFailureClass) return err.wearcastFailureClass;
  const message = String(err?.message || err || "").toLowerCase();
  if (message.includes("openrouter_api_key")) return "missing_api_key";
  if (message.includes("timeout") || err?.name === "AbortError") return "timeout";
  if (message.includes("did not return valid json") || message.includes("json")) return "non_json_response";
  if (message.includes("schema") || message.includes("shape")) return "schema_mismatch";
  if (message.includes("empty content")) return "empty_response";
  if (message.includes("openrouter 429")) return "rate_limited";
  if (message.includes("openrouter 5")) return "provider_unavailable";
  if (message.includes("fetch failed") || message.includes("network")) return "network_error";
  if (message.includes("quality")) return "safety_weather_correction";
  return "unknown";
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

function recommendationBucketNumber(value, size, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n / size) * size;
}

function recommendationWeatherFamily(label = "") {
  const text = String(label || "").toLowerCase();
  if (/thunder|storm/.test(text)) return "storm";
  if (/snow|sleet|freezing/.test(text)) return "snow";
  if (/rain|drizzle|shower/.test(text)) return "rain";
  if (/fog|mist|haze/.test(text)) return "fog";
  if (/clear|sun/.test(text)) return "clear";
  if (/cloud|overcast/.test(text)) return "cloud";
  return cleanInlineText(label || "").toLowerCase().slice(0, 24);
}

function recommendationWardrobeCacheSignature(wardrobe) {
  if (!Array.isArray(wardrobe) || !wardrobe.length) return [];
  return wardrobe.map((item) => ({
    id: item.id ?? null,
    type: cleanInlineText(item.type || "").toLowerCase(),
    name: cleanInlineText(item.name || "").toLowerCase(),
    color: cleanInlineText(item.color || "").toLowerCase(),
    material: cleanInlineText(item.material || "").toLowerCase(),
    favorite: !!item.favorite,
  })).sort((a, b) => String(a.id || a.name || "").localeCompare(String(b.id || b.name || "")));
}

function recommendationCacheKey(weather, wardrobe, preferences, location = {}) {
  const remaining = weather?.remainingForecast || {};
  return JSON.stringify({
    copyVersion: RECOMMENDATION_COPY_VERSION,
    location: {
      name: cleanInlineText(location?.name || ""),
      lat: recommendationBucketNumber(location?.lat, 0.05),
      lon: recommendationBucketNumber(location?.lon, 0.05),
    },
    weather: {
      temp: recommendationBucketNumber(weather?.temperature, 2, 0),
      feelsLike: recommendationBucketNumber(weather?.feelsLike, 2, 0),
      wind: recommendationBucketNumber(weather?.wind, 5, 0),
      precipProb: recommendationBucketNumber(weather?.precipProb, 10, 0),
      family: recommendationWeatherFamily(weather?.weatherLabel),
      day: weather?.isDay === false ? "night" : "day",
      laterTemp: cleanInlineText(remaining.tempRange || ""),
      laterFeels: cleanInlineText(remaining.feelsLikeRange || ""),
      laterWind: cleanInlineText(remaining.maxWind || ""),
      laterRain: cleanInlineText(remaining.maxPrecipProb || ""),
    },
    wardrobe: recommendationWardrobeCacheSignature(wardrobe),
    preferences: {
      cold: !!preferences?.cold,
      hot: !!preferences?.hot,
      activityContext: preferences?.activityContext || "everyday",
      locationContext: preferences?.locationContext || "mixed",
      styleFocus: preferences?.styleFocus || "auto",
      gender: preferences?.gender || "unspecified",
      fashionNotes: cleanInlineText(preferences?.fashionNotes || "").toLowerCase().slice(0, 120),
    },
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

function createTimingTracker() {
  const startedAt = Date.now();
  const spans = [];
  return {
    mark(label, extra = {}) {
      spans.push({
        label,
        durationMs: Date.now() - startedAt,
        ...extra,
      });
    },
    summary(extra = {}) {
      return {
        totalMs: Date.now() - startedAt,
        spans,
        ...extra,
      };
    },
  };
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
  const outlook = salvageOutlookFromText(text);

  if (!outfit.top && !outfit.bottom && !outfit.shoes && !reasoning && !outlook) {
    return null;
  }

  return {
    outfit,
    slotReasons: {},
    reasoning,
    warnings,
    missingItems,
    outlook,
  };
}

function salvageOutlookFromText(text) {
  if (typeof text !== "string" || !text) return null;
  // Locate "outlook": {  ... and pull out the headline + windows.
  const outlookStart = text.search(/"outlook"\s*:\s*\{/);
  if (outlookStart < 0) return null;
  const headlineMatch = text.slice(outlookStart).match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const headline = headlineMatch ? headlineMatch[1].replace(/\\"/g, '"') : "";

  const windowsStart = text.slice(outlookStart).search(/"windows"\s*:\s*\{/);
  const windows = {};
  if (windowsStart >= 0) {
    const after = text.slice(outlookStart + windowsStart);
    for (const key of ["now", "later", "evening"]) {
      // Match either `"key": "string"` or `"key": { "copy": "string" }` (or text/description/summary).
      const re = new RegExp(`"${key}"\\s*:\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|\\{[^}]*?"(?:copy|text|description|summary)"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "i");
      const m = after.match(re);
      const raw = m ? (m[1] ?? m[2]) : "";
      if (raw) windows[key] = { copy: raw.replace(/\\"/g, '"') };
    }
  }
  if (!headline && !Object.keys(windows).length) return null;
  return { headline: headline || null, windows };
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

function normalizeRecommendationItemDetail(value) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  return {
    color: cleanInlineText(source?.color),
    material: cleanInlineText(source?.material),
  };
}

function normalizeRecommendationItemDetails(value) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  return {
    top: normalizeRecommendationItemDetail(source?.top),
    bottom: normalizeRecommendationItemDetail(source?.bottom),
    outer: normalizeRecommendationItemDetail(source?.outer),
    shoes: normalizeRecommendationItemDetail(source?.shoes),
    accessory: normalizeRecommendationItemDetail(source?.accessory),
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

function normalizeRelativeBox(value) {
  if (!value || typeof value !== "object") return null;
  const x = toNumber(value.x);
  const y = toNumber(value.y);
  const width = toNumber(value.width);
  const height = toNumber(value.height);
  if (![x, y, width, height].every((part) => Number.isFinite(part))) return null;
  if (width <= 0.03 || height <= 0.03) return null;

  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const left = clamp01(x);
  const top = clamp01(y);
  const right = clamp01(x + width);
  const bottom = clamp01(y + height);
  const normalizedWidth = right - left;
  const normalizedHeight = bottom - top;

  if (normalizedWidth <= 0.03 || normalizedHeight <= 0.03) return null;

  return {
    x: left,
    y: top,
    width: normalizedWidth,
    height: normalizedHeight,
  };
}

let clothesSegmentationPipelinePromise = null;
let backgroundRemovalModulePromise = null;
const BODY_SEGMENTATION_LABELS = new Set([
  "hair",
  "face",
  "left-leg",
  "right-leg",
  "left-arm",
  "right-arm",
]);

async function getClothesSegmentationPipeline() {
  if (!clothesSegmentationPipelinePromise) {
    clothesSegmentationPipelinePromise = import("@huggingface/transformers")
      .then(({ pipeline }) => pipeline("image-segmentation", "Xenova/segformer_b2_clothes"));
  }
  return clothesSegmentationPipelinePromise;
}

async function getBackgroundRemovalFn() {
  if (!backgroundRemovalModulePromise) {
    backgroundRemovalModulePromise = import("@imgly/background-removal-node")
      .then(({ removeBackground }) => removeBackground);
  }
  return backgroundRemovalModulePromise;
}

function summarizeAnalyzeItems(items = []) {
  return (Array.isArray(items) ? items : []).slice(0, 6).map((item) => {
    const box = normalizeRelativeBox(item?.box);
    const area = box ? Number((box.width * box.height).toFixed(4)) : null;
    return {
      type: item?.type || null,
      name: item?.name || null,
      color: item?.color || null,
      geometrySource: item?.geometrySource || null,
      area,
      box,
    };
  });
}

function createAnalyzeLogger(requestId) {
  const startedAt = Date.now();
  return {
    event(stage, details = {}) {
      console.info("[analyze-item-photo]", {
        requestId,
        stage,
        elapsedMs: Date.now() - startedAt,
        ...details,
      });
    },
    debug(stage, details = {}) {
      if (!DEBUG_LOGS) return;
      console.info("[analyze-item-photo:debug]", {
        requestId,
        stage,
        elapsedMs: Date.now() - startedAt,
        ...details,
      });
    },
    warn(stage, details = {}) {
      console.warn("[analyze-item-photo]", {
        requestId,
        stage,
        elapsedMs: Date.now() - startedAt,
        ...details,
      });
    },
    error(stage, err, details = {}) {
      console.error("[analyze-item-photo]", {
        requestId,
        stage,
        elapsedMs: Date.now() - startedAt,
        error: err?.message || String(err),
        stack: DEBUG_LOGS ? err?.stack || null : undefined,
        ...details,
      });
    },
  };
}

function boxArea(box) {
  const normalized = normalizeRelativeBox(box);
  if (!normalized) return 0;
  return normalized.width * normalized.height;
}

function boxIntersectionArea(a, b) {
  const boxA = normalizeRelativeBox(a);
  const boxB = normalizeRelativeBox(b);
  if (!boxA || !boxB) return 0;
  const left = Math.max(boxA.x, boxB.x);
  const top = Math.max(boxA.y, boxB.y);
  const right = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
  const bottom = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
}

function boxOverlapRatio(a, b) {
  const intersection = boxIntersectionArea(a, b);
  if (!intersection) return 0;
  const minArea = Math.max(0.0001, Math.min(boxArea(a), boxArea(b)));
  return intersection / minArea;
}

function normalizeItemTypeKey(type = "") {
  const normalized = cleanInlineText(type).toLowerCase();
  if (/t-shirt|shirt|tee|polo|sweater|hoodie|blouse|top|tank/.test(normalized)) return "top";
  if (/jacket|coat|blazer|overshirt|outerwear/.test(normalized)) return "outer";
  if (/jean|pant|trouser|legging|short|skirt/.test(normalized)) return "bottom";
  if (/shoe|loafer|boot|sneaker|sandal/.test(normalized)) return "shoes";
  if (/watch|hat|cap|bag|belt|scarf|glove|sunglass|bracelet|necklace|accessor/.test(normalized)) return "accessory";
  return normalized || "other";
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function recenterBox(box, { width = null, height = null } = {}) {
  const normalized = normalizeRelativeBox(box);
  if (!normalized) return null;
  const nextWidth = clamp01(width ?? normalized.width);
  const nextHeight = clamp01(height ?? normalized.height);
  const centerX = normalized.x + normalized.width / 2;
  const centerY = normalized.y + normalized.height / 2;
  return normalizeRelativeBox({
    x: clamp01(centerX - nextWidth / 2),
    y: clamp01(centerY - nextHeight / 2),
    width: nextWidth,
    height: nextHeight,
  });
}

function tightenProductBox(box, type = "") {
  const normalized = normalizeRelativeBox(box);
  if (!normalized) return null;

  const typeKey = normalizeItemTypeKey(type);
  const area = boxArea(normalized);
  const aspect = normalized.width / Math.max(0.001, normalized.height);

  const limits = {
    top: { maxArea: 0.24, widthScale: 0.82, heightScale: 0.88 },
    outer: { maxArea: 0.34, widthScale: 0.86, heightScale: 0.9 },
    bottom: { maxArea: 0.3, widthScale: 0.84, heightScale: 0.9 },
    shoes: { maxArea: 0.16, widthScale: 0.76, heightScale: 0.78 },
    accessory: { maxArea: 0.09, widthScale: 0.74, heightScale: 0.74 },
    other: { maxArea: 0.22, widthScale: 0.84, heightScale: 0.88 },
  }[typeKey] || { maxArea: 0.22, widthScale: 0.84, heightScale: 0.88 };

  let tightened = normalized;
  if (area > limits.maxArea) {
    tightened = recenterBox(normalized, {
      width: normalized.width * limits.widthScale,
      height: normalized.height * limits.heightScale,
    }) || normalized;
  }

  if (typeKey === "top" || typeKey === "outer") {
    if (aspect > 1.1) {
      tightened = recenterBox(tightened, {
        width: tightened.width * 0.88,
        height: tightened.height,
      }) || tightened;
    }
  }

  if (typeKey === "accessory" && boxArea(tightened) > 0.09) {
    tightened = recenterBox(tightened, {
      width: tightened.width * 0.78,
      height: tightened.height * 0.78,
    }) || tightened;
  }

  if (typeKey === "shoes" && boxArea(tightened) > 0.18) {
    tightened = recenterBox(tightened, {
      width: tightened.width * 0.84,
      height: tightened.height * 0.84,
    }) || tightened;
  }

  return tightened;
}

function canonicalizeDetectedTypeLabel(type = "", name = "") {
  const rawType = cleanInlineText(type);
  const rawName = cleanInlineText(name);
  const combined = `${rawType} ${rawName}`.toLowerCase();
  if (!combined) return rawType || null;

  if (/\bpolo\b/.test(combined)) return "Polo";
  if (/\b(t-?shirt|tee)\b/.test(combined)) return "T-shirt";
  if (/\b(tank(\s+top)?)\b/.test(combined)) return "Tank top";
  if (/\b(button[\s-]?up|button[\s-]?down|oxford|dress shirt)\b/.test(combined)) return "Shirt";
  if (/\b(loafer|oxford shoe|derby|dress shoe)\b/.test(combined)) return "Dress shoes";
  if (/\b(sneaker|trainer|runner)\b/.test(combined)) return "Sneakers";
  if (/\b(boot|chelsea|combat boot)\b/.test(combined)) return "Boots";
  if (/\b(sandal|slide)\b/.test(combined)) return "Sandals";
  if (/\b(baseball cap|cap|beanie|sun hat|bucket hat)\b/.test(combined)) return "Hat";
  if (/\b(sunglass|shades|eyewear)\b/.test(combined)) return "Sunglasses";
  if (/\b(glove|mittens?)\b/.test(combined)) return "Gloves";
  if (/\b(scarf)\b/.test(combined)) return "Scarf";
  if (/\b(belt)\b/.test(combined)) return "Belt";
  if (/\b(tote|bag|backpack|purse|handbag)\b/.test(combined)) return "Bag";
  return rawType || null;
}

function sanitizeInferredMaterial(material, { source = "", classifiedMode = null } = {}) {
  const value = cleanInlineText(material);
  if (!value) return null;
  const normalized = value.toLowerCase();

  if (/\bor\b|\band\b|\/|,/.test(normalized)) return null;
  if (/\blikely\b|\bmaybe\b|\bpossibly\b|\bappears\b|\blooks\b|\bseems\b/.test(normalized)) return null;
  if (classifiedMode === "product" && source === "llm-primary") return null;

  const allowList = new Set([
    "cotton",
    "wool",
    "linen",
    "silk",
    "leather",
    "denim",
    "suede",
    "nylon",
    "polyester",
    "cashmere",
    "fleece",
    "canvas",
    "metal",
    "rubber",
  ]);

  return allowList.has(normalized) ? value : null;
}

function finalizeDetectedItems(items = [], { classifiedMode = null, source = "" } = {}) {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => {
      const canonicalType = canonicalizeDetectedTypeLabel(item?.type, item?.name);
      return {
        ...item,
        type: canonicalType,
        material: sanitizeInferredMaterial(item?.material, { source, classifiedMode }),
        box: classifiedMode === "product"
          ? tightenProductBox(item?.box, canonicalType || item?.type)
          : normalizeRelativeBox(item?.box),
      };
    })
    .filter((item) => item.type || item.name || item.color || item.material || item.careInstructions?.length);

  if (classifiedMode !== "product") return normalizedItems;

  const withArea = normalizedItems
    .map((item) => ({ item, area: boxArea(item.box) }))
    .sort((a, b) => b.area - a.area);

  if (!withArea.length) return normalizedItems;

  const best = withArea[0];
  const retained = withArea.filter(({ area, item }, index) => {
    if (index === 0) return true;
    if (!item.box || !best.item.box) return false;
    return area >= best.area * 0.72;
  });

  return retained.map(({ item }) => item).slice(0, 1);
}

function finalizeOutfitDetectedItems(items = [], { source = "" } = {}) {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => {
      const canonicalType = canonicalizeDetectedTypeLabel(item?.type, item?.name);
      return {
        ...item,
        type: canonicalType,
        material: sanitizeInferredMaterial(item?.material, { source, classifiedMode: "outfit" }),
        box: normalizeRelativeBox(item?.box),
        area: boxArea(item?.box),
        typeKey: normalizeItemTypeKey(canonicalType || item?.type),
      };
    })
    .filter((item) => item.type || item.name || item.color || item.material || item.careInstructions?.length)
    .sort((a, b) => b.area - a.area);

  const kept = [];
  for (const item of normalizedItems) {
    if (!item.box) {
      if (!kept.length) kept.push(item);
      continue;
    }

    if (item.area < 0.035 && kept.length) continue;

    const duplicatesExisting = kept.some((existing) => {
      if (!existing.box) return false;
      const overlap = boxOverlapRatio(existing.box, item.box);
      if (overlap < 0.68) return false;
      return existing.typeKey === item.typeKey || item.area <= existing.area * 0.82;
    });
    if (duplicatesExisting) continue;

    const weakAccessory = item.typeKey === "accessory" && item.area < 0.055 && kept.length > 0;
    if (weakAccessory) continue;

    kept.push(item);
  }

  return kept
    .slice(0, 4)
    .map(({ area, typeKey, ...item }) => item);
}

function decodeImageDataUrl(image) {
  const match = String(image || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function fileExtensionForMimeType(mimeType = "") {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

async function writeTempImageFromDataUrl(image) {
  const { mimeType, buffer } = decodeImageDataUrl(image);
  const filePath = join("/tmp", `${randomUUID()}.${fileExtensionForMimeType(mimeType)}`);
  await writeFile(filePath, buffer);
  return filePath;
}

function mapSegmentationLabelToWardrobeItem(label = "") {
  const normalized = cleanInlineText(label).toLowerCase();
  const table = {
    "upper-clothes": { key: "upper-clothes", type: "Shirt", name: "Shirt" },
    "dress": { key: "dress", type: "Dress", name: "Dress" },
    "pants": { key: "pants", type: "Jeans", name: "Pants" },
    "skirt": { key: "skirt", type: "Skirt", name: "Skirt" },
    "hat": { key: "hat", type: "Hat", name: "Hat" },
    "bag": { key: "bag", type: "Bag", name: "Bag" },
    "scarf": { key: "scarf", type: "Scarf", name: "Scarf" },
    "belt": { key: "belt", type: "Belt", name: "Belt" },
    "sunglasses": { key: "sunglasses", type: "Sunglasses", name: "Sunglasses" },
    "left-shoe": { key: "shoes", type: "Sneakers", name: "Shoes" },
    "right-shoe": { key: "shoes", type: "Sneakers", name: "Shoes" },
  };
  return table[normalized] || null;
}

function countMaskPixels(mask) {
  if (!mask?.data || !mask.width || !mask.height) return 0;
  let count = 0;
  for (let index = 0; index < mask.data.length; index += 1) {
    if (mask.data[index] > 0) count += 1;
  }
  return count;
}

function maskBoundingBox(mask) {
  if (!mask?.data || !mask.width || !mask.height) return null;
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  const data = mask.data;

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (data[y * mask.width + x] > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function unionPixelBoxes(boxes = []) {
  const valid = boxes.filter(Boolean);
  if (!valid.length) return null;
  return {
    minX: Math.min(...valid.map((box) => box.minX)),
    minY: Math.min(...valid.map((box) => box.minY)),
    maxX: Math.max(...valid.map((box) => box.maxX)),
    maxY: Math.max(...valid.map((box) => box.maxY)),
    width: Math.max(...valid.map((box) => box.maxX)) - Math.min(...valid.map((box) => box.minX)) + 1,
    height: Math.max(...valid.map((box) => box.maxY)) - Math.min(...valid.map((box) => box.minY)) + 1,
  };
}

function pixelBoxToRelativeBox(box, width, height) {
  if (!box || !width || !height) return null;
  return normalizeRelativeBox({
    x: box.minX / width,
    y: box.minY / height,
    width: box.width / width,
    height: box.height / height,
  });
}

function nearestColorName(r, g, b) {
  const palette = [
    { name: "Black", rgb: [32, 32, 32] },
    { name: "White", rgb: [236, 236, 236] },
    { name: "Gray", rgb: [128, 128, 128] },
    { name: "Navy", rgb: [40, 60, 120] },
    { name: "Blue", rgb: [60, 110, 200] },
    { name: "Brown", rgb: [110, 74, 45] },
    { name: "Beige", rgb: [214, 194, 154] },
    { name: "Green", rgb: [70, 128, 80] },
    { name: "Red", rgb: [180, 56, 52] },
    { name: "Pink", rgb: [222, 138, 170] },
    { name: "Purple", rgb: [124, 88, 164] },
    { name: "Yellow", rgb: [224, 196, 72] },
    { name: "Orange", rgb: [220, 132, 48] },
  ];

  let best = palette[0];
  let bestDistance = Infinity;
  for (const entry of palette) {
    const distance = Math.sqrt(
      (r - entry.rgb[0]) ** 2 +
      (g - entry.rgb[1]) ** 2 +
      (b - entry.rgb[2]) ** 2
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }
  return best.name;
}

function dominantColorForMasks(image, masks = [], unionBox = null) {
  if (!image?.bitmap?.data || !Array.isArray(masks) || !masks.length || !unionBox) return null;
  const { data, width } = image.bitmap;
  const step = Math.max(1, Math.floor(Math.sqrt((unionBox.width * unionBox.height) / 2400)));
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (const mask of masks) {
    for (let y = unionBox.minY; y <= unionBox.maxY; y += step) {
      for (let x = unionBox.minX; x <= unionBox.maxX; x += step) {
        if (mask.data[y * mask.width + x] <= 0) continue;
        const offset = (y * width + x) * 4;
        red += data[offset];
        green += data[offset + 1];
        blue += data[offset + 2];
        count += 1;
      }
    }
  }

  if (!count) return null;
  return nearestColorName(
    Math.round(red / count),
    Math.round(green / count),
    Math.round(blue / count)
  );
}

async function segmentWardrobeItemsFromImage(imageDataUrl) {
  const release = await acquireHeavyMlSlot();
  const tempPath = await writeTempImageFromDataUrl(imageDataUrl);
  try {
    const [segmenter, image] = await Promise.all([
      getClothesSegmentationPipeline(),
      Jimp.read(tempPath),
    ]);
    const result = await segmenter(tempPath);
    const grouped = new Map();

    for (const entry of Array.isArray(result) ? result : []) {
      const mapped = mapSegmentationLabelToWardrobeItem(entry?.label);
      if (!mapped || !entry?.mask) continue;
      const pixelBox = maskBoundingBox(entry.mask);
      if (!pixelBox) continue;

      const existing = grouped.get(mapped.key) || {
        key: mapped.key,
        type: mapped.type,
        baseName: mapped.name,
        masks: [],
        boxes: [],
      };
      existing.masks.push(entry.mask);
      existing.boxes.push(pixelBox);
      grouped.set(mapped.key, existing);
    }

    return [...grouped.values()]
      .map((group) => {
        const unionBox = unionPixelBoxes(group.boxes);
        const relativeBox = pixelBoxToRelativeBox(unionBox, image.bitmap.width, image.bitmap.height);
        if (!relativeBox) return null;
        const color = dominantColorForMasks(image, group.masks, unionBox);
        const name = color ? `${color} ${group.baseName}` : group.baseName;
        return {
          type: group.type,
          name,
          color,
          material: null,
          careInstructions: [],
          box: relativeBox,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.box?.height || 0) * (b.box?.width || 0) - (a.box?.height || 0) * (a.box?.width || 0));
  } finally {
    await unlink(tempPath).catch(() => {});
    release();
  }
}

async function segmentWardrobeOutfitImage(imageDataUrl) {
  const release = await acquireHeavyMlSlot();
  const tempPath = await writeTempImageFromDataUrl(imageDataUrl);
  try {
    const [segmenter, image] = await Promise.all([
      getClothesSegmentationPipeline(),
      Jimp.read(tempPath),
    ]);
    const result = await segmenter(tempPath);
    const grouped = new Map();
    let hasBodySignal = false;

    for (const entry of Array.isArray(result) ? result : []) {
      const label = cleanInlineText(entry?.label).toLowerCase();
      const pixelCount = countMaskPixels(entry?.mask);
      const areaRatio = pixelCount / Math.max(1, image.bitmap.width * image.bitmap.height);
      if (BODY_SEGMENTATION_LABELS.has(label) && areaRatio >= 0.01) hasBodySignal = true;

      const mapped = mapSegmentationLabelToWardrobeItem(entry?.label);
      if (!mapped || !entry?.mask) continue;
      const pixelBox = maskBoundingBox(entry.mask);
      if (!pixelBox) continue;

      const existing = grouped.get(mapped.key) || {
        key: mapped.key,
        type: mapped.type,
        baseName: mapped.name,
        masks: [],
        boxes: [],
      };
      existing.masks.push(entry.mask);
      existing.boxes.push(pixelBox);
      grouped.set(mapped.key, existing);
    }

    const items = [...grouped.values()]
      .map((group) => {
        const unionBox = unionPixelBoxes(group.boxes);
        const relativeBox = pixelBoxToRelativeBox(unionBox, image.bitmap.width, image.bitmap.height);
        if (!relativeBox) return null;
        const color = dominantColorForMasks(image, group.masks, unionBox);
        const name = color ? `${color} ${group.baseName}` : group.baseName;
        return {
          type: group.type,
          name,
          color,
          material: null,
          careInstructions: [],
          box: relativeBox,
          geometrySource: "outfit-segmentation",
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.box?.height || 0) * (b.box?.width || 0) - (a.box?.height || 0) * (a.box?.width || 0));

    return {
      items,
      hasBodySignal,
    };
  } finally {
    await unlink(tempPath).catch(() => {});
    release();
  }
}

async function extractForegroundBoxFromImage(imageDataUrl) {
  const release = await acquireHeavyMlSlot();
  const tempPath = await writeTempImageFromDataUrl(imageDataUrl);
  try {
    const removeBackground = await getBackgroundRemovalFn();
    const blob = await removeBackground(tempPath, {
      model: "small",
      output: {
        format: "image/png",
        type: "mask",
      },
    });
    const maskBuffer = Buffer.from(await blob.arrayBuffer());
    const maskImage = await Jimp.read(maskBuffer);
    const { data, width, height } = maskImage.bitmap;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let count = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha <= 16) continue;
        count += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (!count || maxX < minX || maxY < minY) return null;

    return pixelBoxToRelativeBox({
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    }, width, height);
  } finally {
    await unlink(tempPath).catch(() => {});
    release();
  }
}

async function classifyWardrobePhotoMode(image, { requestId = null } = {}) {
  try {
    const text = await chatCompletion([
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: image } },
          {
            type: "text",
            text: `Classify this wardrobe photo for crop strategy.

Return ONLY valid JSON:
{
  "mode": "product" or "outfit"
}

Use "product" when the image mainly shows one isolated clothing item, shoe, bag, hat, or folded/flat-lay garment.
Use "outfit" when the image mainly shows a person wearing clothing, including mirror selfies, street photos, torso shots, or full-body photos.`,
          },
        ],
      },
    ], { maxTokens: 40, compactJsonRetry: true, requestId, traceLabel: "analyze-classify-mode" });

    const parsed = parseModelJson(text);
    return parsed?.mode === "product" || parsed?.mode === "outfit" ? parsed.mode : null;
  } catch {
    return null;
  }
}

async function analyzeProductPhotoMetadata(image, { requestId = null } = {}) {
  const text = await chatCompletion([
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: image } },
        {
          type: "text",
          text: `You are analysing a single clothing product photo for a wardrobe app.

Return ONLY valid JSON:
{
  "type": "best clothing category such as Polo, T-shirt, Shirt, Jacket, Jeans, Dress shoes, Sneakers, Hat, Sunglasses, Watch, Bag, Other",
  "name": "short natural item name",
  "color": "main visible color or null",
  "material": "likely material if reasonably inferable, otherwise null",
  "careInstructions": []
}

Rules:
- Assume there is one main wardrobe item.
- Use the most specific everyday wardrobe label you can.
- Distinguish Polo from Shirt: if the top has a soft collar and short placket but is not a full button-up, use Polo.
- For small items like shoes, hats, sunglasses, and watches, describe only that item and not the surrounding empty background.
- Keep values short.
- Use null when unsure.
- Return careInstructions as an array of plain strings. Use [] if there is no readable care label.
- Do not include markdown fences or extra text.`,
        },
      ],
    },
  ], { maxTokens: 160, compactJsonRetry: true, requestId, traceLabel: "analyze-product-metadata" });

  const parsed = parseModelJson(text);
  return {
    type: typeof parsed?.type === "string" ? parsed.type : null,
    name: typeof parsed?.name === "string" ? parsed.name : null,
    color: typeof parsed?.color === "string" ? parsed.color : null,
    material: typeof parsed?.material === "string" ? parsed.material : null,
    careInstructions: normalizeCareInstructions(parsed?.careInstructions),
  };
}

async function analyzeWardrobeItemsWithLLM(image, { requestId = null } = {}) {
  const baseMessages = [
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: image } },
        {
          type: "text",
          text: `You are analysing a clothing photo for a wardrobe app.

The user may send:
- a single clothing item photo, or
- a full-body outfit photo that contains multiple visible wardrobe items.

Return ONLY valid JSON with this shape:
{
  "items": [
    {
      "type": "best clothing category such as Polo, T-shirt, Shirt, Jacket, Jeans, Dress shoes, Sneakers, Hat, Sunglasses, Watch, Other",
      "name": "short natural item name",
      "color": "main visible color or null",
      "material": "likely material if reasonably inferable, otherwise null",
      "careInstructions": [],
      "box": {
        "x": 0.1,
        "y": 0.1,
        "width": 0.5,
        "height": 0.5
      }
    }
  ]
}

Rules:
- Return one array entry per distinct visible wardrobe item worth saving.
- For full-body photos, prefer major wearable items such as tops, bottoms, outerwear, shoes, dresses, hats, bags, sunglasses.
- Do not invent hidden garments.
- Do not include the same item twice.
- Return between 1 and 6 items.
- If a simple photo shows one obvious wardrobe item, always return exactly one best-guess item.
- Never return an empty array when at least one visible wearable item is present.
- Use the most specific everyday wardrobe label you can.
- Distinguish Polo from Shirt: if the top has a soft collar and short placket but is not a full button-up, use Polo.
- Keep values short.
- Use null when unsure.
- Return careInstructions as an array of plain strings. Use [] if there is no readable care label.
- Include a best-effort normalized box for each visible item.
- Box coordinates must be fractions from 0 to 1 relative to the full image.
- x/y are the top-left corner. width/height are the item size.
- Keep each box tight around the visible clothing item. Include the whole item, not the whole person.
- For smaller items such as shoes, hats, sunglasses, and watches, boxes should stay close to the visible object and usually occupy much less of the frame than a shirt or jacket.
- Do not include markdown fences or extra text.`,
        },
      ],
    },
  ];

  const parseItems = (payload) => (Array.isArray(payload?.items) ? payload.items : [{
    type: payload?.type,
    name: payload?.name,
    color: payload?.color,
    material: payload?.material,
    careInstructions: payload?.careInstructions,
    box: payload?.box,
  }])
    .map((item) => ({
      type: typeof item?.type === "string" ? item.type : null,
      name: typeof item?.name === "string" ? item.name : null,
      color: typeof item?.color === "string" ? item.color : null,
      material: typeof item?.material === "string" ? item.material : null,
      careInstructions: normalizeCareInstructions(item?.careInstructions),
      box: normalizeRelativeBox(item?.box),
    }))
    .filter((item) => item.type || item.name || item.color || item.material || item.careInstructions.length);

  const text = await chatCompletion(baseMessages, {
    maxTokens: 420,
    requestId,
    traceLabel: "analyze-llm-items",
  });
  let items = parseItems(parseModelJson(text));

  if (!items.length) {
    const retryText = await chatCompletion([
      ...baseMessages,
      {
        role: "user",
        content: "The first pass returned no usable items. Retry and return one best-guess visible wardrobe item from this image, even if some details are uncertain. Use type \"Other\" only if needed. Return valid JSON only.",
      },
    ], {
      maxTokens: 220,
      compactJsonRetry: true,
      requestId,
      traceLabel: "analyze-llm-items-retry",
    });
    items = parseItems(parseModelJson(retryText));
  }

  return items;
}

async function refineProductPrimaryItem(image, item, { requestId = null } = {}) {
  const currentType = cleanInlineText(item?.type);
  const currentName = cleanInlineText(item?.name);
  if (!currentType && !currentName) return item;

  const text = await chatCompletion([
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: image } },
        {
          type: "text",
          text: `Refine the wardrobe type for the main product item in this image.

Current guess:
{
  "type": ${JSON.stringify(currentType || null)},
  "name": ${JSON.stringify(currentName || null)}
}

Return ONLY valid JSON:
{
  "type": "one best label",
  "name": "short natural item name or null"
}

Allowed type labels:
Polo, T-shirt, Shirt, Tank top, Sweater, Hoodie, Jacket, Coat, Blazer, Vest, Jeans, Chinos, Shorts, Sweatpants, Dress pants, Skirt, Dress, Sneakers, Boots, Sandals, Dress shoes, Hat, Sunglasses, Scarf, Gloves, Belt, Bag, Watch, Other

Rules:
- Use the most specific label you can.
- If the top has a soft collar and short placket but is not a full button-up, choose Polo.
- If this is a loafer, oxford, or derby, choose Dress shoes.
- Keep the name short and natural.
- Return JSON only.`,
        },
      ],
    },
  ], { maxTokens: 120, compactJsonRetry: true, requestId, traceLabel: "analyze-refine-product-type" });

  const parsed = parseModelJson(text);
  const refinedType = canonicalizeDetectedTypeLabel(parsed?.type, parsed?.name || currentName);
  const refinedName = typeof parsed?.name === "string" ? parsed.name : null;

  return {
    ...item,
    type: refinedType || currentType || item?.type || null,
    name: refinedName || currentName || item?.name || null,
  };
}

async function checkIfPoloTop(image, item, { requestId = null } = {}) {
  const text = await chatCompletion([
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: image } },
        {
          type: "text",
          text: `Inspect the main top in this image and identify the front closure details.

Return ONLY valid JSON:
{
  "closure": "partial-placket" or "full-button-front" or "unclear",
  "collar": "soft-polo-collar" or "structured-shirt-collar" or "none" or "unclear",
  "isPolo": true or false,
  "name": "short natural polo name if isPolo is true, otherwise null"
}

Use isPolo=true only when the garment has polo-style features:
- a soft fold-down collar
- a short partial placket near the neck
- not a full button-up front extending to the hem

Use isPolo=false for full button-up shirts, blouses, camp shirts, tunics, or dress shirts.
Ignore the current guessed label and judge only from visible garment features.
Return JSON only.`,
        },
      ],
    },
  ], { maxTokens: 90, compactJsonRetry: true, requestId, traceLabel: "analyze-check-polo" });

  const parsed = parseModelJson(text);
  return {
    isPolo: parsed?.isPolo === true,
    name: typeof parsed?.name === "string" ? parsed.name : null,
  };
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
  if (directCatalogEntry && directCatalogEntry.slot === slot && isUsableStockImageCatalogEntry(directCatalogEntry)) {
    return humanizeCatalogKey(preferredKey && STOCK_IMAGE_CATALOG[preferredKey]?.slot === slot ? preferredKey : cleaned, directCatalogEntry);
  }

  const catalogMatch = getUsableStockImageCatalogEntries().find(([key, entry]) =>
    entry.slot === slot && (
      normalizeMatchText(key) === normalized ||
      normalizeMatchText(entry.path) === normalized
    ));

  if (catalogMatch) {
    return humanizeCatalogKey(catalogMatch[0], catalogMatch[1]);
  }

  if (/\.(png|jpe?g|webp|svg)\b/i.test(cleaned) || cleaned.includes("assets/recommendation-stock/")) {
    const fallbackEntry = preferredKey && STOCK_IMAGE_CATALOG[preferredKey]?.slot === slot && isUsableStockImageCatalogEntry(STOCK_IMAGE_CATALOG[preferredKey])
      ? STOCK_IMAGE_CATALOG[preferredKey]
      : null;
    return humanizeCatalogKey(preferredKey, fallbackEntry);
  }

  return cleaned;
}

function normalizeRecommendationResponse(parsed) {
  const outfit = {
    top: sanitizeOutfitSlotText(parsed?.outfit?.top, "top") || "A comfortable top suited to the current temperature",
    bottom: sanitizeOutfitSlotText(parsed?.outfit?.bottom, "bottom") || "Comfortable bottoms for today's conditions",
    outer: sanitizeOutfitSlotText(parsed?.outfit?.outer, "outer") || null,
    shoes: sanitizeOutfitSlotText(parsed?.outfit?.shoes, "shoes") || "Comfortable everyday shoes",
    accessories: normalizeList(parsed?.outfit?.accessories, { limit: 1 })
      .map((value) => sanitizeOutfitSlotText(value, "accessory"))
      .filter(Boolean),
  };
  const slotReasons = {
    top: clampSentenceCount(parsed?.slotReasons?.top, 1),
    bottom: clampSentenceCount(parsed?.slotReasons?.bottom, 1),
    outer: clampSentenceCount(parsed?.slotReasons?.outer, 1),
    shoes: clampSentenceCount(parsed?.slotReasons?.shoes, 1),
    accessory: clampSentenceCount(parsed?.slotReasons?.accessory, 1),
  };
  const itemDetails = normalizeRecommendationItemDetails(parsed?.itemDetails);
  return {
    outfit,
    outfitImages: buildRecommendationImageMatches(outfit, null, { itemDetails }),
    slotReasons,
    itemDetails,
    reasoning: clampSentenceCount(parsed?.reasoning, 1),
    detailsOverview: normalizeDetailsOverview(parsed?.detailsOverview),
    warnings: normalizeList(parsed?.warnings, { limit: 1 }),
    missingItems: normalizeList(parsed?.missingItems, { limit: 1 }),
    outlook: normalizeOutlook(parsed?.outlook),
  };
}

function normalizeOutlook(raw) {
  if (!raw || typeof raw !== "object") return null;
  const headline = clampSentenceCount(cleanInlineText(raw.headline), 1).slice(0, 120);
  const rawWindows = raw.windows && typeof raw.windows === "object" ? raw.windows : {};
  const windows = {};
  const pickCopy = (entry) => {
    if (entry == null) return "";
    if (typeof entry === "string") return entry;
    if (typeof entry !== "object") return "";
    if (typeof entry.copy === "string") return entry.copy;
    if (typeof entry.text === "string") return entry.text;
    if (typeof entry.description === "string") return entry.description;
    if (typeof entry.summary === "string") return entry.summary;
    return "";
  };
  for (const key of ["now", "later", "evening"]) {
    const titleKey = key.charAt(0).toUpperCase() + key.slice(1);
    const entry = rawWindows[key] ?? rawWindows[titleKey];
    const copy = clampSentenceCount(cleanInlineText(pickCopy(entry)), 2).slice(0, 260);
    if (copy) windows[key] = { copy };
  }
  if (!headline && !Object.keys(windows).length) return null;
  return { headline: headline || null, windows };
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

function ensureRecommendationShape(response, weather = {}, preferences = {}, wardrobeAnalysis = null) {
  const outfit = response?.outfit && typeof response.outfit === "object" ? { ...response.outfit } : {};
  outfit.top = cleanInlineText(outfit.top) || "Comfortable Top";
  outfit.bottom = cleanInlineText(outfit.bottom) || "Everyday Trousers";
  outfit.outer = cleanInlineText(outfit.outer) || "";
  outfit.shoes = cleanInlineText(outfit.shoes) || "Sneakers";
  const accessory = cleanInlineText(Array.isArray(outfit.accessories) ? outfit.accessories[0] : outfit.accessories) || pickAlwaysOnAccessory(weather);
  outfit.accessories = [accessory];

  const slotReasons = {
    ...(response?.slotReasons || {}),
    top: cleanInlineText(response?.slotReasons?.top) || "Builds the base of the outfit for today's temperature.",
    bottom: cleanInlineText(response?.slotReasons?.bottom) || "Keeps the look practical and balanced through the day.",
    outer: cleanInlineText(response?.slotReasons?.outer) || "",
    shoes: cleanInlineText(response?.slotReasons?.shoes) || "Keeps the outfit grounded for all-day wear.",
    accessory: cleanInlineText(response?.slotReasons?.accessory) || "Finishes the outfit with a useful extra.",
  };

  const itemDetails = normalizeRecommendationItemDetails(response?.itemDetails);

  return {
    ...response,
    outfit,
    slotReasons,
    itemDetails,
    outfitImages: buildRecommendationImageMatches(outfit, null, {
      weather,
      preferences,
      profileBand: deriveRecommendationProfileBand(preferences, weather),
      itemDetails,
    }),
    weatherProfile: classifyWeatherProfile(weather),
    wardrobeAnalysis: wardrobeAnalysis || response?.wardrobeAnalysis || null,
    quality: response?.quality || validateRecommendationQuality({ ...response, outfit, slotReasons, itemDetails }, weather, preferences),
  };
}

function hasCompleteItemDetails(itemDetails, outfit) {
  const slots = ["top", "bottom", "shoes"];
  if (cleanInlineText(outfit?.outer)) slots.push("outer");
  if (cleanInlineText(Array.isArray(outfit?.accessories) ? outfit.accessories[0] : outfit?.accessories)) slots.push("accessory");
  return slots.every((slot) => {
    const details = itemDetails?.[slot];
    return cleanInlineText(details?.color) && cleanInlineText(details?.material);
  });
}

function buildFallbackItemDetails(outfit = {}) {
  const inferDetails = (text, slot) => {
    const lower = cleanInlineText(text).toLowerCase();
    const color =
      /\bblack\b/.test(lower) ? "Black" :
      /\bwhite\b/.test(lower) ? "White" :
      /\bblue\b/.test(lower) ? "Blue" :
      /\bgray|grey|charcoal\b/.test(lower) ? "Grey" :
      /\bbrown\b/.test(lower) ? "Brown" :
      /\bgreen|olive\b/.test(lower) ? "Olive" :
      /\bred|burgundy|rust\b/.test(lower) ? "Rust red" :
      /\bbeige|tan|camel\b/.test(lower) ? "Tan" :
      slot === "accessory" ? "Weather-ready neutral" : "Easy neutral";
    const material =
      /\bfleece|sherpa\b/.test(lower) ? "Soft fleece" :
      /\bhoodie|sweater|knit|jumper|beanie|scarf\b/.test(lower) ? "Knit fabric" :
      /\bblazer|trouser|pants|chino|button-up|shirt|polo\b/.test(lower) ? "Structured woven fabric" :
      /\bjean|denim|shorts\b/.test(lower) ? "Denim or cotton twill" :
      /\blegging|running\b/.test(lower) ? "Stretch performance knit" :
      /\bwindbreaker|parka|waterproof|shell|jacket|coat|overshirt\b/.test(lower) ? "Technical outerwear fabric" :
      /\bsneaker\b/.test(lower) ? "Mesh and rubber" :
      /\bloafer|boot\b/.test(lower) ? "Leather or suede" :
      /\bumbrella\b/.test(lower) ? "Waterproof canopy fabric" :
      /\bglove\b/.test(lower) ? "Soft insulated fabric" :
      /\bwatch\b/.test(lower) ? "Metal and leather mix" :
      /\bsunglasses\b/.test(lower) ? "Tinted acetate and metal" :
      /\bcap|hat\b/.test(lower) ? "Cotton twill" :
      "Versatile everyday fabric";
    return { color, material };
  };

  const accessory = cleanInlineText(Array.isArray(outfit.accessories) ? outfit.accessories[0] : outfit.accessories);
  return {
    top: inferDetails(outfit.top, "top"),
    bottom: inferDetails(outfit.bottom, "bottom"),
    outer: outfit.outer ? inferDetails(outfit.outer, "outer") : { color: "", material: "" },
    shoes: inferDetails(outfit.shoes, "shoes"),
    accessory: accessory ? inferDetails(accessory, "accessory") : { color: "", material: "" },
  };
}

function normalizeWardrobeSlot(type = "") {
  const key = cleanInlineText(type).toLowerCase();
  if (!key) return "";
  if (["top", "shirt", "t-shirt", "tee", "sweater", "polo"].includes(key)) return "top";
  if (["bottom", "pants", "trousers", "jeans", "shorts", "leggings", "joggers"].includes(key)) return "bottom";
  if (["outer", "outerwear", "jacket", "coat", "hoodie", "blazer", "overshirt", "parka"].includes(key)) return "outer";
  if (["shoes", "shoe", "sneakers", "boots", "loafers", "runners"].includes(key)) return "shoes";
  if (["accessory", "accessories", "scarf", "beanie", "hat", "gloves", "umbrella", "watch", "sunglasses", "cap", "baseball cap", "bag"].includes(key)) return "accessory";
  return key;
}

function normalizePreferenceProfile(preferences = {}) {
  const style = preferences?.styleFocus && preferences.styleFocus !== "auto"
    ? preferences.styleFocus
    : preferences?.formal
      ? "polished"
      : preferences?.sporty
        ? "sporty"
        : preferences?.streetwear
          ? "streetwear"
          : preferences?.minimalist
            ? "minimalist"
            : preferences?.casual
              ? "casual"
              : "casual";
  const activity = preferences?.activityContext || "everyday";
  const setting = preferences?.locationContext || "mixed";
  return { style, activity, setting };
}

function parseForecastNumber(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function toFiniteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getRecommendationWeatherEnvelope(weather = {}) {
  const remaining = weather?.remainingForecast || {};
  const currentFeels = toFiniteNumber(weather?.feelsLike, toFiniteNumber(weather?.temperature));
  const currentTemp = toFiniteNumber(weather?.temperature, currentFeels);
  const minFeelsLike = toFiniteNumber(
    remaining.minFeelsLike,
    parseForecastNumber(remaining.feelsLikeRange) ?? currentFeels,
  );
  const minTemp = toFiniteNumber(
    remaining.minTemp,
    parseForecastNumber(remaining.tempRange) ?? currentTemp,
  );
  const maxPrecipProb = Math.max(
    toFiniteNumber(weather?.precipProb, 0) ?? 0,
    toFiniteNumber(remaining.maxPrecipProbPct, parseForecastNumber(remaining.maxPrecipProb) ?? 0) ?? 0,
  );
  const maxWind = Math.max(
    toFiniteNumber(weather?.wind, 0) ?? 0,
    toFiniteNumber(weather?.gusts, 0) ?? 0,
    toFiniteNumber(remaining.maxWindKmh, parseForecastNumber(remaining.maxWind) ?? 0) ?? 0,
  );
  const drop = Number.isFinite(currentFeels) && Number.isFinite(minFeelsLike)
    ? +(currentFeels - minFeelsLike).toFixed(1)
    : 0;
  return {
    currentFeels,
    currentTemp,
    minFeelsLike,
    minTemp,
    maxPrecipProb,
    maxWind,
    drop,
    coldLater: Number.isFinite(minFeelsLike) && minFeelsLike <= 8,
    chillyLater: Number.isFinite(minFeelsLike) && minFeelsLike <= 12,
    moderateNow: Number.isFinite(currentFeels) && currentFeels >= 13 && currentFeels <= 21,
    sharpDrop: drop >= 5,
    wetLater: maxPrecipProb >= 45,
    windyLater: maxWind >= 24,
  };
}

function weatherForRecommendationScoring(weather = {}) {
  const envelope = getRecommendationWeatherEnvelope(weather);
  if (!Number.isFinite(envelope.minFeelsLike) || !Number.isFinite(envelope.currentFeels)) return weather;
  return {
    ...weather,
    feelsLike: Math.min(envelope.currentFeels, envelope.minFeelsLike),
    temperature: Math.min(envelope.currentTemp ?? envelope.currentFeels, envelope.minTemp ?? envelope.minFeelsLike),
    precipProb: envelope.maxPrecipProb,
    wind: Math.max(Number(weather?.wind ?? 0), envelope.maxWind),
  };
}

function classifyWeatherProfile(weather = {}) {
  const envelope = getRecommendationWeatherEnvelope(weather);
  const feelsLike = Number.isFinite(envelope.currentFeels) ? envelope.currentFeels : Number(weather?.temperature);
  const temperature = Number.isFinite(Number(weather?.temperature)) ? Number(weather.temperature) : feelsLike;
  const precipProb = Number(weather?.precipProb ?? 0);
  const precip = Number(weather?.precip ?? 0);
  const gusts = Number(weather?.gusts ?? weather?.wind ?? 0);
  const wind = Number(weather?.wind ?? 0);
  const uv = Number(weather?.uv ?? 0);
  const label = String(weather?.weatherLabel || "").toLowerCase();
  const remaining = weather?.remainingForecast || {};
  const laterRain = Math.max(precipProb, toFiniteNumber(remaining.maxPrecipProbPct, parseForecastNumber(remaining.maxPrecipProb) ?? 0) ?? 0);
  const wetLabel = /rain|drizzle|storm|thunder|snow|sleet|freezing/.test(label);
  const wet = precip > 0 || precipProb >= 45 || wetLabel;
  const rainLikelyLater = laterRain >= 45 || wet;
  return {
    temperature,
    feelsLike,
    hot: Number.isFinite(feelsLike) && feelsLike >= 30,
    veryHot: Number.isFinite(feelsLike) && feelsLike >= 35,
    warm: Number.isFinite(feelsLike) && feelsLike >= 24,
    cold: (Number.isFinite(feelsLike) && feelsLike <= 8) || envelope.coldLater,
    veryCold: (Number.isFinite(feelsLike) && feelsLike <= 0) || (Number.isFinite(envelope.minFeelsLike) && envelope.minFeelsLike <= 2),
    wet,
    rainLikelyLater,
    dry: !rainLikelyLater,
    windy: Math.max(wind, gusts) >= 30,
    highUv: uv >= 6,
    precipProb,
    precip,
    wind,
    gusts,
    uv,
    label,
  };
}

function getOutfitText(response = {}) {
  const outfit = response?.outfit || {};
  const accessories = Array.isArray(outfit.accessories) ? outfit.accessories : [outfit.accessories];
  const details = response?.itemDetails || {};
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
    response?.reasoning,
    response?.slotReasons?.top,
    response?.slotReasons?.bottom,
    response?.slotReasons?.outer,
    response?.slotReasons?.shoes,
    response?.slotReasons?.accessory,
  ].filter(Boolean).join(" ").toLowerCase();
}

function validateRecommendationQuality(response = {}, weather = {}, preferences = {}) {
  const profile = classifyWeatherProfile(weather);
  const envelope = getRecommendationWeatherEnvelope(weather);
  const outfit = response?.outfit || {};
  const top = cleanInlineText(outfit.top).toLowerCase();
  const bottom = cleanInlineText(outfit.bottom).toLowerCase();
  const outer = cleanInlineText(outfit.outer).toLowerCase();
  const shoes = cleanInlineText(outfit.shoes).toLowerCase();
  const accessory = cleanInlineText(Array.isArray(outfit.accessories) ? outfit.accessories[0] : outfit.accessories).toLowerCase();
  const details = response?.itemDetails || {};
  const itemText = [
    top,
    bottom,
    outer,
    shoes,
    accessory,
    details.top?.material,
    details.bottom?.material,
    details.outer?.material,
    details.shoes?.material,
    details.accessory?.material,
  ].filter(Boolean).join(" ").toLowerCase();
  const text = getOutfitText(response);
  const issues = [];
  const add = (severity, code, message) => issues.push({ severity, code, message });
  const realOuterPattern = /\b(coat|jacket|parka|puffer|insulated|shell|fleece|sherpa|windbreaker|raincoat|waterproof)\b/;
  const lightOuterPattern = /\b(overshirt|shacket|cardigan|shirt jacket)\b/;
  const warmTopPattern = /\b(sweater|jumper|hoodie|fleece|sherpa|thermal|heavy knit|chunky knit|wool|merino)\b/;
  const extremeCold = (Number.isFinite(profile.feelsLike) && profile.feelsLike <= -5)
    || (Number.isFinite(envelope.minFeelsLike) && envelope.minFeelsLike <= -5);
  const arcticTopPattern = /\b(thermal|base layer|wool|merino|fleece|sherpa|insulated|down|sweater|jumper|hoodie|heavy knit|chunky knit)\b/;
  const arcticBottomPattern = /\b(thermal|insulated|fleece[-\s]?lined|lined|wool|snow pants?|ski pants?|shell pants?|waterproof pants?)\b/;
  const arcticOuterPattern = /\b(parka|puffer|down|insulated|winter coat|heavy coat|expedition|ski jacket|snow jacket|wool overcoat)\b/;
  const arcticBootPattern = /\b(winter boots?|snow boots?|insulated boots?|waterproof boots?|hiking boots?|thermal boots?)\b/;

  if (profile.hot && /\b(wool|merino|thermal|fleece|sherpa|insulated|winter|parka|overcoat|heavy coat|beanie|glove)\b/.test(itemText)) {
    add("severe", "hot_heavy_material", "Hot weather outfit contains heavy cold-weather materials or accessories.");
  }
  if (profile.veryHot && /\b(sweater|jumper|crewneck|hoodie|overshirt|jacket|coat|blazer|shacket|long-sleeve|long sleeve)\b/.test(`${top} ${outer}`)) {
    add("severe", "very_hot_layering", "Very hot weather outfit adds unnecessary upper-body layering.");
  } else if (profile.hot && outer && !profile.wet && !profile.windy && !/carry|optional|air[- ]?condition|ac\b/.test(text)) {
    add("warning", "hot_outer_layer", "Hot dry weather includes an outer layer without a clear reason.");
  }
  if (profile.dry && !profile.veryCold && /\b(umbrella|rain jacket|raincoat|waterproof parka)\b/.test(`${outer} ${accessory}`)) {
    add("severe", "dry_rain_gear", "Dry weather outfit includes rain gear without rain risk.");
  }
  if ((profile.wet || profile.rainLikelyLater) && !/\b(rain|waterproof|water-resistant|shell|umbrella|weatherproof)\b/.test(text)) {
    add("warning", "wet_missing_protection", "Wet weather outfit lacks clear rain protection.");
  }
  if (profile.cold && /\b(shorts|tank|sleeveless|sandals)\b/.test(`${top} ${bottom} ${shoes}`)) {
    add("severe", "cold_exposed", "Cold weather outfit exposes too much skin.");
  }
  if (profile.cold && !/\b(coat|jacket|parka|sweater|thermal|knit|hoodie|boot|beanie|scarf|glove)\b/.test(text)) {
    add("warning", "cold_missing_warmth", "Cold weather outfit lacks obvious warmth.");
  }
  if (extremeCold && !arcticTopPattern.test(`${top} ${details.top?.material || ""}`)) {
    add("severe", "arctic_top_too_light", "Extreme cold requires a thermal, wool, fleece, or similarly insulating top layer.");
  }
  if (extremeCold && !arcticBottomPattern.test(`${bottom} ${details.bottom?.material || ""}`)) {
    add("severe", "arctic_bottom_too_light", "Extreme cold requires insulated, lined, wool, shell, or snow-ready bottoms; regular jeans are not enough.");
  }
  if (extremeCold && !arcticOuterPattern.test(`${outer} ${details.outer?.material || ""}`)) {
    add("severe", "arctic_outer_too_light", "Extreme cold requires a substantial winter outer layer, not a fleece or light jacket as the only outerwear.");
  }
  if (extremeCold && !arcticBootPattern.test(`${shoes} ${details.shoes?.material || ""}`)) {
    add("severe", "arctic_shoes_too_light", "Extreme cold requires insulated or winter boots; sneakers are not enough even if waterproof.");
  }
  if (extremeCold && !/\b(gloves?|mittens?)\b/.test(`${accessory} ${details.accessory?.material || ""} ${text}`)) {
    add("warning", "arctic_missing_hand_protection", "Extreme cold should include gloves or mittens.");
  }
  if ((envelope.coldLater || (envelope.chillyLater && envelope.sharpDrop)) && outer && !realOuterPattern.test(outer)) {
    add("severe", "later_cold_outer_too_light", "The rest of today gets cold enough that an overshirt or styling layer is not enough outerwear.");
  }
  if ((envelope.coldLater || (envelope.chillyLater && envelope.sharpDrop)) && !outer) {
    add("severe", "later_cold_missing_outer", "The rest of today gets cold enough to require a real outer layer.");
  }
  if (envelope.moderateNow && !envelope.wetLater && !envelope.windyLater && warmTopPattern.test(top) && lightOuterPattern.test(outer)) {
    add("warning", "moderate_now_overlayered", "Moderate dry conditions do not need both a warm knit and an overshirt unless a colder later window is handled by real outerwear.");
  }
  if ((preferences?.activityContext === "office" || preferences?.styleFocus === "polished" || preferences?.formal) && /\b(running shorts|leggings|tank|graphic tee|hoodie|sandals)\b/.test(itemText)) {
    add("severe", "office_too_casual", "Office/polished outfit is too casual or athletic.");
  }
  if ((preferences?.activityContext === "workout" || preferences?.styleFocus === "sporty" || preferences?.sporty) && /\b(loafer|dress shoe|blazer|wool trouser|slack)\b/.test(itemText)) {
    add("warning", "workout_too_formal", "Sporty/workout outfit includes formal pieces.");
  }
  if (outfitConflictsWithPresentation(response, preferences)) {
    add("severe", "presentation_mismatch", `Outfit conflicts with the user's ${presentationPreferenceLabel(preferences)} presentation preference.`);
  }
  if (profile.highUv && (preferences?.locationContext === "outdoors" || preferences?.locationContext === "exposed") && !/\b(sunglasses|cap|hat|sun|uv|sunscreen)\b/.test(text)) {
    add("warning", "uv_missing_guidance", "High-UV outdoor outfit lacks sun guidance.");
  }

  return {
    ok: !issues.some((issue) => issue.severity === "severe"),
    severeCount: issues.filter((issue) => issue.severity === "severe").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    issues,
    profile,
  };
}

function buildRecommendationTrustSignals(response = {}, weather = {}, preferences = {}, wardrobeAnalysis = {}) {
  const profile = classifyWeatherProfile(weather);
  const signals = [];
  if (profile.veryHot) signals.push("Very hot: skipped heavy layers");
  else if (profile.hot) signals.push("Hot-weather lightness check");
  else if (profile.veryCold) signals.push("Extreme-cold insulation check");
  else if (profile.cold) signals.push("Cold-weather warmth check");
  if (profile.wet || profile.rainLikelyLater) signals.push("Rain protection considered");
  else signals.push("Dry-weather gear check");
  if (profile.windy) signals.push("Wind protection considered");
  if (profile.highUv) signals.push("UV protection considered");
  if (wardrobeAnalysis.usedCount > 0) signals.push(`${wardrobeAnalysis.usedCount} wardrobe piece${wardrobeAnalysis.usedCount === 1 ? "" : "s"} used`);
  if (preferences?.hot) signals.push("Tuned lighter for you");
  if (preferences?.cold) signals.push("Tuned warmer for you");
  return Array.from(new Set(signals)).slice(0, 4);
}

function deriveRecommendationProfileBand(preferences = {}, weather = {}) {
  const { style, activity, setting } = normalizePreferenceProfile(preferences);
  const scoringWeather = weatherForRecommendationScoring(weather);
  const feelsLike = Number.isFinite(Number(scoringWeather?.feelsLike))
    ? Number(scoringWeather.feelsLike)
    : Number(scoringWeather?.temperature);
  const hot = preferences?.hot || feelsLike >= 26;
  const cold = preferences?.cold || feelsLike <= 10;
  const wet = Number(scoringWeather?.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow|freezing/i.test(String(weather?.weatherLabel || ""));
  if (isSafetyDominantWeather(weather)) return "weather-led";
  if (activity === "office" || setting === "event" || style === "polished") return "office";
  if (activity === "workout" || style === "sporty") return "sporty";
  if (hot && (activity === "evening" || setting === "event")) return "hot-evening";
  if (cold || wet) return "weather-led";
  if (style === "minimalist") return "minimal";
  if (style === "streetwear") return "streetwear";
  return "casual";
}

function isSafetyDominantWeather(weather = {}) {
  const profile = classifyWeatherProfile(weather);
  return Boolean(profile.veryCold || profile.veryHot || profile.wet || profile.rainLikelyLater || profile.windy);
}

function safetyDominantWeatherReason(weather = {}) {
  const profile = classifyWeatherProfile(weather);
  if (profile.veryCold) return "extreme cold";
  if (profile.veryHot) return "very hot";
  if (profile.wet || profile.rainLikelyLater) return "wet weather";
  if (profile.windy) return "wind exposure";
  return "";
}

function hashString(value = "") {
  let hash = 0;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildArchetypeOptions(profileBand, preferences = {}, weather = {}) {
  const hot = preferences?.hot || Number(weather?.feelsLike ?? weather?.temperature) >= 26;
  const cold = preferences?.cold || Number(weather?.feelsLike ?? weather?.temperature) <= 10;
  const wet = Number(weather?.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow|freezing/i.test(String(weather?.weatherLabel || ""));
  const windy = Number(weather?.wind ?? 0) >= 24;
  const options = {
    office: [
      {
        name: "smart tailoring",
        top: "oxford shirt or crisp collared shirt",
        bottom: "tailored trousers",
        outer: wet ? "weather-smart shell with clean lines" : "lightweight blazer",
        shoes: "leather loafers or polished smart shoes",
        accessory: "watch or refined scarf",
        avoid: "t-shirt, cap, sporty runners",
        keywords: {
          top: ["oxford", "collared", "button-up", "button up", "shirt"],
          bottom: ["tailored", "trouser", "pleated"],
          outer: wet ? ["shell", "rain", "mac", "coat"] : ["blazer", "tailored jacket"],
          shoes: ["loafer", "derby", "dress", "leather"],
          accessory: ["watch", "scarf", "umbrella"],
        },
      },
      {
        name: "knit polo office casual",
        top: "refined knit polo or fine-gauge knit",
        bottom: "clean chinos",
        outer: "minimal overshirt or none",
        shoes: "minimal leather sneakers or loafers",
        accessory: "understated watch",
        avoid: "graphic tee, baseball cap, cargo bottoms",
        keywords: {
          top: ["knit polo", "polo", "fine-gauge", "merino", "knit"],
          bottom: ["chino", "clean trouser"],
          outer: ["overshirt", "none"],
          shoes: ["minimal sneaker", "leather sneaker", "loafer"],
          accessory: ["watch"],
        },
      },
      {
        name: "commuter polish",
        top: "fine merino crewneck or polished knit",
        bottom: "structured wool trousers",
        outer: wet || cold ? "refined shell or tailored coat" : "tailored overshirt",
        shoes: "derby shoes or leather sneakers",
        accessory: "compact umbrella or subtle scarf",
        avoid: "athletic tank, obvious gym pieces",
        keywords: {
          top: ["merino", "crewneck", "polished knit", "fine knit"],
          bottom: ["wool trouser", "structured trouser", "trouser"],
          outer: wet || cold ? ["tailored coat", "refined shell", "mac", "coat"] : ["tailored overshirt", "overshirt"],
          shoes: ["derby", "leather sneaker", "leather shoe"],
          accessory: ["umbrella", "scarf"],
        },
      },
      {
        name: "soft tailoring",
        top: "open-collar woven shirt",
        bottom: "pleated tapered trousers",
        outer: "clean bomber or overshirt",
        shoes: "loafers",
        accessory: "watch",
        avoid: "hoodie, sport cap, trail shoes",
        keywords: {
          top: ["open-collar", "woven shirt", "camp collar", "shirt"],
          bottom: ["pleated", "tapered trouser", "trouser"],
          outer: ["bomber", "overshirt"],
          shoes: ["loafer"],
          accessory: ["watch"],
        },
      },
    ],
    sporty: [
      {
        name: "run-ready",
        top: "performance tee or athletic tank",
        bottom: hot ? "running shorts" : "light tech shorts",
        outer: windy || wet ? "lightweight windbreaker" : "no outer",
        shoes: "runners or trail runners",
        accessory: "sports cap",
        avoid: "loafers, blazer, tailored trousers",
        keywords: {
          top: ["performance tee", "athletic tank", "running tee", "training tee"],
          bottom: ["running short", "tech short"],
          outer: windy || wet ? ["windbreaker", "shell"] : ["none"],
          shoes: ["runner", "trail runner", "trainer"],
          accessory: ["sports cap", "cap"],
        },
      },
      {
        name: "athleisure commuter",
        top: "performance quarter-zip or fitted training tee",
        bottom: "tech joggers",
        outer: "track jacket",
        shoes: "running shoes",
        accessory: "sports watch",
        avoid: "office shirt, leather shoes",
        keywords: {
          top: ["quarter-zip", "quarter zip", "training tee", "performance tee"],
          bottom: ["tech jogger", "jogger"],
          outer: ["track jacket"],
          shoes: ["running shoe", "trainer", "runner"],
          accessory: ["watch"],
        },
      },
      {
        name: "cool-weather training",
        top: "long-sleeve performance top",
        bottom: "running leggings or warm training pants",
        outer: "light technical jacket or shell",
        shoes: "grip runners",
        accessory: "beanie or sports cap",
        avoid: "cotton chinos, dressy pieces",
        keywords: {
          top: ["long-sleeve performance", "thermal performance", "compression", "performance top"],
          bottom: ["legging", "training pant", "warm jogger"],
          outer: ["technical jacket", "shell"],
          shoes: ["grip runner", "runner", "trail runner"],
          accessory: ["beanie", "sports cap", "cap"],
        },
      },
      {
        name: "court-sport casual",
        top: "performance polo or clean training tee",
        bottom: "sport shorts",
        outer: "packable shell or no outer",
        shoes: "court-style trainers",
        accessory: "light cap",
        avoid: "formal blazer, office loafers",
        keywords: {
          top: ["performance polo", "training tee", "court tee"],
          bottom: ["sport short", "training short"],
          outer: ["packable shell", "none"],
          shoes: ["court trainer", "trainer"],
          accessory: ["cap"],
        },
      },
    ],
    "hot-evening": [
      {
        name: "elevated warm-evening",
        top: "airy shirt or linen shirt",
        bottom: "lightweight chinos or tailored shorts",
        outer: "no outer",
        shoes: "clean sneakers or loafers",
        accessory: "watch or refined small accessory",
        avoid: "basic white tee with cap if a dressier option works",
      },
      {
        name: "relaxed city evening",
        top: "breathable open-collar top",
        bottom: "soft lightweight trousers",
        outer: "no outer",
        shoes: "minimal sneakers",
        accessory: "subtle watch",
        avoid: "winter layers, sporty cap-heavy look",
      },
      {
        name: "dressy summer night",
        top: "lightweight woven shirt",
        bottom: "tapered light trousers",
        outer: "no outer unless breeze truly requires it",
        shoes: "sharp loafers or refined sneakers",
        accessory: "evening-friendly accessory",
        avoid: "plain daytime casual formula",
      },
      {
        name: "summer social minimal",
        top: "refined knit tee or knit polo",
        bottom: "easy tapered chinos",
        outer: "none",
        shoes: "sleek low-profile sneakers",
        accessory: "watch",
        avoid: "baseball cap, technical runners",
      },
    ],
    "weather-led": [
      {
        name: "weather shield",
        top: wet ? "long-sleeve base" : "warmer knit or long-sleeve top",
        bottom: wet ? "water-resistant tapered trousers" : "practical trousers",
        outer: wet ? "waterproof shell" : "protective outer if needed",
        shoes: wet ? "waterproof sneakers" : "grippy shoes",
        accessory: wet ? "umbrella" : "weather-aware accessory",
        avoid: "delicate or overly airy pieces",
        keywords: {
          top: ["long-sleeve", "base", "knit"],
          bottom: wet ? ["water-resistant trouser", "tapered trouser", "technical trouser"] : ["practical trouser", "trouser"],
          outer: wet ? ["waterproof shell", "rain jacket", "shell"] : ["jacket", "shell", "coat"],
          shoes: wet ? ["waterproof sneaker", "weatherproof sneaker"] : ["grippy shoe", "boot", "sneaker"],
          accessory: wet ? ["umbrella"] : ["watch", "scarf", "cap"],
        },
      },
      {
        name: "cold-city protection",
        top: cold ? "thermal or knit base" : "light knit",
        bottom: cold ? "insulating bottoms" : "durable bottoms",
        outer: cold ? "protective outer or winter coat" : "wind layer",
        shoes: cold ? "boots" : "grounded sneakers",
        accessory: cold ? "warm accessory" : "practical accessory",
        avoid: "shorts, tanks",
        keywords: {
          top: cold ? ["thermal", "knit", "fleece", "long-sleeve"] : ["light knit", "long-sleeve"],
          bottom: cold ? ["insulating pant", "wool trouser", "jean"] : ["durable trouser", "jean"],
          outer: cold ? ["winter coat", "coat", "parka", "jacket"] : ["wind layer", "shell", "jacket"],
          shoes: cold ? ["boot"] : ["grounded sneaker", "sneaker"],
          accessory: cold ? ["scarf", "beanie", "gloves"] : ["umbrella", "watch", "cap"],
        },
      },
      {
        name: "transit utility",
        top: "overshirt base or textured long-sleeve",
        bottom: "dark jeans or utility trousers",
        outer: "hooded shell or overshirt",
        shoes: "rubber-soled boots or grounded sneakers",
        accessory: "compact umbrella or cap",
        avoid: "flimsy layers",
        keywords: {
          top: ["overshirt base", "textured long-sleeve", "long-sleeve", "overshirt"],
          bottom: ["dark jean", "utility trouser", "jean"],
          outer: ["hooded shell", "overshirt", "shell"],
          shoes: ["boot", "grounded sneaker", "rubber-soled"],
          accessory: ["umbrella", "cap"],
        },
      },
    ],
    minimal: [
      {
        name: "monochrome gallery",
        top: "clean knit tee",
        bottom: "cropped streamlined trousers",
        outer: "none",
        shoes: "minimal leather sneakers",
        accessory: "slim watch",
        avoid: "busy graphics, statement layers",
        keywords: {
          top: ["knit tee", "clean tee", "fine-gauge tee"],
          bottom: ["cropped trouser", "streamlined trouser", "cropped"],
          outer: ["none"],
          shoes: ["minimal leather sneaker", "minimal sneaker", "low-profile sneaker"],
          accessory: ["watch"],
        },
      },
      {
        name: "quiet luxury light",
        top: "refined poplin shirt",
        bottom: "clean chinos",
        outer: "none",
        shoes: "soft loafers",
        accessory: "pared-back watch",
        avoid: "sport cap, loud sneakers",
        keywords: {
          top: ["poplin", "crisp shirt", "shirt"],
          bottom: ["chino"],
          outer: ["none"],
          shoes: ["loafer"],
          accessory: ["watch"],
        },
      },
      {
        name: "tonal overshirt set",
        top: "fine-gauge knit polo",
        bottom: "sleek tonal trousers",
        outer: "ultra-clean overshirt",
        shoes: "quiet low-profile sneakers",
        accessory: "slim sunglasses",
        avoid: "extra layers with no purpose",
        keywords: {
          top: ["knit polo", "fine-gauge knit", "polo"],
          bottom: ["sleek trouser", "tonal trouser"],
          outer: ["overshirt"],
          shoes: ["low-profile sneaker", "minimal sneaker"],
          accessory: ["sunglasses"],
        },
      },
      {
        name: "soft studio minimal",
        top: "light merino crewneck",
        bottom: "drawstring tailored trousers",
        outer: "none",
        shoes: "slip-on loafers",
        accessory: "structured tote",
        avoid: "heavy layers, bright logos",
        keywords: {
          top: ["merino", "crewneck"],
          bottom: ["drawstring trouser", "tailored trouser"],
          outer: ["none"],
          shoes: ["slip-on loafer", "loafer", "slip on"],
          accessory: ["tote", "bag"],
        },
      },
    ],
    streetwear: [
      {
        name: "streetwear layered",
        top: "graphic or styled top",
        bottom: "relaxed trousers",
        outer: "statement light outer",
        shoes: "standout sneakers",
        accessory: "cap or bag",
        avoid: "overly formal office styling",
      },
      {
        name: "clean streetwear",
        top: "oversized top",
        bottom: "technical pants",
        outer: "sleek shell or overshirt",
        shoes: "retro sneakers",
        accessory: "urban accessory",
        avoid: "plain business casual formula",
      },
      {
        name: "city utility",
        top: "boxy tee or textured long-sleeve",
        bottom: "utility trousers",
        outer: "light shell",
        shoes: "chunky or retro runners",
        accessory: "crossbody or cap",
        avoid: "loafers, tailored blazer",
      },
    ],
    casual: [
      {
        name: "everyday casual",
        top: "easy tee or shirt",
        bottom: "comfortable trousers or jeans",
        outer: "light layer only if justified",
        shoes: "versatile sneakers",
        accessory: "simple accessory",
        avoid: "overbuilt layering",
      },
      {
        name: "smart relaxed",
        top: "long-sleeve top or woven shirt",
        bottom: "chinos",
        outer: "minimal layer",
        shoes: "clean shoes",
        accessory: "practical accessory",
        avoid: "overly sporty details",
      },
      {
        name: "weekend utility",
        top: "soft knit or easy overshirt base",
        bottom: "durable jeans or casual trousers",
        outer: "overshirt or shell if needed",
        shoes: "easy everyday sneakers",
        accessory: "watch or cap",
        avoid: "formal office cues",
      },
    ],
  }[profileBand] || [];
  return options.slice(0, 4);
}

function keywordsMatchText(text = "", keywords = []) {
  const normalized = cleanInlineText(text).toLowerCase();
  return keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
}

function buildArchetypeDirective(profileBand, location, preferences = {}, weather = {}) {
  const options = buildArchetypeOptions(profileBand, preferences, weather);
  if (!options.length) return { text: "- No archetype guidance.", profileBand, variantIndex: 0 };
  const safetyDominant = isSafetyDominantWeather(weather);
  const safetyReason = safetyDominantWeatherReason(weather);
  const seed = [
    location?.name || "",
    Math.round(Number(weather?.temperature) || 0),
    Math.round(Number(weather?.feelsLike) || 0),
    weather?.weatherLabel || "",
    preferences?.activityContext || "",
    preferences?.locationContext || "",
    preferences?.styleFocus || "",
    preferences?.cold ? "cold" : "",
    preferences?.hot ? "hot" : "",
  ].join("|");
  const variantIndex = hashString(seed) % options.length;
  const preferred = options[variantIndex];
  const lines = options.map((option, index) => `${index + 1}. ${option.name}: top ${option.top}; bottom ${option.bottom}; outer ${option.outer}; shoes ${option.shoes}; accessory ${option.accessory}; avoid ${option.avoid}`);
  if (safetyDominant) {
    return {
      profileBand,
      variantIndex,
      preferred,
      options,
      safetyDominant: true,
      text: `- Archetype guidance is disabled for this request because ${safetyReason || "weather risk"} is safety-dominant.
- Choose weather-safe garment categories first. Use style tuning only through color, fit, and polish.`,
    };
  }
  return {
    profileBand,
    variantIndex,
    preferred,
    options,
    safetyDominant: false,
    text: `- Profile band: ${profileBand}
- Archetypes are light variety hints, not hard garment requirements:
${lines.join("\n")}
- Preferred archetype for this request: ${variantIndex + 1} (${preferred.name}).
- Soft slot steer for this request:
  top: ${preferred.top}
  bottom: ${preferred.bottom}
  outer: ${preferred.outer}
  shoes: ${preferred.shoes}
  accessory: ${preferred.accessory}
  avoid: ${preferred.avoid}
- Follow the preferred archetype only when it does not reduce weather, wardrobe, color, or presentation accuracy.`,
  };
}

function recommendationMissesArchetype(response, archetypeDirective, weather = {}) {
  if (archetypeDirective?.safetyDominant || isSafetyDominantWeather(weather)) return false;
  const preferred = archetypeDirective?.preferred;
  if (!preferred?.keywords) return false;
  const top = cleanInlineText(response?.outfit?.top).toLowerCase();
  const bottom = cleanInlineText(response?.outfit?.bottom).toLowerCase();
  const outer = cleanInlineText(response?.outfit?.outer).toLowerCase();
  const shoes = cleanInlineText(response?.outfit?.shoes).toLowerCase();
  const accessory = cleanInlineText(Array.isArray(response?.outfit?.accessories) ? response.outfit.accessories[0] : response?.outfit?.accessories).toLowerCase();
  const feelsLike = Number.isFinite(Number(weather?.feelsLike))
    ? Number(weather.feelsLike)
    : Number(weather?.temperature);
  const wetRisk = Number(weather?.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow|freezing/i.test(String(weather?.weatherLabel || ""));

  const slots = [
    ["top", top],
    ["bottom", bottom],
    ["outer", outer],
    ["shoes", shoes],
    ["accessory", accessory],
  ];

  let matches = 0;
  let relevantSlots = 0;
  for (const [slot, text] of slots) {
    const keywords = preferred.keywords?.[slot] || [];
    if (!keywords.length) continue;
    if (slot === "outer" && preferred.outer.includes("none") && !text) {
      matches += 1;
      relevantSlots += 1;
      continue;
    }
    if (slot === "outer" && !text && preferred.outer.includes("none")) continue;
    if (!text) {
      relevantSlots += 1;
      continue;
    }
    relevantSlots += 1;
    if (keywordsMatchText(text, keywords)) matches += 1;
  }

  const avoidMiss = preferred.avoid
    ? preferred.avoid.split(",").map((item) => item.trim()).filter(Boolean).some((token) => keywordsMatchText(`${top} ${bottom} ${outer} ${shoes} ${accessory}`, [token]))
    : false;

  if (avoidMiss) return true;
  if (preferred.outer.includes("none") && outer && !wetRisk && feelsLike >= 18) return true;
  return relevantSlots >= 4 ? matches < 3 : matches < 2;
}

function buildMinimalArchetypeOutfit(archetypeName = "") {
  switch (archetypeName) {
    case "monochrome gallery":
      return {
        top: "Knit tee",
        bottom: "Cropped trousers",
        outer: "",
        shoes: "Minimal leather sneakers",
        accessories: ["Slim watch"],
      };
    case "quiet luxury light":
      return {
        top: "Poplin shirt",
        bottom: "Clean chinos",
        outer: "",
        shoes: "Soft loafers",
        accessories: ["Pared-back watch"],
      };
    case "tonal overshirt set":
      return {
        top: "Knit polo",
        bottom: "Tonal trousers",
        outer: "Clean overshirt",
        shoes: "Low-profile sneakers",
        accessories: ["Slim sunglasses"],
      };
    case "soft studio minimal":
      return {
        top: "Merino crewneck",
        bottom: "Drawstring trousers",
        outer: "",
        shoes: "Slip-on loafers",
        accessories: ["Structured tote"],
      };
    default:
      return null;
  }
}

function enforceArchetypeShape(response, archetypeDirective, weather = {}) {
  if (!response || typeof response !== "object") return response;
  if (archetypeDirective?.safetyDominant || isSafetyDominantWeather(weather)) return response;
  const profileBand = archetypeDirective?.profileBand || "";
  const preferredName = archetypeDirective?.preferred?.name || "";
  if (profileBand !== "minimal") return response;
  const enforcedOutfit = buildMinimalArchetypeOutfit(preferredName);
  if (!enforcedOutfit) return response;
  if (!recommendationMissesArchetype(response, archetypeDirective, weather)) return response;
  return {
    ...response,
    outfit: enforcedOutfit,
  };
}

function buildStyleGuardrails(preferences = {}, weather = {}) {
  const { style, activity, setting } = normalizePreferenceProfile(preferences);
  const feelsLike = Number(weather?.feelsLike ?? weather?.temperature);
  const lines = [];
  if (activity === "office" || setting === "event" || style === "polished") {
    lines.push("- Office / polished looks must resist falling back to T-shirt + sneakers + cap unless every sharper alternative is clearly unsuitable for the weather.");
    lines.push("- Office / polished looks should favor collared shirts, refined knits, tailored trousers, loafers, and cleaner accessories.");
  }
  if (activity === "evening" || (style === "streetwear" && (preferences?.hot || feelsLike >= 24))) {
    lines.push("- Hot evening looks must not default to the same plain daytime casual outfit. Make them feel more intentional, social, or styled for later in the day.");
  }
  if (activity === "workout" || style === "sporty") {
    lines.push("- Sporty looks must use more than one performance template over time. Vary between run-ready, athleisure commuter, and cool-weather training archetypes when appropriate.");
  }
  if (style === "minimalist" || activity === "indoor" || setting === "indoors") {
    lines.push("- Minimal indoor looks must vary across clearly different minimalist silhouettes such as knit-tee with cropped trousers, poplin shirt with loafers, overshirt set, or merino with tote. Do not collapse them into the same tee-trousers-sneakers formula.");
  }
  return lines;
}

function wardrobeItemFitScore(item, preferences = {}, weather = {}) {
  const scoringWeather = weatherForRecommendationScoring(weather);
  const slot = normalizeWardrobeSlot(item?.type);
  const name = cleanInlineText(item?.name).toLowerCase();
  const color = cleanInlineText(item?.color).toLowerCase();
  const material = cleanInlineText(item?.material).toLowerCase();
  const text = `${name} ${color} ${material}`.trim();
  const profileBand = deriveRecommendationProfileBand(preferences, scoringWeather);
  const feelsLike = Number.isFinite(Number(scoringWeather?.feelsLike))
    ? Number(scoringWeather.feelsLike)
    : Number(scoringWeather?.temperature);
  const wet = Number(scoringWeather?.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow|freezing/i.test(String(weather?.weatherLabel || ""));
  const windy = Number(scoringWeather?.wind ?? 0) >= 24;
  let score = 0;

  if (!slot || !name) return -50;

  if (slot === "top") {
    if (feelsLike <= 10) score += /\b(thermal|long sleeve|long-sleeve|sweater|knit|hoodie)\b/.test(text) ? 4 : -3;
    if (feelsLike <= -5) score += /\b(thermal|base layer|wool|merino|fleece|sherpa|insulated|down|sweater|jumper|hoodie|heavy knit|chunky knit)\b/.test(text) ? 8 : -10;
    if (feelsLike >= 25) score += /\b(tank|tee|t-shirt|t shirt|linen)\b/.test(text) ? 4 : -2;
  }
  if (slot === "bottom") {
    if (feelsLike <= 10) score += /\b(fleece|wool|trouser|pants|jeans)\b/.test(text) ? 3 : -2;
    if (feelsLike <= -5) score += /\b(thermal|insulated|fleece[-\s]?lined|lined|wool|snow pants?|ski pants?|shell pants?|waterproof pants?)\b/.test(text) ? 8 : -10;
    if (feelsLike >= 26) score += /\b(shorts|lightweight|linen)\b/.test(text) ? 4 : 0;
  }
  if (slot === "outer") {
    if (wet || windy || feelsLike <= 14) score += /\b(shell|jacket|coat|parka|blazer|overshirt|hoodie|fleece|sherpa|windbreaker)\b/.test(text) ? 4 : -4;
    if (feelsLike <= 8) score += /\b(coat|jacket|parka|puffer|insulated|shell|fleece|sherpa|windbreaker|waterproof)\b/.test(text) ? 5 : /\b(overshirt|shacket|cardigan)\b/.test(text) ? -5 : 0;
    if (feelsLike <= -5) score += /\b(parka|puffer|down|insulated|winter coat|heavy coat|expedition|ski jacket|snow jacket|wool overcoat)\b/.test(text) ? 10 : -12;
    if (!wet && !windy && feelsLike >= 24) score += /\b(shell|jacket|coat|parka)\b/.test(text) ? -4 : 1;
  }
  if (slot === "shoes") {
    if (wet) score += /\b(boots?|waterproof|water-resistant|runners?|sneakers?)\b/.test(text) ? 3 : -2;
    if (feelsLike <= -5) score += /\b(winter boots?|snow boots?|insulated boots?|waterproof boots?|hiking boots?|thermal boots?)\b/.test(text) ? 10 : -12;
    if (profileBand === "sporty") score += /\b(runners?|running|sneakers?|trainers?)\b/.test(text) ? 4 : -3;
    if (profileBand === "office") score += /\b(loafers?|leather|dress)\b/.test(text) ? 4 : /\bsneakers?\b/.test(text) ? -3 : 0;
    if (["casual", "minimal", "streetwear", "weather-led", "hot-evening"].includes(profileBand)) {
      score += /\b(sneakers?|trainers?|runners?|boots?|loafers?|shoes?)\b/.test(text) ? 4 : 0;
    }
  }
  if (slot === "accessory") {
    if (wet) score += /\b(umbrella)\b/.test(text) ? 4 : 0;
    if (Number(weather?.uv ?? 0) >= 7) score += /\b(sunglass|cap|hat)\b/.test(text) ? 3 : 0;
    if (feelsLike <= 8) score += /\b(scarf|beanie|gloves)\b/.test(text) ? 3 : 0;
    if (feelsLike <= -5) score += /\b(gloves?|mittens?|scarf|balaclava|thermal beanie|wool beanie)\b/.test(text) ? 6 : -4;
  }

  if (profileBand === "office") {
    if (slot === "top") score += /\b(oxford|button|collar|shirt|knit)\b/.test(text) ? 5 : /\b(t-shirt|tee|tank|graphic)\b/.test(text) ? -6 : 0;
    if (slot === "bottom") score += /\b(trouser|chino|slack)\b/.test(text) ? 4 : /\b(cargo|legging|jogger|shorts)\b/.test(text) ? -6 : 0;
    if (slot === "accessory") score += /\b(cap|beanie)\b/.test(text) ? -6 : /\b(watch|scarf|umbrella)\b/.test(text) ? 2 : 0;
  }
  if (profileBand === "sporty") {
    if (slot === "top") score += /\b(performance|athletic|tank|tee)\b/.test(text) ? 5 : /\b(oxford|button|blouse)\b/.test(text) ? -5 : 0;
    if (slot === "bottom") score += /\b(jogger|shorts|legging)\b/.test(text) ? 5 : /\b(trouser|chino)\b/.test(text) ? -3 : 0;
    if (slot === "accessory") score += /\b(cap)\b/.test(text) ? 2 : /\b(scarf|watch)\b/.test(text) ? -1 : 0;
  }
  if (profileBand === "hot-evening") {
    if (slot === "top") score += /\b(linen|shirt|open|light)\b/.test(text) ? 4 : /\b(thermal|hoodie|sweater)\b/.test(text) ? -6 : 0;
    if (slot === "bottom") score += /\b(lightweight|chino|tailored|shorts)\b/.test(text) ? 3 : 0;
    if (slot === "outer") score += text ? -4 : 0;
    if (slot === "accessory") score += /\b(cap)\b/.test(text) ? -2 : /\b(watch)\b/.test(text) ? 2 : 0;
  }

  return score;
}

function filterWardrobeItemsForRecommendation(wardrobeItems = [], preferences = {}, weather = {}) {
  const scoringWeather = weatherForRecommendationScoring(weather);
  const scored = (Array.isArray(wardrobeItems) ? wardrobeItems : [])
    .map((item) => ({
      ...item,
      _slot: normalizeWardrobeSlot(item?.type),
      _fitScore: wardrobeItemFitScore(item, preferences, scoringWeather),
    }))
    .filter((item) => item._slot && item._fitScore >= 3)
    .sort((a, b) => b._fitScore - a._fitScore);

  const kept = [];
  const slotCounts = new Map();
  for (const item of scored) {
    const slot = item._slot;
    const count = slotCounts.get(slot) || 0;
    const limit = slot === "accessory" ? 2 : 3;
    if (count >= limit) continue;
    kept.push(item);
    slotCounts.set(slot, count + 1);
  }
  return kept;
}

function analyzeWardrobeCandidates(wardrobeItems = [], eligibleWardrobeItems = [], preferences = {}, weather = {}) {
  const eligibleIds = new Set((eligibleWardrobeItems || []).map((item) => String(item.id ?? item.name ?? "")));
  const scored = (Array.isArray(wardrobeItems) ? wardrobeItems : [])
    .map((item) => {
      const slot = normalizeWardrobeSlot(item?.type);
      const score = wardrobeItemFitScore(item, preferences, weather);
      const id = String(item?.id ?? item?.name ?? "");
      const status = eligibleIds.has(id) || score >= 3 ? "recommended" : "avoid_today";
      const reason = status === "recommended"
        ? "Fits today's weather, style direction, or useful outfit slot."
        : "Skipped because it is weaker for today's weather or vibe.";
      return {
        id: item?.id ?? null,
        name: cleanInlineText(item?.name),
        type: cleanInlineText(item?.type),
        slot,
        color: cleanInlineText(item?.color),
        material: cleanInlineText(item?.material),
        score,
        status,
        reason,
      };
    })
    .filter((item) => item.name);
  return {
    totalCount: scored.length,
    recommendedCount: scored.filter((item) => item.status === "recommended").length,
    avoidCount: scored.filter((item) => item.status === "avoid_today").length,
    candidates: scored.sort((a, b) => b.score - a.score),
  };
}

function detectWardrobeUsage(response = {}, wardrobeAnalysis = {}) {
  const text = getOutfitText(response);
  const used = (wardrobeAnalysis.candidates || [])
    .filter((item) => item.name && text.includes(item.name.toLowerCase()))
    .map((item) => ({
      id: item.id,
      name: item.name,
      slot: item.slot,
      score: item.score,
      status: item.status,
      reason: item.status === "recommended" ? "Used because it matched the outfit and today's context." : "Used despite a weaker fit; review recommended.",
    }));
  return {
    usedCount: used.length,
    used,
    skippedRecommended: (wardrobeAnalysis.candidates || [])
      .filter((item) => item.status === "recommended" && !used.some((match) => match.name === item.name))
      .slice(0, 5),
  };
}

function buildWardrobePenaltyRules(filteredWardrobe, originalWardrobe, preferences = {}, weather = {}) {
  const eligibleCount = Array.isArray(filteredWardrobe) ? filteredWardrobe.length : 0;
  const totalCount = Array.isArray(originalWardrobe) ? originalWardrobe.length : 0;
  const profileBand = deriveRecommendationProfileBand(preferences, weather);
  const lines = [];
  lines.push(`- Only ${eligibleCount} of ${totalCount} wardrobe items are a good fit for this weather and vibe. Do not force the rest.`);
  if (profileBand === "office") {
    lines.push("- If wardrobe pieces make the look less polished or too casual, prefer generic office-appropriate suggestions.");
  }
  if (profileBand === "sporty") {
    lines.push("- If wardrobe pieces weaken the athletic/performance feel, prefer generic sporty pieces instead.");
  }
  if (profileBand === "hot-evening") {
    lines.push("- If wardrobe pieces make the outfit feel like generic daytime casual, prefer a more intentional warm-evening suggestion.");
  }
  return lines;
}

function normalizeRecommendationPreferences(preferences = {}) {
  const source = preferences && typeof preferences === "object" ? preferences : {};
  const genderAliases = {
    men: "male",
    mens: "male",
    "men's": "male",
    man: "male",
    male: "male",
    women: "female",
    womens: "female",
    "women's": "female",
    woman: "female",
    female: "female",
    mixed: "nonbinary",
    unisex: "nonbinary",
    nonbinary: "nonbinary",
    "non-binary": "nonbinary",
    auto: "unspecified",
    skip: "unspecified",
    unspecified: "unspecified",
  };
  const rawGender = String(source.gender || "unspecified").toLowerCase().trim();
  const gender = genderAliases[rawGender] || rawGender;
  const allowedGender = new Set(["unspecified", "male", "female", "nonbinary"]);
  return {
    ...source,
    gender: allowedGender.has(gender) ? gender : "unspecified",
  };
}

function presentationPreferenceLabel(preferences = {}) {
  const value = String(preferences?.gender || "unspecified").toLowerCase();
  if (value === "male") return "menswear";
  if (value === "female") return "womenswear";
  if (value === "nonbinary") return "unisex / mixed";
  return "unspecified";
}

function buildPresentationDirective(preferences = {}) {
  const value = String(preferences?.gender || "unspecified").toLowerCase();
  switch (value) {
    case "male":
      return [
        "User wants menswear silhouettes.",
        "Lean toward: collared shirts, polos, tees, knit sweaters, hoodies, button-ups; tailored trousers, chinos, jeans, joggers, shorts; loafers, oxfords, sneakers, boots; ties, watches, baseball caps, beanies.",
        "Avoid: dresses, skirts, blouses with feminine cuts, heels, ballet flats, peplum tops, kimonos, espadrille wedges, statement-feminine jewelry.",
        "Item names should read as menswear (e.g. 'Oxford shirt', 'Chinos', 'Loafers').",
      ].join("\n");
    case "female":
      return [
        "User wants womenswear silhouettes.",
        "Lean toward: blouses, camisoles, knit cardigans, sweater dresses, midi/maxi/wrap dresses, tunics; pencil/pleated/midi skirts, high-waist jeans, wide-leg trousers, culottes, bike shorts; ballet flats, pumps, heels, mules, knee-high boots; clutches, mini bags, statement necklaces, hair clips, berets.",
        "It is fine to recommend a single dress (under 'top') and leave 'bottom' empty when appropriate; otherwise pair separates.",
        "Item names should read as womenswear (e.g. 'Wrap dress', 'Pleated skirt', 'Ballet flats').",
      ].join("\n");
    case "nonbinary":
      return [
        "User wants a unisex / mixed wardrobe.",
        "Lean toward pieces that read across genders: oversized tees, knit sweaters, button-ups, jeans, chinos, joggers, sneakers, boots, parkas, totes, beanies, watches.",
        "Avoid pieces that are unmistakably gendered (no stilettos, no neckties, no cocktail dresses) unless the weather and tuning genuinely call for them.",
      ].join("\n");
    default:
      return "User has not set a presentation preference. Pick whichever silhouette best fits the weather, activity, and style; do not impose a gendered direction.";
  }
}

function outfitConflictsWithPresentation(response = {}, preferences = {}) {
  const value = String(preferences?.gender || "unspecified").toLowerCase();
  if (value === "unspecified") return false;
  const text = getOutfitText(response);
  if (value === "male") {
    return /\b(dress|skirt|blouse|camisole|peplum|kimono|heels?|pumps?|ballet flats?|mary jane|stiletto|wedge|clutch|statement necklace|hair clip|beret)\b/.test(text);
  }
  if (value === "female") {
    return /\b(necktie|bow tie|tie\b|brogues?|oxford shoes?|derby shoes?|menswear|men's)\b/.test(text);
  }
  if (value === "nonbinary") {
    return /\b(stilettos?|cocktail dress|ball gown|necktie|bow tie)\b/.test(text);
  }
  return false;
}

function buildPreferenceTuningRules(preferences = {}, weather = {}) {
  const rules = [];
  const feelsLike = Number.isFinite(Number(weather?.feelsLike))
    ? Number(weather.feelsLike)
    : Number(weather?.temperature);
  const wetRisk = Number(weather?.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow|freezing/i.test(String(weather?.weatherLabel || ""));
  const windy = Number(weather?.wind ?? 0) >= 24;

  if (preferences?.cold) {
    rules.push("- The user usually feels cold. Treat the day as roughly 5°C colder and make the outfit visibly warmer with more coverage, warmer fabrics, or an extra layer when sensible.");
  }
  if (preferences?.hot) {
    rules.push("- The user usually feels hot. Treat the day as roughly 5°C warmer and make the outfit visibly lighter by removing unnecessary layers and favoring breathable pieces.");
  }
  if (preferences?.activityContext === "walking") {
    rules.push("- Activity is walking. Favor easy movement, supportive shoes, and layers that work while moving.");
  } else if (preferences?.activityContext === "commute") {
    rules.push("- Activity is commuting. Make the look practical across streets, transit, and indoor stops.");
  } else if (preferences?.activityContext === "errands") {
    rules.push("- Activity is errands. Keep the outfit casual, durable, and easy for repeated on-off movement.");
  } else if (preferences?.activityContext === "office") {
    rules.push("- Activity is office. Make the outfit noticeably smarter than a generic casual look.");
  } else if (preferences?.activityContext === "workout") {
    rules.push("- Activity is workout or athleisure. Make the outfit clearly more active and performance-friendly.");
  } else if (preferences?.activityContext === "travel") {
    rules.push("- Activity is travel. Prioritize comfort through temperature changes and long wear.");
  } else if (preferences?.activityContext === "evening") {
    rules.push("- Activity is evening. Make the look feel slightly more intentional and nighttime-ready.");
  }

  if (preferences?.locationContext === "indoors") {
    rules.push("- Setting is mostly indoors. Avoid over-layering unless cold or wet conditions strongly require it.");
  } else if (preferences?.locationContext === "outdoors") {
    rules.push("- Setting is mostly outdoors. Give weather protection more weight than a standard mixed day.");
  } else if (preferences?.locationContext === "transit") {
    rules.push("- Setting is transit-heavy. Use easy layers and shoes that work for walking and waiting outside.");
  } else if (preferences?.locationContext === "event") {
    rules.push("- Setting is an event. Keep the outfit polished and intentional, not purely utilitarian.");
  } else if (preferences?.locationContext === "exposed") {
    rules.push("- Setting is exposed outdoors. Build in stronger protection for wind, rain, or temperature swings.");
  }

  if (preferences?.styleFocus === "polished" || preferences?.formal) {
    rules.push("- Style focus is polished. Make the outfit visibly cleaner and sharper than a basic casual outfit.");
  } else if (preferences?.styleFocus === "sporty" || preferences?.sporty) {
    rules.push("- Style focus is sporty. Lean into athletic pieces or streamlined performance-inspired styling.");
  } else if (preferences?.styleFocus === "streetwear" || preferences?.streetwear) {
    rules.push("- Style focus is streetwear. Make the silhouette feel more styled and fashion-forward.");
  } else if (preferences?.styleFocus === "minimalist" || preferences?.minimalist) {
    rules.push("- Style focus is minimalist. Keep the look clean, pared back, and tonal.");
  } else if (preferences?.styleFocus === "casual" || preferences?.casual) {
    rules.push("- Style focus is casual. Keep the outfit easy, relaxed, and everyday.");
  }

  if ((preferences?.cold || preferences?.locationContext === "exposed" || preferences?.locationContext === "outdoors") && Number.isFinite(feelsLike) && feelsLike <= 18 && !wetRisk && !windy) {
    rules.push("- Even if the weather is technically moderate, do not underdress this user. A visible layer is acceptable.");
  }
  if ((preferences?.hot || preferences?.locationContext === "indoors") && Number.isFinite(feelsLike) && feelsLike >= 20 && !wetRisk) {
    rules.push("- Avoid adding an outer layer just for styling. Only keep one if weather exposure clearly justifies it.");
  }

  return rules;
}

function recommendationNeedsPreferenceRevision(response, weather = {}, preferences = {}) {
  const profileBand = deriveRecommendationProfileBand(preferences, weather);
  const envelope = getRecommendationWeatherEnvelope(weather);
  const top = cleanInlineText(response?.outfit?.top).toLowerCase();
  const bottom = cleanInlineText(response?.outfit?.bottom).toLowerCase();
  const outer = cleanInlineText(response?.outfit?.outer).toLowerCase();
  const shoes = cleanInlineText(response?.outfit?.shoes).toLowerCase();
  const accessory = cleanInlineText(Array.isArray(response?.outfit?.accessories) ? response.outfit.accessories[0] : response?.outfit?.accessories).toLowerCase();
  const feelsLike = Number.isFinite(Number(weather?.feelsLike))
    ? Number(weather.feelsLike)
    : Number(weather?.temperature);
  const wetRisk = Number(weather?.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow|freezing/i.test(String(weather?.weatherLabel || ""));
  const windy = Number(weather?.wind ?? 0) >= 24;
  const realOuterPattern = /\b(coat|jacket|parka|puffer|insulated|shell|fleece|sherpa|windbreaker|raincoat|waterproof)\b/;

  if (preferences?.cold) {
    if (feelsLike < 22 && !outer && !/\b(hoodie|sweater|knit|fleece|jacket|coat|parka|overshirt)\b/.test(top)) return true;
    if (feelsLike < 20 && /\b(tank|tee|t-shirt|t shirt|polo)\b/.test(top)) return true;
    if (feelsLike < 24 && /\bshorts\b/.test(bottom)) return true;
  }

  if (preferences?.hot) {
    if (feelsLike >= 20 && outer && !wetRisk && !windy) return true;
    if (feelsLike >= 24 && /\b(thermal|sweater|knit|hoodie|fleece|sherpa|long-sleeve|long sleeve)\b/.test(`${top} ${outer}`)) return true;
    if (feelsLike >= 28 && /\b(boots|loafers|insulated)\b/.test(shoes)) return true;
  }

  if ((preferences?.activityContext === "office" || preferences?.locationContext === "event" || preferences?.styleFocus === "polished" || preferences?.formal) && /\b(hoodie|graphic|tank|athletic)\b/.test(`${top} ${outer}`)) {
    return true;
  }
  if ((preferences?.activityContext === "office" || preferences?.locationContext === "event" || preferences?.styleFocus === "polished" || preferences?.formal) && /\b(leggings|cargo)\b/.test(bottom)) {
    return true;
  }
  if (profileBand === "office" && /\b(t-shirt|t shirt|tee)\b/.test(top) && /\b(sneaker|runner)\b/.test(shoes) && /\b(cap|beanie)\b/.test(accessory)) {
    return true;
  }
  if ((preferences?.activityContext === "workout" || preferences?.styleFocus === "sporty" || preferences?.sporty) && !/\b(running|trainer|sneaker|leggings|athletic|performance|hoodie|shorts)\b/.test(`${top} ${bottom} ${shoes}`)) {
    return true;
  }
  if (profileBand === "sporty" && /\b(t-shirt|t shirt|tee)\b/.test(top) && /\b(trouser|chino|jean)\b/.test(bottom) && !/\b(jogger|short|legging)\b/.test(bottom)) {
    return true;
  }
  if (profileBand === "hot-evening" && /\b(t-shirt|t shirt|tee)\b/.test(top) && /\b(black trousers|trousers|jeans)\b/.test(bottom) && /\b(cap)\b/.test(accessory)) {
    return true;
  }
  if (profileBand === "minimal" && /\b(t-shirt|t shirt|tee|knit tee)\b/.test(top) && /\b(trouser|chino)\b/.test(bottom) && /\b(sneaker|slip-on sneaker|low-profile sneaker)\b/.test(shoes) && /\b(watch|understated)\b/.test(accessory)) {
    return true;
  }
  if (profileBand === "minimal" && !outer && /\b(sneaker)\b/.test(shoes) && !/\b(poplin|polo|merino|overshirt)\b/.test(`${top} ${outer}`)) {
    return true;
  }
  if ((preferences?.locationContext === "outdoors" || preferences?.locationContext === "exposed" || preferences?.locationContext === "transit") && (wetRisk || windy || feelsLike <= 14) && !outer) {
    return true;
  }
  if ((envelope.coldLater || (envelope.chillyLater && envelope.sharpDrop)) && !realOuterPattern.test(outer)) {
    return true;
  }
  if (envelope.moderateNow && /\b(sweater|jumper|hoodie|thermal|heavy knit|chunky knit|wool|merino)\b/.test(top) && /\b(overshirt|shacket|cardigan)\b/.test(outer)) {
    return true;
  }
  if ((preferences?.locationContext === "outdoors" || preferences?.locationContext === "exposed") && Number(weather?.uv ?? 0) >= 7 && !/\b(sunglasses|cap|hat)\b/.test(accessory)) {
    return true;
  }
  if (outfitConflictsWithPresentation(response, preferences)) {
    return true;
  }

  return false;
}

async function rewriteRecommendationForPreferences(response, weather, preferences, location, wardrobeItems = []) {
  const revisionNotes = buildPreferenceTuningRules(preferences, weather);
  const presentationDirective = buildPresentationDirective(preferences);
  const profileBand = deriveRecommendationProfileBand(preferences, weather);
  const archetypeDirective = buildArchetypeDirective(profileBand, location, preferences, weather);
  const archetypeRevisionRule = archetypeDirective.safetyDominant
    ? "- Weather safety is dominant here. Do not make the archetype visually obvious through garment categories; use style only as a soft finish after the outfit is weather-safe."
    : "- Make the selected archetype visually obvious in the slot choices instead of blending multiple archetypes together.";
  const styleGuardrails = buildStyleGuardrails(preferences, weather);
  const wardrobePenaltyRules = buildWardrobePenaltyRules(wardrobeItems, wardrobeItems, preferences, weather);

  const wardrobeDesc = Array.isArray(wardrobeItems) && wardrobeItems.length
    ? wardrobeItems
      .map((item) => `- ${item.type}: ${item.name}${item.color ? ` (${item.color})` : ""}${item.material ? ` [${item.material}]` : ""}`)
      .join("\n")
    : "- No saved wardrobe items";

  const accessory = cleanInlineText(Array.isArray(response?.outfit?.accessories) ? response.outfit.accessories[0] : response?.outfit?.accessories) || "none";
  const prompt = `Revise this WearCast outfit so the user's tuning has a noticeable effect while staying weather-appropriate.

## Weather
- Location: ${location?.name || "Unknown"}
- Temperature: ${weather?.temperature}°C
- Feels like: ${weather?.feelsLike}°C
- Wind: ${weather?.wind} km/h
- Precipitation probability: ${weather?.precipProb ?? "unknown"}%
- UV: ${weather?.uv}
- Weather: ${weather?.weatherLabel}

## User tuning that must be visible
${revisionNotes.length ? revisionNotes.join("\n") : "- No extra user tuning beyond the selected profile band. Focus on making the chosen archetype clearer and more distinctive."}

## Presentation
${presentationDirective}

## Archetype guidance
${archetypeDirective.text}

## Style guardrails
${styleGuardrails.length ? styleGuardrails.join("\n") : "- none"}

## Wardrobe
${wardrobeDesc}

## Wardrobe penalty rules
${wardrobePenaltyRules.join("\n")}

## Current outfit to improve
- Top: ${response?.outfit?.top || ""}
- Bottom: ${response?.outfit?.bottom || ""}
- Outer: ${response?.outfit?.outer || "none"}
- Shoes: ${response?.outfit?.shoes || ""}
- Accessory: ${accessory}

## Rules
- Make the tuning effect noticeable, not subtle.
- Keep the weather logic believable.
- Keep the intended profile band clear: ${profileBand}.
${archetypeRevisionRule}
- Strictly follow the Presentation block. Do not keep any item that conflicts with the user's selected presentation.
- Preserve the same JSON schema.
- Return fresh slotReasons and itemDetails for every present slot.
- Color and material must be plausible for the exact item you recommend.
- Outer is optional.
- Exactly one accessory.
- Avoid collapsing back to the same generic outfit formula if a better-fitting archetype is available.
- Return JSON only.

{
  "outfit": {
    "top": "short item name",
    "bottom": "short item name",
    "outer": "short item name or empty string",
    "shoes": "short item name",
    "accessories": ["one item"]
  },
  "slotReasons": {
    "top": "one short reason",
    "bottom": "one short reason",
    "outer": "one short reason or empty string",
    "shoes": "one short reason",
    "accessory": "one short reason"
  },
  "itemDetails": {
    "top": { "color": "short color", "material": "short material" },
    "bottom": { "color": "short color", "material": "short material" },
    "outer": { "color": "short color", "material": "short material" },
    "shoes": { "color": "short color", "material": "short material" },
    "accessory": { "color": "short color", "material": "short material" }
  },
  "reasoning": "One natural weather-overview subline",
  "detailsOverview": {
    "what": "One or two sentences",
    "why": "One or two sentences",
    "note": "One optional practical note"
  },
  "warnings": ["one short warning if needed"],
  "missingItems": ["one short missing item if needed"]
}`;

  try {
    const text = await chatCompletion([{ role: "user", content: prompt }], {
      maxTokens: 560,
      traceLabel: "recommendation-revision",
      timeoutMs: 18000,
    });
    return normalizeRecommendationResponse(parseModelJson(text));
  } catch (err) {
    console.warn("recommendation revision fallback:", err?.message || err);
    return response;
  }
}

async function rewriteRecommendationForQuality(response, weather, preferences, location, wardrobeItems = [], validation = null) {
  const quality = validation || validateRecommendationQuality(response, weather, preferences);
  if (quality.ok) return response;
  const profile = classifyWeatherProfile(weather);
  const presentationDirective = buildPresentationDirective(preferences);
  const issueLines = quality.issues.map((issue) => `- ${issue.code}: ${issue.message}`).join("\n");
  const wardrobeDesc = Array.isArray(wardrobeItems) && wardrobeItems.length
    ? wardrobeItems.slice(0, 10).map((item) => `- ${item.type}: ${item.name}${item.material ? ` [${item.material}]` : ""}`).join("\n")
    : "- No suitable wardrobe items";
  const prompt = `Fix this WearCast outfit. It failed deterministic launch-quality checks.

Weather:
- Location: ${location?.name || "Unknown"}
- Temperature: ${weather?.temperature}C
- Feels like: ${weather?.feelsLike}C
- Rain probability: ${weather?.precipProb ?? "unknown"}%
- Wind/gusts: ${weather?.wind ?? 0}/${weather?.gusts ?? weather?.wind ?? 0} km/h
- UV: ${weather?.uv ?? 0}
- Label: ${weather?.weatherLabel || "Unknown"}

Detected weather profile:
- hot: ${profile.hot}
- very hot: ${profile.veryHot}
- cold: ${profile.cold}
- wet or rain later: ${profile.wet || profile.rainLikelyLater}
- dry: ${profile.dry}

Failures to correct:
${issueLines}

Suitable wardrobe candidates:
${wardrobeDesc}

Current failed outfit:
${JSON.stringify(response?.outfit || {}, null, 2)}

Presentation:
${presentationDirective}

Non-negotiable rules:
- If feels-like is 30C or above: no wool, merino, thermal, fleece, parka, heavy coat, beanie, gloves, or unnecessary outer layer.
- If feels-like is 35C or above: no sweater, hoodie, overshirt, jacket, blazer, coat, or long-sleeve layer unless explicitly described as carried for indoor AC.
- If rain is not likely: no umbrella or rain gear.
- If office/polished: stay sharp with breathable polish, not cold-weather formality.
- Strictly follow the Presentation block. Do not keep any item that conflicts with the user's selected presentation.
- Return exactly one accessory.
- Return JSON only using the same schema.

{
  "outfit": {
    "top": "short item name",
    "bottom": "short item name",
    "outer": "short item name or empty string",
    "shoes": "short item name",
    "accessories": ["one item"]
  },
  "slotReasons": {
    "top": "one short reason",
    "bottom": "one short reason",
    "outer": "one short reason or empty string",
    "shoes": "one short reason",
    "accessory": "one short reason"
  },
  "itemDetails": {
    "top": { "color": "short color", "material": "short material" },
    "bottom": { "color": "short color", "material": "short material" },
    "outer": { "color": "short color", "material": "short material" },
    "shoes": { "color": "short color", "material": "short material" },
    "accessory": { "color": "short color", "material": "short material" }
  },
  "reasoning": "One natural weather-overview subline",
  "detailsOverview": {
    "what": "One or two sentences",
    "why": "One or two sentences",
    "note": "One optional practical note"
  },
  "warnings": ["one short warning if needed"],
  "missingItems": ["one short missing item if needed"]
}`;

  try {
    const text = await chatCompletion([{ role: "user", content: prompt }], {
      maxTokens: 560,
      traceLabel: "recommendation-quality-revision",
      timeoutMs: 16000,
    });
    return normalizeRecommendationResponse(parseModelJson(text));
  } catch (err) {
    console.warn("recommendation quality revision fallback:", err?.message || err);
    return response;
  }
}

async function finalizeRecommendation(response, weather, preferences, location, wardrobeAnalysis = null, eligibleWardrobeItems = [], { allowQualityRetry = true, assetWardrobeItems = null, recommendationSource = "unknown", fallbackReason: upstreamFallbackReason = "" } = {}) {
  let normalized = ensureRecommendationShape(response, weather, preferences, wardrobeAnalysis);
  // Preserve LLM-authored copy that the quality rewrite / fallback paths
  // don't regenerate (outfit-outlook windows, detailsOverview, reasoning).
  // We'll restore them onto whatever shape we end up with so the client
  // never has to fall back to rule-based copy just because the gate fired.
  const preservedOutlook = normalized.outlook || null;
  const preservedDetailsOverview = normalized.detailsOverview || null;
  const preservedReasoning = typeof normalized.reasoning === "string" ? normalized.reasoning : "";
  let quality = validateRecommendationQuality(normalized, weather, preferences);
  const initialQualityIssues = quality.issues || [];
  let fallbackReason = upstreamFallbackReason;
  const shouldUseImmediateFallback = !quality.ok && quality.profile?.veryHot && quality.issues.some((issue) =>
    ["hot_heavy_material", "very_hot_layering", "dry_rain_gear"].includes(issue.code)
  );
  if (!quality.ok && allowQualityRetry && !shouldUseImmediateFallback) {
    normalized = ensureRecommendationShape(
      await rewriteRecommendationForQuality(normalized, weather, preferences, location, eligibleWardrobeItems, quality),
      weather,
      preferences,
      wardrobeAnalysis
    );
    quality = validateRecommendationQuality(normalized, weather, preferences);
  }
  if (!quality.ok) {
    fallbackReason = quality.issues[0]?.code || "quality_gate";
    logApiEvent("warn", "recommendation_quality_fallback", {
      source: recommendationSource,
      fallbackReason,
      severeCount: quality.severeCount,
      issues: quality.issues.map((issue) => issue.code),
      gender: preferences?.gender || "unspecified",
      feelsLike: weather?.feelsLike ?? weather?.temperature ?? null,
    });
    normalized = ensureRecommendationShape(
      buildFallbackRecommendation(weather, preferences, quality.issues[0]?.code || "quality gate"),
      weather,
      preferences,
      wardrobeAnalysis
    );
    quality = validateRecommendationQuality(normalized, weather, preferences);
  }
  if (preservedOutlook && !normalized.outlook) normalized.outlook = preservedOutlook;
  if (preservedDetailsOverview && !normalized.detailsOverview) normalized.detailsOverview = preservedDetailsOverview;
  if (preservedReasoning && !normalized.reasoning) normalized.reasoning = preservedReasoning;

  const wardrobeUsage = detectWardrobeUsage(normalized, wardrobeAnalysis || { candidates: [] });
  const trustSignals = buildRecommendationTrustSignals(normalized, weather, preferences, wardrobeUsage);
  const wardrobeItemsForAssets = Array.isArray(assetWardrobeItems) ? assetWardrobeItems : eligibleWardrobeItems;
  const requestedItemDetails = normalized.itemDetails;
  const outfitImages = await buildRecommendationAssetMatches(normalized.outfit, wardrobeItemsForAssets, null, {
    weather,
    preferences,
    profileBand: deriveRecommendationProfileBand(preferences, weather),
    itemDetails: requestedItemDetails,
  });
  normalized = {
    ...normalized,
    recommendationSource,
    fallbackReason,
    itemDetails: reconcileItemDetailsWithImageMatches(requestedItemDetails, outfitImages),
    outfitImages,
    weatherProfile: classifyWeatherProfile(weather),
    wardrobeAnalysis: wardrobeAnalysis ? { ...wardrobeAnalysis, usage: wardrobeUsage } : null,
    quality,
    initialQualityIssues,
    trustSignals,
  };
  recordStockImageGaps({ ...normalized, itemDetails: requestedItemDetails }, weather, preferences, location, recommendationSource)
    .catch((err) => console.warn("[recommend] stock gap logging failed", err?.message || err));
  return normalized;
}

function inferCatalogAesthetic(entry = {}, key = "") {
  const text = `${key} ${entry.description || ""} ${(entry.keywords || []).join(" ")}`.toLowerCase();
  return {
    warmth: /\b(winter|insulated|thermal|fleece|beanie|glove|parka|overcoat|coat|sweater|knit)\b/.test(text) ? "warm" : /\b(tank|shorts|linen|sun|tee|t-shirt|polo)\b/.test(text) ? "cool" : "neutral",
    formality: /\b(blazer|tailored|dress|loafer|oxford|button-up|button up|trouser|slack|chino|linen trouser|watch|polo)\b/.test(text) ? "polished" : /\b(running|athletic|sport|trail|performance|leggings)\b/.test(text) ? "sporty" : "casual",
    weather: /\b(rain|waterproof|water-resistant|shell|umbrella|parka|windbreaker|weatherproof)\b/.test(text) ? "protective" : /\b(sunglasses|sun hat|cap)\b/.test(text) ? "sun" : "neutral",
    materialCue: /\b(denim)\b/.test(text) ? "denim" : /\b(wool|merino)\b/.test(text) ? "wool" : /\b(linen)\b/.test(text) ? "linen" : /\b(cotton|chino|twill)\b/.test(text) ? "cotton" : "generic",
    visualStyle: /\b(street|outdoor|city|outdoors)\b/.test(text) ? "lifestyle" : "studio",
  };
}

function scoreAestheticContext(itemName = "", entry = {}, key = "", context = {}) {
  const weatherProfile = classifyWeatherProfile(context.weather || {});
  const preferences = context.preferences || {};
  const profileBand = context.profileBand || deriveRecommendationProfileBand(preferences, context.weather || {});
  const aesthetic = { ...inferCatalogAesthetic(entry, key), ...(entry.aesthetic || {}) };
  const itemText = cleanInlineText(itemName).toLowerCase();
  const entryText = `${key} ${entry.description || ""} ${(entry.keywords || []).join(" ")}`.toLowerCase();
  let score = 0;
  const penalties = [];

  if (weatherProfile.hot && aesthetic.warmth === "warm") {
    score -= weatherProfile.veryHot ? 35 : 24;
    penalties.push("too_warm_for_weather");
  }
  if (weatherProfile.cold && aesthetic.warmth === "cool") {
    score -= 16;
    penalties.push("too_light_for_cold");
  }
  if (weatherProfile.dry && aesthetic.weather === "protective" && /\b(umbrella|rain)\b/.test(`${itemText} ${key}`)) {
    score -= 40;
    penalties.push("rain_gear_for_dry_weather");
  }
  if ((weatherProfile.wet || weatherProfile.rainLikelyLater) && aesthetic.weather === "protective") score += 12;
  if (weatherProfile.highUv && aesthetic.weather === "sun") score += 8;

  if (profileBand === "office" && aesthetic.formality === "polished") score += 10;
  if (profileBand === "office" && aesthetic.formality === "sporty") {
    score -= 16;
    penalties.push("too_sporty_for_office");
  }
  if (profileBand === "sporty" && aesthetic.formality === "sporty") score += 12;
  if (profileBand === "sporty" && aesthetic.formality === "polished" && !/\b(watch)\b/.test(itemText)) {
    score -= 12;
    penalties.push("too_formal_for_sporty");
  }
  if (/\b(chino|cotton short|tailored short|linen short)\b/.test(itemText) && aesthetic.materialCue === "denim") {
    score -= 18;
    penalties.push("denim_visual_for_polished_short");
  }
  if (/\blinen\b/.test(itemText)) {
    if (aesthetic.materialCue === "linen") score += 22;
    else if (aesthetic.materialCue === "wool") {
      score -= 22;
      penalties.push("wool_visual_for_linen_item");
    }
  }
  if (/\b(chino|cotton twill)\b/.test(itemText)) {
    if (aesthetic.materialCue === "cotton") score += 18;
    else if (aesthetic.materialCue === "denim") {
      score -= 18;
      penalties.push("denim_visual_for_chino_item");
    }
  }
  if (/\bjeans?|denim\b/.test(itemText) && aesthetic.materialCue === "denim") score += 16;
  if (/\b(loafers?|dress shoes?|oxford shoes?|brogues?)\b/.test(itemText) && aesthetic.formality === "polished") score += 10;
  if (/\b(shell|rain jacket|waterproof jacket|waterproof shell|rain shell)\b/.test(itemText)) {
    if (/\b(shell|rain jacket|rain-jacket|waterproof|weatherproof|tech)\b/.test(entryText)) score += 24;
    if (key === "outer_gray_jacket_studio") {
      score -= 18;
      penalties.push("generic_jacket_for_shell");
    }
  }
  if (/\b(waterproof|rain|weatherproof)\b/.test(itemText) && aesthetic.weather !== "protective") {
    score -= 14;
    penalties.push("non_protective_visual_for_weatherproof_item");
  }
  const colorGroups = [
    { name: "dark", item: /\b(dark|black|charcoal)\b/, entry: /\b(black|charcoal)\b/, avoid: /\b(beige|cream|white|tan)\b/ },
    { name: "navy", item: /\b(navy)\b/, entry: /\b(navy)\b/, avoid: /\b(beige|cream|white|tan)\b/ },
    { name: "white", item: /\b(white)\b/, entry: /\bwhite\b/, avoid: /\bblack|charcoal|brown\b/ },
    { name: "cream", item: /\b(cream|ivory|off[-\s]?white)\b/, entry: /\b(cream|ivory|off[-\s]?white|white)\b/, avoid: /\bblack|charcoal|navy\b/ },
    { name: "tan", item: /\b(tan|beige|camel)\b/, entry: /\b(tan|beige|camel)\b/, avoid: /\bblack|charcoal\b/ },
  ];
  for (const group of colorGroups) {
    if (!group.item.test(itemText)) continue;
    if (group.entry.test(entryText)) score += 10;
    else if (group.avoid.test(entryText)) {
      score -= 10;
      penalties.push(`color_mismatch_${group.name}`);
    }
    break;
  }
  if (/\b(chino|linen trouser|lightweight trouser|tailored trouser)\b/.test(itemText) && key === "bottom_blue_jeans_stack") {
    score -= 24;
    penalties.push("jeans_visual_for_tailoring");
  }
  if (/\b(comfortable|everyday|easy|practical)?\s*(pants|trousers)\b/.test(itemText) || /\bcomfortable\b/.test(itemText)) {
    if (/\b(cargo|legging|bike short|shorts|capri|skirt|palazzo|culotte)\b/.test(entryText)) {
      score -= 30;
      penalties.push("specialized_bottom_for_generic_pants");
    } else if (/\b(trouser|chino|jeans?|pants)\b/.test(entryText)) {
      score += 12;
    }
  }
  if (/\b(derby|oxford shoe)\b/.test(itemText) && !/\b(dress|loafer|formal)\b/.test(`${key} ${(entry.keywords || []).join(" ")}`)) {
    score -= 12;
    penalties.push("weak_formal_shoe_match");
  }

  // Gender-presentation match. The catalog tags each entry as
  // masculine/feminine/unisex; the user has a preference of
  // male/female/nonbinary/unspecified. We boost when they line up and
  // penalise hard when they cross-pollinate (men's user → feminine entry
  // or vice versa). Unisex entries always remain eligible without bonus
  // or penalty so the matcher can still fall back to neutrals.
  const userGender = String(preferences?.gender || "unspecified").toLowerCase();
  const entryGender = String(entry?.gender || "unisex").toLowerCase();
  if (userGender === "male") {
    if (entryGender === "masculine") score += 14;
    else if (entryGender === "feminine") { score -= 26; penalties.push("feminine_entry_for_male_user"); }
  } else if (userGender === "female") {
    if (entryGender === "feminine") score += 14;
    else if (entryGender === "masculine") { score -= 26; penalties.push("masculine_entry_for_female_user"); }
  } else if (userGender === "nonbinary") {
    if (entryGender === "unisex") score += 6;
    // No penalty either way for nonbinary — soft preference for unisex.
  } else {
    const genericRequest = /\b(comfortable|everyday|easy|practical|simple|basic)\b/.test(itemText)
      || (/^(pants|trousers|top|shirt|shoes|sneakers|watch|bag)$/i.test(cleanInlineText(itemName)));
    const specificallyGenderedRequest = /\b(skirt|dress|blouse|camisole|heels?|pumps?|ballet flats?|mary jane|clutch|earrings?|necklace|bracelet|capri|cigarette pants|wide-leg|stiletto|loafer|oxford|tie)\b/.test(itemText);
    if (genericRequest && !specificallyGenderedRequest) {
      if (entryGender === "unisex") score += 8;
      else score -= 18;
    }
  }

  return { score, penalties, aesthetic };
}

function scoreCatalogMatch(text, entry, key = "", context = {}) {
  const normalized = normalizeMatchText(text);
  if (!normalized) return 0;
  const slot = cleanInlineText(entry?.slot);
  const wantedSubtype = inferItemSubtype(text, slot);
  const entrySubtype = getStockItemSubtype(slot, key, entry);
  if (slot === "accessory" && wantedSubtype && entrySubtype && wantedSubtype !== entrySubtype) return -80;
  if ((slot === "shoes" || slot === "bottom") && wantedSubtype && entrySubtype && wantedSubtype !== entrySubtype) return -70;
  const textTokens = normalized.split(" ").filter((token) => token.length > 2);
  let score = 0;
  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalizeMatchText(keyword);
    if (!normalizedKeyword) continue;
    const keywordTokens = normalizedKeyword.split(" ").filter((token) => token.length > 2);
    if (normalized === normalizedKeyword) {
      score += 18;
      continue;
    }
    if (normalized.includes(normalizedKeyword)) {
      score += 8;
    }
    if (normalizedKeyword.includes(normalized)) {
      score += 6;
    }
    if (keywordTokens.length) {
      const matchedTokens = keywordTokens.filter((token) => textTokens.includes(token)).length;
      if (matchedTokens === keywordTokens.length) score += 6;
      else if (matchedTokens > 0) score += matchedTokens * 2;
    }
  }
  const description = normalizeMatchText(entry.description);
  if (description) {
    if (description.includes(normalized)) score += 4;
    const descriptionTokens = description.split(" ").filter((token) => token.length > 2);
    const descriptionOverlap = textTokens.filter((token) => descriptionTokens.includes(token)).length;
    if (descriptionOverlap > 0) score += Math.min(descriptionOverlap, 3);
  }
  if (entry.fallback) score -= 1;
  if (wantedSubtype && entrySubtype && wantedSubtype === entrySubtype) score += 20;
  else if (wantedSubtype && entrySubtype && areStockSubtypesCompatible(slot, wantedSubtype, entrySubtype)) score += 8;
  if ((slot === "top" || slot === "outer") && wantedSubtype && entrySubtype && !areStockSubtypesCompatible(slot, wantedSubtype, entrySubtype)) score -= 36;
  score += scoreAestheticContext(text, entry, key, context).score;
  return score;
}

function getWardrobeDisplayPhoto(item = {}) {
  return item?.cropPhotoDataUrl || item?.photoDataUrl || item?.sourcePhotoDataUrl || null;
}

function itemTextForAssetMatch(item = {}) {
  return [
    item?.name,
    item?.type,
    item?.color,
    item?.material,
  ].map((value) => cleanInlineText(value).toLowerCase()).filter(Boolean).join(" ");
}

function itemDetailsForAssetSlot(slot = "", context = {}) {
  const details = context?.itemDetails || {};
  if (!details || typeof details !== "object") return {};
  if (slot === "accessory") return details.accessory || {};
  return details[slot] || {};
}

function assetMatchTextForSlot(slot, itemName = "", context = {}) {
  const details = itemDetailsForAssetSlot(slot, context);
  return [
    itemName,
    details?.color,
    details?.material,
  ].map((value) => cleanInlineText(value)).filter(Boolean).join(" ");
}

function inferItemSubtype(text = "", slot = "") {
  const value = cleanInlineText(text).toLowerCase();
  if (!value) return "";
  if (slot === "top") {
    if (/\bpolo\b/.test(value)) return "polo";
    if (/\b(t-?shirt|tee)\b/.test(value)) return "tee";
    if (/\b(tank|sleeveless)\b/.test(value)) return "tank";
    if (/\b(thermal|base layer|baselayer)\b/.test(value)) return "thermal";
    if (/\b(button[-\s]?up|button[-\s]?down|oxford|shirt|blouse|poplin|linen shirt|camp collar)\b/.test(value)) return "shirt";
    if (/\bcardigan\b/.test(value)) return "cardigan";
    if (/\bhoodie\b/.test(value)) return "hoodie";
    if (/\b(sweater dress|knit dress|dress)\b/.test(value)) return "dress";
    if (/\b(turtleneck|roll neck|rollneck|mock turtleneck)\b/.test(value)) return "turtleneck";
    if (/\b(sweater|jumper|pullover|crewneck)\b/.test(value)) return "sweater";
    if (/\b(knit tee|fine[-\s]?gauge tee)\b/.test(value)) return "knit-tee";
    if (/\b(knit|merino)\b/.test(value)) return "knit";
  }
  if (slot === "bottom") {
    if (/\bjeans?|denim\b/.test(value)) return "jeans";
    if (/\bchinos?\b/.test(value)) return "chinos";
    if (/\b(shorts?)\b/.test(value)) return "shorts";
    if (/\b(capri|cropped pants?)\b/.test(value)) return "capri";
    if (/\b(leggings?|tights?)\b/.test(value)) return "leggings";
    if (/\b(joggers?|sweatpants?|track pants?)\b/.test(value)) return "joggers";
    if (/\b(trousers?|pants|slacks?|tailored|wool trouser|linen trouser|culottes|palazzo)\b/.test(value)) return "trousers";
    if (/\bskirt\b/.test(value)) return "skirt";
  }
  if (slot === "outer") {
    if (/\b(fleece|sherpa)\b/.test(value)) return "fleece";
    if (/\b(rain|waterproof|shell|weatherproof)\b/.test(value)) return "shell";
    if (/\b(parka|puffer|down)\b/.test(value)) return "parka";
    if (/\b(coat|overcoat|trench|pea coat)\b/.test(value)) return "coat";
    if (/\bblazer\b/.test(value)) return "blazer";
    if (/\b(overshirt|shacket|shirt jacket)\b/.test(value)) return "overshirt";
    if (/\bhoodie\b/.test(value)) return "hoodie";
    if (/\bbomber\b/.test(value)) return "bomber";
    if (/\bfield jacket\b/.test(value)) return "field-jacket";
    if (/\bwindbreaker\b/.test(value)) return "shell";
    if (/\bjacket\b/.test(value)) return "jacket";
    if (/\bcardigan\b/.test(value)) return "cardigan";
  }
  if (slot === "shoes") {
    if (/\b(loafer|derby|oxford|dress shoe|brogue)\b/.test(value)) return "dress-shoes";
    if (/\b(boot|chelsea)\b/.test(value)) return "boots";
    if (/\b(sandal|slide)\b/.test(value)) return "sandals";
    if (/\b(runners?|running|trainers?|trail)\b/.test(value)) return "runners";
    if (/\b(sneakers?|court shoe)\b/.test(value)) return "sneakers";
  }
  if (slot === "accessory") {
    if (/\bumbrella\b/.test(value)) return "umbrella";
    if (/\bsunglasses?\b/.test(value)) return "sunglasses";
    if (/\b(baseball cap|dad cap|snapback|sports? cap|running cap)\b/.test(value)) return "baseball-cap";
    if (/\b(beanie|beret)\b/.test(value)) return "beanie";
    if (/\b(sun hat|wide-brim|wide brim|bucket hat)\b/.test(value)) return "sun-hat";
    if (/\b(hat|cap)\b/.test(value)) return "hat";
    if (/\bscarf\b/.test(value)) return "scarf";
    if (/\bgloves?\b/.test(value)) return "gloves";
    if (/\bwatch\b/.test(value)) return "watch";
    if (/\b(bag|tote|backpack|clutch)\b/.test(value)) return "bag";
    if (/\bbelt\b/.test(value)) return "belt";
  }
  return "";
}

function tokenSetForAssetMatch(text = "") {
  const stop = new Set(["the", "and", "for", "with", "clean", "simple", "easy", "everyday", "comfortable", "light", "dark", "warm", "cool"]);
  return normalizeMatchText(text)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

function colorMatchScore(wanted = "", item = {}) {
  const wantedText = cleanInlineText(wanted).toLowerCase();
  const itemText = itemTextForAssetMatch(item);
  const colors = ["black", "white", "blue", "navy", "gray", "grey", "charcoal", "brown", "tan", "beige", "camel", "cream", "olive", "green", "red", "burgundy", "pink", "purple", "yellow", "orange"];
  const wantedColor = colors.find((color) => new RegExp(`\\b${color}\\b`).test(wantedText));
  if (!wantedColor) return 0;
  if (wantedColor === "gray" || wantedColor === "grey") return /\b(gray|grey)\b/.test(itemText) ? 8 : -2;
  return new RegExp(`\\b${wantedColor}\\b`).test(itemText) ? 8 : -2;
}

function wardrobeSlotsCompatibleForAssetMatch(wantedSlot, itemSlot, wantedName = "", item = {}) {
  if (wantedSlot === itemSlot) return true;
  const text = `${wantedName} ${itemTextForAssetMatch(item)}`.toLowerCase();
  if (
    ((wantedSlot === "outer" && itemSlot === "top") || (wantedSlot === "top" && itemSlot === "outer"))
    && /\b(hoodie|sweater|jumper|cardigan|overshirt|shacket|shirt jacket|jacket|fleece)\b/.test(text)
  ) {
    return true;
  }
  return false;
}

function scoreWardrobeAssetCandidate(slot, wantedName, item = {}, context = {}) {
  const wantedSlot = normalizeWardrobeSlot(slot);
  const itemSlot = normalizeWardrobeSlot(item?.type);
  if (!wantedSlot || !itemSlot || !wardrobeSlotsCompatibleForAssetMatch(wantedSlot, itemSlot, wantedName, item)) return null;
  const photo = getWardrobeDisplayPhoto(item);
  if (!photo) return null;

  const wanted = cleanInlineText(wantedName);
  const itemText = itemTextForAssetMatch(item);
  if (!wanted || !itemText) return null;

  const wantedSubtype = inferItemSubtype(wanted, wantedSlot);
  const itemSubtype = inferItemSubtype(item?.name, wantedSlot)
    || inferItemSubtype(item?.type, wantedSlot)
    || inferItemSubtype(itemText, wantedSlot);
  const wantedTokens = tokenSetForAssetMatch(wanted);
  const itemTokens = tokenSetForAssetMatch(itemText);
  const overlap = wantedTokens.filter((token) => itemTokens.includes(token)).length;
  const fitScore = wardrobeItemFitScore(item, context.preferences || {}, context.weather || {});
  let score = 0;
  const reasons = [];

  const exactName = normalizeMatchText(item?.name) === normalizeMatchText(wanted);
  const nameContains = normalizeMatchText(wanted).includes(normalizeMatchText(item?.name)) || normalizeMatchText(item?.name).includes(normalizeMatchText(wanted));
  if (exactName) {
    score += 52;
    reasons.push("exact_name");
  }
  if (nameContains) {
    score += 32;
    reasons.push("name_contains");
  }
  if (wantedSubtype && itemSubtype && wantedSubtype === itemSubtype) {
    score += 26;
    reasons.push("subtype_match");
  } else if (wantedSubtype && itemSubtype && !nameContains) {
    score -= 28;
    reasons.push("subtype_mismatch");
  }
  if (overlap) {
    score += Math.min(18, overlap * 6);
    reasons.push("token_overlap");
  }
  if (wantedTokens.length && overlap === wantedTokens.length) {
    score += 8;
    reasons.push("all_tokens_match");
  }
  score += colorMatchScore(wanted, item);
  score += Math.max(-18, Math.min(18, fitScore * 2));
  if (item?.favorite) {
    score += 4;
    reasons.push("favorite");
  }

  const confidence = Math.max(0, Math.min(100, Math.round(42 + score)));
  return {
    item,
    slot: wantedSlot,
    score,
    confidence,
    wantedSubtype,
    itemSubtype,
    reasons,
  };
}

function buildWardrobeAssetMatch(candidate, { source = "wardrobe", adjudicated = false } = {}) {
  if (!candidate?.item) return null;
  const item = candidate.item;
  const matchQuality = adjudicated
    ? "llm_adjudicated_wardrobe"
    : candidate.score >= 44
      ? "strong_wardrobe"
      : "wardrobe";
  return {
    path: getWardrobeDisplayPhoto(item),
    source,
    matchQuality,
    itemId: item.id ?? null,
    itemName: cleanInlineText(item.name),
    type: cleanInlineText(item.type),
    color: cleanInlineText(item.color),
    material: cleanInlineText(item.material),
    careInstructions: Array.isArray(item.careInstructions) ? item.careInstructions : [],
    confidence: candidate.confidence,
    matchScore: Math.round(candidate.score),
    matchReasons: candidate.reasons || [],
    adjudicated,
  };
}

function wardrobeAssetCandidatesForSlot(slot, wantedName, wardrobeItems = [], context = {}) {
  return (Array.isArray(wardrobeItems) ? wardrobeItems : [])
    .map((item) => scoreWardrobeAssetCandidate(slot, wantedName, item, context))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

function shouldAskLlmForWardrobeAssetMatch(candidates = []) {
  if (!candidates.length) return false;
  const [best, second] = candidates;
  if (best.score >= 44) return false;
  if (best.score < 16) return false;
  return !second || (best.score - second.score) <= 12 || best.score < 34;
}

async function adjudicateWardrobeAssetMatchWithLLM(slot, wantedName, candidates = [], context = {}) {
  if (!OPENROUTER_API_KEY || !candidates.length) return null;
  const compactCandidates = candidates.slice(0, 5).map((candidate, index) => ({
    index,
    id: candidate.item?.id ?? null,
    type: cleanInlineText(candidate.item?.type),
    name: cleanInlineText(candidate.item?.name),
    color: cleanInlineText(candidate.item?.color),
    material: cleanInlineText(candidate.item?.material),
    score: Math.round(candidate.score),
    fitScore: wardrobeItemFitScore(candidate.item, context.preferences || {}, context.weather || {}),
  }));
  const weatherProfile = classifyWeatherProfile(context.weather || {});
  const prompt = `Choose whether a wardrobe item is an appropriate visual asset for this recommended outfit slot.

Recommended slot: ${slot}
Recommended item: ${wantedName}
Weather/style context:
${JSON.stringify({
  weather: {
    hot: weatherProfile.hot,
    cold: weatherProfile.cold,
    wet: weatherProfile.wet || weatherProfile.rainLikelyLater,
  },
  preferences: context.preferences || {},
})}

Wardrobe candidates:
${JSON.stringify(compactCandidates)}

Return ONLY valid JSON:
{
  "selectedIndex": 0,
  "confidence": 0-100,
  "reason": "short reason"
}

Rules:
- Select a wardrobe item only if it is genuinely the same kind of garment/accessory and appropriate for the recommendation.
- Reject weak category-only matches. Example: do not match any shirt to a polo, any sneaker to a loafer, or shorts to trousers.
- If none are appropriate, return {"selectedIndex": null, "confidence": 0, "reason": "no appropriate wardrobe item"}.
- Accuracy matters more than wardrobe usage.`;

  try {
    const text = await chatCompletion([{ role: "user", content: prompt }], {
      maxTokens: 120,
      compactJsonRetry: true,
      traceLabel: "wardrobe-asset-match",
      timeoutMs: 9000,
    });
    const parsed = parseModelJson(text);
    const selectedIndex = Number.isInteger(parsed?.selectedIndex) ? parsed.selectedIndex : null;
    if (selectedIndex == null || selectedIndex < 0 || selectedIndex >= candidates.slice(0, 5).length) return null;
    const confidence = Number(parsed?.confidence);
    if (!Number.isFinite(confidence) || confidence < 62) return null;
    return {
      ...candidates[selectedIndex],
      confidence: Math.max(candidates[selectedIndex].confidence, Math.round(confidence)),
      reasons: [...(candidates[selectedIndex].reasons || []), "llm_adjudicated"],
    };
  } catch (err) {
    console.warn("[recommend] wardrobe asset LLM adjudication failed", {
      slot,
      error: err?.message || String(err),
    });
    return null;
  }
}

async function findWardrobeImageForSlot(slot, itemName, wardrobeItems = [], context = {}, usedItemIds = new Set()) {
  const candidates = wardrobeAssetCandidatesForSlot(slot, itemName, wardrobeItems, context)
    .filter((candidate) => {
      const id = String(candidate.item?.id ?? candidate.item?.name ?? "");
      return !id || !usedItemIds.has(id);
    });
  if (!candidates.length) return null;

  const best = candidates[0];
  const second = candidates[1];
  const strongMatch = best.score >= 44 || (best.score >= 34 && (!second || best.score - second.score >= 14));
  if (strongMatch) return buildWardrobeAssetMatch(best);

  if (shouldAskLlmForWardrobeAssetMatch(candidates)) {
    const adjudicated = await adjudicateWardrobeAssetMatchWithLLM(slot, itemName, candidates, context);
    if (adjudicated && adjudicated.score >= 16) return buildWardrobeAssetMatch(adjudicated, { adjudicated: true });
  }

  return null;
}

function getStockItemSubtype(slot, key = "", entry = {}) {
  if (key === "outer_gray_jacket_studio") return "jacket";
  return inferItemSubtype(`${key} ${entry?.description || ""} ${(entry?.keywords || []).join(" ")}`, slot);
}

function areStockSubtypesCompatible(slot, wantedSubtype = "", entrySubtype = "") {
  if (!wantedSubtype || !entrySubtype) return false;
  if (wantedSubtype === entrySubtype) return true;
  if (slot === "top") {
    const knitFamily = new Set(["sweater", "turtleneck", "knit", "knit-tee", "thermal"]);
    if ((wantedSubtype === "knit" && knitFamily.has(entrySubtype)) || (entrySubtype === "knit" && knitFamily.has(wantedSubtype))) {
      return true;
    }
    if (wantedSubtype === "thermal" && ["sweater", "turtleneck", "knit"].includes(entrySubtype)) return true;
  }
  if (slot === "outer") {
    const softLayer = new Set(["fleece", "hoodie", "cardigan"]);
    if (softLayer.has(wantedSubtype) && softLayer.has(entrySubtype)) return true;
  }
  return false;
}

function stockImagePresentationCompatible(entry = {}, preferences = {}) {
  const userGender = String(preferences?.gender || "unspecified").toLowerCase();
  const entryGender = String(entry?.gender || "unisex").toLowerCase();
  if (userGender === "male" && entryGender === "feminine") return false;
  if (userGender === "female" && entryGender === "masculine") return false;
  return true;
}

function stockImageVisualCompatibility(slot, itemName, key, entry, context = {}) {
  const details = itemDetailsForAssetSlot(slot, context);
  const entryDetails = inferVisualDetailFromText(`${key || ""} ${entry?.description || ""} ${(entry?.keywords || []).join(" ")}`);
  const requestedColors = uniqueList(requestedColorTerms(itemName, details));
  const requestedMaterials = uniqueList(requestedMaterialTerms(itemName, details));
  const reasons = [];

  if (requestedColors.length && entryDetails.color && !visualColorCovered(requestedColors, entryDetails.color)) {
    reasons.push("color_conflict");
  }
  if (requestedMaterials.length && entryDetails.material && !visualMaterialCovered(requestedMaterials, entryDetails.material)) {
    const looseMaterialOk = requestedMaterials.includes("nylon") && /\b(shell|rain|waterproof|weatherproof|tech|parka)\b/i.test(`${key} ${entry?.description || ""}`);
    if (!looseMaterialOk) reasons.push("material_conflict");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    requestedColors,
    requestedMaterials,
    selectedColor: entryDetails.color || "",
    selectedMaterial: entryDetails.material || "",
  };
}

function stockImageSemanticallyCompatible(slot, itemName, key, entry, { allowGeneric = false, preferences = {} } = {}) {
  if (!entry || entry.slot !== slot || !isUsableStockImageCatalogEntry(entry)) return false;
  if (!stockImagePresentationCompatible(entry, preferences)) return false;
  const wantedSubtype = inferItemSubtype(itemName, slot);
  if (!wantedSubtype) return true;
  const entrySubtype = getStockItemSubtype(slot, key, entry);
  if (!entrySubtype) return Boolean(allowGeneric);
  if (areStockSubtypesCompatible(slot, wantedSubtype, entrySubtype)) return true;
  return false;
}

function chooseColorAwareStockKey(text = "", options = {}, fallbackKey = null) {
  if (/\b(black|dark)\b/.test(text) && options.black) return options.black;
  if (/\bcharcoal\b/.test(text) && options.charcoal) return options.charcoal;
  if (/\b(gray|grey)\b/.test(text) && options.gray) return options.gray;
  if (/\bnavy\b/.test(text) && options.navy) return options.navy;
  if (/\bolive|green\b/.test(text) && options.olive) return options.olive;
  if (/\b(tan|beige|camel)\b/.test(text) && options.tan) return options.tan;
  if (/\bbrown\b/.test(text) && options.brown) return options.brown;
  return fallbackKey;
}

function getCanonicalStockKeyForItem(slot, itemName = "") {
  const text = cleanInlineText(itemName).toLowerCase();
  if (!text) return null;
  if (slot === "top") {
    if (/\b(thermal|base layer|baselayer|wool|merino|sweater|jumper|pullover|knit)\b/.test(text)) return "top_knit_sweater_hanger";
    if (/\blong[-\s]?sleeve|long sleeve top\b/.test(text)) return "top_white_long_sleeve_tshirt_studio";
    if (/\bbreathable|t-?shirt|tee\b/.test(text)) return "top_white_tshirt_studio";
  }
  if (slot === "bottom") {
    if (/\bcomfortable\s+(pants|trousers)|everyday\s+(pants|trousers)|practical\s+(pants|trousers)|\bcomfortable bottoms?\b/.test(text)) return "bottom_black_trousers_studio";
  }
  if (slot === "outer") {
    const hoodieByColor = {
      black: "outer_black_hoodie_cotton_v1",
      brown: "outer_brown_hoodie_cotton_v1",
      charcoal: "outer_charcoal_hoodie_cotton_v1",
      gray: "outer_gray_hoodie_cotton_v1",
      navy: "outer_navy_hoodie_cotton_v1",
      olive: "outer_olive_hoodie_cotton_v1",
      tan: "outer_tan_hoodie_cotton_v1",
    };
    if (/\b(fleece|sherpa)\b/.test(text)) return chooseColorAwareStockKey(text, hoodieByColor, "outer_gray_hoodie_cotton_v1");
    if (/\b(rain|waterproof|weatherproof|shell|windbreaker)\b/.test(text)) return null;
    if (/\blight\s+overshirt|overshirt|shacket\b/.test(text)) return "outer_charcoal_overshirt_studio";
    if (/\bhoodie\b/.test(text)) return chooseColorAwareStockKey(text, hoodieByColor, "outer_gray_hoodie_cotton_v1");
    if (/\bblazer\b/.test(text)) return "outer_black_blazer_studio";
  }
  if (slot === "shoes") {
    if (/\bsneakers?|trainers?\b/.test(text)) return "shoes_white_sneakers_minimal";
  }
  if (slot === "accessory") {
    if (/\bwatch|wristwatch\b/.test(text)) return "accessory_black_watch_metal_v1";
    if (/\bbaseball cap|dad cap|snapback|sport cap|cap\b/.test(text)) return "accessory_baseball_cap_studio";
    if (/\bumbrella\b/.test(text)) return "accessory_white_umbrella_studio";
    if (/\bsunglasses?\b/.test(text)) return "accessory_black_sunglasses_studio";
  }
  return null;
}

function findStockImageForSlot(slot, itemName, preferredKey = null, context = {}) {
  const compatibilityContext = { allowGeneric: false, preferences: context.preferences || {} };
  const stockOk = (key, entry, { allowGeneric = false } = {}) => {
    if (!stockImageSemanticallyCompatible(slot, itemName, key, entry, { ...compatibilityContext, allowGeneric })) return false;
    return stockImageVisualCompatibility(slot, itemName, key, entry, context).ok;
  };
  const buildStockMatch = (key, entry, { baseConfidence = 55, canonical = false, preferred = false, matchQuality = "stock" } = {}) => {
    const aestheticScore = scoreAestheticContext(itemName, entry, key, context);
    const visual = stockImageVisualCompatibility(slot, itemName, key, entry, context);
    return {
      key,
      path: entry.path,
      description: entry.description,
      confidence: Math.max(0, Math.min(100, baseConfidence + aestheticScore.score)),
      source: "stock",
      matchQuality,
      aesthetic: aestheticScore.aesthetic,
      penalties: [...(aestheticScore.penalties || []), ...(visual.reasons || [])],
      ...(canonical ? { canonical: true } : {}),
      ...(preferred ? { preferred: true } : {}),
    };
  };
  if (
    preferredKey
    && stockOk(preferredKey, STOCK_IMAGE_CATALOG[preferredKey])
  ) {
    const entry = STOCK_IMAGE_CATALOG[preferredKey];
    return buildStockMatch(preferredKey, entry, { baseConfidence: 80, preferred: true, matchQuality: "preferred_stock" });
  }
  const canonicalKey = getCanonicalStockKeyForItem(slot, itemName);
  if (
    canonicalKey
    && stockOk(canonicalKey, STOCK_IMAGE_CATALOG[canonicalKey])
  ) {
    const entry = STOCK_IMAGE_CATALOG[canonicalKey];
    return buildStockMatch(canonicalKey, entry, { baseConfidence: 88, canonical: true, matchQuality: "canonical_stock" });
  }

  const entries = getUsableStockImageCatalogEntries().filter(([, entry]) => entry.slot === slot);
  let best = null;
  let bestScore = -1;
  for (const [key, entry] of entries) {
    if (!stockOk(key, entry)) continue;
    const score = scoreCatalogMatch(itemName, entry, key, context);
    if (score > bestScore) {
      best = buildStockMatch(key, entry, {
        baseConfidence: 55 + score,
        matchQuality: score >= 30 ? "strong_stock" : "acceptable_stock",
      });
      bestScore = score;
    }
  }

  if (best && bestScore > 0 && stockOk(best.key, STOCK_IMAGE_CATALOG[best.key])) return best;
  const wantedSubtype = inferItemSubtype(itemName, slot);
  const fallback = entries.find(([key, entry]) => {
    if (!entry.fallback) return false;
    if (!stockImagePresentationCompatible(entry, context.preferences || {})) return false;
    const fallbackSubtype = getStockItemSubtype(slot, key, entry);
    return !wantedSubtype || !fallbackSubtype || wantedSubtype === fallbackSubtype;
  });
  return fallback ? {
    key: fallback[0],
    path: fallback[1].path,
    description: fallback[1].description,
    confidence: 45,
    source: "fallback",
    matchQuality: "generic_fallback",
    aesthetic: inferCatalogAesthetic(fallback[1], fallback[0]),
    penalties: ["fallback"],
  } : null;
}

async function buildRecommendationAssetMatches(outfit, wardrobeItems = [], preferredKeys = null, context = {}) {
  const output = {};
  const preferred = preferredKeys && typeof preferredKeys === "object" ? preferredKeys : {};
  if (!Array.isArray(wardrobeItems) || wardrobeItems.length === 0) {
    const stockTasks = ["top", "bottom", "outer", "shoes"]
      .map((slot) => ({ slot, itemName: cleanInlineText(outfit?.[slot]) }))
      .filter((entry) => entry.itemName)
      .map(async ({ slot, itemName }) => {
        const matchText = assetMatchTextForSlot(slot, itemName, context) || itemName;
        output[slot] = findStockImageForSlot(slot, matchText, cleanInlineText(preferred?.[slot]), context) || null;
      });
    const accessories = Array.isArray(outfit?.accessories)
      ? outfit.accessories
      : [outfit?.accessories];
    accessories.map((item) => cleanInlineText(item)).filter(Boolean).slice(0, 1).forEach((itemName, index) => {
      stockTasks.push(Promise.resolve().then(() => {
        const matchText = assetMatchTextForSlot("accessory", itemName, context) || itemName;
        output[`accessory-${index}`] = findStockImageForSlot("accessory", matchText, cleanInlineText(preferred?.accessory), context) || null;
      }));
    });
    await Promise.all(stockTasks);
    return output;
  }
  const usedItemIds = new Set();
  const resolveSlot = async (slot, itemName, outputKey = slot) => {
    const matchText = assetMatchTextForSlot(slot, itemName, context) || itemName;
    const wardrobeMatch = await findWardrobeImageForSlot(slot, matchText, wardrobeItems, context, usedItemIds);
    if (wardrobeMatch) {
      const id = String(wardrobeMatch.itemId ?? wardrobeMatch.itemName ?? "");
      if (id) usedItemIds.add(id);
      output[outputKey] = wardrobeMatch;
      return;
    }
    output[outputKey] = findStockImageForSlot(slot, matchText, cleanInlineText(preferred?.[slot]), context) || null;
  };

  for (const slot of ["top", "bottom", "outer", "shoes"]) {
    const itemName = cleanInlineText(outfit?.[slot]);
    if (!itemName) {
      output[slot] = null;
      continue;
    }
    await resolveSlot(slot, itemName, slot);
  }

  const accessories = Array.isArray(outfit?.accessories)
    ? outfit.accessories
    : [outfit?.accessories];
  for (const [index, value] of accessories.map((item) => cleanInlineText(item)).filter(Boolean).slice(0, 1).entries()) {
    await resolveSlot("accessory", value, `accessory-${index}`);
  }
  return output;
}

function inferVisualDetailFromText(text = "") {
  const value = cleanInlineText(text).toLowerCase();
  if (!value) return {};
  const colorPatterns = [
    ["off-white", /\boff[-\s]?white\b/],
    ["charcoal", /\bcharcoal\b/],
    ["navy", /\bnavy\b/],
    ["black", /\bblack\b/],
    ["white", /\bwhite\b/],
    ["cream", /\bcream|ivory\b/],
    ["gray", /\bgray|grey\b/],
    ["beige", /\bbeige\b/],
    ["tan", /\btan|camel\b/],
    ["brown", /\bbrown\b/],
    ["olive", /\bolive\b/],
    ["green", /\bgreen\b/],
    ["blue", /\bblue\b/],
    ["burgundy", /\bburgundy\b/],
    ["red", /\bred\b/],
    ["pink", /\bpink\b/],
    ["purple", /\bpurple\b/],
    ["yellow", /\byellow\b/],
    ["orange", /\borange\b/],
  ];
  const materialPatterns = [
    ["merino wool", /\bmerino\b/],
    ["wool", /\bwool\b/],
    ["fleece", /\bfleece|sherpa\b/],
    ["linen", /\blinen\b/],
    ["silk", /\bsilk\b/],
    ["denim", /\bdenim\b/],
    ["leather", /\bleather|suede\b/],
    ["nylon", /\bnylon|shell|waterproof|weatherproof|rain\b/],
    ["canvas", /\bcanvas\b/],
    ["rubber", /\brubber\b/],
    ["cotton", /\bcotton|chino|twill\b/],
    ["knit", /\bknit|sweater|jumper|pullover|cardigan\b/],
    ["metal", /\bmetal|steel\b/],
  ];
  const color = colorPatterns.find(([, pattern]) => pattern.test(value))?.[0] || "";
  const material = materialPatterns.find(([, pattern]) => pattern.test(value))?.[0] || "";
  return { color, material };
}

function inferAssetDetailFromImageMatch(match = {}) {
  if (!match) return {};
  if (match.source === "wardrobe") {
    return {
      color: cleanInlineText(match.color),
      material: cleanInlineText(match.material),
    };
  }
  if (match.source !== "stock" && match.source !== "fallback") return {};
  const entry = STOCK_IMAGE_CATALOG[match.key] || {};
  return inferVisualDetailFromText(`${match.key || ""} ${entry.description || ""} ${(entry.keywords || []).join(" ")}`);
}

function reconcileItemDetailsWithImageMatches(itemDetails = {}, outfitImages = {}) {
  const next = itemDetails && typeof itemDetails === "object" ? { ...itemDetails } : {};
  const slots = [
    ["top", "top"],
    ["bottom", "bottom"],
    ["outer", "outer"],
    ["shoes", "shoes"],
    ["accessory", "accessory-0"],
  ];
  slots.forEach(([detailKey, imageKey]) => {
    const inferred = inferAssetDetailFromImageMatch(outfitImages?.[imageKey]);
    if (!inferred.color && !inferred.material) return;
    next[detailKey] = {
      ...(next[detailKey] || {}),
      ...(inferred.color ? { color: inferred.color } : {}),
      ...(inferred.material ? { material: inferred.material } : {}),
    };
  });
  return next;
}

function extractVisualTerms(text = "", terms = []) {
  const value = cleanInlineText(text).toLowerCase();
  if (!value) return [];
  return terms.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(value));
}

function requestedColorTerms(itemName = "", details = {}) {
  return extractVisualTerms(`${itemName} ${details?.color || ""}`, [
    "off-white", "charcoal", "navy", "black", "white", "cream", "ivory", "gray", "grey",
    "beige", "tan", "camel", "brown", "olive", "green", "blue", "burgundy", "red",
    "pink", "purple", "yellow", "orange",
  ]).map((term) => term === "grey" ? "gray" : term === "ivory" ? "cream" : term);
}

function requestedMaterialTerms(itemName = "", details = {}) {
  return extractVisualTerms(`${itemName} ${details?.material || ""}`, [
    "merino", "wool", "fleece", "sherpa", "linen", "silk", "denim", "leather", "suede",
    "nylon", "shell", "waterproof", "weatherproof", "rain", "canvas", "rubber", "cotton",
    "chino", "twill", "knit", "metal", "steel",
  ]).map((term) => {
    if (term === "merino") return "wool";
    if (term === "sherpa") return "fleece";
    if (term === "suede") return "leather";
    if (["shell", "waterproof", "weatherproof", "rain"].includes(term)) return "nylon";
    if (["chino", "twill"].includes(term)) return "cotton";
    if (term === "steel") return "metal";
    return term;
  });
}

function uniqueList(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function visualColorCovered(requested = [], selected = "") {
  const selectedColor = selected === "grey" || selected === "gray" ? "gray" : selected === "ivory" ? "cream" : selected;
  if (!requested.length || !selectedColor) return true;
  if (requested.includes(selectedColor)) return true;
  if (requested.includes("off-white") && ["white", "cream"].includes(selectedColor)) return true;
  if (requested.includes("cream") && ["ivory", "off-white"].includes(selectedColor)) return true;
  return false;
}

function visualMaterialCovered(requested = [], selected = "") {
  const selectedMaterial = selected === "merino wool" ? "wool" : selected;
  if (!requested.length || !selectedMaterial) return true;
  if (requested.includes(selectedMaterial)) return true;
  if (requested.includes("knit") && ["wool", "cotton"].includes(selectedMaterial)) return true;
  if (requested.includes("wool") && selectedMaterial === "knit") return true;
  if (requested.includes("wool") && selectedMaterial === "merino wool") return true;
  return false;
}

function stockImageGapRecords(recommendation = {}, weather = {}, preferences = {}, location = {}, source = "unknown") {
  const records = [];
  const profile = classifyWeatherProfile(weather);
  const weatherBand = profile.veryHot
    ? "very_hot"
    : profile.hot
      ? "hot"
      : (Number.isFinite(profile.feelsLike) && profile.feelsLike <= -5)
        ? "extreme_cold"
        : profile.veryCold
          ? "very_cold"
          : profile.cold
            ? "cold"
            : profile.wet || profile.rainLikelyLater
              ? "wet"
              : "mild";
  const slots = [
    ["top", "top"],
    ["bottom", "bottom"],
    ["outer", "outer"],
    ["shoes", "shoes"],
    ["accessory", "accessory-0"],
  ];
  slots.forEach(([slot, imageKey]) => {
    const itemName = slot === "accessory"
      ? cleanInlineText(Array.isArray(recommendation?.outfit?.accessories) ? recommendation.outfit.accessories[0] : recommendation?.outfit?.accessories)
      : cleanInlineText(recommendation?.outfit?.[slot]);
    if (!itemName) return;
    const details = recommendation?.itemDetails?.[slot] || {};
    const imageMatch = recommendation?.outfitImages?.[imageKey];
    if (imageMatch?.source === "wardrobe") return;

    const requestedText = assetMatchTextForSlot(slot, itemName, { itemDetails: recommendation?.itemDetails }) || itemName;
    const requestedSubtype = inferItemSubtype(requestedText, slot);
    const selectedSubtype = imageMatch?.source === "stock" || imageMatch?.source === "fallback"
      ? getStockItemSubtype(slot, imageMatch.key, STOCK_IMAGE_CATALOG[imageMatch.key])
      : "";
    const selectedDetails = inferAssetDetailFromImageMatch(imageMatch);
    const colors = uniqueList(requestedColorTerms(itemName, details));
    const materials = uniqueList(requestedMaterialTerms(itemName, details));
    const reasons = [];

    if (!imageMatch) reasons.push("no_stock_image");
    if (imageMatch?.source === "fallback" || imageMatch?.fallback) reasons.push("fallback_stock_image");
    if ((imageMatch?.source === "stock" || imageMatch?.source === "fallback") && imageMatch.canonical && requestedSubtype && selectedSubtype && requestedSubtype !== selectedSubtype) reasons.push("canonical_approximation");
    if (requestedSubtype && selectedSubtype && requestedSubtype !== selectedSubtype) reasons.push("subtype_approximation");
    if (colors.length && !visualColorCovered(colors, selectedDetails.color)) reasons.push("color_gap");
    if (materials.length && !visualMaterialCovered(materials, selectedDetails.material)) reasons.push("material_gap");
    if (Array.isArray(imageMatch?.penalties) && imageMatch.penalties.includes("fallback")) reasons.push("fallback_penalty");
    if (Number(imageMatch?.confidence) > 0 && Number(imageMatch.confidence) < 72) reasons.push("low_confidence_stock");

    const uniqueReasons = uniqueList(reasons);
    if (!uniqueReasons.length) return;
    records.push({
      at: new Date().toISOString(),
      source,
      slot,
      itemName,
      itemDetails: {
        color: cleanInlineText(details?.color),
        material: cleanInlineText(details?.material),
      },
      requested: {
        text: requestedText,
        subtype: requestedSubtype,
        colors,
        materials,
      },
      selectedStock: imageMatch?.source === "stock" || imageMatch?.source === "fallback" ? {
        key: imageMatch.key || "",
        path: imageMatch.path || "",
        subtype: selectedSubtype,
        color: selectedDetails.color || "",
        material: selectedDetails.material || "",
        confidence: Number(imageMatch.confidence || 0),
        source: imageMatch.source || "",
        matchQuality: imageMatch.matchQuality || "",
        penalties: Array.isArray(imageMatch.penalties) ? imageMatch.penalties : [],
      } : null,
      reasons: uniqueReasons,
      context: {
        temperature: Number.isFinite(Number(weather?.temperature)) ? Number(weather.temperature) : null,
        feelsLike: Number.isFinite(Number(weather?.feelsLike)) ? Number(weather.feelsLike) : null,
        weatherLabel: cleanInlineText(weather?.weatherLabel || ""),
        weatherBand,
        gender: cleanInlineText(preferences?.gender || "unspecified"),
        genderPresentation: presentationPreferenceLabel(preferences),
        styleFocus: cleanInlineText(preferences?.styleFocus || ""),
        activityContext: cleanInlineText(preferences?.activityContext || ""),
        locationContext: cleanInlineText(preferences?.locationContext || ""),
      },
      backlogKey: [
        slot,
        normalizeMatchText(itemName),
        requestedSubtype || "generic",
        colors.join("+") || "any-color",
        materials.join("+") || "any-material",
      ].join("|"),
    });
  });
  return records;
}

async function recordStockImageGaps(recommendation = {}, weather = {}, preferences = {}, location = {}, source = "unknown") {
  const records = stockImageGapRecords(recommendation, weather, preferences, location, source);
  if (!records.length) return;
  if (process.env.DATABASE_URL) {
    try {
      await dbPool.query(
        `
          INSERT INTO recommendation_stock_gaps (
            created_at,
            source,
            slot,
            item_name,
            item_color,
            item_material,
            requested,
            selected_stock,
            reasons,
            context,
            backlog_key
          )
          SELECT
            COALESCE((record->>'at')::timestamptz, NOW()),
            record->>'source',
            record->>'slot',
            record->>'itemName',
            record->'itemDetails'->>'color',
            record->'itemDetails'->>'material',
            COALESCE(record->'requested', '{}'::jsonb),
            record->'selectedStock',
            COALESCE(ARRAY(SELECT jsonb_array_elements_text(record->'reasons')), ARRAY[]::text[]),
            COALESCE(record->'context', '{}'::jsonb),
            record->>'backlogKey'
          FROM jsonb_array_elements($1::jsonb) AS record
        `,
        [JSON.stringify(records)]
      );
      logApiEvent("info", "stock_image_gaps_recorded", {
        count: records.length,
        source,
        slots: records.map((record) => record.slot),
        sink: "database",
      });
      return;
    } catch (err) {
      console.warn("[recommend] stock gap database log failed", {
        errorName: err?.name || "Error",
        errorMessage: err?.message || String(err),
      });
      captureServerException(err, { route: "/api/recommend", stage: "stock_gap_database_log" });
    }
  }
  try {
    await mkdir(dirname(STOCK_GAP_LOG_PATH), { recursive: true });
    await appendFile(STOCK_GAP_LOG_PATH, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
    logApiEvent("info", "stock_image_gaps_recorded", {
      count: records.length,
      source,
      slots: records.map((record) => record.slot),
      path: STOCK_GAP_LOG_PATH,
    });
  } catch (err) {
    console.warn("[recommend] stock gap log failed", {
      errorName: err?.name || "Error",
      errorMessage: err?.message || String(err),
    });
  }
}

function buildRecommendationImageMatches(outfit, preferredKeys = null, context = {}) {
  const output = {};
  const preferred = preferredKeys && typeof preferredKeys === "object" ? preferredKeys : {};
  for (const slot of ["top", "bottom", "outer", "shoes"]) {
    const itemName = cleanInlineText(outfit?.[slot]);
    if (!itemName) {
      output[slot] = null;
      continue;
    }
    const matchText = assetMatchTextForSlot(slot, itemName, context) || itemName;
    output[slot] = findStockImageForSlot(slot, matchText, cleanInlineText(preferred?.[slot]), context) || null;
  }
  const accessories = Array.isArray(outfit?.accessories)
    ? outfit.accessories
    : [outfit?.accessories];
  accessories
    .map((value) => cleanInlineText(value))
    .filter(Boolean)
    .slice(0, 1)
    .forEach((itemName, index) => {
      const matchText = assetMatchTextForSlot("accessory", itemName, context) || itemName;
      output[`accessory-${index}`] = findStockImageForSlot("accessory", matchText, cleanInlineText(preferred?.accessory), context) || null;
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

async function ensureAiSlotContent(response, weather, preferences, location) {
  if (hasCompleteSlotReasons(response?.slotReasons, response?.outfit) && hasCompleteItemDetails(response?.itemDetails, response?.outfit)) {
    return response;
  }

  const prompt = `You are writing WearCast outfit-card content.

Write one short, natural, context-based line for each outfit item, plus concise plausible color and material details for each item.

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
- Color should be 1 to 3 words.
- Material should be 1 to 4 words.
- Infer plausible item details from the exact item name and style direction.
- Accessories need details too.
- If there is no outer layer, return an empty string for outer.
- If there is no accessory, return an empty string for accessory.
- Return JSON only.

{
  "slotReasons": {
    "top": "short reason",
    "bottom": "short reason",
    "outer": "short reason or empty string",
    "shoes": "short reason",
    "accessory": "short reason or empty string"
  },
  "itemDetails": {
    "top": { "color": "short color", "material": "short material" },
    "bottom": { "color": "short color", "material": "short material" },
    "outer": { "color": "short color", "material": "short material" },
    "shoes": { "color": "short color", "material": "short material" },
    "accessory": { "color": "short color", "material": "short material" }
  }
}`;

  try {
    const text = await chatCompletion([{ role: "user", content: prompt }], { maxTokens: 260 });
    const parsed = parseModelJson(text);
    const itemDetails = normalizeRecommendationItemDetails(parsed?.itemDetails);
    return {
      ...response,
      slotReasons: {
        top: clampSentenceCount(parsed?.slotReasons?.top, 1) || response?.slotReasons?.top || "",
        bottom: clampSentenceCount(parsed?.slotReasons?.bottom, 1) || response?.slotReasons?.bottom || "",
        outer: clampSentenceCount(parsed?.slotReasons?.outer, 1) || response?.slotReasons?.outer || "",
        shoes: clampSentenceCount(parsed?.slotReasons?.shoes, 1) || response?.slotReasons?.shoes || "",
        accessory: clampSentenceCount(parsed?.slotReasons?.accessory, 1) || response?.slotReasons?.accessory || "",
      },
      itemDetails: {
        ...normalizeRecommendationItemDetails(response?.itemDetails),
        top: itemDetails.top.color || itemDetails.top.material ? itemDetails.top : normalizeRecommendationItemDetail(response?.itemDetails?.top),
        bottom: itemDetails.bottom.color || itemDetails.bottom.material ? itemDetails.bottom : normalizeRecommendationItemDetail(response?.itemDetails?.bottom),
        outer: itemDetails.outer.color || itemDetails.outer.material ? itemDetails.outer : normalizeRecommendationItemDetail(response?.itemDetails?.outer),
        shoes: itemDetails.shoes.color || itemDetails.shoes.material ? itemDetails.shoes : normalizeRecommendationItemDetail(response?.itemDetails?.shoes),
        accessory: itemDetails.accessory.color || itemDetails.accessory.material ? itemDetails.accessory : normalizeRecommendationItemDetail(response?.itemDetails?.accessory),
      },
    };
  } catch (err) {
    console.warn("slot content generation fallback:", err?.message || err);
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
    minTemp: min(temps),
    maxTemp: max(temps),
    minFeelsLike: min(feelsLike),
    maxFeelsLike: max(feelsLike),
    maxWindKmh: max(winds),
    maxPrecipProbPct: max(precipProbs),
    totalPrecipMm: +(precips.reduce((sum, value) => sum + value, 0)).toFixed(1),
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

function buildFallbackRecommendation(weather, preferences = {}, reason = "weather rules fallback") {
  const temp = Number(weather?.temperature);
  const envelope = getRecommendationWeatherEnvelope(weather);
  const currentFeels = Number.isFinite(envelope.currentFeels)
    ? envelope.currentFeels
    : Number(weather?.feelsLike ?? temp);
  const feelsLike = Number.isFinite(envelope.minFeelsLike)
    ? Math.min(currentFeels, envelope.minFeelsLike)
    : currentFeels;
  const precipProb = envelope.maxPrecipProb;
  const wind = envelope.maxWind;
  const weatherLabel = String(weather?.weatherLabel || "").toLowerCase();
  const profile = classifyWeatherProfile(weather);
  const polished = preferences?.activityContext === "office" || preferences?.styleFocus === "polished" || preferences?.formal;
  const sporty = preferences?.activityContext === "workout" || preferences?.styleFocus === "sporty" || preferences?.sporty;

  const freezing = weatherLabel.includes("snow") || weatherLabel.includes("freezing");
  const stormy = weatherLabel.includes("thunder");
  const coldish = feelsLike <= 8;
  const veryCold = feelsLike <= 2;
  const extremeCold = feelsLike <= -5;
  const hot = feelsLike >= 28;
  const veryHot = feelsLike >= 32;
  const wet = precipProb >= 45 || weatherLabel.includes("rain") || weatherLabel.includes("drizzle") || stormy || freezing;

  let top = profile.veryHot && polished
    ? "Short-sleeve linen shirt"
    : profile.veryHot
      ? "Breathable cotton T-shirt"
      : hot && polished
        ? "Lightweight polo"
        : sporty && hot
          ? "Performance tank"
          : veryCold
    ? (extremeCold ? "Thermal wool base layer" : "Thermal base layer")
    : coldish
      ? "Long-sleeve tee"
      : veryHot
        ? "Lightweight T-shirt"
        : temp <= 20
          ? "Long-sleeve top"
          : "Breathable T-shirt";
  let bottom = profile.veryHot && polished
    ? "Lightweight linen trousers"
    : profile.veryHot
      ? "Cotton shorts"
      : hot && polished
        ? "Lightweight chinos"
        : sporty && hot
          ? "Running shorts"
          : veryCold
    ? (extremeCold ? "Insulated snow pants" : "Insulated pants")
    : hot
      ? "Linen shorts"
      : wet && coldish
        ? "Water-resistant pants"
        : temp <= 12
          ? "Jeans"
          : "Comfortable pants";
  let outer = profile.veryHot || (hot && !wet && wind < 30)
    ? ""
    : veryCold
    ? (extremeCold ? "Insulated winter parka" : "Waterproof parka")
    : wet
      ? "Waterproof jacket"
      : coldish || wind >= 25
        ? (feelsLike <= 6 ? "Warm fleece jacket" : "Light jacket")
        : hot
          ? "Breathable overshirt"
          : "Light overshirt";
  let shoes = polished && !wet && !veryCold
    ? "Leather loafers"
    : sporty
      ? "Breathable running sneakers"
      : veryCold || freezing
    ? (extremeCold ? "Insulated winter boots" : "Waterproof boots")
    : wet
      ? "Waterproof sneakers"
      : hot
        ? "Canvas sneakers"
        : "Sneakers";
  const presentation = String(preferences?.gender || "unspecified").toLowerCase();
  if (presentation === "female") {
    if (profile.veryHot && polished) top = "Short-sleeve linen blouse";
    else if (profile.veryHot) top = "Breathable cotton blouse";
    else if (hot && polished) top = "Lightweight sleeveless blouse";
    else if (veryCold) top = extremeCold ? "Thermal wool base layer" : "Thermal knit top";
    else if (coldish) top = "Long-sleeve knit top";
    else if (temp <= 20) top = "Long-sleeve blouse";
    else top = "Breathable blouse";

    if (profile.veryHot && polished) bottom = "Lightweight wide-leg trousers";
    else if (profile.veryHot) bottom = "Cotton midi skirt";
    else if (hot && polished) bottom = "Lightweight culottes";
    else if (sporty && hot) bottom = "Bike shorts";
    else if (veryCold) bottom = extremeCold ? "Insulated snow pants" : "Insulated trousers";
    else if (hot) bottom = "Linen shorts";
    else if (wet && coldish) bottom = "Water-resistant trousers";
    else if (temp <= 12) bottom = "High-waist jeans";
    else bottom = "Wide-leg trousers";

    if (polished && !wet && !veryCold) shoes = coldish ? "Knee-high boots" : "Ballet flats";
    else if (sporty) shoes = "Breathable running sneakers";
    else if (veryCold || freezing) shoes = extremeCold ? "Insulated winter boots" : "Waterproof boots";
    else if (wet) shoes = "Waterproof ankle boots";
    else if (hot) shoes = "Canvas flats";
    else shoes = "Ballet flats";
  } else if (presentation === "male") {
    if (profile.veryHot && polished) top = "Short-sleeve linen shirt";
    else if (hot && polished) top = "Lightweight polo";
    else if (veryCold) top = extremeCold ? "Thermal wool base layer" : "Thermal base layer";
    else if (coldish) top = "Long-sleeve tee";
    else if (temp <= 20) top = "Oxford shirt";

    if (profile.veryHot && polished) bottom = "Lightweight linen trousers";
    else if (hot && polished) bottom = "Lightweight chinos";
    else if (temp > 12 && !hot && !wet && !veryCold) bottom = "Chinos";

    if (polished && !wet && !veryCold) shoes = "Leather loafers";
  }
  const accessories = [];

  if (wet && !freezing) accessories.push("Umbrella");
  else if (Number(weather?.uv ?? 0) >= 6) accessories.push("Sunglasses");
  else if (extremeCold) accessories.push("Insulated gloves");
  else if (coldish) accessories.push("Beanie");
  else if (presentation === "female") accessories.push("Mini bag");
  else accessories.push("Watch");

  const response = {
    outfit: { top, bottom, outer, shoes, accessories },
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
    itemDetails: buildFallbackItemDetails({ top, bottom, outer, shoes, accessories }),
    reasoning: buildContextReasoningFallback({ outfit: { top, bottom, outer, shoes, accessories } }, weather),
    detailsOverview: {
      what: `${top}, ${bottom}, and ${shoes}${outer ? ` with a ${outer}` : ""} make a practical outfit for the current conditions.`,
      why: buildContextReasoningFallback({ outfit: { top, bottom, outer, shoes, accessories } }, weather),
      note: accessories[0] ? `${accessories[0]} adds a useful final layer of weather protection.` : `Generated from deterministic weather rules: ${reason}.`,
    },
    warnings: precipProb >= 40 ? ["Rain may be likely later, so bring a waterproof layer."] : [],
    missingItems: extremeCold ? ["Add a warm beanie or face covering if you will be outside."] : [],
  };
  return ensureRecommendationShape(response, weather, preferences);
}

// ─── POST /api/scan-tag ───────────────────────────────────────
app.post("/api/analyze-item-photo", async (req, res) => {
  const requestId = randomUUID();
  const log = createAnalyzeLogger(requestId);
  try {
    const { image } = req.body;
    res.set("X-WearCast-Request-Id", requestId);
    if (!image) return res.status(400).json({ error: "No image provided", requestId });

    log.event("start", {
      imageChars: typeof image === "string" ? image.length : 0,
    });

    const classifiedMode = await classifyWardrobePhotoMode(image, { requestId });
    log.event("mode-classified", { classifiedMode });

    let source = "llm-primary";
    let items = [];

    if (classifiedMode === "product") {
      const [boxResult, metadataResult] = await Promise.allSettled([
        extractForegroundBoxFromImage(image),
        analyzeProductPhotoMetadata(image, { requestId }),
      ]);
      const box = boxResult.status === "fulfilled" ? boxResult.value : null;
      const metadata = metadataResult.status === "fulfilled"
        ? metadataResult.value
        : {
            type: null,
            name: null,
            color: null,
            material: null,
            careInstructions: [],
          };

      if (boxResult.status === "rejected") {
        log.warn("product-foreground-failed", { error: boxResult.reason?.message || String(boxResult.reason) });
      }
      if (metadataResult.status === "rejected") {
        log.warn("product-metadata-failed", { error: metadataResult.reason?.message || String(metadataResult.reason) });
      }

      if (box) {
        items = [{
          type: metadata.type || "Other",
          name: metadata.name || metadata.type || "Clothing item",
          color: metadata.color || null,
          material: metadata.material || null,
          careInstructions: metadata.careInstructions || [],
          box,
          geometrySource: "product-foreground",
        }];
        source = "product-foreground";
      }
    }

    if (!items.length) {
      try {
        items = await analyzeWardrobeItemsWithLLM(image, { requestId });
        if (items.length) {
          source = "llm-primary";
          log.event("llm-items", {
            count: items.length,
            items: summarizeAnalyzeItems(items),
          });
        }
      } catch (err) {
        log.warn("llm-items-failed", { error: err?.message || String(err) });
      }
    }

    if (!items.length && classifiedMode !== "product") {
      try {
        const outfitAnalysis = await segmentWardrobeOutfitImage(image);
        log.debug("outfit-segmentation", {
          itemCount: outfitAnalysis.items.length,
          hasBodySignal: outfitAnalysis.hasBodySignal,
          items: summarizeAnalyzeItems(outfitAnalysis.items),
        });
        if (outfitAnalysis.items.length && (classifiedMode === "outfit" || outfitAnalysis.hasBodySignal)) {
          items = outfitAnalysis.items;
          source = "outfit-segmentation-fallback";
        } else if (outfitAnalysis.items.length) {
          items = outfitAnalysis.items;
          source = "segmentation-fallback";
        } else {
          const segmentedItems = await segmentWardrobeItemsFromImage(image);
          if (segmentedItems.length) {
            items = segmentedItems.map((item) => ({
              ...item,
              geometrySource: item.geometrySource || "segmentation-fallback",
            }));
            source = "segmentation-fallback";
          }
        }
      } catch (err) {
        log.warn("segmentation-fallback-failed", { error: err?.message || String(err) });
      }
    }

    items = classifiedMode === "outfit"
      ? finalizeOutfitDetectedItems(items, { source })
      : finalizeDetectedItems(items, { classifiedMode, source });

    if (classifiedMode === "product" && source === "llm-primary" && items.length === 1) {
      const candidate = items[0];
      const needsTypeRefinement = /^(shirt|top|other)$/i.test(cleanInlineText(candidate?.type || ""));
      if (needsTypeRefinement) {
        try {
          const refined = await refineProductPrimaryItem(image, candidate, { requestId });
          items = finalizeDetectedItems([refined], { classifiedMode, source });
          log.event("product-type-refined", {
            before: summarizeAnalyzeItems([candidate]),
            after: summarizeAnalyzeItems(items),
          });
        } catch (err) {
          log.warn("product-type-refinement-failed", { error: err?.message || String(err) });
        }
      }

      const poloAmbiguous = /^shirt$/i.test(cleanInlineText(items[0]?.type || ""))
        || /\bshirt\b/i.test(cleanInlineText(items[0]?.name || ""));
      if (poloAmbiguous) {
        try {
          const poloCheck = await checkIfPoloTop(image, items[0], { requestId });
          if (poloCheck.isPolo) {
            items = finalizeDetectedItems([{
              ...items[0],
              type: "Polo",
              name: cleanInlineText(poloCheck.name) || `${cleanInlineText(items[0]?.color) || "Polo"} Polo`,
            }], { classifiedMode, source });
            log.event("product-polo-promoted", {
              result: summarizeAnalyzeItems(items),
            });
          }
        } catch (err) {
          log.warn("product-polo-check-failed", { error: err?.message || String(err) });
        }
      }
    }

    if (classifiedMode === "product" && source === "llm-primary") {
      items = items.map((item) => ({
        ...item,
        geometrySource: item.geometrySource || "product-llm",
      }));
    }

    const first = items[0] || {};
    log.event("success", {
      source,
      count: items.length,
      items: summarizeAnalyzeItems(items),
    });

    res.json({
      requestId,
      items,
      type: first.type || null,
      name: first.name || null,
      color: first.color || null,
      material: first.material || null,
      careInstructions: first.careInstructions || [],
      box: first.box || null,
      source,
    });
  } catch (err) {
    log.error("fatal", err);
    captureServerException(err, { requestId, route: "/api/analyze-item-photo" });
    res.status(500).json({ error: "Failed to analyse clothing photo", requestId });
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
    captureServerException(err, { route: "/api/scan-tag" });
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
    const timings = createTimingTracker();
    const { weather, wardrobe, preferences: rawPreferences, location, outlookWindows } = req.body;
    const preferences = normalizeRecommendationPreferences(rawPreferences);
    const resolvedWeather = await resolveRecommendationWeather(weather, location);
    if (!resolvedWeather) return res.status(400).json({ error: "No weather data or location provided" });
    timings.mark("weather_resolved");
    const wardrobeItems = Array.isArray(wardrobe) ? wardrobe : [];
    const eligibleWardrobeItems = filterWardrobeItemsForRecommendation(wardrobeItems, preferences, resolvedWeather);
    const wardrobeAnalysis = analyzeWardrobeCandidates(wardrobeItems, eligibleWardrobeItems, preferences, resolvedWeather);
    timings.mark("wardrobe_scored", {
      wardrobeCount: wardrobeItems.length,
      eligibleWardrobeCount: eligibleWardrobeItems.length,
    });
    const hasWardrobe = eligibleWardrobeItems.length > 0;
    const profileBand = deriveRecommendationProfileBand(preferences, resolvedWeather);
    const archetypeDirective = buildArchetypeDirective(profileBand, location, preferences, resolvedWeather);
    const archetypePromptRule = archetypeDirective.safetyDominant
      ? "- Weather safety is dominant. Use archetype/style only as a soft finish after choosing weather-safe garment categories."
      : "- Avoid repeating the same outfit archetype for every similar request; follow the selected archetype direction unless the weather makes it unreasonable.";
    const styleGuardrails = buildStyleGuardrails(preferences, resolvedWeather);
    const wardrobePenaltyRules = buildWardrobePenaltyRules(eligibleWardrobeItems, wardrobeItems, preferences, resolvedWeather);
    console.info("[recommend] start", {
      requestId,
      location: location?.name || "Unknown",
      hasInlineWeather: !!weather,
      wardrobeCount: wardrobeItems.length,
      eligibleWardrobeCount: eligibleWardrobeItems.length,
      profileBand,
      preferences: preferences || {},
      tempC: resolvedWeather.temperature,
      feelsLikeC: resolvedWeather.feelsLike,
      windKmh: resolvedWeather.wind,
      precipProb: resolvedWeather.precipProb ?? null,
      weatherLabel: resolvedWeather.weatherLabel,
    });

    const cacheKey = recommendationCacheKey(resolvedWeather, eligibleWardrobeItems, preferences, location);
    const cachedRecommendation = getCachedRecommendation(cacheKey);
    if (cachedRecommendation) {
      console.info("[recommend] cache-hit", {
        requestId,
        durationMs: Date.now() - startedAt,
        preferences: preferences || {},
        genericReasoning: isGenericRecommendationReasoning(cachedRecommendation.reasoning),
      });
      if (!isGenericRecommendationReasoning(cachedRecommendation.reasoning)) {
        return res.json({
          ...cachedRecommendation,
          performance: timings.summary({ cacheHit: true }),
        });
      }
      const withReasoning = {
        ...cachedRecommendation,
        reasoning: buildContextReasoningFallback(cachedRecommendation, resolvedWeather),
      };
      setCachedRecommendation(cacheKey, withReasoning);
      return res.json({
        ...withReasoning,
        performance: timings.summary({ cacheHit: true }),
      });
    }

    const weatherProfile = classifyWeatherProfile(resolvedWeather);
    const deterministicHotOffice = weatherProfile.veryHot && profileBand === "office";
    if (deterministicHotOffice) {
      const response = await finalizeRecommendation(
        buildFallbackRecommendation(resolvedWeather, preferences, "very hot polished fast path"),
        resolvedWeather,
        preferences,
        location,
        wardrobeAnalysis,
        eligibleWardrobeItems,
        { allowQualityRetry: false, assetWardrobeItems: wardrobeItems, recommendationSource: "deterministic_fallback" }
      );
      setCachedRecommendation(cacheKey, response);
      return res.json({
        ...response,
        performance: timings.summary({ cacheHit: false, deterministicFastPath: "very_hot_office" }),
      });
    }

    const wardrobeDesc =
      hasWardrobe
        ? eligibleWardrobeItems
            .slice(0, 12)
            .map((item) => {
              const parts = [
                cleanInlineText(item.type),
                cleanInlineText(item.name),
                cleanInlineText(item.color),
                cleanInlineText(item.material),
              ].filter(Boolean);
              return `- ${parts.join(" | ")}`;
            })
            .join("\n")
        : "- none";

    const prefsDesc = [];
    if (preferences?.cold) prefsDesc.push("runs cold");
    if (preferences?.hot) prefsDesc.push("runs hot");
    if (preferences?.activityContext && preferences.activityContext !== "everyday") prefsDesc.push(`activity: ${preferences.activityContext}`);
    if (preferences?.locationContext && preferences.locationContext !== "mixed") prefsDesc.push(`setting: ${preferences.locationContext}`);
    if (preferences?.styleFocus && preferences.styleFocus !== "auto") prefsDesc.push(`style: ${preferences.styleFocus}`);
    if (preferences?.gender && preferences.gender !== "unspecified") prefsDesc.push(`presentation: ${presentationPreferenceLabel(preferences)}`);
    if (preferences?.fashionNotes) prefsDesc.push(`notes: ${cleanInlineText(preferences.fashionNotes).slice(0, 120)}`);
    const tuningRules = buildPreferenceTuningRules(preferences, resolvedWeather);
    const presentationDirective = buildPresentationDirective(preferences);

    const dayFc = resolvedWeather.remainingForecast;
    const dayForecastDesc = dayFc
      ? `later: temp ${dayFc.tempRange}; feels ${dayFc.feelsLikeRange}; wind ${dayFc.maxWind}; rain ${dayFc.maxPrecipProb}; uv ${dayFc.peakUV}`
      : "later: unavailable";

    // Compact 3-window summary the client computed from hourly data.
    // We pass it straight through so the model can write the outfit-outlook
    // copy itself instead of the client templating it.
    const safeOutlookWindows = Array.isArray(outlookWindows)
      ? outlookWindows
          .filter((w) => w && typeof w === "object")
          .slice(0, 3)
          .map((w) => ({
            label: typeof w.label === "string" ? w.label.slice(0, 24) : "",
            tempRange: typeof w.tempRange === "string" ? w.tempRange.slice(0, 24) : null,
            maxRain: Number.isFinite(Number(w.maxRain)) ? Math.round(Number(w.maxRain)) : null,
            maxWind: Number.isFinite(Number(w.maxWind)) ? Math.round(Number(w.maxWind)) : null,
            condition: typeof w.condition === "string" ? w.condition.slice(0, 32) : null,
          }))
      : [];
    const outlookDesc = safeOutlookWindows.length
      ? safeOutlookWindows
          .map((w) => `- ${w.label}: ${w.tempRange || "temp —"}, ${w.condition || "—"}, rain ${w.maxRain ?? "—"}%, wind ${w.maxWind ?? "—"} km/h`)
          .join("\n")
      : "- unavailable";
    const outlookPeriodKeys = (safeOutlookWindows.length ? safeOutlookWindows : [{ label: "Now" }, { label: "Later" }, { label: "Evening" }])
      .map((w) => String(w.label || "").toLowerCase().trim() || "now");

    const effectiveTemp = Number.isFinite(Number(resolvedWeather.feelsLike))
      ? Number(resolvedWeather.feelsLike)
      : Number(resolvedWeather.temperature);
    const weatherEnvelope = getRecommendationWeatherEnvelope(resolvedWeather);
    const wetRisk = Number(resolvedWeather.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow|freezing/i.test(String(resolvedWeather.weatherLabel || ""));
    const weatherRules = [
      effectiveTemp <= -5
        ? "- It is extreme cold. Use a thermal/wool base, insulated or snow-ready bottoms, an insulated winter parka or comparable heavy coat, insulated winter boots, and hand protection. Regular jeans, polos, fleece-only outerwear, and sneakers are not acceptable."
        : effectiveTemp <= 2
        ? "- It is very cold. Use a thermal or insulated top, insulated bottoms, a substantial winter outer layer, and boots. Avoid light sneakers."
        : effectiveTemp <= 8
          ? "- It is cold. Prefer long sleeves and a real outer layer. Do not suggest shorts."
          : effectiveTemp >= 35
            ? "- It is very hot. Use breathable single-layer pieces. Absolutely no wool, merino, thermal, fleece, sweater, hoodie, overshirt, jacket, blazer, coat, beanie, gloves, or umbrella unless rain is actually likely."
            : effectiveTemp >= 30
          ? "- It is hot. Prefer breathable lightweight pieces. Avoid wool, merino, fleece, thermal pieces, heavy layers, and unnecessary outerwear."
          : "- Temperature is moderate. A light layer may be appropriate depending on wind and rain.",
      (weatherEnvelope.coldLater || (weatherEnvelope.chillyLater && weatherEnvelope.sharpDrop))
        ? `- The rest of today drops to about ${weatherEnvelope.minFeelsLike}C feels-like. Plan for the coldest part of the wear window, not just right now: include a real jacket/coat/shell/fleece outer layer. Do not rely on only an overshirt or shacket for the outer slot.`
        : "- No major late-day temperature drop requires changing the outfit plan.",
      weatherEnvelope.moderateNow && !weatherEnvelope.wetLater && !weatherEnvelope.windyLater
        ? "- Right now is mild and dry. Avoid stacking a warm sweater with an overshirt unless a colder later window is handled by real outerwear."
        : "- Layering can be justified if wind, rain, or the later forecast requires it.",
      wetRisk
        ? "- Wet conditions are likely. Use a waterproof or water-resistant outer layer and avoid delicate open footwear."
        : "- Dry conditions are likely. Do not suggest an umbrella or rain gear.",
      Number(resolvedWeather.wind ?? 0) >= 25
        ? "- It is windy. Add a protective layer and avoid outfits that feel too exposed."
        : "- Wind is not a dominant factor right now.",
      Number(resolvedWeather.uv ?? 0) >= 7
        ? "- UV is high. Favor sun-protective accessories when sensible."
        : "- UV is not a major driver.",
    ].join("\n");

    const prompt = `You are WearCast. Return one weather-aware outfit for the rest of today.

Use wardrobe items only if they fit both the weather and the requested vibe. Otherwise use general recommendations. Make tuning visibly affect the result.

WEATHER
location: ${location?.name || "Unknown"}
now: ${resolvedWeather.temperature}C feels ${resolvedWeather.feelsLike}C, ${resolvedWeather.weatherLabel}, wind ${resolvedWeather.wind} km/h, rain ${resolvedWeather.precipProb ?? "unknown"}%, uv ${resolvedWeather.uv}, ${resolvedWeather.isDay ? "day" : "night"}
${dayForecastDesc}

OUTLOOK WINDOWS
${outlookDesc}

PREFERENCES
${prefsDesc.length ? prefsDesc.join("; ") : "none"}

PRESENTATION
${presentationDirective}

TUNING RULES
${tuningRules.length ? tuningRules.join("\n") : "- none"}

ARCHETYPE GUIDANCE
${archetypeDirective.text}

STYLE GUARDRAILS
${styleGuardrails.length ? styleGuardrails.join("\n") : "- none"}

WARDROBE
${wardrobeDesc}

WARDROBE PENALTY RULES
${wardrobePenaltyRules.join("\n")}

WEATHER RULES
${weatherRules}

RULES
- Use short item names.
- Consider only the rest of today.
- ${hasWardrobe ? "Use specific wardrobe item names only when they truly fit. Ignore the rest of the wardrobe completely." : "Generic outfit is fine."}
- Make the subline natural and weather-specific. No raw numbers or generic filler.
- Return 0 or 1 outer layer only when justified.
- Return exactly 1 accessory.
- Return at most 1 warning and 1 missing item.
- Return short slotReasons for every present slot.
- Return itemDetails with plausible color and material for every present slot.
- Keep detailsOverview high-level, not per-card repetition.
- Wardrobe fit is secondary to vibe fit. If wardrobe pieces degrade the intended profile, prefer generic recommendations.
- Strictly follow the PRESENTATION block above. Never propose a piece that conflicts with the user's chosen presentation (e.g. no skirts/heels for menswear, no neckties/oxford brogues for womenswear, no cocktail dresses or stilettos for unisex unless warranted).
${archetypePromptRule}
- For "outlook": write a short headline (max ~10 words) that names the outfit's lead pieces in plain language, and one specific sentence per window (now / later / evening) tying the outfit to that window's weather. Reference real items from "outfit" (top, outer, shoes, etc.) by name. No raw numbers, no generic filler ("stay comfortable"), and never repeat the same advice across windows.
- If a window key is missing from OUTLOOK WINDOWS above, you may omit it from "outlook.windows".
- JSON only.

Return ONLY valid JSON (no markdown fences). Fill "outlook" BEFORE moving on to warnings/missingItems so the outfit-outlook copy is never truncated.
{
  "outlook": {
    "headline": "Short outfit-led title naming the lead pieces (max ~10 words)",
    "windows": {
      "now": { "copy": "One specific sentence tying the outfit to the next 1–4 hours" },
      "later": { "copy": "One specific sentence for mid-day; reference a real outfit item by name" },
      "evening": { "copy": "One specific sentence for evening; mention layering or removal if relevant" }
    }
  },
  "outfit": {
    "top": "short item name",
    "bottom": "short item name",
    "outer": "short item name",
    "shoes": "short item name",
    "accessories": ["one item"]
  },
  "slotReasons": {
    "top": "one short reason",
    "bottom": "one short reason",
    "outer": "one short reason",
    "shoes": "one short reason",
    "accessory": "one short reason"
  },
  "itemDetails": {
    "top": { "color": "short color", "material": "short material" },
    "bottom": { "color": "short color", "material": "short material" },
    "outer": { "color": "short color", "material": "short material" },
    "shoes": { "color": "short color", "material": "short material" },
    "accessory": { "color": "short color", "material": "short material" }
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

    const compactNoWardrobePrompt = `You are WearCast. Return one weather-aware generic outfit for the rest of today. JSON only.

WEATHER: ${location?.name || "Unknown"}; now ${resolvedWeather.temperature}C feels ${resolvedWeather.feelsLike}C; ${resolvedWeather.weatherLabel}; wind ${resolvedWeather.wind} km/h; rain ${resolvedWeather.precipProb ?? "unknown"}%; uv ${resolvedWeather.uv}; ${dayForecastDesc}
OUTLOOK:
${outlookDesc}
PREFERENCES: ${prefsDesc.length ? prefsDesc.join("; ") : "none"}
PRESENTATION: ${presentationDirective}
WEATHER RULES:
${weatherRules}
STYLE: ${styleGuardrails.length ? styleGuardrails.slice(0, 4).join("\n") : "- keep it practical and natural"}

Rules: short item names; at most one outer; exactly one accessory; one warning and one missing item max; no raw numbers in user-facing copy; strictly follow presentation preference.
Return ONLY valid compact JSON with this shape:
{"outlook":{"headline":"max 10 words","windows":{"now":{"copy":"specific sentence"},"later":{"copy":"specific sentence"},"evening":{"copy":"specific sentence"}}},"outfit":{"top":"","bottom":"","outer":"","shoes":"","accessories":[""]},"slotReasons":{"top":"","bottom":"","outer":"","shoes":"","accessory":""},"itemDetails":{"top":{"color":"","material":""},"bottom":{"color":"","material":""},"outer":{"color":"","material":""},"shoes":{"color":"","material":""},"accessory":{"color":"","material":""}},"reasoning":"one natural weather-overview subline","detailsOverview":{"what":"one sentence","why":"one sentence","note":"optional short note"},"warnings":[],"missingItems":[]}`;

    const activePrompt = hasWardrobe ? prompt : compactNoWardrobePrompt;
    const recommendationModel = hasWardrobe ? MODEL : RECOMMENDATION_FAST_MODEL;

    let text = "";
    try {
      const recommendationMaxTokens = hasWardrobe ? 1800 : 1050;
      const recommendationTimeoutMs = hasWardrobe ? 30000 : 20000;
      console.info("[recommend] ai-request", {
        requestId,
        durationMs: Date.now() - startedAt,
        promptChars: activePrompt.length,
        maxTokens: recommendationMaxTokens,
        timeoutMs: recommendationTimeoutMs,
        model: recommendationModel,
      });
      text = await chatCompletion(
        [{ role: "user", content: activePrompt }],
        {
          maxTokens: recommendationMaxTokens,
          requestId,
          traceLabel: "recommendation",
          timeoutMs: recommendationTimeoutMs,
          model: recommendationModel,
        }
      );
    } catch (aiErr) {
      console.warn("[recommend] ai-fallback", {
        requestId,
        durationMs: Date.now() - startedAt,
        errorName: aiErr?.name || "Error",
        errorMessage: aiErr?.message || String(aiErr),
        failureClass: classifyLlmFailure(aiErr),
      });
      const response = await finalizeRecommendation(
        buildFallbackRecommendation(resolvedWeather, preferences, "ai fallback"),
        resolvedWeather,
        preferences,
        location,
        wardrobeAnalysis,
        eligibleWardrobeItems,
        { allowQualityRetry: false, assetWardrobeItems: wardrobeItems, recommendationSource: "ai_error_fallback", fallbackReason: classifyLlmFailure(aiErr) }
      );
      setCachedRecommendation(cacheKey, response);
      return res.json({
        ...response,
        performance: timings.summary({ cacheHit: false, fallback: classifyLlmFailure(aiErr) }),
      });
    }
    timings.mark("model_completed");
    console.info("[recommend] ai-response", {
      requestId,
      durationMs: Date.now() - startedAt,
      responseChars: text.length,
      preview: text.slice(0, 500),
    });

    try {
      const parsed = parseModelJson(text);
      let normalized = ensureRecommendationShape(normalizeRecommendationResponse(parsed), resolvedWeather, preferences, wardrobeAnalysis);
      const initialQuality = validateRecommendationQuality(normalized, resolvedWeather, preferences);
      const needsPreferenceRevision = recommendationNeedsPreferenceRevision(normalized, resolvedWeather, preferences);
      const missesArchetype = recommendationMissesArchetype(normalized, archetypeDirective, resolvedWeather);
      const shouldReviseForArchetype = missesArchetype && !initialQuality.ok;
      if ((initialQuality.ok && needsPreferenceRevision) || shouldReviseForArchetype) {
        console.info("[recommend] preference-revision", {
          requestId,
          durationMs: Date.now() - startedAt,
          preferences: preferences || {},
          missesArchetype: shouldReviseForArchetype,
          outfit: normalized?.outfit || null,
        });
        normalized = ensureRecommendationShape(await rewriteRecommendationForPreferences(normalized, resolvedWeather, preferences, location, eligibleWardrobeItems), resolvedWeather, preferences, wardrobeAnalysis);
      }
      normalized = ensureRecommendationShape(enforceArchetypeShape(normalized, archetypeDirective, resolvedWeather), resolvedWeather, preferences, wardrobeAnalysis);
      const withReasoning = await ensureAiRecommendationReasoning(normalized, resolvedWeather, preferences, location);
      const response = await finalizeRecommendation(
        await ensureAiSlotContent(withReasoning, resolvedWeather, preferences, location),
        resolvedWeather,
        preferences,
        location,
        wardrobeAnalysis,
        eligibleWardrobeItems,
        { assetWardrobeItems: wardrobeItems, recommendationSource: "llm" }
      );
      timings.mark("post_processing_completed", { qualitySevere: response.quality?.severeCount || 0 });
      console.info("[recommend] success", {
        requestId,
        durationMs: Date.now() - startedAt,
        outfit: response?.outfit || null,
        warnings: response?.warnings?.length || 0,
        missingItems: response?.missingItems?.length || 0,
      });
      setCachedRecommendation(cacheKey, response);
      res.json({
        ...response,
        performance: timings.summary({ cacheHit: false }),
      });
    } catch (parseErr) {
      console.warn("[recommend] parse-fallback", {
        requestId,
        durationMs: Date.now() - startedAt,
        errorName: parseErr?.name || "Error",
        errorMessage: parseErr?.message || String(parseErr),
        failureClass: classifyLlmFailure(parseErr),
        responseChars: text.length,
      });
      const salvaged = salvageRecommendationFromText(text);
      if (salvaged) {
        let normalized = ensureRecommendationShape(normalizeRecommendationResponse(salvaged), resolvedWeather, preferences, wardrobeAnalysis);
        const initialQuality = validateRecommendationQuality(normalized, resolvedWeather, preferences);
        const needsPreferenceRevision = recommendationNeedsPreferenceRevision(normalized, resolvedWeather, preferences);
        const missesArchetype = recommendationMissesArchetype(normalized, archetypeDirective, resolvedWeather);
        const shouldReviseForArchetype = missesArchetype && !initialQuality.ok;
        if ((initialQuality.ok && needsPreferenceRevision) || shouldReviseForArchetype) {
          console.info("[recommend] preference-revision-salvaged", {
            requestId,
            durationMs: Date.now() - startedAt,
            preferences: preferences || {},
            missesArchetype: shouldReviseForArchetype,
            outfit: normalized?.outfit || null,
          });
          normalized = ensureRecommendationShape(await rewriteRecommendationForPreferences(normalized, resolvedWeather, preferences, location, eligibleWardrobeItems), resolvedWeather, preferences, wardrobeAnalysis);
        }
        normalized = ensureRecommendationShape(enforceArchetypeShape(normalized, archetypeDirective, resolvedWeather), resolvedWeather, preferences, wardrobeAnalysis);
        const withReasoning = await ensureAiRecommendationReasoning(normalized, resolvedWeather, preferences, location);
        const response = await finalizeRecommendation(
          await ensureAiSlotContent(withReasoning, resolvedWeather, preferences, location),
          resolvedWeather,
          preferences,
          location,
          wardrobeAnalysis,
          eligibleWardrobeItems,
          { assetWardrobeItems: wardrobeItems, recommendationSource: "llm_salvaged" }
        );
        console.info("[recommend] salvaged-success", {
          requestId,
          durationMs: Date.now() - startedAt,
          outfit: response?.outfit || null,
        });
        setCachedRecommendation(cacheKey, response);
        return res.json({
          ...response,
          performance: timings.summary({ cacheHit: false, salvaged: true }),
        });
      }
      const response = await finalizeRecommendation(
        buildFallbackRecommendation(resolvedWeather, preferences, "parse fallback"),
        resolvedWeather,
        preferences,
        location,
        wardrobeAnalysis,
        eligibleWardrobeItems,
        { allowQualityRetry: false, assetWardrobeItems: wardrobeItems, recommendationSource: "parse_error_fallback", fallbackReason: classifyLlmFailure(parseErr) }
      );
      setCachedRecommendation(cacheKey, response);
      res.json({
        ...response,
        performance: timings.summary({ cacheHit: false, fallback: classifyLlmFailure(parseErr) }),
      });
    }
  } catch (err) {
    console.error("[recommend] fatal", {
      errorName: err?.name || "Error",
      errorMessage: err?.message || String(err),
      stack: err?.stack || null,
    });
    captureServerException(err, { route: "/api/recommend" });
    res.status(500).json({ error: "Failed to generate recommendation" });
  }
});

app.post("/api/recommend/feedback", async (req, res) => {
  try {
    const feedback = cleanInlineText(req.body?.feedback).slice(0, 80);
    const outfitText = getOutfitText({ outfit: req.body?.outfit || {} }).slice(0, 500);
    const weatherProfile = classifyWeatherProfile(req.body?.weather || {});
    logApiEvent("info", "recommendation_feedback", {
      feedback,
      weatherProfile,
      outfitText,
      wardrobeUsageCount: Number(req.body?.wardrobeUsageCount || 0),
      imageConfidence: Number(req.body?.imageConfidence || 0),
    });
    res.json({ ok: true });
  } catch (err) {
    captureServerException(err, { route: "/api/recommend/feedback" });
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

app.get("/api/weather", async (req, res) => {
  const lat = toNumber(req.query.lat);
  const lon = toNumber(req.query.lon);

  if (lat == null || lon == null) {
    return res.status(400).json({ error: "Missing or invalid lat/lon" });
  }

  try {
    const cachedWeather = getCachedWeather(lat, lon);
    if (cachedWeather) {
      return res.json({ ...cachedWeather, provider: cachedWeather.provider || "cache" });
    }

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
      captureServerException(fallbackErr, { route: "/api/weather", provider: "met-norway-fallback" });
      return res.status(502).json({ error: "All weather providers failed" });
    }
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "wearcast-api",
    uptimeSec: Math.round(process.uptime()),
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    memory: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
    heavyMl: {
      concurrency: HEAVY_ML_CONCURRENCY,
      inFlight: heavyMlInFlight,
      queued: heavyMlQueue.length,
    },
  });
});

app.get("/api/ready", async (req, res) => {
  try {
    if (process.env.DATABASE_URL) {
      await dbPool.query("SELECT 1");
    }
    res.json({
      ok: true,
      service: "wearcast-api",
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round((Date.now() - SERVER_STARTED_AT) / 1000),
      databaseConfigured: !!process.env.DATABASE_URL,
      heavyMl: {
        concurrency: HEAVY_ML_CONCURRENCY,
        inFlight: heavyMlInFlight,
        queued: heavyMlQueue.length,
      },
    });
  } catch (err) {
    logApiEvent("error", "readiness_failed", {
      requestId: req.requestId,
      errorName: err?.name || "Error",
      errorMessage: err?.message || String(err),
    });
    captureServerException(err, { requestId: req.requestId, route: "/api/ready" });
    res.status(503).json({
      ok: false,
      error: "Service not ready",
      requestId: req.requestId,
    });
  }
});

app.get("/api/recommend/stock-gaps", async (req, res) => {
  const token = req.headers["x-wearcast-admin-token"] || req.query.token || "";
  const tokenRequired = process.env.NODE_ENV === "production" || STOCK_GAP_ADMIN_TOKEN;
  if (tokenRequired && (!STOCK_GAP_ADMIN_TOKEN || token !== STOCK_GAP_ADMIN_TOKEN)) {
    return res.status(404).json({ error: "Not found" });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "Database not configured" });
  }
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
  try {
    const result = await dbPool.query(
      `
        SELECT
          backlog_key,
          slot,
          item_name,
          item_color,
          item_material,
          requested,
          selected_stock,
          reasons,
          context,
          COUNT(*)::int AS request_count,
          MAX(created_at) AS last_seen_at
        FROM recommendation_stock_gaps
        GROUP BY
          backlog_key,
          slot,
          item_name,
          item_color,
          item_material,
          requested,
          selected_stock,
          reasons,
          context
        ORDER BY request_count DESC, last_seen_at DESC
        LIMIT $1
      `,
      [limit]
    );
    res.json({
      ok: true,
      count: result.rowCount,
      rows: result.rows,
    });
  } catch (err) {
    logApiEvent("error", "stock_gap_report_failed", {
      requestId: req.requestId,
      errorName: err?.name || "Error",
      errorMessage: err?.message || String(err),
    });
    captureServerException(err, { requestId: req.requestId, route: "/api/recommend/stock-gaps" });
    res.status(500).json({ error: "Could not load stock gap report" });
  }
});

app.post("/api/client-log", (req, res) => {
  const body = req.body || {};
  logApiEvent("error", "client_error", {
    requestId: req.requestId,
    clientEvent: body.type || "client_log",
    message: body.message || "",
    stack: body.stack || "",
    source: body.source || "",
    line: body.line || null,
    column: body.column || null,
    url: body.url || "",
    appVersion: body.appVersion || "",
    native: !!body.native,
    recentEvents: Array.isArray(body.recentEvents) ? body.recentEvents : [],
  });
  res.status(202).json({ ok: true, requestId: req.requestId });
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

process.on("unhandledRejection", (reason) => {
  logApiEvent("error", "process_unhandled_rejection", {
    errorMessage: reason?.message || String(reason),
    stack: reason?.stack || null,
  });
  captureServerException(reason instanceof Error ? reason : new Error(String(reason)), {
    lifecycle: "unhandledRejection",
  });
});

process.on("uncaughtException", (err) => {
  logApiEvent("error", "process_uncaught_exception", {
    errorName: err?.name || "Error",
    errorMessage: err?.message || String(err),
    stack: err?.stack || null,
  });
  captureServerException(err, { lifecycle: "uncaughtException" });
});

startServer().catch((err) => {
  console.error("Failed to start:", err);
  captureServerException(err, { lifecycle: "startServer" });
  process.exit(1);
});
