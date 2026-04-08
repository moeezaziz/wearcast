// Google OAuth Client IDs
const GOOGLE_CLIENT_ID_WEB = "263164817169-ft9s72dno3i766j00dtvogaj8bmckec5.apps.googleusercontent.com";

// Google OAuth Redirect URIs
const GOOGLE_REDIRECT_IOS = "https://wearcast.fly.dev/oauth2redirect/google";
const GOOGLE_REDIRECT_WEB = "https://wearcast.fly.dev/api/auth/google/callback";

// Detect if running in Capacitor (native app)
const isNative = typeof window.Capacitor !== "undefined" && !!window.Capacitor.isNativePlatform;
const nativePlugins = window.Capacitor?.Plugins || {};

function getGoogleClientId() {
  // This flow always goes through the backend HTTPS bridge, so it must use
  // the web OAuth client that owns that redirect URI on every platform.
  return GOOGLE_CLIENT_ID_WEB;
}

function configureNativeViewport() {
  if (!isNative) return;
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;
  viewport.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
}

function disableNativeDoubleTapZoom() {
  if (!isNative) return;
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (event) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
}

function getGoogleRedirectUri() {
  // Always use HTTPS redirect for Google OAuth (backend bridge)
  return "https://wearcast.fly.dev/oauth2redirect/google";
}
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
  severityIcon: $("severityIcon"),
  severityTitle: $("severityTitle"),
  severityMeta: $("severityMeta"),
  severityDetail: $("severityDetail"),

  updatedAt: $("updatedAt"),
  temp: $("temp"),
  apparent: $("apparent"),
  heroConditionIcon: $("heroConditionIcon"),
  wind: $("wind"),
  humidity: $("humidity"),
  cloud: $("cloud"),
  precip: $("precip"),
  heroPrecipProb: $("heroPrecipProb"),
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
  prefCasual: $("prefCasual"),
  prefSporty: $("prefSporty"),
  prefStreetwear: $("prefStreetwear"),
  prefMinimalist: $("prefMinimalist"),
  prefBike: $("prefBike"),

  privacyBtn: $("privacyBtn"),
  installBanner: $("installBanner"),
  installBannerSubtitle: $("installBannerSubtitle"),
  installBtn: $("installBtn"),
  installCloseBtn: $("installCloseBtn"),
  installDialog: $("installDialog"),
  installText: $("installText"),
  consentDialog: $("consentDialog"),
  consentSelectAll: $("consentSelectAll"),
  consentFunctional: $("consentFunctional"),
  consentLocation: $("consentLocation"),
  consentEssential: $("consentEssential"),
  consentAccept: $("consentAccept"),

  // Wardrobe
  addItemBtn: $("addItemBtn"),
  wardrobeList: $("wardrobeList"),
  wardrobeEmpty: $("wardrobeEmpty"),
  itemDialog: $("itemDialog"),
  itemForm: $("itemForm"),
  itemType: $("itemType"),
  itemName: $("itemName"),
  itemColor: $("itemColor"),
  itemMaterial: $("itemMaterial"),
  itemCare: $("itemCare"),
  itemPhoto: $("itemPhoto"),
  itemPhotoPreview: $("itemPhotoPreview"),
  itemPhotoImg: $("itemPhotoImg"),
  itemPhotoStatus: $("itemPhotoStatus"),
  itemVisualPlaceholder: $("itemVisualPlaceholder"),
  itemVisualEmoji: $("itemVisualEmoji"),
  itemVisualName: $("itemVisualName"),
  itemVisualMeta: $("itemVisualMeta"),
  itemManualDetails: $("itemManualDetails"),
  removePhotoBtn: $("removePhotoBtn"),
  itemSaveBtn: $("itemSaveBtn"),
  itemCancelBtn: $("itemCancelBtn"),
  itemDeleteBtn: $("itemDeleteBtn"),
  scanTagBtn: $("scanTagBtn"),

  // Scan dialog
  scanDialog: $("scanDialog"),
  scanPhoto: $("scanPhoto"),
  scanPreview: $("scanPreview"),
  scanPreviewImg: $("scanPreviewImg"),
  scanStatus: $("scanStatus"),
  scanCancelBtn: $("scanCancelBtn"),
  scanSubmitBtn: $("scanSubmitBtn"),

  // AI recommendation
  aiRecSection: $("aiRecSection"),
  aiRecLoading: $("aiRecLoading"),
  aiRecContent: $("aiRecContent"),
  aiRecBadge: $("aiRecBadge"),
  aiRecWarnings: $("aiRecWarnings"),
  aiRecMissing: $("aiRecMissing"),

  // Fashion notes
  fashionNotes: $("fashionNotes"),
  settingsAccountTitle: $("settingsAccountTitle"),
  settingsAccountStatus: $("settingsAccountStatus"),
  settingsAccountBtn: $("settingsAccountBtn"),
  settingsDeleteAccountBtn: $("settingsDeleteAccountBtn"),
  settingsPrivacyBtn: $("settingsPrivacyBtn"),
  settingsLocationBtn: $("settingsLocationBtn"),
  settingsClearLocationBtn: $("settingsClearLocationBtn"),
  settingsResetPrefsBtn: $("settingsResetPrefsBtn"),

  // New UI
  weatherHero: $("weatherHero"),
  emptyState: $("emptyState"),
  bottomNav: $("bottomNav"),
  ruleRecCard: $("ruleRecCard"),
  weatherDetailsCard: $("weatherDetailsCard"),
  reasonsCard: $("reasonsCard"),
  addItemBtnEmpty: $("addItemBtnEmpty"),
  todayWardrobeCtaBtn: $("todayWardrobeCtaBtn"),
  wardrobeExplainerBtn: $("wardrobeExplainerBtn"),
  todayCtaKicker: $("todayCtaKicker"),
  todayCtaTitle: $("todayCtaTitle"),
  wardrobeExplainerKicker: $("wardrobeExplainerKicker"),
  wardrobeExplainerTitle: $("wardrobeExplainerTitle"),
  wardrobeExplainerText: $("wardrobeExplainerText"),

  // Wardrobe auth gate
  wardrobeAuthGate: $("wardrobeAuthGate"),
  wardrobeContent: $("wardrobeContent"),
  wardrobeSignInBtn: $("wardrobeSignInBtn"),

  // Auth
  userBtn: $("userBtn"),
  userBtnIcon: $("userBtnIcon"),
  userBtnAvatar: $("userBtnAvatar"),
  authDialog: $("authDialog"),
  authDialogTitle: $("authDialogTitle"),
  authFormWrap: $("authFormWrap"),
  authLoggedIn: $("authLoggedIn"),
  authForm: $("authForm"),
  authName: $("authName"),
  authEmail: $("authEmail"),
  authPassword: $("authPassword"),
  authError: $("authError"),
  authInfo: $("authInfo"),
  authSubmitBtn: $("authSubmitBtn"),
  authResendVerifyBtn: $("authResendVerifyBtn"),
  authToggleMode: $("authToggleMode"),
  googleSignInBtn: $("googleSignInBtn"),
  authAvatar: $("authAvatar"),
  authUserName: $("authUserName"),
  authUserEmail: $("authUserEmail"),
  authUserBadge: $("authUserBadge"),
  authLogoutBtn: $("authLogoutBtn"),
  authDeleteBtn: $("authDeleteBtn"),
  authCloseBtn: $("authCloseBtn"),
  deleteAccountDialog: $("deleteAccountDialog"),
  deleteAccountPrompt: $("deleteAccountPrompt"),
  deleteAccountPassword: $("deleteAccountPassword"),
  deleteAccountConfirmText: $("deleteAccountConfirmText"),
  deleteAccountError: $("deleteAccountError"),
  deleteAccountCancelBtn: $("deleteAccountCancelBtn"),
  deleteAccountConfirmBtn: $("deleteAccountConfirmBtn"),
};

const STORAGE_KEY = "wearcast:v1";
const CONSENT_KEY = "wearcast:consent:v1";
const WARDROBE_KEY = "wearcast:wardrobe:v1";
const AUTH_TOKEN_KEY = "wearcast:token";
const AUTH_USER_KEY = "wearcast:user";
const API_BASE = "https://wearcast.fly.dev";
const GOOGLE_CALLBACK_PATH = "/oauth2redirect/google";

// ─── Auth state ──────────────────────────────────────────────
let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || null;
let authUser = (() => { try { return JSON.parse(localStorage.getItem(AUTH_USER_KEY)); } catch { return null; } })();
let googleAuthCompletionPromise = null;
let lastVerificationEmail = "";

function setAuth(token, user) {
  authToken = token;
  authUser = user;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }
  updateAuthUI();
}

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function isLoggedIn() { return !!authToken; }

function buildGoogleOAuthUrl() {
  const clientId = getGoogleClientId();
  const redirectUri = getGoogleRedirectUri();
  const platform = isNative ? "native" : "web";
  return `${API_BASE}/api/auth/google?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&platform=${encodeURIComponent(platform)}`;
}

async function getCurrentPositionNative() {
  const geolocation = nativePlugins.Geolocation;
  if (!geolocation?.getCurrentPosition) {
    throw new Error("Native geolocation plugin unavailable");
  }

  try {
    const permissions = await geolocation.checkPermissions?.();
    if (permissions?.location === "denied") {
      throw new Error("Location permission denied");
    }
  } catch {}

  return geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  });
}

async function finalizeAuthSuccess(token, user) {
  setAuth(token, user);
  await syncLocalWardrobeToServer();
  await renderWardrobe();
  if (els.authDialog?.open) els.authDialog.close();
}

async function completeGoogleAuth(params) {
  const code = params.get("code");
  const authError = params.get("error") || params.get("auth_error");
  const state = params.get("state");

  if (!code && !authError) return false;
  if (googleAuthCompletionPromise) return googleAuthCompletionPromise;

  googleAuthCompletionPromise = (async () => {
    try {
      if (authError) throw new Error(authError);

      const callbackUrl = new URL(`${API_BASE}/api/auth/google/callback`);
      callbackUrl.searchParams.set("code", code);
      if (state) callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("response_mode", "json");

      const res = await fetch(callbackUrl.toString());
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Google authentication failed");

      await finalizeAuthSuccess(data.token, data.user);
      return true;
    } finally {
      googleAuthCompletionPromise = null;
    }
  })();

  return googleAuthCompletionPromise;
}

async function closeNativeBrowser() {
  try {
    await window.Capacitor?.Plugins?.Browser?.close?.();
  } catch {}
}

function isGoogleCallbackUrl(urlString) {
  try {
    const url = new URL(urlString);
    const hasGoogleAuthParams = url.searchParams.has("code")
      || url.searchParams.has("error")
      || url.searchParams.has("auth_error");
    return url.pathname === GOOGLE_CALLBACK_PATH || (url.pathname === "/" && hasGoogleAuthParams);
  } catch {
    return false;
  }
}

