import { readFileSync } from "node:fs";

const envText = readFileSync(new URL("../server/.env", import.meta.url), "utf8");
const key = envText
  .split("\n")
  .map((line) => line.trim())
  .find((line) => line.startsWith("OPENROUTER_API_KEY="))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim();

function scenario(
  name,
  {
    temperature,
    feelsLike,
    wind,
    gusts,
    humidity,
    cloud,
    precip,
    precipProb,
    uv,
    weatherLabel,
    prefs = [],
    tempRange,
    feelsLikeRange,
    maxWind,
    maxPrecipProb,
    totalPrecip,
    peakUV,
    avgHumidity,
  }
) {
  return {
    name,
    weather: {
      temperature,
      feelsLike,
      wind,
      gusts,
      humidity,
      cloud,
      precip,
      precipProb,
      uv,
      weatherLabel,
      isDay: true,
      remainingForecast: {
        tempRange,
        feelsLikeRange,
        maxWind,
        maxPrecipProb,
        totalPrecip,
        peakUV,
        avgHumidity,
      },
    },
    prefs,
  };
}

const scenarios = [
  scenario("cool_clear_city", {
    temperature: 16, feelsLike: 14, wind: 18, gusts: 28, humidity: 61, cloud: 12, precip: 0, precipProb: 8, uv: 3, weatherLabel: "Clear",
    prefs: ["prefers casual everyday outfits"],
    tempRange: "14°C – 18°C", feelsLikeRange: "12°C – 17°C", maxWind: "28 km/h", maxPrecipProb: "10%", totalPrecip: "0 mm", peakUV: 4, avgHumidity: "60%",
  }),
  scenario("warm_rain_commute", {
    temperature: 22, feelsLike: 23, wind: 16, gusts: 24, humidity: 78, cloud: 84, precip: 1.2, precipProb: 72, uv: 4, weatherLabel: "Rain",
    prefs: ["is dressing for commuting and movement"],
    tempRange: "20°C – 24°C", feelsLikeRange: "21°C – 25°C", maxWind: "24 km/h", maxPrecipProb: "78%", totalPrecip: "6.4 mm", peakUV: 4, avgHumidity: "79%",
  }),
  scenario("cold_windy_layered", {
    temperature: 7, feelsLike: 3, wind: 31, gusts: 43, humidity: 67, cloud: 55, precip: 0.1, precipProb: 26, uv: 2, weatherLabel: "Partly cloudy",
    prefs: ["runs cold (feels colder than average)", "will spend a lot of time outdoors"],
    tempRange: "5°C – 8°C", feelsLikeRange: "1°C – 5°C", maxWind: "43 km/h", maxPrecipProb: "30%", totalPrecip: "0.6 mm", peakUV: 2, avgHumidity: "69%",
  }),
  scenario("hot_sunny_minimal", {
    temperature: 29, feelsLike: 31, wind: 10, gusts: 15, humidity: 49, cloud: 5, precip: 0, precipProb: 2, uv: 8, weatherLabel: "Clear",
    prefs: ["wants the outfit to lean minimalist"],
    tempRange: "28°C – 32°C", feelsLikeRange: "30°C – 34°C", maxWind: "15 km/h", maxPrecipProb: "4%", totalPrecip: "0 mm", peakUV: 8, avgHumidity: "47%",
  }),
  scenario("snowy_weekend", {
    temperature: -1, feelsLike: -5, wind: 20, gusts: 30, humidity: 83, cloud: 92, precip: 0.8, precipProb: 68, uv: 1, weatherLabel: "Snow",
    prefs: ["prefers casual everyday outfits"],
    tempRange: "-2°C – 1°C", feelsLikeRange: "-7°C – -1°C", maxWind: "30 km/h", maxPrecipProb: "74%", totalPrecip: "3.5 mm", peakUV: 1, avgHumidity: "84%",
  }),
  scenario("smart_casual_office", {
    temperature: 18, feelsLike: 18, wind: 11, gusts: 16, humidity: 58, cloud: 40, precip: 0, precipProb: 12, uv: 5, weatherLabel: "Mainly clear",
    prefs: ["prefers polished or smart-casual style", "wants the outfit to lean polished"],
    tempRange: "17°C – 20°C", feelsLikeRange: "17°C – 20°C", maxWind: "16 km/h", maxPrecipProb: "14%", totalPrecip: "0 mm", peakUV: 5, avgHumidity: "58%",
  }),
  scenario("humid_heat_streetwear", {
    temperature: 31, feelsLike: 35, wind: 9, gusts: 14, humidity: 74, cloud: 28, precip: 0.2, precipProb: 18, uv: 7, weatherLabel: "Partly cloudy",
    prefs: ["prefers streetwear-inspired outfits", "wants the outfit to lean streetwear", "runs hot (feels warmer than average)"],
    tempRange: "30°C – 34°C", feelsLikeRange: "34°C – 38°C", maxWind: "14 km/h", maxPrecipProb: "22%", totalPrecip: "0.2 mm", peakUV: 8, avgHumidity: "76%",
  }),
  scenario("brisk_polished_evening", {
    temperature: 11, feelsLike: 8, wind: 19, gusts: 27, humidity: 63, cloud: 36, precip: 0, precipProb: 12, uv: 2, weatherLabel: "Mainly clear",
    prefs: ["prefers polished or smart-casual style", "runs cold (feels colder than average)"],
    tempRange: "9°C – 12°C", feelsLikeRange: "6°C – 10°C", maxWind: "27 km/h", maxPrecipProb: "14%", totalPrecip: "0 mm", peakUV: 2, avgHumidity: "64%",
  }),
  scenario("drizzly_mild_indoors", {
    temperature: 19, feelsLike: 19, wind: 13, gusts: 19, humidity: 81, cloud: 90, precip: 0.5, precipProb: 58, uv: 2, weatherLabel: "Drizzle",
    prefs: ["will spend most of the day indoors"],
    tempRange: "18°C – 20°C", feelsLikeRange: "18°C – 20°C", maxWind: "19 km/h", maxPrecipProb: "60%", totalPrecip: "2.3 mm", peakUV: 2, avgHumidity: "82%",
  }),
  scenario("bike_commute_breezy", {
    temperature: 13, feelsLike: 10, wind: 24, gusts: 34, humidity: 59, cloud: 30, precip: 0, precipProb: 10, uv: 4, weatherLabel: "Partly cloudy",
    prefs: ["plans to bike or walk (active)", "expects to walk more than usual today"],
    tempRange: "11°C – 15°C", feelsLikeRange: "8°C – 13°C", maxWind: "34 km/h", maxPrecipProb: "14%", totalPrecip: "0 mm", peakUV: 4, avgHumidity: "60%",
  }),
  scenario("freezing_rain_alert", {
    temperature: 1, feelsLike: -3, wind: 22, gusts: 31, humidity: 88, cloud: 96, precip: 1.1, precipProb: 81, uv: 1, weatherLabel: "Freezing rain",
    prefs: ["runs cold (feels colder than average)"],
    tempRange: "-1°C – 2°C", feelsLikeRange: "-5°C – 0°C", maxWind: "31 km/h", maxPrecipProb: "86%", totalPrecip: "5.1 mm", peakUV: 1, avgHumidity: "90%",
  }),
  scenario("overcast_spring_formal", {
    temperature: 15, feelsLike: 15, wind: 12, gusts: 18, humidity: 66, cloud: 88, precip: 0, precipProb: 16, uv: 3, weatherLabel: "Overcast",
    prefs: ["prefers polished or smart-casual style", "wants the outfit to lean polished", "will spend most of the day indoors"],
    tempRange: "14°C – 17°C", feelsLikeRange: "14°C – 17°C", maxWind: "18 km/h", maxPrecipProb: "18%", totalPrecip: "0 mm", peakUV: 3, avgHumidity: "67%",
  }),
  scenario("athleisure_cool_morning", {
    temperature: 9, feelsLike: 7, wind: 15, gusts: 21, humidity: 57, cloud: 22, precip: 0, precipProb: 6, uv: 3, weatherLabel: "Clear",
    prefs: ["prefers sporty or athleisure looks", "plans to bike or walk (active)"],
    tempRange: "8°C – 13°C", feelsLikeRange: "6°C – 11°C", maxWind: "21 km/h", maxPrecipProb: "8%", totalPrecip: "0 mm", peakUV: 4, avgHumidity: "58%",
  }),
  scenario("beach_heatwave", {
    temperature: 34, feelsLike: 37, wind: 12, gusts: 18, humidity: 56, cloud: 3, precip: 0, precipProb: 1, uv: 9, weatherLabel: "Clear",
    prefs: ["runs hot (feels warmer than average)", "will spend a lot of time outdoors", "prefers casual everyday outfits"],
    tempRange: "33°C – 36°C", feelsLikeRange: "36°C – 40°C", maxWind: "18 km/h", maxPrecipProb: "2%", totalPrecip: "0 mm", peakUV: 10, avgHumidity: "55%",
  }),
  scenario("mountain_chill_hike", {
    temperature: 5, feelsLike: 1, wind: 28, gusts: 39, humidity: 71, cloud: 48, precip: 0.2, precipProb: 24, uv: 5, weatherLabel: "Partly cloudy",
    prefs: ["will spend a lot of time outdoors", "plans to bike or walk (active)", "runs cold (feels colder than average)"],
    tempRange: "3°C – 7°C", feelsLikeRange: "-1°C – 4°C", maxWind: "39 km/h", maxPrecipProb: "28%", totalPrecip: "0.4 mm", peakUV: 6, avgHumidity: "72%",
  }),
  scenario("autumn_streetwear_layering", {
    temperature: 12, feelsLike: 10, wind: 14, gusts: 20, humidity: 64, cloud: 52, precip: 0, precipProb: 10, uv: 2, weatherLabel: "Partly cloudy",
    prefs: ["prefers streetwear-inspired outfits", "wants the outfit to lean streetwear"],
    tempRange: "10°C – 14°C", feelsLikeRange: "8°C – 12°C", maxWind: "20 km/h", maxPrecipProb: "12%", totalPrecip: "0 mm", peakUV: 3, avgHumidity: "65%",
  }),
  scenario("summer_evening_smart", {
    temperature: 24, feelsLike: 24, wind: 8, gusts: 12, humidity: 52, cloud: 18, precip: 0, precipProb: 4, uv: 3, weatherLabel: "Clear",
    prefs: ["prefers polished or smart-casual style", "wants the outfit to lean polished"],
    tempRange: "22°C – 25°C", feelsLikeRange: "22°C – 26°C", maxWind: "12 km/h", maxPrecipProb: "6%", totalPrecip: "0 mm", peakUV: 3, avgHumidity: "53%",
  }),
  scenario("transitional_office_casual", {
    temperature: 20, feelsLike: 20, wind: 9, gusts: 14, humidity: 54, cloud: 33, precip: 0, precipProb: 8, uv: 4, weatherLabel: "Partly cloudy",
    prefs: ["prefers casual everyday outfits", "will spend most of the day indoors"],
    tempRange: "19°C – 22°C", feelsLikeRange: "19°C – 22°C", maxWind: "14 km/h", maxPrecipProb: "10%", totalPrecip: "0 mm", peakUV: 4, avgHumidity: "55%",
  }),
  scenario("stormy_evening", {
    temperature: 17, feelsLike: 16, wind: 26, gusts: 38, humidity: 82, cloud: 98, precip: 2.2, precipProb: 88, uv: 1, weatherLabel: "Thunderstorm",
    prefs: ["prefers casual everyday outfits"],
    tempRange: "16°C – 18°C", feelsLikeRange: "15°C – 17°C", maxWind: "38 km/h", maxPrecipProb: "92%", totalPrecip: "9.1 mm", peakUV: 1, avgHumidity: "84%",
  }),
];

