// WearCast
// Weather: Open-Meteo (no key). Geocoding: Nominatim (OSM).

const $ = (id) => document.getElementById(id);

const els = {
  placeInput: $("placeInput"),
  placeStatus: $("placeStatus"),
  geoBtn: $("geoBtn"),
  searchBtn: $("searchBtn"),
  refreshBtn: $("refreshBtn"),

  recBadge: $("recBadge"),
  recommendation: $("recommendation"),
  reasons: $("reasons"),

  severity: $("severity"),
  severityTitle: $("severityTitle"),
  severityMeta: $("severityMeta"),
  severityDetail: $("severityDetail"),

  updatedAt: $("updatedAt"),
  temp: $("temp"),
  apparent: $("apparent"),
  wind: $("wind"),
  humidity: $("humidity"),
  cloud: $("cloud"),
  precip: $("precip"),
  precipProb: $("precipProb"),
  uv: $("uv"),
  dewPoint: $("dewPoint"),
  effTemp: $("effTemp"),
  vis: $("vis"),
  isDay: $("isDay"),
  wcode: $("wcode"),

  prefCold: $("prefCold"),
  prefHot: $("prefHot"),
  prefFormal: $("prefFormal"),
  prefBike: $("prefBike"),

  privacyBtn: $("privacyBtn"),
  consentDialog: $("consentDialog"),
  consentSelectAll: $("consentSelectAll"),
  consentFunctional: $("consentFunctional"),
  consentLocation: $("consentLocation"),
  consentEssential: $("consentEssential"),
  consentAccept: $("consentAccept"),
};

const STORAGE_KEY = "wearcast:v1";
const CONSENT_KEY = "wearcast:consent:v1";

const DEFAULT_STATE = {
  lastQuery: "",
  lastLocation: null, // { name, lat, lon }
  prefs: { cold: false, hot: false, formal: false, bike: false },
};

const DEFAULT_CONSENT = {
  seen: false,
  functionalStorage: false,
  deviceLocation: false,
  updatedAt: null,
};

let consent = loadConsent();
let memoryState = structuredClone(DEFAULT_STATE);

function loadConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return structuredClone(DEFAULT_CONSENT);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_CONSENT), ...parsed };
  } catch {
    return structuredClone(DEFAULT_CONSENT);
  }
}

function saveConsent(patch) {
  consent = { ...consent, ...patch, updatedAt: new Date().toISOString() };
  try {
    // Storing consent itself is considered strictly necessary to remember the choice.
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // ignore
  }
  return consent;
}

function canUseFunctionalStorage() {
  return !!consent.functionalStorage;
}