async function handleGoogleAuthRedirect(urlString, { clearBrowserUrl = false, closeBrowser = false } = {}) {
  if (!urlString || !isGoogleCallbackUrl(urlString)) return false;

  const url = new URL(urlString);
  try {
    const handled = await completeGoogleAuth(url.searchParams);
    if (!handled) return false;
    if (clearBrowserUrl) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    return true;
  } catch (err) {
    alert(`Login failed: ${err.message}`);
    return false;
  } finally {
    if (closeBrowser) await closeNativeBrowser();
  }
}

function bindNativeGoogleAuth() {
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin) return;

  appPlugin.addListener?.("appUrlOpen", async ({ url }) => {
    await handleGoogleAuthRedirect(url, { closeBrowser: true });
  });

  appPlugin.getLaunchUrl?.().then(async ({ url }) => {
    if (url) await handleGoogleAuthRedirect(url, { closeBrowser: true });
  }).catch(() => {});
}

function updateAuthUI() {
  if (authUser) {
    if (authUser.avatarUrl) {
      els.userBtnAvatar.src = authUser.avatarUrl;
      els.userBtnAvatar.style.display = "";
      els.userBtnIcon.style.display = "none";
    } else {
      els.userBtnAvatar.style.display = "none";
      els.userBtnIcon.style.display = "";
    }
  } else {
    els.userBtnAvatar.style.display = "none";
    els.userBtnIcon.style.display = "";
  }
  // Toggle wardrobe auth gate
  const loggedIn = isLoggedIn();
  els.wardrobeAuthGate.style.display = loggedIn ? "none" : "flex";
  els.wardrobeContent.style.display = loggedIn ? "" : "none";
  renderSettingsUI();
}

const DEFAULT_STATE = {
  lastQuery: "",
  lastLocation: null, // { name, lat, lon }
  prefs: {
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
    fashionNotes: "",
  },
};

const DEFAULT_CONSENT = {
  seen: false,
  functionalStorage: false,
  deviceLocation: false,
  updatedAt: null,
};

let consent = loadConsent();
let memoryState = structuredClone(DEFAULT_STATE);
let pendingRecommendationPrefs = null;

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
  els.placeStatus.classList.remove("is-busy");
  els.placeStatus.textContent = msg || "";
}

function setLocationLoading(active, message = "") {
  if (els.geoBtn) {
    els.geoBtn.classList.toggle("loading", !!active);
    els.geoBtn.disabled = !!active;
  }
  if (active) {
    els.placeStatus.classList.add("is-busy");
    els.placeStatus.textContent = message || "Finding your location…";
  } else if (message) {
    setStatus(message);
  } else {
    els.placeStatus.classList.remove("is-busy");
  }
}

function privacyPromptFallback() {
  // Minimal GDPR-style consent flow for browsers without <dialog> support (notably some mobile Safari versions).
  // We ask for the same choices via confirm prompts.
  const functional = confirm(
    "WearCast privacy: Allow functional storage?\n\nThis saves your preferences and last-used location in this browser."
  );
  const location = confirm(
    "WearCast privacy: Allow device location?\n\nThis enables the ‘Use my location’ button. Your browser will still ask for permission when used."
  );
  saveConsent({ seen: true, functionalStorage: functional, deviceLocation: location });

  // If storage was enabled, persist whatever is currently in memory.
  if (canUseFunctionalStorage()) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState)); } catch {}
  }
}

function showConsentDialog({ forceModal = false } = {}) {
  if (!els.consentDialog) {
    privacyPromptFallback();
    return;
  }

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
    privacyPromptFallback();
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
  els.recBadge.className = "pill";
  els.recBadge.textContent = text;
}

function setSeverity(level, title, meta, detail, icon) {
  if (!els.severity) return;
  els.severity.style.display = "none";
}

function classifySeverity(current, ctx, effectiveC, hourly) {
  const gust = current.wind_gusts_10m ?? 0;
  const wind = current.wind_speed_10m ?? 0;
  const uv = current.uv_index ?? 0;
  const visM = current.visibility ?? null;
  const code = current.weather_code;
  const precipProb = ctx?.precipProb ?? null;
  const next2h = ctx?.next2hPrecip ?? null;

  const wetCodes = [51,53,55,56,57,61,63,65,66,67,80,81,82];
  const snowCodes = [71,73,75,77,85,86];
  const stormCodes = [95,96,99];

  const storm = stormCodes.includes(code);
  const snowy = snowCodes.includes(code) || ((ctx?.snowfall ?? 0) > 0);
  const freezing = [56,57,66,67].includes(code);
  const wet = wetCodes.includes(code) || ((precipProb ?? 0) >= 50) || ((next2h ?? 0) >= 1.0) || freezing;

  const extremeCold = effectiveC != null && effectiveC <= -15;
  const veryCold = effectiveC != null && effectiveC <= 2;
  const extremeHeat = effectiveC != null && effectiveC >= 38;
  const veryHot = effectiveC != null && effectiveC >= 30;

  const veryWindy = gust >= 60 || wind >= 35;
  const windy = gust >= 40 || wind >= 25;

  // Scan today's remaining hourly forecast for upcoming events
  let dayRainMax = 0, daySnowMax = 0, dayTempMax = -Infinity, dayTempMin = Infinity, dayWindMax = 0, dayPrecipProbMax = precipProb ?? 0;
  if (hourly?.time) {
    const nowStr = current.time || new Date().toISOString();
    const todayStr = nowStr.slice(0, 10); // "2026-04-04"
    const nowMs = new Date(nowStr).getTime() || Date.now();
    for (let i = 0; i < hourly.time.length; i++) {
      const t = hourly.time[i];
      if (!t.startsWith(todayStr)) continue;
      if (new Date(t).getTime() < nowMs) continue; // only future hours
      dayRainMax = Math.max(dayRainMax, hourly.precipitation?.[i] ?? 0);
      daySnowMax = Math.max(daySnowMax, hourly.snowfall?.[i] ?? 0);
      dayTempMax = Math.max(dayTempMax, hourly.apparent_temperature?.[i] ?? hourly.temperature_2m?.[i] ?? -Infinity);
      dayTempMin = Math.min(dayTempMin, hourly.apparent_temperature?.[i] ?? hourly.temperature_2m?.[i] ?? Infinity);
      dayWindMax = Math.max(dayWindMax, hourly.wind_speed_10m?.[i] ?? 0);
      dayPrecipProbMax = Math.max(dayPrecipProbMax, hourly.precipitation_probability?.[i] ?? 0);
    }
  }

  // Each stressor: [score, flag label, icon, priority (higher = more important)]
  const stressors = [];

  if (storm) stressors.push({ s: 4, flag: "Thunderstorm", icon: "⛈️", p: 10 });
  if (freezing) stressors.push({ s: 4, flag: "Freezing rain", icon: "🧊", p: 9 });
  if (snowy || daySnowMax > 0) {
    stressors.push({ s: 3, flag: daySnowMax > 0 && !snowy ? "Snow expected later" : "Snow / ice", icon: "🌨️", p: 8 });
    if (windy) stressors.push({ s: 1, flag: "Blowing snow", icon: "🌨️", p: 7 });
  }
  if (wet || dayPrecipProbMax >= 50) {
    const heavy = (next2h ?? 0) >= 5 || dayRainMax >= 5;
    const label = heavy ? "Heavy rain" : dayPrecipProbMax >= 50 && !wet ? `Rain later (${Math.round(dayPrecipProbMax)}%)` : "Rain expected";
    stressors.push({ s: heavy ? 3 : 2, flag: label, icon: heavy ? "🌧️" : "🌦️", p: heavy ? 6 : 5 });
  }
  if (veryWindy || dayWindMax >= 35) stressors.push({ s: 3, flag: dayWindMax >= 35 && !veryWindy ? "Strong gusts later" : "Strong gusts", icon: "💨", p: 6 });
  else if (windy || dayWindMax >= 25) stressors.push({ s: 2, flag: dayWindMax >= 25 && !windy ? "Windy later" : "Windy", icon: "💨", p: 4 });

  if (extremeCold || dayTempMin <= -15) stressors.push({ s: 3, flag: dayTempMin <= -15 && !extremeCold ? "Very cold later" : "Very cold", icon: "🥶", p: 7 });
  else if (veryCold || dayTempMin <= 2) stressors.push({ s: 1, flag: dayTempMin <= 2 && !veryCold ? "Cold later" : "Cold", icon: "❄️", p: 3 });

  if (extremeHeat || dayTempMax >= 38) stressors.push({ s: 3, flag: dayTempMax >= 38 && !extremeHeat ? "Heatwave expected" : "Extreme heat", icon: "🔥", p: 7 });
  else if (veryHot || dayTempMax >= 30) stressors.push({ s: 1, flag: dayTempMax >= 30 && !veryHot ? "Hot later" : "Hot", icon: "☀️", p: 3 });

  if (uv >= 8) stressors.push({ s: 2, flag: "Very high UV", icon: "☀️", p: 5 });
  else if (uv >= 6) stressors.push({ s: 1, flag: "High UV", icon: "🕶️", p: 2 });

  const score = stressors.reduce((a, x) => a + x.s, 0);
  const primary = [...stressors].sort((a, b) => b.p - a.p)[0] || null;
  const flags = stressors.map(s => s.flag);

  let level = "good";
  let title = "All clear";
  let icon = "✅";

  if (score >= 6) { level = "bad"; title = primary?.flag || "Severe conditions"; icon = primary?.icon || "⚠️"; }
  else if (stressors.length > 0) { level = "warn"; title = primary?.flag || "Be prepared"; icon = primary?.icon || "⚠️"; }

  const metaParts = [];
  if (effectiveC != null) metaParts.push(`Effective ${fmt1(effectiveC, "°C")}`);
  if (dayPrecipProbMax > 0) metaParts.push(`Precip ${fmt(Math.round(dayPrecipProbMax), "%")}`);
  if (gust) metaParts.push(`Gusts ${fmt(gust, " km/h")}`);

  const others = flags.filter(f => f !== title);
  const detail = others.length ? `Also: ${others.join(", ")}` : level === "good" ? "No major weather stressors today." : "";

  return { level, title, meta: metaParts.join(" • "), detail, icon };
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
  const url = new URL(`${API_BASE}/api/weather`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));

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
  const freezingRain = [56,57,66,67].includes(code) || (wet && (t ?? 99) <= 1 && (t ?? 99) >= -2);

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

  // Extreme cold (Svalbard-style)
  if (comfort <= -20) {
    top.push(
      "thermal base (merino/synthetic)",
      "thick mid-layer (fleece or wool)",
      "insulated puffer/parka",
      "windproof/waterproof shell (hood)"
    );
    bottom.push("thermal leggings", "insulated pants or shell pants", "thick socks (wool)");
    extras.push(
      "insulated winter boots (rated for subzero)",
      "mittens (warmer than gloves)",
      "balaclava/face cover",
      "beanie",
      "scarf/neck gaiter"
    );
    if (windy) extras.push("ski goggles (wind + snow)");
    extras.push("avoid exposed skin (frostbite risk)", "hand warmers (optional)");
  }
  // Very cold
  else if (comfort <= -10) {
    top.push("thermal base layer (merino/synthetic)", "mid-layer sweater/fleece");
    outer.push("insulated coat (windproof if possible)");
    bottom.push("long pants", "thermal leggings if outside >30 min");
    extras.push("warm socks", "winter boots (insulated)");
    extras.push("beanie", "gloves/mittens", "scarf/neck gaiter");
    if (windy) extras.push("windproof shell over insulation (if you have one)");
  }
  // Cold
  else if (comfort <= 0) {
    top.push("base layer", "mid-layer (sweater/light fleece)");
    outer.push("jacket (wind-resistant)");
    bottom.push("pants");
    extras.push("closed shoes", "warm socks");
    if (windy) extras.push("windproof outer layer", "beanie");
  }
  // Cool
  else if (comfort <= 10) {
    top.push("t-shirt", "light layer (overshirt/cardigan)");
    outer.push("optional light jacket");
    bottom.push("jeans/chinos");
    extras.push("sneakers");
    if (windy) extras.push("thin windbreaker (packable)");
  }
  // Mild
  else if (comfort <= 18) {
    top.push("t-shirt or light long-sleeve");
    bottom.push("light pants or jeans");
    outer.push("optional thin layer for wind/AC");
    extras.push("comfortable shoes");
    if (sunny) extras.push("sunglasses");
  }
  // Warm
  else if (comfort <= 26) {
    top.push("t-shirt (breathable)");
    bottom.push("light pants or shorts");
    extras.push("breathable shoes");
    if (sunny) extras.push("SPF (face/neck)", "sunglasses");
    if (humid) extras.push("moisture-wicking fabric");
  }
  // Hot
  else if (comfort <= 34) {
    top.push("very light top (linen/mesh/cotton)");
    bottom.push("shorts or very light pants");
    extras.push("breathable shoes/sandals", "water bottle (if outside)");
    if (sunny) extras.push("hat", "SPF 30+", "sunglasses");
    if (humid) extras.push("avoid heavy denim", "moisture-wicking underwear/socks");
  }
  // Extreme heat
  else {
    top.push("ultra-light, loose, light-colored clothing");
    bottom.push("shorts or loose linen pants");
    extras.push("SPF 50", "hat", "sunglasses", "water + electrolytes");
    extras.push("avoid peak sun (11–16)", "take shade breaks");
  }

  // Wet/snow modifiers
  if (wet) {
    // Umbrella vs shell: if windy, prefer shell.
    outer.unshift(windy ? "waterproof shell (hood)" : "rain jacket / shell");
    if (!windy && !freezingRain) extras.push("umbrella (optional)");
    extras.push("water-resistant shoes");
    if ((ctx?.precipProb ?? 0) >= 60 || (precip ?? 0) >= 1 || (ctx?.next2hPrecip ?? 0) >= 3) {
      extras.push("avoid suede", "consider spare socks");
      extras.push("waterproof bag cover (optional)");
    }
    if (freezingRain) {
      extras.push("non-slip footwear", "walk carefully (ice risk)");
      outer.unshift("waterproof shell (hood)");
    }
    reasons.push(`Wet risk: ${weatherCodeLabel(code)}; precip ~${fmt1(precip ?? 0, "mm/h")}${ctx?.precipProb != null ? `, chance ~${fmt(ctx.precipProb, "%")}` : ""}.`);
  }
  if (snow) {
    outer.unshift("insulated shell");
    extras.push("boots with grip", "warm socks");
    if ((ctx?.snowfall ?? 0) >= 1) extras.push("gaiters (optional)");
    reasons.push(`Snow/ice conditions (${weatherCodeLabel(code)}).`);
  }
  if (storm) {
    extras.push("avoid open areas", "avoid umbrellas if gusty", "consider postponing if exposed");
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

  // Tips
  const tips = [];
  if ((ctx?.precipProb ?? 0) >= 50 || (precip ?? 0) >= 0.5) tips.push("If you’ll be out >15 min: pick a hooded shell + water-resistant shoes.");
  if (windy && comfort <= 10) tips.push("If you get cold easily: add a windproof layer (wind matters more than temperature)." );
  if ((uv ?? 0) >= 6) tips.push("If you’re outdoors mid-day: SPF + hat." );

  return {
    // structured fields for nicer UI
    outer,
    top,
    bottom,
    extras,
    tips,
    reasons,
  };
}

