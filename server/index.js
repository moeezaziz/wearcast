import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { writeFile, unlink } from "fs/promises";
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
config({ path: join(__dirname, ".env") });

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
const MODEL = "auto";
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;
const RECOMMENDATION_CACHE_TTL_MS = 2 * 60 * 1000;
const RECOMMENDATION_COPY_VERSION = 20;
const DEBUG_LOGS = String(process.env.DEBUG || "").toLowerCase() === "true";
const weatherCache = new Map();
const recommendationCache = new Map();
const STOCK_IMAGE_CATALOG = {
  top_white_tshirt_studio: {
    slot: "top",
    path: "assets/recommendation-stock/top-white-tshirt-studio.jpg",
    description: "white crew-neck T-shirt in a clean studio flat lay",
    keywords: ["t-shirt", "tee", "tee shirt", "tshirt", "short sleeve", "crew neck", "basic tee", "cotton t-shirt", "lightweight t-shirt", "oversized tee", "white performance tee"],
    fallback: true,
  },
  top_white_long_sleeve_tshirt_studio: {
    slot: "top",
    path: "assets/recommendation-stock/top-white-long-sleeve-tshirt-studio.jpg",
    description: "white long sleeve T-shirt on a clean studio background",
    keywords: ["long-sleeve t-shirt", "long sleeve t-shirt", "long-sleeve tshirt", "long sleeve tshirt", "long sleeve tee", "long-sleeve tee", "long sleeve top", "long-sleeve top"],
  },
  top_white_hoodie_studio: {
    slot: "top",
    path: "assets/recommendation-stock/outer-white-hoodie-studio.jpg",
    description: "white hoodie in a minimal studio shot",
    keywords: ["hoodie", "casual hoodie", "pullover hoodie", "light hoodie"],
  },
  top_white_button_up_shirt: {
    slot: "top",
    path: "assets/recommendation-stock/top-white-button-up-shirt.jpg",
    description: "white button-up shirt on hangers in soft studio light",
    keywords: ["button-up", "button down", "button-up shirt", "button-down", "oxford", "oxford shirt", "dress shirt", "collared shirt", "white shirt", "long-sleeve shirt", "polo shirt", "linen shirt"],
  },
  top_linen_shirt_warm: {
    slot: "top",
    path: "assets/recommendation-stock/top-linen-shirt-warm.svg",
    description: "warm ivory short-sleeve linen shirt illustrated for hot polished outfits",
    keywords: ["linen shirt", "short-sleeve linen shirt", "short sleeve linen shirt", "camp shirt", "lightweight linen shirt", "breathable shirt", "hot weather shirt", "polished warm-weather shirt"],
  },
  top_lightweight_knit_tee: {
    slot: "top",
    path: "assets/recommendation-stock/top-lightweight-knit-tee.svg",
    description: "lightweight knit tee in a soft neutral studio illustration",
    keywords: ["knit tee", "lightweight knit tee", "clean knit tee", "cotton knit tee", "fine gauge tee", "lightweight knit", "minimal knit top"],
  },
  top_white_polo_studio: {
    slot: "top",
    path: "assets/recommendation-stock/top-white-polo-studio.jpg",
    description: "white polo shirt against a clean white background",
    keywords: ["polo", "polo shirt", "white polo", "collared polo", "smart polo"],
  },
  top_black_graphic_tee_studio: {
    slot: "top",
    path: "assets/recommendation-stock/top-black-graphic-tee-studio.jpg",
    description: "black graphic t-shirt in a clean studio shot",
    keywords: ["graphic tee", "graphic t-shirt", "graphic tee shirt", "printed tee", "streetwear tee", "oversized graphic tee", "graphic shirt"],
  },
  top_knit_sweater_hanger: {
    slot: "top",
    path: "assets/recommendation-stock/top-knit-sweater-hanger.jpg",
    description: "knit sweater hanging on a wooden hanger",
    keywords: ["sweater", "knit", "jumper", "pullover", "crewneck", "thermal", "base layer", "thermal shirt", "long-sleeve thermal shirt"],
  },
  top_white_tank_top_studio: {
    slot: "top",
    path: "assets/recommendation-stock/top-white-tank-top-studio.jpg",
    description: "white tank top on a bright studio background",
    keywords: ["tank top", "white tank top", "linen tank top", "lightweight tank top", "sleeveless top", "summer tank"],
  },
  bottom_blue_jeans_stack: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-blue-jeans-stack.jpg",
    description: "stack of blue jeans in studio light",
    keywords: ["jeans", "denim", "pants", "trousers", "bottoms", "warm jeans"],
    fallback: true,
  },
  bottom_blue_denim_shorts_studio: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-blue-denim-shorts-studio.jpg",
    description: "blue denim shorts on a clean white background",
    keywords: ["shorts", "denim shorts", "loose shorts", "summer shorts"],
  },
  bottom_cotton_shorts_warm: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-cotton-shorts-warm.svg",
    description: "cotton chino shorts in a warm neutral illustration",
    keywords: ["cotton shorts", "chino shorts", "tailored shorts", "linen shorts", "lightweight shorts", "summer shorts", "warm-weather shorts"],
  },
  bottom_athletic_running_shorts_studio: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-athletic-running-shorts-studio.jpg",
    description: "athletic running shorts styled in a studio fashion shot",
    keywords: ["running shorts", "athletic shorts", "sport shorts", "training shorts", "performance shorts"],
  },
  bottom_black_trousers_studio: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-black-trousers-studio.jpg",
    description: "black tailored trousers on a white studio background",
    keywords: ["tailored trousers", "trousers", "dress pants", "slacks", "tailored pants", "charcoal chinos", "warm trousers", "wool trousers", "tailored wool trousers"],
  },
  bottom_linen_trousers_warm: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-linen-trousers-warm.svg",
    description: "lightweight linen trousers in a warm neutral illustration",
    keywords: ["linen trousers", "lightweight linen trousers", "lightweight trousers", "tailored cotton trousers", "breathable trousers", "warm-weather trousers", "tropical trousers"],
  },
  bottom_navy_chinos_polished: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-navy-chinos-polished.svg",
    description: "navy tailored chinos in a clean polished illustration",
    keywords: ["chinos", "navy chinos", "lightweight chinos", "slim chinos", "tailored chinos", "cotton chinos", "clean chinos", "chino trousers"],
  },
  bottom_black_tech_joggers_studio: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-black-trousers-studio.jpg",
    description: "black technical jogger-style trousers in a clean product shot",
    keywords: ["black tech joggers", "tech joggers", "performance joggers", "joggers", "fleece-lined trousers"],
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
    keywords: ["blazer", "light blazer", "tailored blazer", "smart blazer", "lightweight blazer"],
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
    keywords: ["windbreaker", "lightweight windbreaker", "windproof jacket", "waterproof jacket", "windbreaker jacket"],
  },
  outer_black_shell_jacket_city: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-black-shell-jacket-city.jpg",
    description: "black shell jacket worn outdoors in the city",
    keywords: ["shell jacket", "black shell jacket", "running jacket", "light shell", "windbreaker", "technical jacket", "rain jacket", "waterproof jacket", "weatherproof jacket"],
  },
  outer_charcoal_overshirt_studio: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-charcoal-overshirt-studio.jpg",
    description: "charcoal overshirt jacket over a knit top",
    keywords: ["overshirt", "shirt jacket", "charcoal overshirt", "light jacket", "casual jacket", "overshirt jacket"],
  },
  outer_black_light_overshirt_street: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-black-light-overshirt-street.jpg",
    description: "black lightweight overshirt styled in a streetwear shot",
    keywords: ["light overshirt", "breathable overshirt", "lightweight overshirt", "black overshirt", "shacket", "light shacket"],
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
    keywords: ["waterproof parka", "parka", "winter coat", "waterproof winter coat", "insulated jacket", "insulated coat", "wool overcoat", "overcoat", "long coat"],
  },
  outer_white_overcoat_studio: {
    slot: "outer",
    path: "assets/recommendation-stock/outer-white-overcoat-studio.jpg",
    description: "white overcoat in a minimal fashion studio portrait",
    keywords: ["overcoat", "wool overcoat", "long overcoat", "smart overcoat", "tailored coat"],
  },
  shoes_white_sneakers_minimal: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-white-sneakers-minimal.jpg",
    description: "minimal white sneakers on a light background",
    keywords: ["sneakers", "trainers", "tennis shoes", "casual shoes", "white sneakers", "casual sneakers", "low-top sneakers", "white leather sneakers", "supportive sneakers", "canvas sneakers"],
    fallback: true,
  },
  shoes_black_white_sneakers_studio: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-black-white-sneakers-studio.jpg",
    description: "black and white statement sneakers in studio lighting",
    keywords: ["streetwear sneakers", "sporty sneakers", "fashion sneakers", "black sneakers", "retro sneakers"],
  },
  shoes_white_running_sneakers: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-white-running-sneakers.jpg",
    description: "white running sneakers in a clean product shot",
    keywords: ["running sneakers", "running shoes", "athletic shoes", "water-resistant athletic shoes", "breathable sneakers", "waterproof sneakers", "breathable running sneakers", "athleisure sneakers"],
  },
  shoes_white_performance_runner_studio: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-white-performance-runner-studio.jpg",
    description: "white performance running shoe in a dramatic product shot",
    keywords: ["performance runner", "running sneakers", "running shoes", "white running shoe", "athletic shoes", "technical sneakers", "white running shoes"],
  },
  shoes_gray_trail_runners_studio: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-gray-trail-runners-studio.jpg",
    description: "gray trail running shoes in a product-style shot",
    keywords: ["trail runners", "trail running shoes", "trail shoes", "grip runners"],
  },
  shoes_black_loafers_studio: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-black-loafers-studio.jpg",
    description: "black loafers in a studio product shot",
    keywords: ["loafers", "dress loafers", "smart loafers", "leather loafers"],
  },
  shoes_brown_loafers_polished: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-brown-loafers-polished.svg",
    description: "brown leather loafers in a polished warm-weather illustration",
    keywords: ["brown loafers", "tan loafers", "brown leather loafers", "leather loafers", "soft loafers", "polished leather loafers"],
  },
  shoes_black_dress_loafers_studio: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-black-dress-loafers-studio.jpg",
    description: "black leather dress loafers on a white background",
    keywords: ["dress shoes", "dress loafers", "formal shoes", "smart shoes", "office shoes"],
  },
  shoes_tan_winter_boots: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-tan-winter-boots.jpg",
    description: "tan winter boots on a soft white background",
    keywords: ["boots", "ankle boots", "winter boots", "suede boots", "waterproof boots", "water-resistant boots", "insulated boots", "waterproof hiking boots", "insulated walking boots"],
  },
  shoes_brown_ankle_boots_studio: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-brown-ankle-boots-studio.jpg",
    description: "brown ankle boots on a clean studio backdrop",
    keywords: ["ankle boots", "leather ankle boots", "brown ankle boots", "smart ankle boots", "heeled ankle boots"],
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
    keywords: ["scarf", "neck scarf", "silk scarf", "wrap", "light scarf", "lightweight scarf", "wool scarf"],
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
    keywords: ["beanie", "warm hat", "knit hat", "winter hat", "winter beanie", "wool beanie"],
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
    keywords: ["black baseball cap", "black cap", "baseball cap", "cap", "dad cap", "sport cap", "snapback cap", "compact cap"],
  },
  accessory_black_sports_cap_outdoors: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-black-sports-cap-outdoors.jpg",
    description: "black sports cap in an outdoor product-style shot",
    keywords: ["sports cap", "black sport cap", "sport cap", "running cap", "athletic cap"],
  },
  accessory_white_sun_hat_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-white-sun-hat-studio.jpg",
    description: "white wide-brim sun hat on a clean background",
    keywords: ["sun hat", "wide-brim sun hat", "wide brim hat", "beach hat", "sun hat with brim"],
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
    keywords: ["tote bag", "tote", "carryall", "shopper bag", "bag", "waterproof bag", "bag for essentials", "everyday bag"],
  },
  accessory_belt_bag_studio: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-belt-bag-studio.jpg",
    description: "belt bag on a white background",
    keywords: ["belt bag", "crossbody bag", "waist bag", "bag", "small waterproof bag", "compact essentials bag"],
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
    keywords: ["gloves", "light gloves", "warm gloves", "lightweight gloves", "waterproof insulated gloves"],
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