function loadState() {
  if (!canUseFunctionalStorage()) return structuredClone(memoryState);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      prefs: { ...DEFAULT_STATE.prefs, ...(parsed.prefs || {}) },
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState(partial) {
  const prev = loadState();
  const next = {
    ...prev,
    ...partial,
    prefs: { ...prev.prefs, ...(partial.prefs || {}) },
  };

  // Always keep an in-memory state so the app works without storage.
  memoryState = structuredClone(next);

  if (canUseFunctionalStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  return next;
}

function fmt(n, unit = "") {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${Math.round(n)}${unit}`;
}

function fmt1(n, unit = "") {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${Math.round(n * 10) / 10}${unit}`;
}

function setStatus(msg) {
  els.placeStatus.textContent = msg || "";
}

function showConsentDialog({ forceModal = false } = {}) {
  if (!els.consentDialog) return;

  // Sync UI
  els.consentFunctional.checked = !!consent.functionalStorage;
  els.consentLocation.checked = !!consent.deviceLocation;
  if (els.consentSelectAll) {
    els.consentSelectAll.checked = !!(els.consentFunctional.checked && els.consentLocation.checked);
    els.consentSelectAll.indeterminate = !!(els.consentFunctional.checked !== els.consentLocation.checked);
  }

  // HTMLDialogElement isn't supported in some older browsers.
  if (typeof els.consentDialog.showModal === "function") {
    if (forceModal) els.consentDialog.showModal();
    else els.consentDialog.show();
  } else {
    alert("Privacy options are not supported in this browser UI. You can still use search without device location.");
  }
}

function closeConsentDialog() {
  if (!els.consentDialog) return;
  if (typeof els.consentDialog.close === "function") els.consentDialog.close();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function dewPointC(tempC, rhPct) {
  // Magnus formula (good enough for consumer guidance)
  if (tempC == null || rhPct == null) return null;
  const rh = clamp(rhPct, 1, 100) / 100;
  const a = 17.62;
  const b = 243.12;
  const gamma = (a * tempC) / (b + tempC) + Math.log(rh);
  return (b * gamma) / (a - gamma);
}

function humidex(tempC, dewC) {
  // Canadian humidex (uses dew point)
  if (tempC == null || dewC == null) return null;
  const e = 6.11 * Math.exp(5417.7530 * (1 / 273.16 - 1 / (dewC + 273.15)));
  return tempC + 0.5555 * (e - 10);
}

function windChillC(tempC, windKmh) {
  // Environment Canada wind chill (valid when T<=10C and wind>4.8km/h)
  if (tempC == null || windKmh == null) return null;
  if (tempC > 10 || windKmh <= 4.8) return null;
  const v = Math.max(0, windKmh);
  return 13.12 + 0.6215 * tempC - 11.37 * Math.pow(v, 0.16) + 0.3965 * tempC * Math.pow(v, 0.16);
}

function clearReasons() {
  els.reasons.innerHTML = "";
}

function addReason(text) {
  const li = document.createElement("li");
  li.textContent = text;
  els.reasons.appendChild(li);
}

function setBadge(type, text) {
  els.recBadge.className = "badge";
  if (type) els.recBadge.classList.add(type);
  els.recBadge.textContent = text;
}

function setSeverity(level, title, meta, detail) {
  // level: good|warn|bad
  els.severity.className = "alert";
  if (level) els.severity.classList.add(level);
  els.severityTitle.textContent = title || "—";
  els.severityMeta.textContent = meta || "";
  els.severityDetail.textContent = detail || "";
}

function classifySeverity(current, ctx, effectiveC) {
  const gust = current.wind_gusts_10m ?? 0;
  const wind = current.wind_speed_10m ?? 0;
  const uv = current.uv_index ?? 0;
  const code = current.weather_code;
  const precipProb = ctx?.precipProb ?? null;
  const next2h = ctx?.next2hPrecip ?? null;

  const wetCodes = [51,53,55,56,57,61,63,65,66,67,80,81,82];
  const snowCodes = [71,73,75,77,85,86];
  const stormCodes = [95,96,99];

  const storm = stormCodes.includes(code);
  const snowy = snowCodes.includes(code) || ((ctx?.snowfall ?? 0) > 0);
  const wet = wetCodes.includes(code) || ((precipProb ?? 0) >= 50) || ((next2h ?? 0) >= 1.0);

  const extremeCold = effectiveC != null && effectiveC <= -5;
  const veryCold = effectiveC != null && effectiveC <= 2;
  const extremeHeat = effectiveC != null && effectiveC >= 33;
  const veryHot = effectiveC != null && effectiveC >= 28;

  const veryWindy = gust >= 60 || wind >= 35;
  const windy = gust >= 40 || wind >= 25;

  // Score-based severity (simple & explainable)
  let score = 0;
  const flags = [];

  if (storm) { score += 4; flags.push("thunderstorm"); }
  if (snowy) { score += 3; flags.push("snow/ice risk"); }
  if (wet) { score += 2; flags.push("rain risk"); }
  if (veryWindy) { score += 3; flags.push("strong gusts"); }
  else if (windy) { score += 2; flags.push("windy"); }

  if (extremeCold) { score += 3; flags.push("very cold"); }
  else if (veryCold) { score += 1; flags.push("cold"); }

  if (extremeHeat) { score += 3; flags.push("very hot"); }
  else if (veryHot) { score += 1; flags.push("hot"); }

  if (uv >= 8) { score += 2; flags.push("very high UV"); }
  else if (uv >= 6) { score += 1; flags.push("high UV"); }

  let level = "good";
  let title = "All clear";

  if (score >= 6) { level = "bad"; title = "Severe conditions"; }
  else if (score >= 3) { level = "warn"; title = "Be prepared"; }

  const metaParts = [];
  if (effectiveC != null) metaParts.push(`Effective ${fmt1(effectiveC, "°C")}`);
  if (precipProb != null) metaParts.push(`Precip ${fmt(precipProb, "%")}`);
  if (gust) metaParts.push(`Gusts ${fmt(gust, " km/h")}`);

  const detail = flags.length ? `Key factors: ${flags.join(", ")}.` : "No major weather stressors detected.";

  return { level, title, meta: metaParts.join(" • "), detail };
}

function weatherCodeLabel(code) {
  // Open-Meteo WMO weather interpretation codes (simplified labels)
  const m = {
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
  return m[code] ?? `Code ${code}`;
}

async function geocodePlace(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      // Nominatim requests a descriptive UA; browsers may ignore; still helpful.
      "Accept": "application/json",
    },
  });

  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  return {
    name: data[0].display_name,
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
  };
}

async function fetchWeather(lat, lon) {
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

  // Pull a few hourly values to make recommendations smarter (rain risk, near-term trend)
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
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
  return res.json();
}

function pickHourlyAtTime(hourly, isoTime) {
  if (!hourly?.time || !Array.isArray(hourly.time)) return null;
  const idx = hourly.time.indexOf(isoTime);
  if (idx === -1) return null;

  const get = (key) => {
    const arr = hourly[key];
    if (!Array.isArray(arr)) return null;
    return arr[idx] ?? null;
  };

  return {
    time: isoTime,
    precipProb: get("precipitation_probability"),
    precip: get("precipitation"),
    rain: get("rain"),
    snowfall: get("snowfall"),
    t: get("temperature_2m"),
    feels: get("apparent_temperature"),
    wind: get("wind_speed_10m"),
    rh: get("relative_humidity_2m"),
    cloud: get("cloud_cover"),
    uv: get("uv_index"),
  };
}

function sumNextHours(hourly, isoTime, key, hours = 2) {
  if (!hourly?.time || !Array.isArray(hourly.time) || !Array.isArray(hourly[key])) return null;
  const start = hourly.time.indexOf(isoTime);
  if (start === -1) return null;
  let sum = 0;
  for (let i = 0; i < hours; i++) {
    const v = hourly[key][start + i];
    if (v == null) continue;
    sum += Number(v);
  }
  return sum;
}

function deriveRecommendation(current, ctx, prefs) {
  // Inputs
  const t = current.temperature_2m; // °C
  const feels = current.apparent_temperature;
  const wind = current.wind_speed_10m; // km/h
  const gust = current.wind_gusts_10m;
  const rh = current.relative_humidity_2m; // %
  const cloud = current.cloud_cover; // %
  const precip = current.precipitation; // mm (current hour)
  const uv = current.uv_index;
  const code = current.weather_code;

  // Derived metrics
  const dew = dewPointC(t, rh);
  const hx = humidex(t, dew);
  const wc = windChillC(t, wind);

  // "Effective" temp: prefer wind chill when cold+windy; humidex when warm+muggy; else apparent
  let effective = feels;
  let effectiveLabel = "apparent";
  if (wc != null) {
    effective = wc;
    effectiveLabel = "wind chill";
  } else if (hx != null && hx >= t + 1.0) {
    effective = hx;
    effectiveLabel = "humidex";
  }

  // Preference adjustments (how you personally feel)
  const bias = prefs.cold ? -2 : prefs.hot ? 2 : 0; // shift perceived comfort
  const comfort = effective + bias;

  const reasons = [];

  // Rain/wet
  const wetCodes = [51,53,55,56,57,61,63,65,66,67,80,81,82];
  const snowCodes = [71,73,75,77,85,86];
  const stormCodes = [95,96,99];

  const wet = (precip ?? 0) >= 0.2 || wetCodes.includes(code) || ((ctx?.precipProb ?? 0) >= 40);
  const snow = snowCodes.includes(code) || ((ctx?.snowfall ?? 0) > 0);
  const storm = stormCodes.includes(code);

  // Wind
  const windy = (wind ?? 0) >= 25 || (gust ?? 0) >= 40;

  // Heat/humidity/sun
  const humid = (rh ?? 0) >= 75 || (dew ?? 0) >= 16;
  const sunny = (cloud ?? 100) <= 25 && (uv ?? 0) >= 3;

  // Base layers by comfort temperature
  let top = [];
  let bottom = [];
  let outer = [];
  let extras = [];

  reasons.push(`Effective temp: ~${fmt1(effective, "°C")} (${effectiveLabel})${bias ? `, adjusted to ~${fmt1(comfort, "°C")} for your preference` : ""}.`);
  if (dew != null) reasons.push(`Dew point ~${fmt1(dew, "°C")} (${dew >= 18 ? "very muggy" : dew >= 16 ? "muggy" : dew >= 12 ? "a bit humid" : "dry-ish"}).`);
  if (ctx?.precipProb != null) reasons.push(`Precip chance this hour: ~${fmt(ctx.precipProb, "%")}.`);
  if (ctx?.next2hPrecip != null && ctx.next2hPrecip >= 0.5) reasons.push(`Next ~2h precip: ~${fmt1(ctx.next2hPrecip, " mm")}.`);

  // Very cold
  if (comfort <= 0) {
    top.push("thermal base layer (merino/synthetic)", "mid-layer sweater/fleece");
    outer.push("insulated coat (windproof if possible)");
    bottom.push("long pants", "optional thermal leggings if outside >30 min");
    extras.push("warm socks", "closed shoes/boots");
    if (windy) extras.push("beanie", "gloves", "scarf/neck gaiter");
  }
  // Cold
  else if (comfort <= 8) {
    top.push("long-sleeve", "mid-layer (sweater/light fleece)");
    outer.push("jacket (wind-resistant)");
    bottom.push("pants");
    extras.push("closed shoes");
    if (windy) extras.push("windproof outer layer");
  }
  // Cool / Mild
  else if (comfort <= 14) {
    top.push("t-shirt", "light layer (overshirt/cardigan)");
    outer.push("optional light jacket if you’ll be out late");
    bottom.push("jeans/chinos");
    extras.push("sneakers");
  }
  // Mild / Warm
  else if (comfort <= 20) {
    top.push("t-shirt or light long-sleeve");
    bottom.push("light pants or jeans");
    outer.push("optional thin layer for wind/AC");
    extras.push("breathable shoes");
    if (sunny) extras.push("sunglasses");
    if (windy) extras.push("thin windbreaker (packable)");
  }
  // Warm
  else if (comfort <= 25) {
    top.push("t-shirt (breathable)");
    bottom.push("light pants or shorts");
    extras.push("breathable shoes");
    if (sunny) extras.push("sunglasses", "SPF (face/neck)");
    if (humid) extras.push("choose moisture-wicking fabric");
  }
  // Hot
  else {
    top.push("very light top (linen/mesh/cotton)");
    bottom.push("shorts or very light pants");
    extras.push("breathable shoes/sandals");
    extras.push("water bottle (if outside)");
    if (sunny) extras.push("hat", "SPF 30+", "sunglasses");
    if (humid) extras.push("moisture-wicking underwear/socks", "avoid heavy denim");
  }

  // Wet/snow modifiers
  if (wet) {
    // Umbrella vs shell: if windy, prefer shell.
    outer.unshift(windy ? "waterproof shell (hood)" : "rain jacket / shell");
    if (!windy) extras.push("umbrella (optional)");
    extras.push("water-resistant shoes");
    if ((ctx?.precipProb ?? 0) >= 60 || (precip ?? 0) >= 1) extras.push("avoid suede / consider spare socks");
    reasons.push(`Wet risk: ${weatherCodeLabel(code)}; precip ~${fmt1(precip ?? 0, "mm/h")}${ctx?.precipProb != null ? `, chance ~${fmt(ctx.precipProb, "%")}` : ""}.`);
  }
  if (snow) {
    outer.unshift("insulated shell");
    extras.push("boots with grip");
    reasons.push(`Snowy conditions (${weatherCodeLabel(code)}).`);
  }
  if (storm) {
    extras.push("avoid umbrellas if gusty", "consider postponing if exposed");
    reasons.push("Thunderstorm conditions.");
  }

  // Wind
  if (windy) {
    reasons.push(`Wind: ${fmt(wind, " km/h")} (gusts ${fmt(gust, " km/h")}).`);
    extras.push("secure hat/hood", "avoid very loose outerwear");
  }

  // UV
  if (sunny) {
    reasons.push(`Sun/UV: UV ~${fmt1(uv, "")} with low cloud cover (${fmt(cloud, "%")}).`);
    if ((uv ?? 0) >= 6) extras.push("SPF 30+", "hat", "seek shade mid-day");
    else extras.push("SPF (face/neck)");
  }

  // Bike/walk preference
  if (prefs.bike) {
    extras.push("light windbreaker (packable)", "avoid heavy fabrics", "prefer breathable layers you can vent");
    reasons.push("Activity: bike/walk → plan for wind + sweat (layers > heavy coat)." );
  }

  // Formal preference
  if (prefs.formal) {
    // Map pieces to a slightly more formal set.
    top = top.map((x) => x.replace("t-shirt", "polo or button-down").replace("hoodie", "knit sweater"));
    bottom = bottom.map((x) => x.replace("shorts", "chinos").replace("jeans", "chinos"));
    reasons.push("You prefer formal-ish: recommending smarter basics." );
  }

  // Clean duplicates
  const uniq = (arr) => [...new Set(arr)].filter(Boolean);
  top = uniq(top);
  bottom = uniq(bottom);
  outer = uniq(outer);
  extras = uniq(extras);

  // Severity badge
  let badgeType = "good";
  let badgeText = "Comfortable";
  if (storm || snow) { badgeType = "bad"; badgeText = "Severe"; }
  else if (wet || windy || comfort <= 2 || comfort >= 28) { badgeType = "warn"; badgeText = "Be prepared"; }

  // Tips
  const tips = [];
  if ((ctx?.precipProb ?? 0) >= 50 || (precip ?? 0) >= 0.5) tips.push("If you’ll be out >15 min: pick a hooded shell + water-resistant shoes.");
  if (windy && comfort <= 10) tips.push("If you get cold easily: add a windproof layer (wind matters more than temperature)." );
  if ((uv ?? 0) >= 6) tips.push("If you’re outdoors mid-day: SPF + hat." );

  return {
    badgeType,
    badgeText,
    // structured fields for nicer UI
    outer,
    top,
    bottom,
    extras,
    tips,
    reasons,
  };
}

function renderWeather(current, derived) {
  els.temp.textContent = `${fmt1(current.temperature_2m, "°C")}`;
  els.apparent.textContent = `${fmt1(current.apparent_temperature, "°C")}`;
  els.wind.textContent = `${fmt(current.wind_speed_10m, " km/h")} (gusts ${fmt(current.wind_gusts_10m, " km/h")})`;
  els.humidity.textContent = `${fmt(current.relative_humidity_2m, "%")}`;
  els.cloud.textContent = `${fmt(current.cloud_cover, "%")}`;
  els.precip.textContent = `${fmt1(current.precipitation, " mm")}`;
  els.precipProb.textContent = derived?.precipProb != null ? `${fmt(derived.precipProb, "%")}` : "—";

  const dew = dewPointC(current.temperature_2m, current.relative_humidity_2m);
  const hx = humidex(current.temperature_2m, dew);
  const wc = windChillC(current.temperature_2m, current.wind_speed_10m);
  let effective = current.apparent_temperature;
  if (wc != null) effective = wc;
  else if (hx != null && hx >= current.temperature_2m + 1.0) effective = hx;

  els.dewPoint.textContent = dew != null ? `${fmt1(dew, "°C")}` : "—";
  els.effTemp.textContent = effective != null ? `${fmt1(effective, "°C")}` : "—";

  const sev = classifySeverity(current, derived, effective);
  setSeverity(sev.level, sev.title, sev.meta, sev.detail);

  els.uv.textContent = `${fmt1(current.uv_index, "")}`;
  els.vis.textContent = current.visibility != null ? `${fmt1(current.visibility / 1000, " km")}` : "—";
  els.isDay.textContent = current.is_day === 1 ? "Yes" : current.is_day === 0 ? "No" : "—";
  els.wcode.textContent = `${weatherCodeLabel(current.weather_code)} (${current.weather_code})`;
}

function renderRecommendation(rec) {
  setBadge(rec.badgeType, rec.badgeText);

  // More readable structured output
  const section = (title, items) => {
    if (!items || items.length === 0) return "";
    const lis = items.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
    return `<div class="rec-section"><h3>${escapeHtml(title)}</h3><ul>${lis}</ul></div>`;
  };

  const tips = rec.tips?.length
    ? `<div class="rec-section"><h3>Tips</h3><div class="rec-tip">${escapeHtml(rec.tips.join(" "))}</div></div>`
    : "";

  els.recommendation.innerHTML = `<div class="rec-block">${
    section("Outer layer", rec.outer)
  }${section("Upper body", rec.top)}${section("Lower body", rec.bottom)}${section(
    "Accessories / notes",
    rec.extras
  )}${tips}</div>`;

  clearReasons();
  rec.reasons.forEach(addReason);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function runForLocation(loc) {
  if (!loc) return;

  setStatus(`Fetching weather for ${loc.name}…`);
  try {
    const data = await fetchWeather(loc.lat, loc.lon);
    const current = data?.current;
    if (!current) throw new Error("No current weather in response");

    const state = loadState();

    const ctx = (() => {
      const hourlyNow = pickHourlyAtTime(data.hourly, data.current.time);
      return {
        ...hourlyNow,
        next2hPrecip: sumNextHours(data.hourly, data.current.time, "precipitation", 2),
      };
    })();

    renderWeather(current, ctx);

    const rec = deriveRecommendation(current, ctx, state.prefs);
    renderRecommendation(rec);

    const updated = new Date(data.current.time || Date.now());
    els.updatedAt.textContent = `Updated ${updated.toLocaleString()}`;

    setStatus(`Using: ${loc.name}`);
    saveState({ lastLocation: loc });
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  }
}

async function onSearch() {
  const query = (els.placeInput.value || "").trim();
  if (!query) {
    setStatus("Enter a location (e.g., \"Berlin\") or use \"Use my location\".");
    return;
  }

  setStatus(`Searching for “${query}”…`);
  try {
    const loc = await geocodePlace(query);
    if (!loc) {
      setStatus(`No results for “${query}”. Try a city + country (e.g., “Paris, FR”).`);
      return;
    }
    saveState({ lastQuery: query, lastLocation: loc });
    await runForLocation(loc);
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  }
}

function getGeo() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported in this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(new Error(err.message || "Geolocation failed")),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

async function reverseGeocode(lat, lon) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));

  const res = await fetch(url.toString(), { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
  const data = await res.json();
  const name = data?.display_name || `Lat ${lat.toFixed(3)}, Lon ${lon.toFixed(3)}`;
  return { name, lat, lon };
}

async function onUseMyLocation() {
  if (!consent.deviceLocation) {
    setStatus("To use device location, open Privacy settings and enable ‘Use device location’. You can still search by city.");
    showConsentDialog({ forceModal: true });
    return;
  }

  setStatus("Requesting location permission…");
  try {
    const pos = await getGeo();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    setStatus("Resolving place name…");
    const loc = await reverseGeocode(lat, lon);
    els.placeInput.value = loc.name;
    saveState({ lastQuery: "", lastLocation: loc });
    await runForLocation(loc);
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  }
}

function bindPrefs() {
  const state = loadState();
  els.prefCold.checked = !!state.prefs.cold;
  els.prefHot.checked = !!state.prefs.hot;
  els.prefFormal.checked = !!state.prefs.formal;
  els.prefBike.checked = !!state.prefs.bike;

  function syncPrefs() {
    // cold/hot mutually exclusive
    const cold = els.prefCold.checked;
    const hot = els.prefHot.checked;
    if (cold && hot) {
      // Prefer latest toggle: if both become true, turn off the other.
      // We detect based on event target in listeners below.
    }
  }

  els.prefCold.addEventListener("change", () => {
    if (els.prefCold.checked) els.prefHot.checked = false;
    saveState({ prefs: { cold: els.prefCold.checked, hot: els.prefHot.checked, formal: els.prefFormal.checked, bike: els.prefBike.checked } });
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });
  els.prefHot.addEventListener("change", () => {
    if (els.prefHot.checked) els.prefCold.checked = false;
    saveState({ prefs: { cold: els.prefCold.checked, hot: els.prefHot.checked, formal: els.prefFormal.checked, bike: els.prefBike.checked } });
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });
  els.prefFormal.addEventListener("change", () => {
    saveState({ prefs: { cold: els.prefCold.checked, hot: els.prefHot.checked, formal: els.prefFormal.checked, bike: els.prefBike.checked } });
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });
  els.prefBike.addEventListener("change", () => {
    saveState({ prefs: { cold: els.prefCold.checked, hot: els.prefHot.checked, formal: els.prefFormal.checked, bike: els.prefBike.checked } });
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

function bindConsentUI() {
  // Footer button
  els.privacyBtn?.addEventListener("click", () => showConsentDialog({ forceModal: true }));

  // Select-all logic
  const syncSelectAll = () => {
    if (!els.consentSelectAll) return;
    const a = !!els.consentFunctional?.checked;
    const b = !!els.consentLocation?.checked;
    els.consentSelectAll.checked = a && b;
    els.consentSelectAll.indeterminate = a !== b;
  };

  els.consentSelectAll?.addEventListener("change", () => {
    const on = !!els.consentSelectAll.checked;
    if (els.consentFunctional) els.consentFunctional.checked = on;
    if (els.consentLocation) els.consentLocation.checked = on;
    syncSelectAll();
  });
  els.consentFunctional?.addEventListener("change", syncSelectAll);
  els.consentLocation?.addEventListener("change", syncSelectAll);

  // Dialog buttons
  els.consentEssential?.addEventListener("click", (e) => {
    // Continue without saving (no functional storage, no device location)
    e.preventDefault();
    saveConsent({ seen: true, functionalStorage: false, deviceLocation: false });
    closeConsentDialog();
  });

  els.consentAccept?.addEventListener("click", (e) => {
    e.preventDefault();
    saveConsent({
      seen: true,
      functionalStorage: !!els.consentFunctional?.checked,
      deviceLocation: !!els.consentLocation?.checked,
    });

    // If storage was just enabled, persist whatever is in memory now.
    if (canUseFunctionalStorage()) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState)); } catch {}
    }

    closeConsentDialog();
  });
}

function init() {
  bindConsentUI();
  bindPrefs();

  els.searchBtn.addEventListener("click", onSearch);
  els.geoBtn.addEventListener("click", onUseMyLocation);
  els.refreshBtn.addEventListener("click", () => {
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });

  els.placeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSearch();
  });

  // Show GDPR-style privacy choices on first visit.
  if (!consent.seen) {
    showConsentDialog({ forceModal: true });
  }

  const st = loadState();
  if (st.lastLocation) {
    els.placeInput.value = st.lastLocation.name;
    runForLocation(st.lastLocation);
  } else if (st.lastQuery) {
    els.placeInput.value = st.lastQuery;
  }

  registerSW();
}

init();