function renderWeather(current, derived, hourly) {
  // Show hero + hide empty state
  els.weatherHero.style.display = "";
  els.emptyState.style.display = "none";
  els.weatherDetailsCard.style.display = "";

  els.temp.textContent = `${fmt1(current.temperature_2m, "°")}`;
  els.apparent.textContent = `${fmt1(current.apparent_temperature, "°C")}`;
  els.wind.textContent = `${fmt(current.wind_speed_10m)} km/h`;
  els.humidity.textContent = `${fmt(current.relative_humidity_2m)}%`;
  els.cloud.textContent = `${fmt(current.cloud_cover, "%")}`;
  els.precip.textContent = `${fmt1(current.precipitation)} mm`;
  els.precipProb.textContent = derived?.precipProb != null ? `${fmt(derived.precipProb, "%")}` : "—";
  if (els.heroPrecipProb) {
    els.heroPrecipProb.textContent = derived?.precipProb != null ? `${fmt(derived.precipProb, "%")}` : "—";
  }

  const dew = dewPointC(current.temperature_2m, current.relative_humidity_2m);
  const hx = humidex(current.temperature_2m, dew);
  const wc = windChillC(current.temperature_2m, current.wind_speed_10m);
  let effective = current.apparent_temperature;
  if (wc != null) effective = wc;
  else if (hx != null && hx >= current.temperature_2m + 1.0) effective = hx;

  els.dewPoint.textContent = dew != null ? `${fmt1(dew, "°C")}` : "—";
  els.effTemp.textContent = effective != null ? `${fmt1(effective, "°C")}` : "—";

  const sev = classifySeverity(current, derived, effective, hourly);
  setSeverity(sev.level, sev.title, sev.meta, sev.detail, sev.icon);

  els.uv.textContent = `${fmt1(current.uv_index, "")}`;
  els.vis.textContent = current.visibility != null ? `${fmt1(current.visibility / 1000, " km")}` : "—";
  els.isDay.textContent = current.is_day === 1 ? "Yes" : current.is_day === 0 ? "No" : "—";
  const conditionLabel = weatherCodeLabel(current.weather_code);
  els.wcode.textContent = conditionLabel;
  if (els.heroConditionIcon) {
    els.heroConditionIcon.textContent = weatherConditionIcon(conditionLabel);
  }
}

function renderRecommendation(rec) {
  // Badge now reflects the weather severity (kept in sync elsewhere).

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

function compactText(value, fallback = "—") {
  const text = String(value || "").trim();
  return text || fallback;
}

function firstSentence(text) {
  const normalized = compactText(text, "");
  if (!normalized) return "";
  const match = normalized.match(/.*?[.!?](?:\s|$)/);
  return (match ? match[0] : normalized).trim();
}

function normalizeItemLabel(text) {
  return compactText(text, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*[—-]\s*.*$/, "")
    .trim();
}

function weatherConditionIcon(label = "") {
  const text = String(label).toLowerCase();
  if (text.includes("clear") || text.includes("fair")) return "☼";
  if (text.includes("partly") || text.includes("cloud")) return "◔";
  if (text.includes("rain") || text.includes("drizzle")) return "☂";
  if (text.includes("snow")) return "❄";
  if (text.includes("thunder")) return "⚡";
  if (text.includes("fog")) return "◌";
  return "○";
}

function extractWearableHeadlinePart(text) {
  const normalized = normalizeItemLabel(text).toLowerCase();
  if (!normalized) return "";

  const patterns = [
    [/long\s*sleeve\s*(shirt|tee|top)?/, "Long-sleeve top"],
    [/t[\s-]?shirt|tee\b/, "T-shirt"],
    [/sweater|knit|jumper/, "Sweater"],
    [/hoodie|zip hoodie|zip-up/, "Hoodie"],
    [/jacket|coat|shell|parka|blazer/, "Jacket"],
    [/cardigan/, "Cardigan"],
    [/shirt|button[- ]?down|button[- ]?up/, "Shirt"],
    [/jeans/, "Jeans"],
    [/chinos/, "Chinos"],
    [/trousers|pants/, "Trousers"],
    [/leggings/, "Leggings"],
    [/skirt/, "Skirt"],
    [/dress/, "Dress"],
    [/sneakers|trainers/, "Sneakers"],
    [/boots/, "Boots"],
    [/loafers/, "Loafers"],
  ];

  for (const [pattern, label] of patterns) {
    if (pattern.test(normalized)) return label;
  }

  const words = normalizeItemLabel(text).split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(" ");
}

function buildOutfitHeadline(outfit) {
  const outer = extractWearableHeadlinePart(outfit.outer);
  const top = extractWearableHeadlinePart(outfit.top);
  const bottom = extractWearableHeadlinePart(outfit.bottom);
  const shoes = extractWearableHeadlinePart(outfit.shoes);
  const options = [
    outer || top,
    bottom,
    shoes,
  ].filter(Boolean);

  if (options.length >= 2) return `${options[0]} + ${options[1]}`;
  if (options.length === 1) return options[0];
  return "A weather-ready outfit";
}

function getRecommendationBadge(outfit, weather) {
  if (normalizeItemLabel(outfit.outer)) return "Layered";
  if ((weather?.precipProb || 0) >= 45) return "Ready";
  if ((weather?.temperature ?? 99) >= 22) return "Light";
  return "Best match";
}

function getRecommendationTileIcon(label) {
  const key = String(label || "").toLowerCase();
  if (key === "top") return "👕";
  if (key === "bottom") return "👖";
  if (key === "outer") return "🧥";
  if (key === "shoes") return "👟";
  return "•";
}

function getTodayContextChips() {
  const prefs = loadState().prefs || {};
  const chips = [];
  const activityMap = {
    everyday: "Everyday",
    walking: "Walking",
    commute: "Commute",
  };
  const locationMap = {
    indoors: "Mostly indoors",
    mixed: "Mixed day",
    outdoors: "Mostly outdoors",
  };
  const styleMap = {
    auto: "",
    casual: "Casual",
    polished: "Polished",
    sporty: "Sporty",
    streetwear: "Streetwear",
    minimalist: "Minimalist",
  };
  chips.push(activityMap[prefs.activityContext] || "Everyday");
  chips.push(locationMap[prefs.locationContext] || "Mixed day");
  if (styleMap[prefs.styleFocus]) chips.push(styleMap[prefs.styleFocus]);
  if (prefs.cold) chips.push("Usually cold");
  if (prefs.hot) chips.push("Usually hot");
  return chips.slice(0, 3);
}

function renderRecommendationControls() {
  const prefs = pendingRecommendationPrefs || loadState().prefs || {};
  const groups = [
    {
      label: "Activity",
      key: "activityContext",
      options: [
        ["everyday", "Everyday"],
        ["walking", "Walking"],
        ["commute", "Commute"],
      ],
    },
    {
      label: "Setting",
      key: "locationContext",
      options: [
        ["indoors", "Indoors"],
        ["mixed", "Mixed"],
        ["outdoors", "Outdoors"],
      ],
    },
    {
      label: "Style",
      key: "styleFocus",
      options: [
        ["auto", "Auto"],
        ["casual", "Casual"],
        ["polished", "Polished"],
        ["sporty", "Sporty"],
        ["streetwear", "Streetwear"],
        ["minimalist", "Minimal"],
      ],
    },
  ];

  return `
    <div class="today-control-groups">
      ${groups.map((group) => `
        <div class="today-control-group">
          <div class="today-control-label">${escapeHtml(group.label)}</div>
          <div class="today-chip-row today-chip-row-controls">
            ${group.options.map(([value, label]) => `
              <button
                type="button"
                class="today-chip today-chip-toggle ${prefs[group.key] === value ? "is-active" : ""}"
                data-rec-pref="${escapeHtml(group.key)}"
                data-rec-value="${escapeHtml(value)}"
              >${escapeHtml(label)}</button>
            `).join("")}
          </div>
        </div>
      `).join("")}
      <button type="button" class="btn-primary-sm today-update-btn" data-rec-action="apply">Update recommendation</button>
    </div>
  `;
}

function normalizeRecommendationPrefs(prefs = {}) {
  const normalized = {
    ...prefs,
    bike: prefs.activityContext === "walking" || prefs.activityContext === "commute",
  };
  const style = normalized.styleFocus;
  normalized.casual = style === "casual";
  normalized.formal = style === "polished";
  normalized.sporty = style === "sporty";
  normalized.streetwear = style === "streetwear";
  normalized.minimalist = style === "minimalist";
  if (style === "auto") {
    normalized.casual = false;
    normalized.formal = false;
    normalized.sporty = false;
    normalized.streetwear = false;
    normalized.minimalist = false;
  }
  return normalized;
}

function buildWhyBullets(data, weather) {
  const bullets = [];
  const reasoning = compactText(data.reasoning, "");
  if (reasoning) {
    reasoning
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2)
      .forEach((part) => bullets.push(part));
  }

  (data.warnings || []).forEach((warning) => {
    if (bullets.length < 3) bullets.push(compactText(warning, ""));
  });

  if (bullets.length === 0 && weather?.feelsLike != null) {
    bullets.push(`Feels like ${fmt1(weather.feelsLike, "°C")}, so light layering is the safer call.`);
  }

  return bullets.slice(0, 3);
}

