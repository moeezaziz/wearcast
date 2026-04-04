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

// Serve the frontend static files
app.use(express.static(join(__dirname, "..")));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "qwen/qwen3.6-plus:free";

async function chatCompletion(messages, { maxTokens = 512 } = {}) {
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
      temperature: 0.7,
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

    const cleaned = text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
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
    const { weather, wardrobe, preferences } = req.body;
    if (!weather) return res.status(400).json({ error: "No weather data provided" });

    const wardrobeDesc =
      wardrobe && wardrobe.length > 0
        ? wardrobe
            .map(
              (item) =>
                `- ${item.type}: ${item.name}${item.color ? ` (${item.color})` : ""}${item.material ? ` [${item.material}]` : ""}${item.careInstructions?.length ? ` care: ${item.careInstructions.join(", ")}` : ""}`
            )
            .join("\n")
        : "(user has not added any wardrobe items yet)";

    const prefsDesc = [];
    if (preferences?.cold) prefsDesc.push("runs cold (feels colder than average)");
    if (preferences?.hot) prefsDesc.push("runs hot (feels warmer than average)");
    if (preferences?.formal) prefsDesc.push("prefers formal/smart-casual style");
    if (preferences?.bike) prefsDesc.push("plans to bike or walk (active)");
    if (preferences?.fashionNotes) prefsDesc.push(`style notes: ${preferences.fashionNotes}`);

    const dayFc = weather.dayForecast;
    const dayForecastDesc = dayFc
      ? `## Today's Full-Day Forecast
- Temperature range: ${dayFc.tempRange}
- Feels-like range: ${dayFc.feelsLikeRange}
- Max wind: ${dayFc.maxWind}
- Max precipitation probability: ${dayFc.maxPrecipProb}
- Total precipitation: ${dayFc.totalPrecip}
- Peak UV index: ${dayFc.peakUV}
- Average humidity: ${dayFc.avgHumidity}`
      : "";

    const prompt = `You are WearCast, a smart clothing recommendation assistant.

Given the current weather and today's full-day forecast, suggest a specific outfit they should wear TODAY that will work for the entire day. Pick actual items from their wardrobe when possible.

## Current Weather
- Temperature: ${weather.temperature}°C (feels like ${weather.feelsLike}°C)
- Wind: ${weather.wind} km/h (gusts ${weather.gusts} km/h)
- Humidity: ${weather.humidity}%
- Cloud cover: ${weather.cloud}%
- Precipitation: ${weather.precip} mm/h
- Precipitation probability: ${weather.precipProb ?? "unknown"}%
- UV index: ${weather.uv}
- Weather: ${weather.weatherLabel}
- Is daytime: ${weather.isDay ? "yes" : "no"}

${dayForecastDesc}

## User Preferences
${prefsDesc.length ? prefsDesc.join("\n") : "No special preferences set."}

## User's Wardrobe
${wardrobeDesc}

## Instructions
1. Recommend a COMPLETE outfit (top, bottom, outer layer if needed, shoes, accessories).
2. Consider the FULL DAY forecast — if rain is expected later or temperatures will change, account for that.
3. When the user has wardrobe items, reference SPECIFIC items by name.
3. If specific wardrobe items aren't suitable, explain why and suggest what type of item they'd need.
4. Give concise reasoning for each choice (weather-based).
5. Add any weather warnings or tips.

Return ONLY valid JSON (no markdown fences):
{
  "outfit": {
    "top": "specific item or suggestion",
    "bottom": "specific item or suggestion",
    "outer": "specific item or suggestion, or null if not needed",
    "shoes": "specific item or suggestion",
    "accessories": ["item1", "item2"]
  },
  "reasoning": "Brief explanation of why this outfit works for today's conditions",
  "warnings": ["any weather warnings or tips"],
  "missingItems": ["items the user might want to buy for weather like this"]
}`;

    const text = await chatCompletion([
      { role: "user", content: prompt },
    ]);

    const cleaned = text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    res.json(parsed);
  } catch (err) {
    console.error("recommend error:", err);
    res.status(500).json({ error: "Failed to generate recommendation" });
  }
});

// ─── Auth & Wardrobe routes ──────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/wardrobe", wardrobeRoutes);

import http from "http";

const IS_PROD = process.env.NODE_ENV === "production";

async function startServer() {
  // Initialize database tables
  if (process.env.DATABASE_URL) {
    await initDB();
  }

  if (IS_PROD) {
    http.createServer(app).listen(PORT, "0.0.0.0", () => {
      console.log(`WearCast → http://0.0.0.0:${PORT}`);
    });
  } else {
    const sslOpts = {
      key: readFileSync(join(__dirname, "certs", "key.pem")),
      cert: readFileSync(join(__dirname, "certs", "cert.pem")),
    };
    http.createServer(app).listen(3000, "0.0.0.0", () => {
      console.log(`WearCast HTTP  → http://localhost:3000`);
    });
    https.createServer(sslOpts, app).listen(PORT, "0.0.0.0", () => {
      console.log(`WearCast HTTPS → https://localhost:${PORT}`);
    });
  }
}

startServer().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