async function chatCompletion(messages, {
  maxTokens = 560,
  requestId = null,
  traceLabel = "chat",
  timeoutMs = 18000,
  allowEmptyRetry = true,
  compactJsonRetry = false,
} = {}) {
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
    const requestMessages = compactJsonRetry
      ? [
          ...(Array.isArray(messages) ? messages : []),
          {
            role: "user",
            content: "Return compact valid JSON only. Keep every value short and finish the answer quickly.",
          },
        ]
      : messages;
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
        messages: requestMessages,
        max_tokens: maxTokens,
        temperature: compactJsonRetry ? 0 : 0.2,
        ...(compactJsonRetry
          ? {}
          : {
              reasoning: {
                effort: "minimal",
                exclude: true,
              },
            }),
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
        });
      }
      throw new Error(`OpenRouter returned empty content${finishReason ? ` (${finishReason})` : ""}`);
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

function recommendationCacheKey(weather, wardrobe, preferences, location = {}) {
  return JSON.stringify({
    copyVersion: RECOMMENDATION_COPY_VERSION,
    location: {
      name: cleanInlineText(location?.name || ""),
      lat: Number.isFinite(Number(location?.lat)) ? Math.round(Number(location.lat) * 100) / 100 : null,
      lon: Number.isFinite(Number(location?.lon)) ? Math.round(Number(location.lon) * 100) / 100 : null,
    },
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
  return {
    outfit,
    outfitImages: buildRecommendationImageMatches(outfit),
    slotReasons,
    itemDetails: normalizeRecommendationItemDetails(parsed?.itemDetails),
    reasoning: clampSentenceCount(parsed?.reasoning, 1),
    detailsOverview: normalizeDetailsOverview(parsed?.detailsOverview),
    warnings: normalizeList(parsed?.warnings, { limit: 1 }),
    missingItems: normalizeList(parsed?.missingItems, { limit: 1 }),
  };
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

  if (profile.hot && /\b(wool|merino|thermal|fleece|sherpa|insulated|winter|parka|overcoat|heavy coat|beanie|glove)\b/.test(itemText)) {
    add("severe", "hot_heavy_material", "Hot weather outfit contains heavy cold-weather materials or accessories.");
  }
  if (profile.veryHot && /\b(sweater|jumper|crewneck|hoodie|overshirt|jacket|coat|blazer|shacket|long-sleeve|long sleeve)\b/.test(`${top} ${outer}`)) {
    add("severe", "very_hot_layering", "Very hot weather outfit adds unnecessary upper-body layering.");
  } else if (profile.hot && outer && !profile.wet && !profile.windy && !/carry|optional|air[- ]?condition|ac\b/.test(text)) {
    add("warning", "hot_outer_layer", "Hot dry weather includes an outer layer without a clear reason.");
  }
  if (profile.dry && /\b(umbrella|rain jacket|raincoat|waterproof parka)\b/.test(`${outer} ${accessory}`)) {
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
  if (activity === "office" || setting === "event" || style === "polished") return "office";
  if (activity === "workout" || style === "sporty") return "sporty";
  if (hot && (activity === "evening" || setting === "event")) return "hot-evening";
  if (cold || wet) return "weather-led";
  if (style === "minimalist") return "minimal";
  if (style === "streetwear") return "streetwear";
  return "casual";
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
  return {
    profileBand,
    variantIndex,
    preferred,
    options,
    text: `- Profile band: ${profileBand}
- Use one of these valid archetypes and avoid collapsing to the same default every time:
${lines.join("\n")}
- Preferred archetype for this request: ${variantIndex + 1} (${preferred.name}).
- Strong slot steer for this request:
  top: ${preferred.top}
  bottom: ${preferred.bottom}
  outer: ${preferred.outer}
  shoes: ${preferred.shoes}
  accessory: ${preferred.accessory}
  avoid: ${preferred.avoid}
- Follow the preferred archetype unless weather or truly suitable wardrobe pieces make another listed archetype clearly better.`,
  };
}

function recommendationMissesArchetype(response, archetypeDirective, weather = {}) {
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
    if (feelsLike >= 25) score += /\b(tank|tee|t-shirt|t shirt|linen)\b/.test(text) ? 4 : -2;
  }
  if (slot === "bottom") {
    if (feelsLike <= 10) score += /\b(fleece|wool|trouser|pants|jeans)\b/.test(text) ? 3 : -2;
    if (feelsLike >= 26) score += /\b(shorts|lightweight|linen)\b/.test(text) ? 4 : 0;
  }
  if (slot === "outer") {
    if (wet || windy || feelsLike <= 14) score += /\b(shell|jacket|coat|parka|blazer|overshirt|hoodie|fleece|sherpa|windbreaker)\b/.test(text) ? 4 : -4;
    if (feelsLike <= 8) score += /\b(coat|jacket|parka|puffer|insulated|shell|fleece|sherpa|windbreaker|waterproof)\b/.test(text) ? 5 : /\b(overshirt|shacket|cardigan)\b/.test(text) ? -5 : 0;
    if (!wet && !windy && feelsLike >= 24) score += /\b(shell|jacket|coat|parka)\b/.test(text) ? -4 : 1;
  }
  if (slot === "shoes") {
    if (wet) score += /\b(boot|waterproof|water-resistant|runner|sneaker)\b/.test(text) ? 3 : -2;
    if (profileBand === "sporty") score += /\b(runner|running|sneaker|trainer)\b/.test(text) ? 4 : -3;
    if (profileBand === "office") score += /\b(loafer|leather|dress)\b/.test(text) ? 4 : /\b(sneaker)\b/.test(text) ? -3 : 0;
  }
  if (slot === "accessory") {
    if (wet) score += /\b(umbrella)\b/.test(text) ? 4 : 0;
    if (Number(weather?.uv ?? 0) >= 7) score += /\b(sunglass|cap|hat)\b/.test(text) ? 3 : 0;
    if (feelsLike <= 8) score += /\b(scarf|beanie|gloves)\b/.test(text) ? 3 : 0;
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

  return false;
}

async function rewriteRecommendationForPreferences(response, weather, preferences, location, wardrobeItems = []) {
  const revisionNotes = buildPreferenceTuningRules(preferences, weather);
  const profileBand = deriveRecommendationProfileBand(preferences, weather);
  const archetypeDirective = buildArchetypeDirective(profileBand, location, preferences, weather);
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
- Make the selected archetype visually obvious in the slot choices instead of blending multiple archetypes together.
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

Non-negotiable rules:
- If feels-like is 30C or above: no wool, merino, thermal, fleece, parka, heavy coat, beanie, gloves, or unnecessary outer layer.
- If feels-like is 35C or above: no sweater, hoodie, overshirt, jacket, blazer, coat, or long-sleeve layer unless explicitly described as carried for indoor AC.
- If rain is not likely: no umbrella or rain gear.
- If office/polished: stay sharp with breathable polish, not cold-weather formality.
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

async function finalizeRecommendation(response, weather, preferences, location, wardrobeAnalysis = null, eligibleWardrobeItems = [], { allowQualityRetry = true } = {}) {
  let normalized = ensureRecommendationShape(response, weather, preferences, wardrobeAnalysis);
  let quality = validateRecommendationQuality(normalized, weather, preferences);
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
    normalized = ensureRecommendationShape(
      buildFallbackRecommendation(weather, preferences, quality.issues[0]?.code || "quality gate"),
      weather,
      preferences,
      wardrobeAnalysis
    );
    quality = validateRecommendationQuality(normalized, weather, preferences);
  }

  const wardrobeUsage = detectWardrobeUsage(normalized, wardrobeAnalysis || { candidates: [] });
  const trustSignals = buildRecommendationTrustSignals(normalized, weather, preferences, wardrobeUsage);
  normalized = {
    ...normalized,
    outfitImages: buildRecommendationImageMatches(normalized.outfit, null, {
      weather,
      preferences,
      profileBand: deriveRecommendationProfileBand(preferences, weather),
    }),
    weatherProfile: classifyWeatherProfile(weather),
    wardrobeAnalysis: wardrobeAnalysis ? { ...wardrobeAnalysis, usage: wardrobeUsage } : null,
    quality,
    trustSignals,
  };
  return normalized;
}

function inferCatalogAesthetic(entry = {}, key = "") {
  const text = `${key} ${entry.description || ""} ${(entry.keywords || []).join(" ")}`.toLowerCase();
  return {
    warmth: /\b(winter|insulated|thermal|fleece|beanie|glove|parka|overcoat|coat|sweater|knit)\b/.test(text) ? "warm" : /\b(tank|shorts|linen|sun|tee|t-shirt|polo)\b/.test(text) ? "cool" : "neutral",
    formality: /\b(blazer|tailored|dress|loafer|oxford|button-up|button up|trouser|slack|watch|polo)\b/.test(text) ? "polished" : /\b(running|athletic|sport|trail|performance|leggings)\b/.test(text) ? "sporty" : "casual",
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
  if (/\b(chino|linen trouser|lightweight trouser|tailored trouser)\b/.test(itemText) && key === "bottom_blue_jeans_stack") {
    score -= 24;
    penalties.push("jeans_visual_for_tailoring");
  }
  if (/\b(derby|oxford shoe)\b/.test(itemText) && !/\b(dress|loafer|formal)\b/.test(`${key} ${(entry.keywords || []).join(" ")}`)) {
    score -= 12;
    penalties.push("weak_formal_shoe_match");
  }

  return { score, penalties, aesthetic };
}

function scoreCatalogMatch(text, entry, key = "", context = {}) {
  const normalized = normalizeMatchText(text);
  if (!normalized) return 0;
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
  score += scoreAestheticContext(text, entry, key, context).score;
  return score;
}

function findStockImageForSlot(slot, itemName, preferredKey = null, context = {}) {
  if (preferredKey && STOCK_IMAGE_CATALOG[preferredKey]?.slot === slot) {
    const entry = STOCK_IMAGE_CATALOG[preferredKey];
    const aestheticScore = scoreAestheticContext(itemName, entry, preferredKey, context);
    return { key: preferredKey, path: entry.path, description: entry.description, confidence: Math.max(40, Math.min(100, 80 + aestheticScore.score)), aesthetic: aestheticScore.aesthetic, penalties: aestheticScore.penalties };
  }

  const entries = Object.entries(STOCK_IMAGE_CATALOG).filter(([, entry]) => entry.slot === slot);
  let best = null;
  let bestScore = -1;
  for (const [key, entry] of entries) {
    const score = scoreCatalogMatch(itemName, entry, key, context);
    if (score > bestScore) {
      const aestheticScore = scoreAestheticContext(itemName, entry, key, context);
      best = {
        key,
        path: entry.path,
        description: entry.description,
        confidence: Math.max(0, Math.min(100, 55 + score + aestheticScore.score)),
        aesthetic: aestheticScore.aesthetic,
        penalties: aestheticScore.penalties,
      };
      bestScore = score;
    }
  }

  if (best && bestScore > 0) return best;
  const fallback = entries.find(([, entry]) => entry.fallback);
  return fallback ? {
    key: fallback[0],
    path: fallback[1].path,
    description: fallback[1].description,
    confidence: 45,
    aesthetic: inferCatalogAesthetic(fallback[1], fallback[0]),
    penalties: ["fallback"],
  } : null;
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
    output[slot] = findStockImageForSlot(slot, itemName, cleanInlineText(preferred?.[slot]), context) || null;
  }
  const accessories = Array.isArray(outfit?.accessories)
    ? outfit.accessories
    : [outfit?.accessories];
  accessories
    .map((value) => cleanInlineText(value))
    .filter(Boolean)
    .slice(0, 1)
    .forEach((itemName, index) => {
      output[`accessory-${index}`] = findStockImageForSlot("accessory", itemName, cleanInlineText(preferred?.accessory), context) || null;
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
  const hot = feelsLike >= 28;
  const veryHot = feelsLike >= 32;
  const wet = precipProb >= 45 || weatherLabel.includes("rain") || weatherLabel.includes("drizzle") || stormy || freezing;

  const top = profile.veryHot && polished
    ? "Short-sleeve linen shirt"
    : profile.veryHot
      ? "Breathable cotton T-shirt"
      : hot && polished
        ? "Lightweight polo"
        : sporty && hot
          ? "Performance tank"
          : veryCold
    ? "Thermal base layer"
    : coldish
      ? "Long-sleeve tee"
      : veryHot
        ? "Lightweight T-shirt"
        : temp <= 20
          ? "Long-sleeve top"
          : "Breathable T-shirt";
  const bottom = profile.veryHot && polished
    ? "Lightweight linen trousers"
    : profile.veryHot
      ? "Cotton shorts"
      : hot && polished
        ? "Lightweight chinos"
        : sporty && hot
          ? "Running shorts"
          : veryCold
    ? "Insulated pants"
    : hot
      ? "Linen shorts"
      : wet && coldish
        ? "Water-resistant pants"
        : temp <= 12
          ? "Jeans"
          : "Comfortable pants";
  const outer = profile.veryHot || (hot && !wet && wind < 30)
    ? ""
    : veryCold
    ? "Waterproof parka"
    : wet
      ? "Waterproof jacket"
      : coldish || wind >= 25
        ? (feelsLike <= 6 ? "Warm fleece jacket" : "Light jacket")
        : hot
          ? "Breathable overshirt"
          : "Light overshirt";
  const shoes = polished && !wet && !veryCold
    ? "Leather loafers"
    : sporty
      ? "Breathable running sneakers"
      : veryCold || freezing
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
    missingItems: [],
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
    const { weather, wardrobe, preferences, location } = req.body;
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
        { allowQualityRetry: false }
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
    if (preferences?.fashionNotes) prefsDesc.push(`notes: ${cleanInlineText(preferences.fashionNotes).slice(0, 120)}`);
    const tuningRules = buildPreferenceTuningRules(preferences, resolvedWeather);

    const dayFc = resolvedWeather.remainingForecast;
    const dayForecastDesc = dayFc
      ? `later: temp ${dayFc.tempRange}; feels ${dayFc.feelsLikeRange}; wind ${dayFc.maxWind}; rain ${dayFc.maxPrecipProb}; uv ${dayFc.peakUV}`
      : "later: unavailable";

    const effectiveTemp = Number.isFinite(Number(resolvedWeather.feelsLike))
      ? Number(resolvedWeather.feelsLike)
      : Number(resolvedWeather.temperature);
    const weatherEnvelope = getRecommendationWeatherEnvelope(resolvedWeather);
    const wetRisk = Number(resolvedWeather.precipProb ?? 0) >= 45 || /rain|drizzle|storm|snow|freezing/i.test(String(resolvedWeather.weatherLabel || ""));
    const weatherRules = [
      effectiveTemp <= 2
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

PREFERENCES
${prefsDesc.length ? prefsDesc.join("; ") : "none"}

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
- Avoid repeating the same outfit archetype for every similar request; follow the selected archetype direction unless the weather makes it unreasonable.
- JSON only.

Return ONLY valid JSON (no markdown fences):
{
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

    let text = "";
    try {
      const recommendationMaxTokens = hasWardrobe ? 820 : 700;
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
      const response = buildFallbackRecommendation(resolvedWeather, preferences, "ai fallback");
      setCachedRecommendation(cacheKey, response);
      return res.json({
        ...response,
        performance: timings.summary({ cacheHit: false, fallback: "ai_error" }),
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
        eligibleWardrobeItems
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
          eligibleWardrobeItems
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
      const response = buildFallbackRecommendation(resolvedWeather, preferences, "parse fallback");
      setCachedRecommendation(cacheKey, response);
      res.json({
        ...response,
        performance: timings.summary({ cacheHit: false, fallback: "parse_error" }),
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