function buildAlternatives(outfit, weather) {
  const alternatives = [];
  const outer = normalizeItemLabel(outfit.outer);
  const top = normalizeItemLabel(outfit.top);
  const bottom = normalizeItemLabel(outfit.bottom);

  if (outer) {
    alternatives.push({
      label: "Lighter option",
      value: `Skip the ${outer.toLowerCase()} if you stay indoors.`,
    });
  } else if ((weather?.feelsLike ?? 99) <= 14) {
    alternatives.push({
      label: "Warmer option",
      value: `Add a light jacket over ${top ? top.toLowerCase() : "your base layer"}.`,
    });
  }

  if (bottom) {
    alternatives.push({
      label: "More relaxed",
      value: `Keep ${bottom.toLowerCase()} and swap the top for something softer.`,
    });
  }

  return alternatives.slice(0, 2);
}

function renderWhyItems(items) {
  return `
    <div class="today-why-list">
      ${items.map((item) => `
        <div class="today-why-item">
          <span class="today-why-badge" aria-hidden="true">✦</span>
          <div class="today-why-text">${escapeHtml(item)}</div>
        </div>
      `).join("")}
    </div>
  `;
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

    renderWeather(current, ctx, data.hourly);

    // AI recommendation (non-blocking)
    fetchAIRecommendation(data, current, ctx);

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

function getGeoFresh() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported in this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(new Error(err.message || "Geolocation failed")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

async function getBrowserGeoPermissionState() {
  try {
    if (!navigator.permissions?.query) return null;
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result?.state || null;
  } catch {
    return null;
  }
}

async function getGeoBestEffort() {
  try {
    return await getGeoFresh();
  } catch (err) {
    const message = String(err?.message || "");
    const shouldFallback =
      /unavailable/i.test(message) ||
      /timeout/i.test(message) ||
      /position/i.test(message);

    if (!shouldFallback) throw err;

    return getGeo();
  }
}

function isDesktopMacBrowser() {
  const ua = navigator.userAgent || "";
  return /Macintosh/.test(ua) && !/iPhone|iPad|iPod/.test(ua);
}

async function buildGeoErrorMessage(err) {
  const base = err?.message || "Could not get current location";
  const permissionState = await getBrowserGeoPermissionState();

  if (permissionState === "denied") {
    return "Location access is blocked for this site. Enable location permission in your browser site settings and try again.";
  }

  if (isDesktopMacBrowser() && /unavailable|position/i.test(base)) {
    return "Chrome could not get your Mac location. Check macOS System Settings > Privacy & Security > Location Services and make sure Google Chrome is allowed, then try again.";
  }

  return `${base}. Check browser/site location permissions and try again.`;
}

function fetchWithTimeout(resource, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(resource, {
    ...options,
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

async function reverseGeocode(lat, lon) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));

  const res = await fetchWithTimeout(
    url.toString(),
    { headers: { "Accept": "application/json" } },
    8000
  );
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
  const data = await res.json();
  const name = data?.display_name || `Lat ${lat.toFixed(3)}, Lon ${lon.toFixed(3)}`;
  return { name, lat, lon };
}

async function resolveLocationFromCoords(lat, lon) {
  try {
    return await reverseGeocode(lat, lon);
  } catch (err) {
    console.warn("Reverse geocoding failed, using coordinate fallback", err);
    return {
      name: `Current location (${lat.toFixed(3)}, ${lon.toFixed(3)})`,
      lat,
      lon,
    };
  }
}

function onUseMyLocation() {
  // IMPORTANT (mobile Safari/Chrome): the geolocation permission prompt often only appears
  // when geolocation is requested *synchronously* from a user gesture.
  // So: do NOT open dialogs/confirm prompts before calling geolocation.

  // Quick environment checks
  if (!isNative && typeof window !== "undefined" && window.isSecureContext === false) {
    setLocationLoading(false);
    setStatus("Location requires HTTPS. Open WearCast via https://… (not a local file or http://)." );
    return;
  }

  setLocationLoading(true, "Requesting location permission…");

  if (isNative && nativePlugins.Geolocation?.getCurrentPosition) {
    (async () => {
      try {
        const pos = await getCurrentPositionNative();
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocationLoading(true, "Resolving place name…");
        const loc = await resolveLocationFromCoords(lat, lon);
        els.placeInput.value = loc.name;
        saveState({ lastQuery: "", lastLocation: loc });
        await runForLocation(loc);
        setLocationLoading(false);
        if (!consent.seen) showConsentDialog({ forceModal: true });
      } catch (err) {
        setLocationLoading(false);
        setStatus(`Location error: ${err.message || "Could not get current location"}`);
        if (!consent.seen) showConsentDialog({ forceModal: true });
      }
    })();
    return;
  }

  if (!navigator.geolocation) {
    setLocationLoading(false);
    setStatus("Geolocation is not supported in this browser. Search by city instead.");
    return;
  }

  (async () => {
    try {
      const pos = await getGeoBestEffort();
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setLocationLoading(true, "Resolving place name…");
      const loc = await resolveLocationFromCoords(lat, lon);
      els.placeInput.value = loc.name;
      saveState({ lastQuery: "", lastLocation: loc });
      await runForLocation(loc);
      setLocationLoading(false);
      if (!consent.seen) showConsentDialog({ forceModal: true });
    } catch (err) {
      setLocationLoading(false);
      const detail = await buildGeoErrorMessage(err);
      setStatus(`Location error: ${detail}`);
      if (!consent.seen) showConsentDialog({ forceModal: true });
    }
  })();
}

function bindPrefs() {
  if (!els.prefCold || !els.prefHot) return;
  const state = loadState();
  syncPreferenceInputs(state.prefs);
  if (els.fashionNotes) els.fashionNotes.value = state.prefs.fashionNotes || "";

  const persistPrefs = () => {
    saveState({
      prefs: {
        cold: els.prefCold.checked,
        hot: els.prefHot.checked,
        formal: els.prefFormal.checked,
        casual: els.prefCasual.checked,
        sporty: els.prefSporty.checked,
        streetwear: els.prefStreetwear.checked,
        minimalist: els.prefMinimalist.checked,
        bike: els.prefBike.checked,
        fashionNotes: els.fashionNotes?.value.trim() || "",
      }
    });
  };

  els.prefCold.addEventListener("change", () => {
    if (els.prefCold.checked) els.prefHot.checked = false;
    persistPrefs();
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });
  els.prefHot.addEventListener("change", () => {
    if (els.prefHot.checked) els.prefCold.checked = false;
    persistPrefs();
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });
  els.prefFormal.addEventListener("change", () => {
    persistPrefs();
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });
  els.prefCasual.addEventListener("change", () => {
    persistPrefs();
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });
  els.prefSporty.addEventListener("change", () => {
    persistPrefs();
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });
  els.prefStreetwear.addEventListener("change", () => {
    persistPrefs();
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });
  els.prefMinimalist.addEventListener("change", () => {
    persistPrefs();
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });
  els.prefBike.addEventListener("change", () => {
    persistPrefs();
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });

  // Save fashion notes on blur (no need to re-fetch weather)
  els.fashionNotes?.addEventListener("blur", () => {
    persistPrefs();
  });
}

function syncPreferenceInputs(prefs = {}) {
  if (!els.prefCold || !els.prefHot) return;
  els.prefCold.checked = !!prefs.cold;
  els.prefHot.checked = !!prefs.hot;
  els.prefFormal.checked = !!prefs.formal;
  els.prefCasual.checked = !!prefs.casual;
  els.prefSporty.checked = !!prefs.sporty;
  els.prefStreetwear.checked = !!prefs.streetwear;
  els.prefMinimalist.checked = !!prefs.minimalist;
  els.prefBike.checked = !!prefs.bike;
}

function renderSettingsUI() {
  if (!els.settingsAccountTitle || !els.settingsAccountStatus) return;
  if (authUser) {
    els.settingsAccountTitle.textContent = authUser.name || authUser.email || "Signed in";
    els.settingsAccountStatus.textContent = authUser.email
      ? `${authUser.email} • ${authUser.authProvider === "google" ? "Google account" : "Email account"}`
      : "Your account is connected.";
    if (els.settingsAccountBtn) els.settingsAccountBtn.querySelector("strong").textContent = "Open account";
    if (els.settingsDeleteAccountBtn) els.settingsDeleteAccountBtn.style.display = "";
  } else {
    els.settingsAccountTitle.textContent = "Not signed in";
    els.settingsAccountStatus.textContent = "Sign in to sync your wardrobe and account settings.";
    if (els.settingsAccountBtn) els.settingsAccountBtn.querySelector("strong").textContent = "Sign in";
    if (els.settingsDeleteAccountBtn) els.settingsDeleteAccountBtn.style.display = "none";
  }
}

function bindSettingsUI() {
  els.settingsAccountBtn?.addEventListener("click", showAuthDialog);
  els.settingsDeleteAccountBtn?.addEventListener("click", () => els.authDeleteBtn?.click());
  els.settingsPrivacyBtn?.addEventListener("click", () => showConsentDialog({ forceModal: true }));
  els.settingsLocationBtn?.addEventListener("click", onUseMyLocation);
  els.settingsClearLocationBtn?.addEventListener("click", () => {
    const state = loadState();
    saveState({ lastQuery: "", lastLocation: null, prefs: state.prefs });
    els.placeInput.value = "";
    setStatus("Saved location cleared.");
  });
  els.settingsResetPrefsBtn?.addEventListener("click", () => {
    const state = loadState();
    const nextPrefs = { ...DEFAULT_STATE.prefs };
    saveState({ ...state, prefs: nextPrefs });
    pendingRecommendationPrefs = null;
    syncPreferenceInputs(nextPrefs);
    setStatus("Recommendation preferences reset.");
  });
}

let deferredInstallPrompt = null;
let installBannerDismissed = false;

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function isIOS() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

function showInstallHelp() {
  if (!els.installDialog) {
    alert("To install WearCast: use your browser menu and choose 'Add to Home Screen'.");
    return;
  }

  if (els.installText) {
    if (isIOS()) {
      els.installText.textContent = "On iPhone/iPad: tap the Share icon, then ‘Add to Home Screen’.";
    } else {
      els.installText.textContent = "If your browser doesn’t show an install prompt, use the browser menu and choose ‘Install app’ or ‘Add to Home Screen’.";
    }
  }

  if (typeof els.installDialog.showModal === "function") els.installDialog.showModal();
  else alert(els.installText?.textContent || "Use your browser menu to add to home screen.");
}

function showInstallBanner(show) {
  if (!els.installBanner) return;
  if (isNative || installBannerDismissed || isStandalone()) {
    els.installBanner.style.display = "none";
    return;
  }
  els.installBanner.style.display = show ? "block" : "none";
}

function setupInstallUI() {
  if (isNative) {
    showInstallBanner(false);
    return;
  }

  // Close button (session-only dismissal; no storage)
  els.installCloseBtn?.addEventListener("click", () => {
    installBannerDismissed = true;
    showInstallBanner(false);
  });

  // Android/Chromium provides beforeinstallprompt.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (els.installBannerSubtitle) {
      els.installBannerSubtitle.textContent = "Install WearCast for faster access and an app-like experience.";
    }
    showInstallBanner(true);
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    showInstallBanner(false);
  });

  // iOS: show banner with instructions (no programmatic prompt exists)
  if (isIOS() && !isStandalone()) {
    if (els.installBannerSubtitle) {
      els.installBannerSubtitle.textContent = "On iPhone/iPad: Share → Add to Home Screen.";
    }
    showInstallBanner(true);
  }

  els.installBtn?.addEventListener("click", async () => {
    if (isStandalone()) return;

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch {}
      deferredInstallPrompt = null;
      return;
    }

    // iOS and other browsers: show instructions.
    showInstallHelp();
  });
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js?v=3");

      // If there's an update waiting (rare here because SW calls skipWaiting), activate it.
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });

      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            // New version installed; the SW will claim control and notify.
          }
        });
      });

      // When the new SW takes control, reload to pick up fresh assets.
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });

      // Also listen for explicit update message.
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "WEARCAST_UPDATED") {
          // Avoid infinite reload loops.
          if (!reloaded) {
            reloaded = true;
            window.location.reload();
          }
        }
      });
    } catch {
      // ignore
    }
  });
}

