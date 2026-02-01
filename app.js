// What to Wear (local-first)
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

  updatedAt: $("updatedAt"),
  temp: $("temp"),
  apparent: $("apparent"),
  wind: $("wind"),
  humidity: $("humidity"),
  cloud: $("cloud"),
  precip: $("precip"),
  uv: $("uv"),
  vis: $("vis"),
  isDay: $("isDay"),
  wcode: $("wcode"),

  prefCold: $("prefCold"),
  prefHot: $("prefHot"),
  prefFormal: $("prefFormal"),
  prefBike: $("prefBike"),
};

const STORAGE_KEY = "wtw:v1";

const DEFAULT_STATE = {
  lastQuery: "",
  lastLocation: null, // { name, lat, lon }
  prefs: { cold: false, hot: false, formal: false, bike: false },
};

function loadState() {
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
  url.searchParams.set("current", [
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
  ].join(","));
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
  return res.json();
}

function deriveRecommendation(current, prefs) {
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

  // Preference adjustments
  const bias = prefs.cold ? -2 : prefs.hot ? 2 : 0; // shift perceived comfort
  const comfort = feels + bias;

  const reasons = [];

  // Rain/wet
  const wet = (precip ?? 0) >= 0.2 || [51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code);
  const snow = [71,73,75,77,85,86].includes(code);
  const storm = [95,96,99].includes(code);

  // Wind chill-ish
  const windy = (wind ?? 0) >= 25 || (gust ?? 0) >= 40;

  // Heat/humidity
  const humid = (rh ?? 0) >= 75;
  const sunny = (cloud ?? 100) <= 25 && (uv ?? 0) >= 3;

  // Base layers by comfort temperature
  let top = [];
  let bottom = [];
  let outer = [];
  let extras = [];

  // Very cold
  if (comfort <= 0) {
    top.push("thermal base layer", "sweater/hoodie");
    outer.push("warm coat");
    bottom.push("long pants");
    extras.push("warm socks", "closed shoes/boots");
    if (windy) extras.push("beanie", "gloves", "scarf");
    reasons.push(`Feels like ~${fmt1(feels, "°C")} (you ${prefs.cold ? "run cold" : prefs.hot ? "run hot" : "run neutral"}).`);
  }
  // Cold
  else if (comfort <= 8) {
    top.push("long-sleeve", "sweater/hoodie");
    outer.push("jacket");
    bottom.push("pants");
    extras.push("closed shoes");
    if (windy) extras.push("windproof layer");
    reasons.push(`Cool conditions: feels like ~${fmt1(feels, "°C")}.`);
  }
  // Mild
  else if (comfort <= 16) {
    top.push("t-shirt", "light layer (overshirt/cardigan)");
    bottom.push("pants or jeans");
    outer.push("optional light jacket");
    extras.push("sneakers");
    reasons.push(`Mild: feels like ~${fmt1(feels, "°C")}.`);
  }
  // Warm
  else if (comfort <= 23) {
    top.push("t-shirt");
    bottom.push("light pants or shorts");
    extras.push("breathable shoes");
    if (sunny) extras.push("sunglasses");
    reasons.push(`Warm: feels like ~${fmt1(feels, "°C")}.`);
  }
  // Hot
  else {
    top.push("light t-shirt/tank");
    bottom.push("shorts or very light pants");
    extras.push("breathable shoes/sandals");
    if (sunny) extras.push("sunglasses", "hat", "SPF 30+");
    if (humid) extras.push("consider moisture-wicking fabric");
    reasons.push(`Hot: feels like ~${fmt1(feels, "°C")}${humid ? " with high humidity" : ""}.`);
  }

  // Wet/snow modifiers
  if (wet) {
    outer.unshift("rain jacket / shell");
    extras.push("umbrella (optional)");
    extras.push("water-resistant shoes");
    reasons.push(`Precipitation likely now (~${fmt1(precip ?? 0, "mm/h")} or weather: ${weatherCodeLabel(code)}).`);
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
  if (windy && !reasons.some(r => r.includes("Wind"))) {
    reasons.push(`Windy: ${fmt(wind, " km/h")} (gusts ${fmt(gust, " km/h")}).`);
  }

  // UV
  if (sunny) {
    reasons.push(`Sunny / UV ~${fmt1(uv, "")} with low cloud cover (${fmt(cloud, "%")}).`);
  }

  // Bike/walk preference
  if (prefs.bike) {
    extras.push("consider a light windbreaker", "avoid heavy fabrics");
    reasons.push("You marked that you’ll bike/walk (wind + sweat management)." );
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

  // Final message
  const parts = [];
  if (outer.length) parts.push(`Outer: ${outer.join(", ")}`);
  if (top.length) parts.push(`Top: ${top.join(", ")}`);
  if (bottom.length) parts.push(`Bottom: ${bottom.join(", ")}`);
  if (extras.length) parts.push(`Extras: ${extras.join(", ")}`);

  return {
    badgeType,
    badgeText,
    text: parts.join("\n"),
    reasons,
  };
}

function renderWeather(current) {
  els.temp.textContent = `${fmt1(current.temperature_2m, "°C")}`;
  els.apparent.textContent = `${fmt1(current.apparent_temperature, "°C")}`;
  els.wind.textContent = `${fmt(current.wind_speed_10m, " km/h")} (gusts ${fmt(current.wind_gusts_10m, " km/h")})`;
  els.humidity.textContent = `${fmt(current.relative_humidity_2m, "%")}`;
  els.cloud.textContent = `${fmt(current.cloud_cover, "%")}`;
  els.precip.textContent = `${fmt1(current.precipitation, " mm")}`;
  els.uv.textContent = `${fmt1(current.uv_index, "")}`;
  els.vis.textContent = current.visibility != null ? `${fmt1(current.visibility / 1000, " km")}` : "—";
  els.isDay.textContent = current.is_day === 1 ? "Yes" : current.is_day === 0 ? "No" : "—";
  els.wcode.textContent = `${weatherCodeLabel(current.weather_code)} (${current.weather_code})`;
}

function renderRecommendation(rec) {
  setBadge(rec.badgeType, rec.badgeText);
  els.recommendation.textContent = rec.text;
  clearReasons();
  rec.reasons.forEach(addReason);
}

async function runForLocation(loc) {
  if (!loc) return;

  setStatus(`Fetching weather for ${loc.name}…`);
  try {
    const data = await fetchWeather(loc.lat, loc.lon);
    const current = data?.current;
    if (!current) throw new Error("No current weather in response");

    const state = loadState();
    renderWeather(current);

    const rec = deriveRecommendation(current, state.prefs);
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

function init() {
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