function promptFor(scenario) {
  const { weather } = scenario;
  const dayFc = weather.remainingForecast;
  return `You are WearCast, a smart clothing recommendation assistant.

Given the current weather and the forecast from NOW through the rest of today, suggest a specific outfit they should wear for the rest of today. The user has no wardrobe saved, so suggest a generic outfit only.

## Current Weather
- Temperature: ${weather.temperature}°C (feels like ${weather.feelsLike}°C)
- Wind: ${weather.wind} km/h (gusts ${weather.gusts} km/h)
- Humidity: ${weather.humidity}%
- Cloud cover: ${weather.cloud}%
- Precipitation: ${weather.precip} mm/h
- Precipitation probability: ${weather.precipProb}%
- UV index: ${weather.uv}
- Weather: ${weather.weatherLabel}
- Is daytime: yes

## Forecast For The Rest Of Today
- Temperature range: ${dayFc.tempRange}
- Feels-like range: ${dayFc.feelsLikeRange}
- Max wind: ${dayFc.maxWind}
- Max precipitation probability: ${dayFc.maxPrecipProb}
- Total precipitation: ${dayFc.totalPrecip}
- Peak UV index: ${dayFc.peakUV}
- Average humidity: ${dayFc.avgHumidity}

## User Preferences
${scenario.prefs.join("\n")}

## User's Wardrobe
User has no saved wardrobe items. Suggest a generic outfit only.

## Instructions
1. Recommend a COMPLETE outfit using short item names only.
2. Consider ONLY the forecast from now onward today.
3. Do not mention missing wardrobe pieces beyond one short missing-item suggestion.
4. Keep reasoning to ONE short sentence.
5. Return at most ONE accessory, ONE warning, and ONE missing item.
6. Do not explain each clothing piece separately.
7. Vary item names naturally when appropriate instead of always using the same generic pieces.
8. Return JSON only.

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
}

function parseMaybeJson(content, fallback) {
  try {
    return JSON.parse(String(content).replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
  } catch {
    return { raw: content || fallback };
  }
}

const results = [];

for (const [index, scenarioDef] of scenarios.entries()) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://wearcast.app",
      "X-Title": "WearCast",
    },
    body: JSON.stringify({
      model: "auto",
      messages: [{ role: "user", content: promptFor(scenarioDef) }],
      max_tokens: 200,
      temperature: 0.35,
      reasoning: { effort: "none" },
    }),
  });

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const parsed = parseMaybeJson(content, data);
  results.push({ scenario: scenarioDef.name, status: res.status, parsed });
  console.error(`sampled ${index + 1}/${scenarios.length}: ${scenarioDef.name}`);
}

const uniqueBySlot = { top: new Set(), bottom: new Set(), outer: new Set(), shoes: new Set(), accessories: new Set() };
for (const entry of results) {
  const outfit = entry.parsed?.outfit || {};
  for (const slot of ["top", "bottom", "outer", "shoes"]) {
    if (typeof outfit[slot] === "string" && outfit[slot].trim()) uniqueBySlot[slot].add(outfit[slot].trim());
  }
  if (Array.isArray(outfit.accessories)) {
    for (const accessory of outfit.accessories) {
      if (typeof accessory === "string" && accessory.trim()) uniqueBySlot.accessories.add(accessory.trim());
    }
  }
}

const summary = Object.fromEntries(
  Object.entries(uniqueBySlot).map(([slot, values]) => [slot, Array.from(values).sort((a, b) => a.localeCompare(b))])
);

console.log(JSON.stringify({ results, summary }, null, 2));