function bindConsentUI() {
  // Footer button
  els.privacyBtn?.addEventListener("click", () => {
    switchTab("tabPrefs");
    showConsentDialog({ forceModal: true });
  });

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

    // Auto-trigger geolocation after consent if location was granted and no saved location
    if (!!els.consentLocation?.checked) {
      const st = loadState();
      if (!st.lastLocation) onUseMyLocation();
    }
  });
}

// ─── Wardrobe ────────────────────────────────────────────────
// ─── Wardrobe: API (logged in) or localStorage (guest) ───────
let _wardrobeCache = null;

function loadWardrobeLocal() {
  if (!canUseFunctionalStorage()) return [];
  try {
    const raw = localStorage.getItem(WARDROBE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveWardrobeLocal(items) {
  if (canUseFunctionalStorage()) {
    try { localStorage.setItem(WARDROBE_KEY, JSON.stringify(items)); } catch {}
  }
}

async function fetchWardrobeFromServer() {
  const res = await fetch(`${API_BASE}/api/wardrobe`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load wardrobe");
  return res.json();
}

function loadWardrobe() {
  // synchronous — returns cached server data or local
  if (isLoggedIn() && _wardrobeCache) return _wardrobeCache;
  return loadWardrobeLocal();
}

async function loadWardrobeAsync() {
  if (isLoggedIn()) {
    try {
      _wardrobeCache = await fetchWardrobeFromServer();
      return _wardrobeCache;
    } catch {
      return loadWardrobeLocal();
    }
  }
  return loadWardrobeLocal();
}

function saveWardrobe(items) {
  // always keep local copy in sync
  saveWardrobeLocal(items);
  if (isLoggedIn()) _wardrobeCache = items;
}

async function syncLocalWardrobeToServer() {
  // Upload localStorage items to server for first-time login migration
  const local = loadWardrobeLocal();
  if (!local.length) return;
  for (const item of local) {
    try {
      await fetch(`${API_BASE}/api/wardrobe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(item),
      });
    } catch {}
  }
  // Clear local wardrobe after sync
  localStorage.removeItem(WARDROBE_KEY);
}

function typeEmoji(type) {
  const m = {
    "T-shirt":"👕","Shirt":"👔","Polo":"👕","Sweater":"🧶","Hoodie":"🧥",
    "Jacket":"🧥","Coat":"🧥","Blazer":"🤵","Vest":"🦺","Tank top":"👕",
    "Jeans":"👖","Chinos":"👖","Shorts":"🩳","Sweatpants":"👖","Dress pants":"👖",
    "Skirt":"👗","Dress":"👗","Sneakers":"👟","Boots":"🥾","Sandals":"🩴",
    "Dress shoes":"👞","Scarf":"🧣","Hat":"🧢","Gloves":"🧤","Sunglasses":"🕶️",
    "Belt":"⬜","Bag":"🎒",
  };
  return m[type] || "👚";
}

async function renderWardrobe() {
  const items = await loadWardrobeAsync();
  els.wardrobeList.innerHTML = "";
  els.wardrobeEmpty.style.display = items.length ? "none" : "flex";
  updateWardrobeCtas(items);

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "wardrobe-item";
    div.setAttribute("data-id", item.id);

    const photoHtml = item.photoDataUrl
      ? `<img class="wardrobe-item-photo" src="${escapeHtml(item.photoDataUrl)}" alt="" />`
      : `<div class="wardrobe-item-placeholder">${typeEmoji(item.type)}</div>`;

    const meta = [item.type, item.color, item.material].filter(Boolean).join(" · ");
    div.innerHTML = `${photoHtml}<div class="wardrobe-item-info"><div class="wardrobe-item-name">${escapeHtml(item.name)}</div><div class="wardrobe-item-meta">${escapeHtml(meta)}</div></div>`;
    div.addEventListener("click", () => openItemDialog(item));
    els.wardrobeList.appendChild(div);
  });
}

function updateWardrobeCtas(items) {
  const count = Array.isArray(items) ? items.length : 0;

  if (count === 0) {
    if (els.todayCtaKicker) els.todayCtaKicker.textContent = "Level up";
    if (els.todayCtaTitle) els.todayCtaTitle.textContent = "Build your closet to unlock sharper outfit picks.";
    if (els.todayWardrobeCtaBtn) els.todayWardrobeCtaBtn.textContent = "Add wardrobe";
    if (els.wardrobeExplainerKicker) els.wardrobeExplainerKicker.textContent = "Get personalized fast";
    if (els.wardrobeExplainerTitle) els.wardrobeExplainerTitle.textContent = "Your wardrobe powers smarter outfit picks";
    if (els.wardrobeExplainerText) els.wardrobeExplainerText.textContent = "Add photos or care tags once, then WearCast can recommend pieces you actually own instead of generic outfits.";
    if (els.wardrobeExplainerBtn) els.wardrobeExplainerBtn.textContent = "Add an item";
    return;
  }

  if (count < 4) {
    if (els.todayCtaKicker) els.todayCtaKicker.textContent = "Nice start";
    if (els.todayCtaTitle) els.todayCtaTitle.textContent = "A few more pieces will make today’s picks feel much more you.";
    if (els.todayWardrobeCtaBtn) els.todayWardrobeCtaBtn.textContent = "Add more";
    if (els.wardrobeExplainerKicker) els.wardrobeExplainerKicker.textContent = "Keep going";
    if (els.wardrobeExplainerTitle) els.wardrobeExplainerTitle.textContent = `You’ve added ${count} item${count === 1 ? "" : "s"} so far`;
    if (els.wardrobeExplainerText) els.wardrobeExplainerText.textContent = "Add a couple more staples and WearCast will have far more options to mix, match, and personalize.";
    if (els.wardrobeExplainerBtn) els.wardrobeExplainerBtn.textContent = "Add another";
    return;
  }

  if (els.todayCtaKicker) els.todayCtaKicker.textContent = "Looking good";
  if (els.todayCtaTitle) els.todayCtaTitle.textContent = "Your closet is shaping up. Keep it fresh with one more standout piece.";
  if (els.todayWardrobeCtaBtn) els.todayWardrobeCtaBtn.textContent = "Keep building";
  if (els.wardrobeExplainerKicker) els.wardrobeExplainerKicker.textContent = "Strong foundation";
  if (els.wardrobeExplainerTitle) els.wardrobeExplainerTitle.textContent = `Your ${count}-item wardrobe is already helping`;
  if (els.wardrobeExplainerText) els.wardrobeExplainerText.textContent = "WearCast can now make more specific recommendations from what you own. Add new pieces anytime to keep the suggestions sharp.";
  if (els.wardrobeExplainerBtn) els.wardrobeExplainerBtn.textContent = "Add one more";
}

let editingItemId = null;
let pendingPhotoDataUrl = null;
let isSavingItem = false;
let isReadingItemPhoto = false;
let isReadingScanPhoto = false;
let isAnalyzingItemPhoto = false;

function normalizeItemSignature(item) {
  return [
    item?.type?.trim().toLowerCase() || "",
    item?.name?.trim().toLowerCase() || "",
    item?.color?.trim().toLowerCase() || "",
    item?.material?.trim().toLowerCase() || "",
  ].join("|");
}

async function hasDuplicateWardrobeItem(itemData, excludeId = null) {
  const items = await loadWardrobeAsync();
  const signature = normalizeItemSignature(itemData);
  return items.some((item) => {
    if (excludeId && item.id === excludeId) return false;
    return normalizeItemSignature(item) === signature;
  });
}

function updateItemSaveState() {
  if (!els.itemSaveBtn) return;
  const busy = isSavingItem || isReadingItemPhoto || isAnalyzingItemPhoto;
  els.itemSaveBtn.disabled = busy;
  els.itemSaveBtn.textContent = isSavingItem ? "Saving…" : isReadingItemPhoto || isAnalyzingItemPhoto ? "Preparing…" : "Save item";
}

function setItemPhotoStatus(message = "", busy = false) {
  if (!els.itemPhotoStatus) return;
  els.itemPhotoStatus.textContent = message;
  els.itemPhotoStatus.classList.toggle("is-busy", !!busy);
}

function updateItemVisual() {
  const type = els.itemType?.value?.trim();
  const name = els.itemName?.value?.trim();
  const meta = [els.itemColor?.value?.trim(), els.itemMaterial?.value?.trim()].filter(Boolean).join(" · ");
  const photo = pendingPhotoDataUrl;

  if (els.itemPhotoImg) {
    els.itemPhotoImg.style.display = photo ? "block" : "none";
  }
  if (els.itemVisualPlaceholder) {
    els.itemVisualPlaceholder.style.display = photo ? "none" : "flex";
  }
  if (els.removePhotoBtn) {
    els.removePhotoBtn.style.display = photo ? "flex" : "none";
  }
  if (els.itemVisualEmoji) els.itemVisualEmoji.textContent = typeEmoji(type || "Other");
  if (els.itemVisualName) els.itemVisualName.textContent = name || (photo ? "Selected clothing item" : "Add a clothing photo");
  if (els.itemVisualMeta) {
    els.itemVisualMeta.textContent = meta || (photo ? "We’ll use the photo to help fill in the details." : "We’ll try to prefill the details for you.");
  }
}

async function analyzeItemPhoto(imageDataUrl) {
  const res = await fetch(`${API_BASE}/api/analyze-item-photo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageDataUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not analyze clothing photo");
  return data;
}

function applyItemPhotoPrefill(data) {
  if (!data || data.error) return;
  if (data.type && !els.itemType.value) els.itemType.value = data.type;
  if (data.name && !els.itemName.value.trim()) els.itemName.value = data.name;
  if (data.color && !els.itemColor.value.trim()) els.itemColor.value = data.color;
  if (data.material && !els.itemMaterial.value.trim()) els.itemMaterial.value = data.material;
  if (data.careInstructions?.length && !els.itemCare.value.trim()) {
    els.itemCare.value = data.careInstructions.join(", ");
  }
  if (data.type || data.name || data.color || data.material || data.careInstructions?.length) {
    els.itemManualDetails?.setAttribute("open", "open");
  }
}

function updateScanState(scanning) {
  if (els.scanSubmitBtn) {
    els.scanSubmitBtn.disabled = scanning || !pendingScanImageReady();
    els.scanSubmitBtn.textContent = scanning ? "Scanning…" : "Done";
  }
}

function pendingScanImageReady() {
  return !!window.__wearcastScanImageDataUrl;
}

function openItemDialog(item = null) {
  editingItemId = item?.id || null;
  isSavingItem = false;
  isReadingItemPhoto = false;
  isAnalyzingItemPhoto = false;
  updateItemSaveState();
  els.itemForm.reset();
  pendingPhotoDataUrl = null;
  setItemPhotoStatus("");

  if (item) {
    els.itemDialogTitle = $("itemDialogTitle");
    if (els.itemDialogTitle) els.itemDialogTitle.textContent = "Edit Clothing Item";
    els.itemType.value = item.type || "";
    els.itemName.value = item.name || "";
    els.itemColor.value = item.color || "";
    els.itemMaterial.value = item.material || "";
    els.itemCare.value = (item.careInstructions || []).join(", ");
    if (item.photoDataUrl) {
      pendingPhotoDataUrl = item.photoDataUrl;
      els.itemPhotoImg.src = item.photoDataUrl;
    }
    els.itemDeleteBtn.style.display = "inline-flex";
    els.itemManualDetails?.setAttribute("open", "open");
  } else {
    const title = $("itemDialogTitle");
    if (title) title.textContent = "Add Clothing Item";
    els.itemDeleteBtn.style.display = "none";
    els.itemManualDetails?.removeAttribute("open");
  }

  updateItemVisual();

  if (typeof els.itemDialog.showModal === "function") els.itemDialog.showModal();
}

function closeItemDialog() {
  if (typeof els.itemDialog.close === "function") els.itemDialog.close();
}

async function saveItem() {
  if (isSavingItem || isReadingItemPhoto) return;
  const type = els.itemType.value.trim();
  const name = els.itemName.value.trim();
  if (!type || !name) return;

  const careRaw = els.itemCare.value.trim();
  const careInstructions = careRaw ? careRaw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : [];

  const itemData = {
    type, name,
    color: els.itemColor.value.trim() || null,
    material: els.itemMaterial.value.trim() || null,
    careInstructions,
    photoDataUrl: pendingPhotoDataUrl || null,
  };

  if (await hasDuplicateWardrobeItem(itemData, editingItemId)) {
    alert("That wardrobe item already exists.");
    return;
  }

  isSavingItem = true;
  updateItemSaveState();

  try {
    if (isLoggedIn()) {
      if (editingItemId) {
        await fetch(`${API_BASE}/api/wardrobe/${editingItemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(itemData),
        });
      } else {
        await fetch(`${API_BASE}/api/wardrobe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(itemData),
        });
      }
    } else {
      const items = loadWardrobeLocal();
      if (editingItemId) {
        const idx = items.findIndex(i => i.id === editingItemId);
        if (idx !== -1) items[idx] = { ...items[idx], ...itemData, photoDataUrl: pendingPhotoDataUrl || items[idx].photoDataUrl || null };
      } else {
        items.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...itemData, createdAt: new Date().toISOString() });
      }
      saveWardrobeLocal(items);
    }
    await renderWardrobe();
    closeItemDialog();
  } catch (err) {
    console.error("save item error:", err);
  } finally {
    isSavingItem = false;
    updateItemSaveState();
  }
}

async function deleteItem() {
  if (!editingItemId) return;

  if (isLoggedIn()) {
    try {
      await fetch(`${API_BASE}/api/wardrobe/${editingItemId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
    } catch (err) {
      console.error("delete item error:", err);
    }
  } else {
    const items = loadWardrobeLocal().filter(i => i.id !== editingItemId);
    saveWardrobeLocal(items);
  }

  await renderWardrobe();
  closeItemDialog();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function bindWardrobeUI() {
  els.addItemBtn?.addEventListener("click", () => openItemDialog());
  els.wardrobeExplainerBtn?.addEventListener("click", () => openItemDialog());
  els.itemCancelBtn?.addEventListener("click", closeItemDialog);
  els.itemDeleteBtn?.addEventListener("click", deleteItem);

  els.itemForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveItem();
  });

  els.itemPhoto?.addEventListener("change", async () => {
    const file = els.itemPhoto.files?.[0];
    if (!file) return;
    isReadingItemPhoto = true;
    updateItemSaveState();
    setItemPhotoStatus("Preparing your image…", true);
    try {
      pendingPhotoDataUrl = await readFileAsDataUrl(file);
      els.itemPhotoImg.src = pendingPhotoDataUrl;
      updateItemVisual();
      isAnalyzingItemPhoto = true;
      updateItemSaveState();
      setItemPhotoStatus("Looking at the clothing photo…", true);
      const analysis = await analyzeItemPhoto(pendingPhotoDataUrl);
      applyItemPhotoPrefill(analysis);
      updateItemVisual();
      setItemPhotoStatus("Details prefilled from your photo.", false);
    } catch (err) {
      console.error("item photo error:", err);
      setItemPhotoStatus("Photo added, but we could not prefill all details.", false);
    } finally {
      isReadingItemPhoto = false;
      isAnalyzingItemPhoto = false;
      updateItemSaveState();
    }
  });

  els.removePhotoBtn?.addEventListener("click", () => {
    pendingPhotoDataUrl = null;
    els.itemPhoto.value = "";
    setItemPhotoStatus("");
    updateItemVisual();
  });

  [els.itemType, els.itemName, els.itemColor, els.itemMaterial].forEach((input) => {
    input?.addEventListener("input", updateItemVisual);
    input?.addEventListener("change", updateItemVisual);
  });

  // Scan tag button opens scan dialog
  els.scanTagBtn?.addEventListener("click", () => {
    els.scanPhoto.value = "";
    els.scanPreview.style.display = "none";
    els.scanStatus.textContent = "";
    els.scanSubmitBtn.disabled = true;
    if (typeof els.scanDialog.showModal === "function") els.scanDialog.showModal();
  });

  els.scanCancelBtn?.addEventListener("click", () => {
    if (typeof els.scanDialog.close === "function") els.scanDialog.close();
  });

  let scanImageDataUrl = null;
  window.__wearcastScanImageDataUrl = null;

  els.scanPhoto?.addEventListener("change", async () => {
    const file = els.scanPhoto.files?.[0];
    if (!file) return;
    isReadingScanPhoto = true;
    els.scanSubmitBtn.disabled = true;
    try {
      scanImageDataUrl = await readFileAsDataUrl(file);
      window.__wearcastScanImageDataUrl = scanImageDataUrl;
      els.scanPreviewImg.src = scanImageDataUrl;
      els.scanPreview.style.display = "block";
      els.scanStatus.textContent = "";
    } catch (err) {
      console.error("scan photo error:", err);
      els.scanStatus.textContent = "Could not load image.";
    } finally {
      isReadingScanPhoto = false;
      updateScanState(false);
    }
  });

  els.scanSubmitBtn?.addEventListener("click", async () => {
    if (!scanImageDataUrl || isReadingScanPhoto) return;
    updateScanState(true);
    els.scanStatus.textContent = "Scanning with Gemini… this may take a few seconds.";
    try {
      const res = await fetch(`${API_BASE}/api/scan-tag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: scanImageDataUrl }),
      });
      const data = await res.json();
      if (data.error) {
        els.scanStatus.textContent = `Could not read tag: ${data.error}`;
        updateScanState(false);
        return;
      }
      // Fill in the item form fields
      if (data.material) els.itemMaterial.value = data.material;
      if (data.careInstructions?.length) {
        const existing = els.itemCare.value.trim();
        els.itemCare.value = existing
          ? existing + ", " + data.careInstructions.join(", ")
          : data.careInstructions.join(", ");
      }
      if (data.brand && !els.itemName.value.trim()) {
        els.itemName.value = data.brand;
      }
      els.scanStatus.textContent = "Done! Tag info added to the form.";
      setTimeout(() => {
        if (typeof els.scanDialog.close === "function") els.scanDialog.close();
      }, 800);
    } catch (err) {
      els.scanStatus.textContent = `Error: ${err.message}. Is the server running on ${API_BASE}?`;
      updateScanState(false);
    }
  });

  renderWardrobe();
}

// ─── AI Recommendation (Gemini) ─────────────────────────────
let lastWeatherForAI = null;

async function fetchAIRecommendation(weatherData, current, ctx) {
  const wardrobe = loadWardrobe().map(({ id, type, name, color, material, careInstructions }) => ({
    id, type, name, color, material, careInstructions,
  }));
  const state = loadState();
  const location = state.lastLocation
    ? {
        lat: Number(state.lastLocation.lat),
        lon: Number(state.lastLocation.lon),
        name: state.lastLocation.name || null,
      }
    : null;

  // Build a forecast summary for the remaining hours of today only
  const hourly = weatherData?.hourly;
  let remainingForecast = null;
  if (hourly?.time) {
    const nowIso = current.time || new Date().toISOString();
    const nowMs = new Date(nowIso).getTime();
    const todayStr = nowIso.slice(0, 10);
    const indices = hourly.time.reduce((acc, t, i) => {
      const hourMs = new Date(t).getTime();
      return t.startsWith(todayStr) && hourMs >= nowMs ? [...acc, i] : acc;
    }, []);
    if (indices.length) {
      const pick = (key) => indices.map(i => hourly[key]?.[i]).filter(v => v != null);
      const min = (arr) => arr.length ? Math.min(...arr) : null;
      const max = (arr) => arr.length ? Math.max(...arr) : null;
      const avg = (arr) => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null;

      const temps = pick("temperature_2m");
      const feelsLike = pick("apparent_temperature");
      const winds = pick("wind_speed_10m");
      const precipProbs = pick("precipitation_probability");
      const precips = pick("precipitation");
      const uvs = pick("uv_index");

      remainingForecast = {
        tempRange: `${min(temps)}°C – ${max(temps)}°C`,
        feelsLikeRange: `${min(feelsLike)}°C – ${max(feelsLike)}°C`,
        maxWind: `${max(winds)} km/h`,
        maxPrecipProb: `${max(precipProbs)}%`,
        totalPrecip: `${+(precips.reduce((a, b) => a + b, 0)).toFixed(1)} mm`,
        peakUV: max(uvs),
        avgHumidity: `${avg(pick("relative_humidity_2m"))}%`,
      };
    }
  }

  const weather = {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    wind: current.wind_speed_10m,
    gusts: current.wind_gusts_10m,
    humidity: current.relative_humidity_2m,
    cloud: current.cloud_cover,
    precip: current.precipitation,
    precipProb: ctx?.precipProb ?? null,
    uv: current.uv_index,
    weatherLabel: weatherCodeLabel(current.weather_code),
    isDay: current.is_day === 1,
    remainingForecast,
  };

  lastWeatherForAI = weather;

  const preferences = {
    ...state.prefs,
    fashionNotes: state.prefs.fashionNotes || null,
  };

  els.aiRecSection.style.display = "";
  els.aiRecLoading.style.display = "flex";
  els.aiRecContent.innerHTML = "";
  els.aiRecWarnings.innerHTML = "";
  els.aiRecMissing.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weather, wardrobe, preferences, location }),
    });
    const data = await res.json();
    if (data.error) {
      els.aiRecContent.innerHTML = `<div class="ai-error">Could not generate outfit recommendation. <button onclick="document.getElementById('refreshBtn').click()" class="ai-retry-btn">Retry</button></div>`;
      return;
    }
    renderAIRecommendation(data);
  } catch (err) {
    els.aiRecContent.innerHTML = `<div class="ai-error">Could not reach the AI service. <button onclick="document.getElementById('refreshBtn').click()" class="ai-retry-btn">Retry</button></div>`;
  } finally {
    els.aiRecLoading.style.display = "none";
  }
}

function renderAIRecommendation(data) {
  pendingRecommendationPrefs = null;
  const outfit = data.outfit || {};
  const weather = lastWeatherForAI || {};
  const headline = buildOutfitHeadline(outfit);
  const subtitle = firstSentence(data.reasoning) || "Built around today’s conditions.";
  const chips = getTodayContextChips();
  const whyBullets = buildWhyBullets(data, weather);
  const alternatives = buildAlternatives(outfit, weather);
  const accessories = Array.isArray(outfit.accessories)
    ? outfit.accessories.map(normalizeItemLabel).filter(Boolean)
    : [normalizeItemLabel(outfit.accessories)].filter(Boolean);
  const accessoryText = accessories.length ? accessories.slice(0, 2).join(" • ") : "";
  const rowEntries = [
    ["Top", normalizeItemLabel(outfit.top)],
    ["Bottom", normalizeItemLabel(outfit.bottom)],
    ["Outer", normalizeItemLabel(outfit.outer)],
    ["Shoes", normalizeItemLabel(outfit.shoes)],
  ].filter(([, value]) => value);

  if (els.aiRecBadge) {
    els.aiRecBadge.textContent = getRecommendationBadge(outfit, weather);
  }

  els.aiRecContent.innerHTML = `
    <div class="today-rec-body">
      <div class="today-rec-hero">
        <div class="today-rec-outfit">
          <div class="today-rec-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2 12 5.5 8 2 3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47c.1.6.6 1.04 1.2 1.04H6v10c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V10h1.94c.6 0 1.1-.44 1.2-1.04l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>
          </div>
          <div class="today-rec-copy">
            <h3>${escapeHtml(headline)}</h3>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>
      </div>
      ${chips.length ? `<div class="today-chip-row">${chips.map((chip) => `<span class="today-chip">${escapeHtml(chip)}</span>`).join("")}</div>` : ""}
      ${rowEntries.length ? `<div class="today-rec-breakdown-grid">${rowEntries.map(([label, value]) => `<div class="today-rec-tile"><span class="today-rec-tile-label"><span class="today-rec-tile-icon" aria-hidden="true">${getRecommendationTileIcon(label)}</span>${escapeHtml(label)}</span><span class="today-rec-tile-value">${escapeHtml(value)}</span></div>`).join("")}</div>` : ""}
      ${accessoryText ? `<div class="today-rec-accessories">Extras: ${escapeHtml(accessoryText)}</div>` : ""}
      <details class="today-tune-section">
        <summary><span>Tune this look</span><svg class="today-expand-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></summary>
        ${renderRecommendationControls()}
      </details>
      <details class="today-why">
        <summary><span>Why this works</span><svg class="today-expand-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></summary>
        ${renderWhyItems(whyBullets)}
      </details>
      ${alternatives.length ? `<details class="today-alt-section"><summary><span>Alternative options</span><svg class="today-expand-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></summary><div class="today-alt-list">${alternatives.map((alt) => `<div class="today-alt-row"><span class="today-alt-label">${escapeHtml(alt.label)}</span><span class="today-alt-value">${escapeHtml(alt.value)}</span></div>`).join("")}</div></details>` : ""}
    </div>
  `;

  if (data.missingItems?.length) {
    const item = compactText(data.missingItems[0], "");
    els.aiRecMissing.innerHTML = item
      ? `<div class="today-rec-note">Wardrobe tip: ${escapeHtml(item)}</div>`
      : "";
  } else {
    els.aiRecMissing.innerHTML = "";
  }

  els.aiRecWarnings.innerHTML = "";
}

function bindRecommendationControls() {
  els.aiRecContent?.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-rec-action='apply']");
    if (actionButton) {
      const latestState = loadState();
      const nextPrefs = normalizeRecommendationPrefs(pendingRecommendationPrefs || latestState.prefs);
      pendingRecommendationPrefs = null;
      saveState({ prefs: nextPrefs });
      syncPreferenceInputs(nextPrefs);
      if (latestState.lastLocation) {
        await runForLocation(latestState.lastLocation);
      }
      return;
    }

    const chipButton = event.target.closest("[data-rec-pref]");
    if (!chipButton) return;

    const key = chipButton.dataset.recPref;
    const value = chipButton.dataset.recValue;
    if (!key || !value) return;

    const basePrefs = pendingRecommendationPrefs || loadState().prefs;
    pendingRecommendationPrefs = {
      ...basePrefs,
      [key]: value,
    };

    const allButtons = els.aiRecContent.querySelectorAll(`[data-rec-pref="${key}"]`);
    allButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.recValue === value);
    });
  });
}

// ─── Tab navigation ──────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  const page = document.getElementById(tabId);
  if (page) page.classList.add("active");
  const btn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (btn) btn.classList.add("active");
}

function bindTabNav() {
  els.bottomNav?.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  els.todayWardrobeCtaBtn?.addEventListener("click", () => switchTab("tabWardrobe"));
}

// ─── Auto-geolocation (silent, no prompt) ────────────────────
async function tryAutoGeo() {
  if (!navigator.geolocation) return;
  try {
    setStatus("Detecting location…");
    const pos = await getGeo(); // uses maximumAge:5min, won't prompt if already granted
    const loc = await resolveLocationFromCoords(pos.coords.latitude, pos.coords.longitude);
    els.placeInput.value = loc.name;
    saveState({ lastQuery: "", lastLocation: loc });
    await runForLocation(loc);
  } catch {
    // Permission not granted yet or blocked — just show a nudge
    setStatus("Tap the location button or search for a city to get started.");
  }
}

// ─── Autocomplete with country flags ─────────────────────────
function countryFlag(code) {
  if (!code) return "\u{1F30D}"; // 🌍
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

let _acCtrl = null;
let _acTimer = null;
let _acList = null;

function hideAC() {
  if (_acList) { _acList.innerHTML = ""; _acList.style.display = "none"; }
}

function setupAutocomplete() {
  _acList = document.createElement("div");
  _acList.className = "ac-dropdown";
  els.placeInput.parentElement.style.position = "relative";
  els.placeInput.parentElement.appendChild(_acList);

  const selectAllSearchText = () => {
    const input = els.placeInput;
    if (!input || !input.value) return;
    try {
      input.select();
      input.setSelectionRange?.(0, input.value.length);
    } catch {}
  };

  els.placeInput.addEventListener("focus", () => {
    requestAnimationFrame(selectAllSearchText);
  });
  els.placeInput.addEventListener("pointerup", () => {
    requestAnimationFrame(selectAllSearchText);
  });
  els.placeInput.addEventListener("click", () => {
    requestAnimationFrame(selectAllSearchText);
  });

  els.placeInput.addEventListener("input", () => {
    clearTimeout(_acTimer);
    const q = els.placeInput.value.trim();
    if (q.length < 2) { hideAC(); return; }
    _acTimer = setTimeout(() => fetchAC(q), 400);
  });

  els.placeInput.addEventListener("blur", () => setTimeout(hideAC, 200));
}

async function fetchAC(q) {
  if (_acCtrl) _acCtrl.abort();
  _acCtrl = new AbortController();
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");
    const res = await fetch(url, {
      signal: _acCtrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;
    renderAC(await res.json());
  } catch (e) {
    if (e.name !== "AbortError") console.warn("AC error", e);
  }
}

function renderAC(results) {
  if (!results.length) { hideAC(); return; }
  _acList.innerHTML = "";
  _acList.style.display = "block";
  for (const r of results) {
    const flag = countryFlag(r.address?.country_code);
    const short = r.display_name.split(",").slice(0, 3).map((s) => s.trim()).join(", ");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-item";
    btn.innerHTML = `<span class="ac-flag">${flag}</span><span class="ac-text">${short}</span>`;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      els.placeInput.value = r.display_name;
      hideAC();
      const loc = { name: r.display_name, lat: Number(r.lat), lon: Number(r.lon) };
      saveState({ lastQuery: "", lastLocation: loc });
      runForLocation(loc);
    });
    _acList.appendChild(btn);
  }
}

// ─── Auth UI binding ─────────────────────────────────────────
let authIsSignup = false;

function showAuthDialog() {
  if (isLoggedIn()) {
    els.authFormWrap.style.display = "none";
    els.authLoggedIn.style.display = "";
    els.authDialogTitle.textContent = "Account";
    if (authUser) {
      els.authAvatar.src = authUser.avatarUrl || "";
      els.authAvatar.style.display = authUser.avatarUrl ? "" : "none";
      els.authUserName.textContent = authUser.name || "User";
      els.authUserEmail.textContent = authUser.email || "";
      if (els.authUserBadge) {
        const provider = authUser.authProvider === "google" ? "Google account" : "Email account";
        const verified = authUser.emailVerified === false ? "Unverified" : "Verified";
        els.authUserBadge.textContent = `${provider} • ${verified}`;
      }
    }
  } else {
    els.authFormWrap.style.display = "";
    els.authLoggedIn.style.display = "none";
    setAuthMode(false);
  }
  els.authError.style.display = "none";
  if (els.authInfo) els.authInfo.style.display = "none";
  if (els.authResendVerifyBtn) els.authResendVerifyBtn.style.display = "none";
  if (typeof els.authDialog.showModal === "function") els.authDialog.showModal();
}

function setAuthMode(signup) {
  authIsSignup = signup;
  els.authDialogTitle.textContent = signup ? "Create account" : "Sign in";
  els.authSubmitBtn.textContent = signup ? "Sign up" : "Sign in";
  els.authName.style.display = signup ? "" : "none";
  els.authToggleMode.innerHTML = signup
    ? 'Already have an account? <strong>Sign in</strong>'
    : "Don't have an account? <strong>Sign up</strong>";
  if (els.authInfo) els.authInfo.style.display = "none";
  if (els.authResendVerifyBtn) els.authResendVerifyBtn.style.display = "none";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function bindAuthUI() {
  els.userBtn.addEventListener("click", showAuthDialog);
  els.wardrobeSignInBtn?.addEventListener("click", showAuthDialog);
  els.authCloseBtn.addEventListener("click", () => els.authDialog.close());
  els.authToggleMode.addEventListener("click", () => setAuthMode(!authIsSignup));

  els.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.authError.style.display = "none";
    if (els.authInfo) els.authInfo.style.display = "none";
    const email = els.authEmail.value.trim().toLowerCase();
    if (!isValidEmail(email)) {
      els.authError.textContent = "Enter a valid email address.";
      els.authError.style.display = "";
      els.authEmail.focus();
      return;
    }
    const endpoint = authIsSignup ? "/api/auth/signup" : "/api/auth/login";
    const body = {
      email,
      password: els.authPassword.value,
    };
    if (authIsSignup) body.name = els.authName.value.trim();

    els.authSubmitBtn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auth failed");
      if (data.requiresVerification) {
        lastVerificationEmail = email;
        if (els.authInfo) {
          els.authInfo.textContent = data.message || "Check your email to verify your account.";
          els.authInfo.style.display = "";
        }
        if (els.authResendVerifyBtn) els.authResendVerifyBtn.style.display = "";
        return;
      }
      await finalizeAuthSuccess(data.token, data.user);
    } catch (err) {
      els.authError.textContent = err.message;
      els.authError.style.display = "";
      if (/verify your email/i.test(err.message)) {
        lastVerificationEmail = email;
        if (els.authResendVerifyBtn) els.authResendVerifyBtn.style.display = "";
      }
    } finally {
      els.authSubmitBtn.disabled = false;
    }
  });

  els.authResendVerifyBtn?.addEventListener("click", async () => {
    if (!lastVerificationEmail) return;
    els.authResendVerifyBtn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: lastVerificationEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not resend verification email");
      if (els.authInfo) {
        els.authInfo.textContent = "Verification email sent. Check your inbox.";
        els.authInfo.style.display = "";
      }
    } catch (err) {
      els.authError.textContent = err.message;
      els.authError.style.display = "";
    } finally {
      els.authResendVerifyBtn.disabled = false;
    }
  });



  // Use Capacitor Browser plugin for in-app browser on native, fallback to window.open on web
  els.googleSignInBtn.addEventListener("click", async () => {
    const oauthUrl = buildGoogleOAuthUrl();
    if (isNative && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
      await window.Capacitor.Plugins.Browser.open({ url: oauthUrl });
    } else {
      window.location.href = oauthUrl; // Always use redirect for web
    }
    // The redirect handler should be implemented in the app for native (see below)
  });

  els.authLogoutBtn.addEventListener("click", () => {
    setAuth(null, null);
    _wardrobeCache = null;
    renderWardrobe();
    els.authDialog.close();
  });

  els.authDeleteBtn?.addEventListener("click", () => {
    if (!authUser) return;
    els.deleteAccountError.style.display = "none";
    els.deleteAccountPassword.value = "";
    els.deleteAccountConfirmText.value = "";
    els.deleteAccountPrompt.textContent = authUser.authProvider === "google"
      ? "Type DELETE to confirm. This permanently removes your account and wardrobe."
      : "Enter your password to confirm. This permanently removes your account and wardrobe.";
    if (typeof els.deleteAccountDialog.showModal === "function") els.deleteAccountDialog.showModal();
  });

  els.deleteAccountCancelBtn?.addEventListener("click", () => els.deleteAccountDialog.close());
  els.deleteAccountConfirmBtn?.addEventListener("click", async () => {
    els.deleteAccountError.style.display = "none";
    els.deleteAccountConfirmBtn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/auth/account`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          password: els.deleteAccountPassword.value,
          confirmText: els.deleteAccountConfirmText.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete account");
      setAuth(null, null);
      _wardrobeCache = null;
      await renderWardrobe();
      els.deleteAccountDialog.close();
      els.authDialog.close();
    } catch (err) {
      els.deleteAccountError.textContent = err.message;
      els.deleteAccountError.style.display = "";
    } finally {
      els.deleteAccountConfirmBtn.disabled = false;
    }
  });

  // Listen for Google OAuth callback postMessage
  window.addEventListener("message", (e) => {
    if (e.data?.type === "wearcast-auth" && e.data.token) {
      finalizeAuthSuccess(e.data.token, e.data.user).catch((err) => {
        alert(`Login failed: ${err.message}`);
      });
    }
  });
}

// Handle Google OAuth code in URL (web flow)
window.addEventListener('DOMContentLoaded', async () => {
  await handleGoogleAuthRedirect(window.location.href, { clearBrowserUrl: true });
});

function init() {
  configureNativeViewport();
  disableNativeDoubleTapZoom();
  bindTabNav();
  setupInstallUI();
  bindConsentUI();
  bindPrefs();
  bindSettingsUI();
  bindRecommendationControls();
  bindWardrobeUI();
  bindAuthUI();
  bindNativeGoogleAuth();
  updateAuthUI();

  // Also bind the empty-state add button
  els.addItemBtnEmpty?.addEventListener("click", () => openItemDialog());

  els.searchBtn.addEventListener("click", onSearch);
  els.geoBtn.addEventListener("click", onUseMyLocation);
  els.refreshBtn.addEventListener("click", () => {
    const st = loadState();
    if (st.lastLocation) runForLocation(st.lastLocation);
  });

  els.placeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { hideAC(); onSearch(); }
    if (e.key === "Escape") hideAC();
  });

  // ── Autocomplete dropdown ──
  setupAutocomplete();

  // Show GDPR-style privacy choices on first visit.
  if (!consent.seen) {
    showConsentDialog({ forceModal: true });
  }

  const st = loadState();
  if (st.lastLocation) {
    els.placeInput.value = st.lastLocation.name;
    runForLocation(st.lastLocation);
  } else if (consent.seen) {
    // No saved location — silently try cached/granted geolocation (no prompt)
    tryAutoGeo();
  }
  // If consent not yet seen, auto-geo triggers after consent accept (see bindConsentUI)

  registerSW();
}

init();
