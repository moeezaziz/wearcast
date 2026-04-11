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
  pullRefreshIndicator: $("pullRefreshIndicator"),

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
  heroHumidity: $("heroHumidity"),
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
  itemNameError: $("itemNameError"),
  itemColor: $("itemColor"),
  itemMaterial: $("itemMaterial"),
  itemCare: $("itemCare"),
  itemTypeError: $("itemTypeError"),
  itemFormStatus: $("itemFormStatus"),
  itemPhoto: $("itemPhoto"),
  itemPhotoPreview: $("itemPhotoPreview"),
  itemPhotoImg: $("itemPhotoImg"),
  itemPhotoStatus: $("itemPhotoStatus"),
  itemManualToggleBtn: $("itemManualToggleBtn"),
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
  whyWorksDialog: $("whyWorksDialog"),
  whyWorksDialogBody: $("whyWorksDialogBody"),
  whyWorksDialogCloseBtn: $("whyWorksDialogCloseBtn"),
  todayItemDialog: $("todayItemDialog"),
  todayItemDialogBody: $("todayItemDialogBody"),
  todayItemDialogCloseBtn: $("todayItemDialogCloseBtn"),
  tuneLookDialog: $("tuneLookDialog"),
  tuneLookDialogBody: $("tuneLookDialogBody"),
  tuneLookDialogCloseBtn: $("tuneLookDialogCloseBtn"),

  // Fashion notes
  fashionNotes: $("fashionNotes"),
  settingsAccountTitle: $("settingsAccountTitle"),
  settingsAccountStatus: $("settingsAccountStatus"),
  settingsAccountBtn: $("settingsAccountBtn"),
  settingsDeleteAccountBtn: $("settingsDeleteAccountBtn"),
  settingsPrivacyBtn: $("settingsPrivacyBtn"),
  settingsPrivacyStatus: $("settingsPrivacyStatus"),
  settingsClearLocationBtn: $("settingsClearLocationBtn"),
  settingsClearLocationStatus: $("settingsClearLocationStatus"),
  settingsResetPrefsBtn: $("settingsResetPrefsBtn"),
  settingsResetPrefsStatus: $("settingsResetPrefsStatus"),
  settingsFeedback: $("settingsFeedback"),
  userMenuDialog: $("userMenuDialog"),
  userMenuCloseBtn: $("userMenuCloseBtn"),
  userMenuAccountBtn: $("userMenuAccountBtn"),
  userMenuSettingsBtn: $("userMenuSettingsBtn"),

  // New UI
  weatherHero: $("weatherHero"),
  emptyState: $("emptyState"),
  emptyStateTitle: $("emptyStateTitle"),
  emptyStateText: $("emptyStateText"),
  bottomNav: $("bottomNav"),
  ruleRecCard: $("ruleRecCard"),
  weatherDetailsCard: $("weatherDetailsCard"),
  reasonsCard: $("reasonsCard"),
  addItemBtnEmpty: $("addItemBtnEmpty"),
  todayWardrobeCtaBtn: $("todayWardrobeCtaBtn"),
  todayWardrobeDialog: $("todayWardrobeDialog"),
  todayWardrobeDialogCloseBtn: $("todayWardrobeDialogCloseBtn"),
  todayWardrobeInlineCta: $("todayWardrobeInlineCta"),
  todayWardrobeInlineProgress: $("todayWardrobeInlineProgress"),
  todayWardrobeInlineBtn: $("todayWardrobeInlineBtn"),
  wardrobeExplainerBtn: $("wardrobeExplainerBtn"),
  todayCtaKicker: $("todayCtaKicker"),
  todayCtaTitle: $("todayCtaTitle"),
  wardrobeExplainerKicker: $("wardrobeExplainerKicker"),
  wardrobeExplainerTitle: $("wardrobeExplainerTitle"),
  wardrobeExplainerText: $("wardrobeExplainerText"),
  wardrobeExplainerProgress: $("wardrobeExplainerProgress"),
  wardrobeExplainer: $("wardrobeExplainer"),
  wardrobeFilters: $("wardrobeFilters"),

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
const AUTH_REFRESH_TOKEN_KEY = "wearcast:refresh-token";
const AUTH_USER_KEY = "wearcast:user";
const API_BASE = "https://wearcast.fly.dev";
const GOOGLE_CALLBACK_PATH = "/oauth2redirect/google";

// ─── Auth state ──────────────────────────────────────────────
let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || null;
let authRefreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY) || null;
let authUser = (() => { try { return JSON.parse(localStorage.getItem(AUTH_USER_KEY)); } catch { return null; } })();
let googleAuthCompletionPromise = null;
let lastVerificationEmail = "";
let refreshSessionPromise = null;

function setAuth(token, user, refreshToken = authRefreshToken) {
  authToken = token;
  authRefreshToken = refreshToken || null;
  authUser = user;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    if (authRefreshToken) localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, authRefreshToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }
  updateAuthUI();
}

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function isLoggedIn() { return !!authToken; }

function handleExpiredSession(message = "Your session expired. Please sign in again.") {
  setAuth(null, null, null);
  alert(message);
}

async function refreshAuthSession() {
  if (!authRefreshToken) throw new Error("No refresh token available");
  if (refreshSessionPromise) return refreshSessionPromise;

  refreshSessionPromise = (async () => {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: authRefreshToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Session expired. Please sign in again.");
    }
    setAuth(data.token, data.user, data.refreshToken);
    return data;
  })();

  try {
    return await refreshSessionPromise;
  } finally {
    refreshSessionPromise = null;
  }
}

async function authFetch(resource, options = {}, { retryOnAuth = true } = {}) {
  const headers = {
    ...(options.headers || {}),
    ...authHeaders(),
  };
  let response = await fetch(resource, { ...options, headers });
  if (response.status !== 401 || !retryOnAuth) return response;

  try {
    await refreshAuthSession();
  } catch (err) {
    handleExpiredSession(err.message || "Your session expired. Please sign in again.");
    return response;
  }

  response = await fetch(resource, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders(),
    },
  });
  return response;
}

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

async function finalizeAuthSuccess(token, user, refreshToken = authRefreshToken) {
  setAuth(token, user, refreshToken);
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

      await finalizeAuthSuccess(data.token, data.user, data.refreshToken);
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
let activeRecommendationDialogIndex = -1;
let recommendationDialogTouchStartX = 0;
let recommendationDialogTouchDeltaX = 0;
let recommendationDialogSwipeActive = false;
let settingsFeedbackTimeoutId = null;
let consentDialogSource = null;
const TAB_ORDER = ["tabToday", "tabWardrobe"];

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
  if (!consent.functionalStorage) {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    try { localStorage.removeItem(WARDROBE_KEY); } catch {}
  }
  renderSettingsDataUI();
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
  const normalizedLocation = partial.lastLocation
    ? {
        ...partial.lastLocation,
        name: formatCityLevelLocation(partial.lastLocation.name),
      }
    : partial.lastLocation;
  const next = {
    ...prev,
    ...partial,
    ...(partial.lastLocation !== undefined ? { lastLocation: normalizedLocation } : {}),
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

  renderSettingsDataUI();
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
  if (/^Using:\s/i.test(String(msg || ""))) {
    msg = "";
  }
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

function setSettingsFeedback(message = "", tone = "info", { persist = false } = {}) {
  if (!els.settingsFeedback) return;
  if (settingsFeedbackTimeoutId) {
    window.clearTimeout(settingsFeedbackTimeoutId);
    settingsFeedbackTimeoutId = null;
  }
  if (!message) {
    els.settingsFeedback.textContent = "";
    els.settingsFeedback.dataset.tone = "";
    els.settingsFeedback.classList.remove("is-busy");
    return;
  }
  els.settingsFeedback.textContent = message;
  els.settingsFeedback.dataset.tone = tone;
  els.settingsFeedback.classList.toggle("is-busy", tone === "busy");
  if (!persist && tone !== "busy") {
    settingsFeedbackTimeoutId = window.setTimeout(() => {
      setSettingsFeedback("");
    }, 3200);
  }
}

function setSettingsActionBusy(button, busy) {
  if (!button) return;
  button.disabled = !!busy;
  button.classList.toggle("is-busy", !!busy);
  button.setAttribute("aria-busy", busy ? "true" : "false");
}

function truncateSettingsText(text, maxLength = 54) {
  const value = String(text || "").trim();
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}

function areRecommendationPrefsDefault(prefs = {}) {
  const resolved = { ...DEFAULT_STATE.prefs, ...(prefs || {}) };
  return Object.keys(DEFAULT_STATE.prefs).every((key) => resolved[key] === DEFAULT_STATE.prefs[key]);
}

function summarizeConsentSettings() {
  const storageText = consent.functionalStorage ? "Functional storage on" : "Functional storage off";
  const locationText = consent.deviceLocation ? "device location allowed" : "device location off";
  return `${storageText} • ${locationText}.`;
}

function summarizeSavedLocation(state = loadState()) {
  if (!canUseFunctionalStorage()) {
    return state.lastLocation
      ? `Current session only: ${truncateSettingsText(state.lastLocation.name || "Current location")}.`
      : "Functional storage is off. No location is saved across sessions.";
  }
  return state.lastLocation
    ? `Saved on this device: ${truncateSettingsText(state.lastLocation.name || "Current location")}.`
    : "No saved location on this device.";
}

function summarizeRecommendationTuning(prefs = loadState().prefs) {
  const resolved = { ...DEFAULT_STATE.prefs, ...(prefs || {}) };
  if (areRecommendationPrefsDefault(resolved)) {
    return "Using default outfit tuning.";
  }

  const chips = [];
  const activityMap = {
    everyday: "Everyday",
    walking: "Walking",
    commute: "Commute",
    errands: "Errands",
    office: "Office",
    workout: "Workout",
    travel: "Travel",
    evening: "Evening",
  };
  const locationMap = {
    indoors: "Indoors",
    mixed: "Mixed day",
    outdoors: "Outdoors",
    transit: "Transit",
    event: "Event",
    exposed: "Exposed",
  };
  const styleMap = {
    auto: "",
    casual: "Casual",
    polished: "Polished",
    sporty: "Sporty",
    streetwear: "Streetwear",
    minimalist: "Minimalist",
  };

  if (resolved.activityContext && resolved.activityContext !== DEFAULT_STATE.prefs.activityContext) {
    chips.push(activityMap[resolved.activityContext] || "Custom activity");
  }
  if (resolved.locationContext && resolved.locationContext !== DEFAULT_STATE.prefs.locationContext) {
    chips.push(locationMap[resolved.locationContext] || "Custom setting");
  }
  if (resolved.styleFocus && resolved.styleFocus !== DEFAULT_STATE.prefs.styleFocus) {
    chips.push(styleMap[resolved.styleFocus] || "Custom style");
  }
  if (resolved.cold) chips.push("Usually cold");
  if (resolved.hot) chips.push("Usually hot");

  return chips.length ? `Current tuning: ${chips.slice(0, 3).join(" • ")}.` : "Using custom outfit tuning.";
}

function renderSettingsDataUI() {
  if (els.settingsPrivacyStatus) {
    els.settingsPrivacyStatus.textContent = summarizeConsentSettings();
  }

  const state = loadState();
  if (els.settingsClearLocationStatus) {
    els.settingsClearLocationStatus.textContent = summarizeSavedLocation(state);
  }
  if (els.settingsResetPrefsStatus) {
    els.settingsResetPrefsStatus.textContent = summarizeRecommendationTuning(state.prefs);
  }
}

function resetTodayLocationState() {
  pendingRecommendationPrefs = null;
  lastWeatherForAI = null;
  if (els.weatherHero) els.weatherHero.style.display = "none";
  if (els.weatherDetailsCard) {
    els.weatherDetailsCard.style.display = "none";
    els.weatherDetailsCard.open = false;
  }
  if (els.aiRecSection) els.aiRecSection.style.display = "none";
  if (els.aiRecLoading) els.aiRecLoading.style.display = "none";
  if (els.aiRecContent) els.aiRecContent.innerHTML = "";
  if (els.aiRecWarnings) els.aiRecWarnings.innerHTML = "";
  if (els.aiRecMissing) els.aiRecMissing.innerHTML = "";
  if (els.aiRecBadge) els.aiRecBadge.textContent = "Best match";
  if (els.emptyState) els.emptyState.style.display = "";
  setEmptyStateLoading(false);
  if (els.updatedAt) els.updatedAt.textContent = "—";
}

function setEmptyStateLoading(active, message = "Fetching your local weather…") {
  if (!els.emptyState) return;
  els.emptyState.classList.toggle("is-loading", !!active);
  const spinnerWrap = els.emptyState.querySelector(".empty-spinner-wrap");
  const iconSvg = els.emptyState.querySelector("svg");
  if (spinnerWrap) spinnerWrap.style.display = active ? "flex" : "none";
  if (iconSvg) iconSvg.style.display = active ? "none" : "";
  if (els.emptyStateTitle) {
    els.emptyStateTitle.textContent = active ? "Getting your location" : "Where are you headed?";
  }
  if (els.emptyStateText) {
    els.emptyStateText.textContent = active
      ? message
      : "Search a city or share your location to get weather-based outfit suggestions.";
  }
}

function privacyPromptFallback({ source = null } = {}) {
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
  renderWardrobe();
  renderSettingsDataUI();
  if (source === "settings") {
    setSettingsFeedback(`Privacy choices saved. ${summarizeConsentSettings()}`, "success");
  }
  consentDialogSource = null;
}

function showConsentDialog({ forceModal = false, source = null } = {}) {
  consentDialogSource = source;
  if (!els.consentDialog) {
    privacyPromptFallback({ source });
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
    privacyPromptFallback({ source });
  }
}

function closeConsentDialog() {
  if (!els.consentDialog) return;
  if (typeof els.consentDialog.close === "function") els.consentDialog.close();
  consentDialogSource = null;
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

  if (storm) stressors.push({ s: 4, flag: "Thunderstorm", icon: renderInlineIcon("storm"), p: 10 });
  if (freezing) stressors.push({ s: 4, flag: "Freezing rain", icon: renderInlineIcon("umbrella"), p: 9 });
  if (snowy || daySnowMax > 0) {
    stressors.push({ s: 3, flag: daySnowMax > 0 && !snowy ? "Snow expected later" : "Snow / ice", icon: renderInlineIcon("snow"), p: 8 });
    if (windy) stressors.push({ s: 1, flag: "Blowing snow", icon: renderInlineIcon("snow"), p: 7 });
  }
  if (wet || dayPrecipProbMax >= 50) {
    const heavy = (next2h ?? 0) >= 5 || dayRainMax >= 5;
    const label = heavy ? "Heavy rain" : dayPrecipProbMax >= 50 && !wet ? `Rain later (${Math.round(dayPrecipProbMax)}%)` : "Rain expected";
    stressors.push({ s: heavy ? 3 : 2, flag: label, icon: heavy ? renderInlineIcon("rain") : renderInlineIcon("drizzle"), p: heavy ? 6 : 5 });
  }
  if (veryWindy || dayWindMax >= 35) stressors.push({ s: 3, flag: dayWindMax >= 35 && !veryWindy ? "Strong gusts later" : "Strong gusts", icon: renderInlineIcon("wind"), p: 6 });
  else if (windy || dayWindMax >= 25) stressors.push({ s: 2, flag: dayWindMax >= 25 && !windy ? "Windy later" : "Windy", icon: renderInlineIcon("wind"), p: 4 });

  if (extremeCold || dayTempMin <= -15) stressors.push({ s: 3, flag: dayTempMin <= -15 && !extremeCold ? "Very cold later" : "Very cold", icon: renderInlineIcon("cold"), p: 7 });
  else if (veryCold || dayTempMin <= 2) stressors.push({ s: 1, flag: dayTempMin <= 2 && !veryCold ? "Cold later" : "Cold", icon: renderInlineIcon("cold"), p: 3 });

  if (extremeHeat || dayTempMax >= 38) stressors.push({ s: 3, flag: dayTempMax >= 38 && !extremeHeat ? "Heatwave expected" : "Extreme heat", icon: renderInlineIcon("hot"), p: 7 });
  else if (veryHot || dayTempMax >= 30) stressors.push({ s: 1, flag: dayTempMax >= 30 && !veryHot ? "Hot later" : "Hot", icon: renderInlineIcon("hot"), p: 3 });

  if (uv >= 8) stressors.push({ s: 2, flag: "Very high UV", icon: renderInlineIcon("clear"), p: 5 });
  else if (uv >= 6) stressors.push({ s: 1, flag: "High UV", icon: renderInlineIcon("clear"), p: 2 });

  const score = stressors.reduce((a, x) => a + x.s, 0);
  const primary = [...stressors].sort((a, b) => b.p - a.p)[0] || null;
  const flags = stressors.map(s => s.flag);

  let level = "good";
  let title = "All clear";
  let icon = renderInlineIcon("success");

  if (score >= 6) { level = "bad"; title = primary?.flag || "Severe conditions"; icon = primary?.icon || renderInlineIcon("warning"); }
  else if (stressors.length > 0) { level = "warn"; title = primary?.flag || "Be prepared"; icon = primary?.icon || renderInlineIcon("warning"); }

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
  url.searchParams.set("addressdetails", "1");

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
    name: formatCityLevelLocation(data[0].display_name, data[0].address),
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

  els.temp.textContent = `${fmt1(current.temperature_2m, "°")}`;
  els.apparent.textContent = `${fmt1(current.apparent_temperature, "°C")}`;
  els.wind.textContent = `${fmt(current.wind_speed_10m)} km/h`;
  if (els.humidity) els.humidity.textContent = `${fmt(current.relative_humidity_2m)}%`;
  els.heroHumidity.textContent = `${fmt(current.relative_humidity_2m)}%`;
  if (els.cloud) els.cloud.textContent = `${fmt(current.cloud_cover, "%")}`;
  if (els.precip) els.precip.textContent = `${fmt1(current.precipitation)} mm`;
  if (els.precipProb) els.precipProb.textContent = derived?.precipProb != null ? `${fmt(derived.precipProb, "%")}` : "—";
  if (els.heroPrecipProb) {
    els.heroPrecipProb.textContent = derived?.precipProb != null ? `${fmt(derived.precipProb, "%")}` : "—";
  }

  const dew = dewPointC(current.temperature_2m, current.relative_humidity_2m);
  const hx = humidex(current.temperature_2m, dew);
  const wc = windChillC(current.temperature_2m, current.wind_speed_10m);
  let effective = current.apparent_temperature;
  if (wc != null) effective = wc;
  else if (hx != null && hx >= current.temperature_2m + 1.0) effective = hx;

  if (els.dewPoint) els.dewPoint.textContent = dew != null ? `${fmt1(dew, "°C")}` : "—";
  if (els.effTemp) els.effTemp.textContent = effective != null ? `${fmt1(effective, "°C")}` : "—";

  const sev = classifySeverity(current, derived, effective, hourly);
  setSeverity(sev.level, sev.title, sev.meta, sev.detail, sev.icon);

  els.uv.textContent = `${fmt1(current.uv_index, "")}`;
  if (els.vis) els.vis.textContent = current.visibility != null ? `${fmt1(current.visibility / 1000, " km")}` : "—";
  if (els.isDay) els.isDay.textContent = current.is_day === 1 ? "Yes" : current.is_day === 0 ? "No" : "—";
  const conditionLabel = weatherCodeLabel(current.weather_code);
  els.wcode.textContent = conditionLabel;
  if (els.heroConditionIcon) {
    els.heroConditionIcon.innerHTML = weatherConditionIcon(conditionLabel);
  }
}

function renderRecommendationWeatherStrip(weather = {}) {
  const items = [
    { label: "Now", value: Number.isFinite(Number(weather.temperature)) ? `${fmt1(weather.temperature, "°C")}` : "—" },
    { label: "Feels", value: Number.isFinite(Number(weather.feelsLike)) ? `${fmt1(weather.feelsLike, "°C")}` : "—" },
    { label: "Wind", value: Number.isFinite(Number(weather.wind)) ? `${fmt(Math.round(weather.wind), "")} km/h` : "—" },
    { label: "Rain", value: Number.isFinite(Number(weather.precipProb)) ? `${fmt(Math.round(weather.precipProb), "")}%` : "—" },
  ];
  const condition = compactText(weather.weatherLabel, "");
  return `
    <div class="today-rec-weather-strip" aria-label="Current weather summary">
      <span class="today-rec-weather-condition">${escapeHtml(condition)}</span>
      <div class="today-rec-weather-metrics">
        ${items.map((item) => `
          <span class="today-rec-weather-metric">
            <small>${escapeHtml(item.label)}</small>
            ${escapeHtml(item.value)}
          </span>
        `).join("")}
      </div>
    </div>
  `;
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

function formatList(items = []) {
  const values = items.map((item) => compactText(item, "")).filter(Boolean);
  if (values.length <= 1) return values[0] || "";
  if (typeof Intl !== "undefined" && Intl.ListFormat) {
    return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(values);
  }
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

const STREAMLINE_ICON_BASE = "assets/icons/streamline";

function renderAssetIcon(fileName, extraClass = "", alt = "") {
  const classes = ["streamline-icon"];
  if (extraClass) classes.push(extraClass);
  return `<img class="${classes.join(" ")}" src="${STREAMLINE_ICON_BASE}/${fileName}" alt="${escapeHtml(alt)}" draggable="false" />`;
}

function renderInlineIcon(kind, extraClass = "") {
  const assetIcons = {
    wind: "Wind-Flow-2--Streamline-Core-Gradient.svg",
    top: "Shirt--Streamline-Flex-Gradient.svg",
    jacket: "Hoodie--Streamline-Phosphor.svg",
    pants: "Pants--Streamline-Phosphor.svg",
    shoes: "Sneakers--Streamline-Cyber.svg",
    accessory: "Hexagram--Streamline-Core-Gradient.svg",
    info: "Information-Circle--Streamline-Ultimate.svg",
  };
  if (assetIcons[kind]) {
    return renderAssetIcon(assetIcons[kind], extraClass);
  }

  const classAttr = extraClass ? ` class="${extraClass}"` : "";
  const icons = {
    clear: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"/></svg>`,
    partly: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 6.5a3.5 3.5 0 1 0-6.8 1.2"/><path d="M7 17.5h9.5a3.5 3.5 0 0 0 .5-6.96A5.5 5.5 0 0 0 6.55 9.2 3.8 3.8 0 0 0 7 17.5Z"/></svg>`,
    rain: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15.5h9.5a3.5 3.5 0 0 0 .5-6.96A5.5 5.5 0 0 0 6.55 7.2 3.8 3.8 0 0 0 7 15.5Z"/><path d="M9 17.5v2M13 17.5v3M17 17.5v2"/></svg>`,
    snow: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13.5h9.5a3.5 3.5 0 0 0 .5-6.96A5.5 5.5 0 0 0 6.55 5.2 3.8 3.8 0 0 0 7 13.5Z"/><path d="m10 17 .9 1.5L12.5 20m0-3-.9 1.5L10.1 20M15 17l.9 1.5 1.6 1.5m0-3-.9 1.5L15.1 20"/></svg>`,
    storm: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13.5h9.5a3.5 3.5 0 0 0 .5-6.96A5.5 5.5 0 0 0 6.55 5.2 3.8 3.8 0 0 0 7 13.5Z"/><path d="m12 14-1 3h2l-1 4 4-6h-2l1-3Z"/></svg>`,
    fog: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 9.5h14"/><path d="M3 13h18"/><path d="M6 16.5h12"/></svg>`,
    wind: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h10a2.5 2.5 0 1 0-2.5-2.5"/><path d="M2 14h14a2.5 2.5 0 1 1-2.5 2.5"/><path d="M4 19h7"/></svg>`,
    drizzle: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13.5h9.5a3.5 3.5 0 0 0 .5-6.96A5.5 5.5 0 0 0 6.55 5.2 3.8 3.8 0 0 0 7 13.5Z"/><path d="M10 17v1.6M14 18.2v2.3"/></svg>`,
    cold: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m8 5 4 2 4-2"/><path d="m8 19 4-2 4 2"/><path d="M4.5 8h15"/><path d="M4.5 16h15"/></svg>`,
    hot: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z"/><path d="M12 11v6"/></svg>`,
    umbrella: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 16 0Z"/><path d="M12 12v6a2 2 0 0 0 4 0"/></svg>`,
    globe: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`,
    success: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    warning: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
    jacket: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 3-4 4v13h5v-6h4v6h5V7l-4-4"/><path d="M9 3h6"/></svg>`,
    top: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2 12 5.5 8 2 3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47c.1.6.6 1.04 1.2 1.04H6v10c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V10h1.94c.6 0 1.1-.44 1.2-1.04l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>`,
    pants: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v6l-2 12"/><path d="M15 3v6l2 12"/><path d="M9 3h6"/><path d="M8 21h3"/><path d="M13 21h3"/></svg>`,
    dress: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 4 2.5 3H9.5L12 4Z"/><path d="M10 7 7 21h10L14 7"/><path d="M9.5 10h5"/></svg>`,
    shoes: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c2 0 3-1 4-3l2 1c1.2.6 2.4 1 3.8 1H15c2 0 3 1.5 3 3v1H3z"/><path d="M18 18h3v-1c0-1.7-1.3-3-3-3h-2"/></svg>`,
    accessory: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 10.5a4.5 4.5 0 0 1 9 0"/><path d="M9.5 10.5a2.5 2.5 0 0 1 5 0"/><path d="M7 10.5h10l-1.1 6.1A2 2 0 0 1 13.93 18H10.07a2 2 0 0 1-1.97-1.39L7 10.5Z"/><path d="M12 5.5v1"/></svg>`,
    tune: `<svg${classAttr} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5h16"/><path d="M4 12h16"/><path d="M4 17.5h16"/><circle cx="8" cy="6.5" r="2.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="12" r="2.1" fill="currentColor" stroke="none"/><circle cx="11" cy="17.5" r="2.1" fill="currentColor" stroke="none"/></svg>`,
  };
  return icons[kind] || icons.globe;
}

function itemTypeIconKey(type = "") {
  const key = String(type).toLowerCase();
  if (/(jacket|coat|hoodie|sweater|blazer|vest)/.test(key)) return "jacket";
  if (/(jeans|chinos|shorts|pants|sweatpants|skirt)/.test(key)) return "pants";
  if (/(dress)/.test(key)) return "dress";
  if (/(sneakers|boots|sandals|shoes)/.test(key)) return "shoes";
  if (/(scarf|hat|beanie|gloves|sunglasses|belt|bag|umbrella|watch|cap|socks|accessor)/.test(key)) return "accessory";
  return "top";
}

function formatCityLevelLocation(displayName, address = null) {
  const fullText = compactText(displayName, "");
  const parts = fullText.split(",").map((part) => part.trim()).filter(Boolean);
  const candidates = [
    address?.city,
    address?.town,
    address?.village,
    address?.municipality,
    address?.suburb,
    address?.county,
    address?.state,
    address?.country,
  ].map((part) => compactText(part, "")).filter(Boolean);

  const primary = candidates[0] || parts[0] || fullText;
  const secondary = candidates.find((part) => part && part !== primary) || parts.find((part) => part && part !== primary);
  if (!primary) return "Current location";
  return secondary ? `${primary}, ${secondary}` : primary;
}

function firstSentence(text) {
  const normalized = compactText(text, "");
  if (!normalized) return "";
  const match = normalized.match(/.*?[.!?](?:\s|$)/);
  return (match ? match[0] : normalized).trim();
}

function shortenRecommendationSubtitle(text) {
  return compactText(text, "");
}

function isGenericRecommendationSubtitle(text) {
  const value = compactText(text, "").toLowerCase();
  if (!value) return true;
  return [
    /chosen to match today'?s weather/,
    /chosen to match today’s weather/,
    /keep you comfortable through the day/,
    /built around today'?s conditions/,
    /built around today’s conditions/,
    /matched to the weather/,
    /matched to today'?s weather/,
    /matched to today’s weather/,
    /suited to today'?s conditions/,
    /suited to today’s conditions/,
  ].some((pattern) => pattern.test(value));
}

function buildLocalRecommendationSubtitle(weather = {}) {
  const feelsLike = Number(weather.feelsLike ?? weather.temperature);
  const wind = Number(weather.wind ?? 0);
  const rainChance = Number(weather.precipProb ?? 0);
  const precip = Number(weather.precip ?? 0);
  const humidity = Number(weather.humidity ?? 0);
  const uv = Number(weather.uv ?? 0);
  const label = compactText(weather.weatherLabel, "today’s conditions").toLowerCase();
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
  if (!traits.some((trait) => label.includes(trait.replace(/\s.*$/, "")))) traits.push(label);

  const summary = formatList(Array.from(new Set(traits)).slice(0, 3));
  return `Today looks ${summary}, so the outfit leans into comfort, coverage, and weather protection without feeling overbuilt.`;
}

function normalizeItemLabel(text) {
  return compactText(text, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+[—-]\s+.*$/, "")
    .trim();
}

function preserveUsefulItemLabel(text) {
  const normalized = normalizeItemLabel(text);
  if (!normalized) return "";
  const cleaned = normalized
    .replace(/\s{2,}/g, " ")
    .replace(/\btee\s*shirt\b/i, "T-shirt")
    .replace(/\btshirt\b/i, "T-shirt")
    .trim();
  if (!cleaned) return "";

  return cleaned
    .split(/\s+/)
    .map((word) => word
      .split("-")
      .map((part) => {
        if (!part) return part;
        if (/^(t)$/i.test(part)) return "T";
        if (/^[A-Z0-9]{2,}$/.test(part)) return part;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join("-"))
    .join(" ")
    .replace(/\bT-Shirt\b/g, "T-shirt");
}

function weatherConditionIcon(label = "") {
  const text = String(label).toLowerCase();
  if (text.includes("thunder")) return renderInlineIcon("storm");
  if (text.includes("snow")) return renderInlineIcon("snow");
  if (text.includes("rain")) return renderInlineIcon("rain");
  if (text.includes("drizzle")) return renderInlineIcon("drizzle");
  if (text.includes("partly") || text.includes("cloud")) return renderInlineIcon("partly");
  if (text.includes("fog")) return renderInlineIcon("fog");
  if (text.includes("clear") || text.includes("fair")) return renderInlineIcon("clear");
  return renderInlineIcon("globe");
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
  if (key === "top") return renderInlineIcon("top");
  if (key === "bottom") return renderInlineIcon("pants");
  if (key === "outer") return renderInlineIcon("jacket");
  if (key === "shoes") return renderInlineIcon("shoes");
  return renderInlineIcon("accessory");
}

function getRecommendationCardArt(label, value, imageMatch = null) {
  const key = itemTypeIconKey(`${label} ${value}`);
  const toneMap = {
    top: "top",
    pants: "bottom",
    jacket: "outer",
    shoes: "shoes",
    accessory: "accessory",
    dress: "dress",
  };
  return {
    key,
    tone: toneMap[key] || "top",
    icon: renderInlineIcon(key),
    photo: imageMatch?.path || {
      top: "assets/recommendation-stock/top-white-tshirt-studio.jpg",
      pants: "assets/recommendation-stock/bottom-blue-jeans-stack.jpg",
      jacket: "assets/recommendation-stock/outer-gray-jacket-studio.jpg",
      shoes: "assets/recommendation-stock/shoes-white-sneakers-minimal.jpg",
      accessory: "assets/recommendation-stock/accessory-black-sunglasses-studio.jpg",
    }[key] || "",
  };
}

function buildRecommendationItemReason(label, value, weather, aiReason = "") {
  const preferred = compactText(aiReason, "");
  if (preferred) return preferred;
  const normalized = `${label} ${value}`.toLowerCase();
  if (label === "Outer") {
    if ((weather?.precipProb || 0) >= 40) return "Adds protection for possible rain later.";
    if ((weather?.wind || 0) >= 22) return "Helps block the wind and hold warmth.";
    return "Adds a useful outer layer without overdoing it.";
  }
  if (label === "Top") {
    if (normalized.includes("long sleeve")) return "Keeps the base layer comfortable in cooler air.";
    if ((weather?.temperature ?? 0) >= 22) return "Keeps the outfit light and breathable.";
    return "Builds a comfortable base for the day.";
  }
  if (label === "Bottom") {
    if (normalized.includes("short")) return "Keeps movement easy and the look light.";
    return "Balances coverage and all-day comfort.";
  }
  if (label === "Shoes") {
    if ((weather?.precipProb || 0) >= 40) return "Grounds the outfit for a wetter forecast.";
    return "Finishes the look with easy everyday wear.";
  }
  if (label === "Accessory") {
    if ((weather?.precipProb || 0) >= 40) return "Adds a practical weather-ready extra.";
    if ((weather?.uv || 0) >= 7) return "Adds a useful finishing touch outdoors.";
    return "Rounds out the outfit with a small extra.";
  }
  return "Chosen to balance the outfit for today’s conditions.";
}

function buildClientFallbackRecommendation(weather = {}, reason = "AI response timed out") {
  const temp = Number(weather.temperature);
  const feelsLikeRaw = Number(weather.feelsLike ?? weather.temperature);
  const feelsLike = Number.isFinite(feelsLikeRaw) ? feelsLikeRaw : temp;
  const precipProb = Number(weather.precipProb ?? 0);
  const precip = Number(weather.precip ?? 0);
  const wind = Number(weather.wind ?? 0);
  const uv = Number(weather.uv ?? 0);
  const label = compactText(weather.weatherLabel, "").toLowerCase();
  const wet = precipProb >= 40 || precip > 0 || /rain|drizzle|shower|thunder|snow|sleet/.test(label);
  const veryCold = Number.isFinite(feelsLike) && feelsLike <= 2;
  const cold = Number.isFinite(feelsLike) && feelsLike <= 8;
  const cool = Number.isFinite(feelsLike) && feelsLike <= 15;
  const hot = Number.isFinite(feelsLike) && feelsLike >= 27;

  const top = veryCold ? "Thermal Base Layer" : cold ? "Knit Sweater" : hot ? "Breathable T-shirt" : "Long-Sleeve Top";
  const bottom = veryCold ? "Insulated Pants" : hot ? "Lightweight Trousers" : wet ? "Dark Jeans" : "Comfortable Trousers";
  const outer = wet ? "Waterproof Jacket" : (cold || wind >= 22 || cool) ? "Light Jacket" : hot ? "Breathable Overshirt" : "Light Overshirt";
  const shoes = wet ? "Waterproof Sneakers" : veryCold ? "Weatherproof Boots" : "Sneakers";
  const accessories = [];
  if (wet) accessories.push("Umbrella");
  else if (uv >= 6) accessories.push("Sunglasses");
  else if (cold) accessories.push("Warm Scarf");
  else accessories.push("Watch");

  const weatherSummary = buildLocalRecommendationSubtitle(weather);
  return {
    outfit: { top, bottom, outer, shoes, accessories },
    reasoning: weatherSummary,
    slotReasons: {
      top: cold ? "Adds comfortable warmth without making the base bulky." : hot ? "Keeps the base breathable in warmer air." : "Creates a flexible base for changing conditions.",
      bottom: wet ? "Darker, sturdier fabric is more forgiving if showers arrive." : "Balances coverage, comfort, and easy movement.",
      outer: outer ? (wet ? "Keeps wind and possible rain from becoming the main issue." : "Adds light coverage that can come off if it warms up.") : "",
      shoes: wet ? "Closed, grippier shoes are safer for damp streets." : "Keeps the outfit practical for walking through the day.",
      accessory: accessories[0] ? "Adds a small weather-specific layer without overcomplicating the outfit." : "",
    },
    detailsOverview: {
      what: [top, bottom, outer, shoes, ...accessories].filter(Boolean).join(", "),
      why: `${weatherSummary} This fallback keeps the recommendation usable while the AI provider recovers.`,
      note: `${reason}. You can refresh again for a fully AI-generated version.`,
    },
    warnings: [`Using a local weather-based fallback: ${reason}.`],
    missingItems: [],
  };
}

function normalizeWardrobeType(type = "") {
  const key = String(type || "").trim().toLowerCase();
  if (!key) return "";
  if (["top", "shirt", "t-shirt", "tee", "sweater"].includes(key)) return "top";
  if (["bottom", "pants", "trousers", "jeans", "shorts", "leggings"].includes(key)) return "bottom";
  if (["outer", "outerwear", "jacket", "coat", "hoodie", "blazer"].includes(key)) return "outer";
  if (["shoes", "shoe", "sneakers", "boots", "loafers"].includes(key)) return "shoes";
  if (["accessory", "accessories", "scarf", "beanie", "hat", "gloves", "umbrella", "watch", "sunglasses", "cap", "baseball cap", "bag", "belt bag", "tote bag", "socks"].includes(key)) return "accessory";
  return key;
}

function normalizeRecommendationEntry(entry, index = 0) {
  if (Array.isArray(entry)) {
    return {
      label: entry[0] || "",
      value: entry[1] || "",
      key: entry[2] || `${String(entry[0] || "item").toLowerCase()}-${index}`,
    };
  }
  return {
    label: entry?.label || "",
    value: entry?.value || "",
    key: entry?.key || `${String(entry?.label || "item").toLowerCase()}-${index}`,
  };
}

function buildWardrobePhotoMatches(entries, wardrobeItems = []) {
  const photoItems = Array.isArray(wardrobeItems)
    ? wardrobeItems.filter((item) => item?.photoDataUrl && item?.name)
    : [];
  if (!photoItems.length) return {};

  const scoredMatchFor = (slotKey, value) => {
    const normalizedValue = normalizeItemLabel(value).toLowerCase();
    if (!normalizedValue) return null;
    const wantedType = normalizeWardrobeType(slotKey);
    const wantedTokens = normalizedValue.split(/\s+/).filter((token) => token.length > 2);

    let best = null;
    let bestScore = 0;

    for (const item of photoItems) {
      const itemType = normalizeWardrobeType(item.type);
      if (wantedType && itemType && itemType !== wantedType) continue;

      const itemName = normalizeItemLabel(item.name).toLowerCase();
      if (!itemName) continue;

      let score = 0;
      if (itemName === normalizedValue) score += 10;
      if (itemName.includes(normalizedValue) || normalizedValue.includes(itemName)) score += 6;

      const itemTokens = itemName.split(/\s+/).filter((token) => token.length > 2);
      const overlap = wantedTokens.filter((token) => itemTokens.includes(token)).length;
      score += overlap * 2;

      if (wantedTokens.length && overlap === wantedTokens.length) score += 2;

      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    if (!best || bestScore < 6) return null;
    return {
      path: best.photoDataUrl,
      source: "wardrobe",
      itemId: best.id ?? null,
      itemName: best.name || "",
      color: best.color || "",
      material: best.material || "",
      careInstructions: Array.isArray(best.careInstructions) ? best.careInstructions : [],
      type: best.type || "",
    };
  };

  return entries.reduce((acc, entry, index) => {
    const normalizedEntry = normalizeRecommendationEntry(entry, index);
    const slotKey = String(normalizedEntry.label || "").toLowerCase();
    const match = scoredMatchFor(slotKey, normalizedEntry.value);
    if (match) acc[normalizedEntry.key] = match;
    return acc;
  }, {});
}

function inferRecommendedItemDetails(item = {}, weather = {}) {
  const value = compactText(item.value, "");
  const label = compactText(item.label, "Item");
  const lower = value.toLowerCase();
  const inferredColor =
    /\bblack\b/.test(lower) ? "Black" :
    /\bwhite\b/.test(lower) ? "White" :
    /\bblue\b/.test(lower) ? "Blue" :
    /\bgray|grey\b/.test(lower) ? "Grey" :
    /\btan|beige|camel\b/.test(lower) ? "Tan" :
    /\bbrown\b/.test(lower) ? "Brown" :
    /\bgreen|olive\b/.test(lower) ? "Olive" :
    /\bred|burgundy\b/.test(lower) ? "Burgundy" :
    "Weather-ready neutral";

  const inferredMaterial =
    /\bfleece|sherpa\b/.test(lower) ? "Soft fleece" :
    /\bhoodie|sweater|knit|jumper|beanie|scarf\b/.test(lower) ? "Knit fabric" :
    /\bblazer|trouser|pants|chino|button-up|shirt\b/.test(lower) ? "Structured woven fabric" :
    /\bjean|denim\b/.test(lower) ? "Denim" :
    /\blegging\b/.test(lower) ? "Stretch performance knit" :
    /\bwindbreaker|parka|waterproof|shell|jacket|coat\b/.test(lower) ? "Technical outerwear fabric" :
    /\bsneaker|running\b/.test(lower) ? "Mesh and rubber" :
    /\bloafer|boot\b/.test(lower) ? "Leather or suede" :
    /\bumbrella\b/.test(lower) ? "Waterproof canopy fabric" :
    /\bglove\b/.test(lower) ? "Soft insulated fabric" :
    /\bwatch\b/.test(lower) ? "Metal and leather mix" :
    "Versatile everyday fabric";

  const care =
    /\bwaterproof|shell|windbreaker|parka|jacket\b/.test(lower)
      ? "Spot clean and air dry"
      : /\bknit|sweater|beanie|scarf|glove|fleece|sherpa\b/.test(lower)
        ? "Cool wash and lay flat to dry"
        : /\bsneaker|boot|loafer\b/.test(lower)
          ? "Wipe clean after wear"
          : "Gentle wash when needed";

  const note = item.reason || buildRecommendationItemReason(label, value, weather, "");
  return {
    sourceLabel: "AI pick",
    color: inferredColor,
    material: inferredMaterial,
    care,
    note,
  };
}

function buildRecommendationItemDialogDetails(item = {}, weather = {}) {
  const wardrobeDetails = item.wardrobeDetails && typeof item.wardrobeDetails === "object"
    ? item.wardrobeDetails
    : null;
  const aiDetails = item.aiDetails && typeof item.aiDetails === "object"
    ? item.aiDetails
    : null;
  const fallback = inferRecommendedItemDetails(item, weather);
  const details = wardrobeDetails
    ? {
        sourceLabel: "From your wardrobe",
        color: compactText(wardrobeDetails.color, ""),
        material: compactText(wardrobeDetails.material, ""),
        care: Array.isArray(wardrobeDetails.careInstructions) && wardrobeDetails.careInstructions.length
          ? wardrobeDetails.careInstructions.slice(0, 2).join(" • ")
          : "",
        note: item.reason || "",
      }
    : aiDetails
      ? {
          sourceLabel: "AI suggestion",
          color: compactText(aiDetails.color, ""),
          material: compactText(aiDetails.material, ""),
          care: Array.isArray(aiDetails.careInstructions) && aiDetails.careInstructions.length
            ? aiDetails.careInstructions.slice(0, 2).join(" • ")
            : "",
          note: item.reason || "",
        }
      : fallback;

  return [
    { label: "Color", value: details.color || fallback.color },
    { label: "Material", value: details.material || fallback.material },
  ].filter((entry) => compactText(entry.value, ""));
}

function getRecommendationDialogItems() {
  try {
    const items = JSON.parse(els.aiRecContent?.dataset?.collageItems || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function stepRecommendationItemDialog(direction = 1) {
  const items = getRecommendationDialogItems();
  if (!items.length) return;
  const nextIndex = Math.max(0, Math.min(items.length - 1, activeRecommendationDialogIndex + direction));
  if (nextIndex === activeRecommendationDialogIndex) return;
  openRecommendationItemDialog(items[nextIndex], nextIndex, direction > 0 ? "next" : "prev");
}

function getRecommendationDialogVisual() {
  return els.todayItemDialogBody?.querySelector(".today-item-dialog-visual") || null;
}

function getRecommendationDialogStage() {
  return els.todayItemDialogBody?.querySelector(".today-item-dialog-stage") || null;
}

function getRecommendationDialogPreview() {
  return els.todayItemDialogBody?.querySelector(".today-item-dialog-preview") || null;
}

function renderRecommendationItemDialogMedia(item, className = "today-item-dialog-photo") {
  if (item?.photo) {
    return `<img class="${className}" src="${escapeHtml(item.photo)}" alt="" draggable="false" />`;
  }
  return `<div class="today-item-dialog-art">${item?.icon || ""}</div>`;
}

function renderRecommendationDeck(entries, weather, imageMatches = {}, slotReasons = {}) {
  if (!entries.length) return "";
  let accessoryIndex = 0;
  const accessoryCount = entries.filter((entry) => compactText(normalizeRecommendationEntry(entry).label, "").toLowerCase() === "accessory").length;
  const collageItems = entries.map((entry, index) => {
    const normalizedEntry = normalizeRecommendationEntry(entry, index);
    const slotKey = String(normalizedEntry.label || "").toLowerCase();
    const art = getRecommendationCardArt(normalizedEntry.label, normalizedEntry.value, imageMatches?.[normalizedEntry.key] || imageMatches?.[slotKey] || null);
    const reason = buildRecommendationItemReason(normalizedEntry.label, normalizedEntry.value, weather, slotReasons?.[normalizedEntry.key] || slotReasons?.[slotKey] || "");
    const positionClass = slotKey === "accessory"
      ? getRecommendationCollagePosition(normalizedEntry.label, accessoryIndex++, accessoryCount)
      : getRecommendationCollagePosition(normalizedEntry.label, index, accessoryCount);
    return {
      index,
      label: normalizedEntry.label,
      value: normalizedEntry.value,
      key: normalizedEntry.key,
      tone: art.tone,
      photo: art.photo,
      icon: art.icon,
      reason,
      positionClass,
      accessoryCount,
    };
  });
  return `
    <div class="today-rec-collage-wrap">
      <div
        class="today-rec-collage"
        aria-label="Recommended outfit collage"
        data-piece-count="${collageItems.length}"
        data-accessory-count="${accessoryCount}"
      >
        <div class="today-rec-collage-silhouette" aria-hidden="true"></div>
        ${collageItems.map((item) => `
          <button
            type="button"
            class="today-rec-collage-item today-rec-collage-item-${escapeHtml(item.tone)} ${escapeHtml(item.positionClass)}"
            data-rec-item-index="${item.index}"
            aria-label="Open ${escapeHtml(item.value)}"
          >
            <span class="today-rec-collage-photo-wrap">
              ${item.photo ? `<img class="today-rec-collage-photo" src="${item.photo}" alt="" draggable="false" />` : `<span class="today-rec-collage-art">${item.icon}</span>`}
            </span>
            <span class="today-rec-collage-chip">${escapeHtml(item.label)}</span>
            <span class="today-rec-collage-name">${escapeHtml(item.value)}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function getRecommendationCollagePosition(label = "", index = 0, accessoryCount = 0) {
  const key = String(label || "").toLowerCase();
  if (key === "outer") return "is-outer";
  if (key === "top") return "is-top";
  if (key === "bottom") return "is-bottom";
  if (key === "shoes") return accessoryCount > 0 ? "is-shoes" : "is-shoes-centered";
  if (index % 3 === 0) return "is-accessory-left";
  if (index % 3 === 1) return "is-accessory-right";
  return "is-accessory-bottom";
}

function getRecommendationDeckTitleSizeClass(value = "") {
  const text = compactText(value, "");
  if (!text) return "";
  if (text.length >= 24) return "today-rec-deck-title-sm";
  if (text.length >= 18) return "today-rec-deck-title-md";
  return "";
}

function initializeRecommendationDeck() {
  return;
}

function renderRecommendationDeckHint(entries) {
  if (!entries.length) return "";
  return `
    <div class="today-rec-deck-hint-wrap" aria-label="Recommendation deck hint">
      <div class="today-rec-deck-hint">
        <span>Tap any piece to inspect it</span>
        <span class="today-rec-deck-hint-count">${entries.length} pieces</span>
      </div>
    </div>
  `;
}

function renderWhyBadgeIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/></svg>`;
}

function renderInfoIcon() {
  return renderInlineIcon("info");
}

function renderTuneIcon() {
  return renderInlineIcon("tune");
}

function getTodayContextChips() {
  const prefs = loadState().prefs || {};
  const chips = [];
  const activityMap = {
    everyday: "Everyday",
    walking: "Walking",
    commute: "Commute",
    errands: "Errands",
    office: "Office",
    workout: "Workout",
    travel: "Travel",
    evening: "Evening",
  };
  const locationMap = {
    indoors: "Mostly indoors",
    mixed: "Mixed day",
    outdoors: "Mostly outdoors",
    transit: "Transit-heavy",
    event: "Event setting",
    exposed: "Exposed outdoors",
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
  const comfortValue = prefs.cold ? "cold" : prefs.hot ? "hot" : "neutral";
  const groups = [
    {
      label: "Comfort",
      key: "comfortBias",
      activeValue: comfortValue,
      options: [
        ["neutral", "Balanced"],
        ["cold", "I’m usually cold"],
        ["hot", "I’m usually hot"],
      ],
    },
    {
      label: "Activity",
      key: "activityContext",
      activeValue: prefs.activityContext || DEFAULT_STATE.prefs.activityContext,
      options: [
        ["everyday", "Everyday"],
        ["walking", "Walking"],
        ["commute", "Commute"],
        ["errands", "Errands"],
        ["office", "Office"],
        ["workout", "Workout"],
        ["travel", "Travel"],
        ["evening", "Evening"],
      ],
    },
    {
      label: "Setting",
      key: "locationContext",
      activeValue: prefs.locationContext || DEFAULT_STATE.prefs.locationContext,
      options: [
        ["indoors", "Indoors"],
        ["mixed", "Mixed"],
        ["outdoors", "Outdoors"],
        ["transit", "Transit"],
        ["event", "Event"],
        ["exposed", "Exposed"],
      ],
    },
    {
      label: "Style",
      key: "styleFocus",
      activeValue: prefs.styleFocus || DEFAULT_STATE.prefs.styleFocus,
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

  const descriptions = {
    Comfort: "Bias the outfit warmer or lighter based on how you usually feel.",
    Activity: "Adjust the look for how much movement your day actually has.",
    Setting: "Tell WearCast whether you’ll stay inside, outside, or in transit.",
    Style: "Shift the overall vibe without changing the weather logic.",
  };

  return `
    <div class="today-control-groups">
      <div class="today-control-intro">
        <span class="today-control-intro-kicker">Today tune</span>
        <strong>Shape the outfit direction before refreshing.</strong>
        <p>These changes apply to today’s recommendation only and keep the weather logic intact.</p>
      </div>
      ${groups.map((group) => `
        <div class="today-control-group">
          <div class="today-control-heading">
            <div>
              <div class="today-control-label">${escapeHtml(group.label)}</div>
              <p class="today-control-help">${escapeHtml(descriptions[group.label] || "")}</p>
            </div>
            <span class="today-control-current">${escapeHtml(group.options.find(([value]) => value === group.activeValue)?.[1] || "")}</span>
          </div>
          <div class="today-chip-row today-chip-row-controls">
            ${group.options.map(([value, label]) => `
              <button
                type="button"
                class="today-chip today-chip-toggle ${group.activeValue === value ? "is-active" : ""}"
                data-rec-pref="${escapeHtml(group.key)}"
                data-rec-value="${escapeHtml(value)}"
              >${escapeHtml(label)}</button>
            `).join("")}
          </div>
        </div>
      `).join("")}
      <button type="button" class="btn-primary-sm today-update-btn" data-rec-action="apply">Refresh today’s look</button>
    </div>
  `;
}

function normalizeRecommendationPrefs(prefs = {}) {
  const normalized = {
    ...prefs,
    bike: ["walking", "commute", "errands", "travel"].includes(prefs.activityContext),
  };
  delete normalized.comfortBias;
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

function buildRecommendationDetails(data, weather, rowEntries = [], slotReasons = {}) {
  const detailsOverview = data?.detailsOverview && typeof data.detailsOverview === "object" && !Array.isArray(data.detailsOverview)
    ? data.detailsOverview
    : {};
  const what = compactText(detailsOverview.what, "");
  const why = compactText(detailsOverview.why, "");
  const note = compactText(detailsOverview.note, "");
  const outfitItems = rowEntries
    .map((entry) => ({
      label: compactText(entry.label, "Item"),
      value: normalizeItemLabel(entry.value),
    }))
    .filter((entry) => entry.value);
  const outfitItemNames = outfitItems
    .map((entry) => entry.value)
    .filter(Boolean);
  const reasoning = compactText(data.reasoning, "");
  const weatherTags = [
    weather?.feelsLike != null ? `Feels ${fmt1(weather.feelsLike, "°C")}` : "",
    compactText(weather?.weatherLabel, ""),
    weather?.wind != null ? `${fmt1(weather.wind, " km/h")} wind` : "",
    weather?.precipProb != null ? `${Math.round(Number(weather.precipProb) || 0)}% rain` : "",
  ].filter(Boolean).slice(0, 4);

  const sections = [];
  sections.push({
    title: "What to wear",
    kicker: `${outfitItems.length || 0} pieces`,
    chips: outfitItems,
    body: what || (
      outfitItemNames.length
        ? `Wear ${formatList(outfitItemNames.map((item) => item.toLowerCase()))}. The combination is meant to work as one balanced look rather than separate pieces.`
        : "Wear a complete outfit that balances coverage, movement, and weather protection."
    ),
  });
  sections.push({
    title: "Weather logic",
    kicker: "Why it works",
    chips: weatherTags.map((value) => ({ label: "", value })),
    body: why || reasoning || (
      weather?.feelsLike != null
        ? `Feels like ${fmt1(weather.feelsLike, "°C")}, so the recommendation balances comfort with enough coverage for the current conditions.`
        : "The recommendation is tuned around the current temperature, sky, wind, and precipitation risk."
    ),
  });

  const practicalNotes = [];
  if (note) practicalNotes.push(note);
  (data.warnings || []).forEach((warning) => {
    const cleaned = compactText(warning, "");
    if (cleaned) practicalNotes.push(cleaned);
  });

  (data.missingItems || []).forEach((item) => {
    const cleaned = compactText(item, "");
    if (cleaned) practicalNotes.push(`Worth adding: ${cleaned}`);
  });

  if (practicalNotes.length) {
    sections.push({
      title: "Keep in mind",
      kicker: "Heads up",
      body: Array.from(new Set(practicalNotes)).slice(0, 2).join(" "),
    });
  }

  return sections.filter((section) => compactText(section.body, ""));
}

function buildRecommendationMeta(weather = {}, outfit = {}) {
  const chips = [];
  const feelsLike = Number(weather.feelsLike ?? weather.temperature);

  const remaining = weather.remainingForecast || null;
  if (remaining) {
    const nextMin = Number(remaining.minApparent ?? remaining.minTemperature);
    const rainLater = Number(remaining.maxPrecipProb ?? 0);
    const windyLater = Number(remaining.maxWind ?? 0);

    if (Number.isFinite(nextMin) && Number.isFinite(feelsLike) && nextMin <= feelsLike - 3) {
      chips.push({ kind: "time", text: "Later gets noticeably colder" });
    } else if (rainLater >= 45) {
      chips.push({ kind: "time", text: "Rain risk builds later" });
    } else if (windyLater >= 24 || normalizeItemLabel(outfit.outer)) {
      chips.push({ kind: "time", text: "Layer-friendly through the day" });
    }
  }

  return chips.slice(0, 2);
}

function renderRecommendationMeta(chips = []) {
  if (!chips.length) return "";
  return `
    <div class="today-rec-meta-chips" aria-label="Recommendation signals">
      ${chips.map((chip) => `<span class="today-rec-meta-chip today-rec-meta-chip-${escapeHtml(chip.kind || "default")}">${escapeHtml(chip.text || "")}</span>`).join("")}
    </div>
  `;
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
  if (items && !Array.isArray(items) && typeof items === "object") {
    items = Object.values(items).filter(Boolean);
  }
  const normalizedItems = (items || [])
    .map((item) => {
      if (item && typeof item === "object") {
        const chips = Array.isArray(item.chips)
          ? item.chips
              .map((chip) => {
                if (chip && typeof chip === "object") {
                  return {
                    label: compactText(chip.label, ""),
                    value: compactText(chip.value, ""),
                  };
                }
                return { label: "", value: compactText(chip, "") };
              })
              .filter((chip) => chip.value)
          : [];
        return {
          title: compactText(item.title, ""),
          kicker: compactText(item.kicker, ""),
          body: compactText(item.body, ""),
          chips,
        };
      }
      return {
        title: "",
        kicker: "",
        body: compactText(item, ""),
        chips: [],
      };
    })
    .filter((item) => item.body);
  return `
    <div class="today-details-overview">
      <div class="today-details-overview-icon" aria-hidden="true">${renderInlineIcon("info")}</div>
      <div>
        <strong>Quick read</strong>
        <span>What to wear, why it works, and what to keep in mind.</span>
      </div>
    </div>
    <div class="today-why-list today-details-list">
      ${normalizedItems.map((item) => `
        <div class="today-why-item today-details-item">
          <span class="today-why-badge" aria-hidden="true">${renderWhyBadgeIcon()}</span>
          <div class="today-why-copy">
            <div class="today-details-title-row">
              ${item.title ? `<strong>${escapeHtml(item.title)}</strong>` : ""}
              ${item.kicker ? `<span>${escapeHtml(item.kicker)}</span>` : ""}
            </div>
            ${item.chips?.length ? `
              <div class="today-details-mini-chips">
                ${item.chips.map((chip) => `
                  <span class="today-details-mini-chip">
                    ${chip.label ? `<small>${escapeHtml(chip.label)}</small>` : ""}
                    ${escapeHtml(chip.value)}
                  </span>
                `).join("")}
              </div>
            ` : ""}
            <div class="today-why-text">${escapeHtml(item.body)}</div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function openWhyWorksDialog(items) {
  if (!els.whyWorksDialogBody || !els.whyWorksDialog) return;
  els.whyWorksDialogBody.innerHTML = renderWhyItems(items || []);
  if (typeof els.whyWorksDialog.showModal === "function") els.whyWorksDialog.showModal();
}

function openRecommendationItemDialog(item, index = null, transitionDirection = "") {
  if (!els.todayItemDialog || !els.todayItemDialogBody || !item) return;
  const weather = lastWeatherForAI || {};
  const detailRows = buildRecommendationItemDialogDetails(item, weather);
  const dialogItems = getRecommendationDialogItems();
  const resolvedIndex = Number.isInteger(index)
    ? index
    : Math.max(0, dialogItems.findIndex((entry) => entry?.value === item?.value && entry?.label === item?.label));
  activeRecommendationDialogIndex = resolvedIndex;
  const hasPrev = resolvedIndex > 0;
  const hasNext = resolvedIndex >= 0 && resolvedIndex < dialogItems.length - 1;
  const initialPreviewIndex = hasNext ? resolvedIndex + 1 : hasPrev ? resolvedIndex - 1 : -1;
  const initialPreviewItem = initialPreviewIndex >= 0 ? dialogItems[initialPreviewIndex] : null;
  const visualClass = item.photo ? "today-item-dialog-visual has-photo" : "today-item-dialog-visual has-art";
  els.todayItemDialogBody.innerHTML = `
    <div class="${visualClass} ${transitionDirection ? `is-entering-from-${transitionDirection}` : ""}" data-dialog-index="${resolvedIndex}">
      <div class="today-item-dialog-preview ${initialPreviewItem ? "is-visible" : ""}" data-preview-index="${initialPreviewIndex >= 0 ? initialPreviewIndex : ""}">
        ${initialPreviewItem ? renderRecommendationItemDialogMedia(initialPreviewItem, "today-item-dialog-photo today-item-dialog-photo-preview") : ""}
      </div>
      <div class="today-item-dialog-stage">
        ${renderRecommendationItemDialogMedia(item)}
        <div class="today-item-dialog-overlay"></div>
        ${dialogItems.length > 1 ? `
          <button type="button" class="today-item-dialog-nav-hint today-item-dialog-nav-hint-left ${hasPrev ? "" : "is-disabled"}" data-rec-dialog-nav="prev" aria-label="Show previous item" ${hasPrev ? "" : "disabled"}><span></span></button>
          <button type="button" class="today-item-dialog-nav-hint today-item-dialog-nav-hint-right ${hasNext ? "" : "is-disabled"}" data-rec-dialog-nav="next" aria-label="Show next item" ${hasNext ? "" : "disabled"}><span></span></button>
          <div class="today-item-dialog-indicators" aria-hidden="true">
            ${dialogItems.map((_, dotIndex) => `<span class="today-item-dialog-indicator ${dotIndex === resolvedIndex ? "is-active" : ""}"></span>`).join("")}
          </div>
        ` : ""}
        <div class="today-item-dialog-title-block">
          <span class="today-cta-kicker today-item-dialog-kicker">${escapeHtml(item.label || "Item")}</span>
          <h2 id="todayItemDialogTitle" class="dialog-title">${escapeHtml(item.value || "Recommendation item")}</h2>
        </div>
        <div class="today-item-dialog-info-block">
          ${item.reason ? `
            <div class="today-item-dialog-info-section">
              <span class="today-item-dialog-block-kicker">Why it works</span>
              <p>${escapeHtml(item.reason || "")}</p>
            </div>
          ` : ""}
          ${detailRows.length ? `
            <div class="today-item-dialog-info-section">
              <span class="today-item-dialog-block-kicker">Details</span>
              <div class="today-item-dialog-detail-grid">
                ${detailRows.map((row) => `
                  <div class="today-item-dialog-detail-row">
                    <small>${escapeHtml(row.label)}</small>
                    <strong>${escapeHtml(row.value)}</strong>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : ""}
        </div>
      </div>
    </div>
  `;
  const visual = els.todayItemDialogBody.firstElementChild;
  if (visual && transitionDirection) {
    window.requestAnimationFrame(() => {
      visual.classList.add("is-animating");
    });
    window.setTimeout(() => {
      visual.classList.remove("is-entering-from-next", "is-entering-from-prev", "is-animating");
    }, 280);
  }
  if (typeof els.todayItemDialog.showModal === "function") els.todayItemDialog.showModal();
}

function openTuneLookDialog() {
  if (!els.tuneLookDialog || !els.tuneLookDialogBody) return;
  els.tuneLookDialogBody.innerHTML = renderRecommendationControls();
  if (typeof els.tuneLookDialog.showModal === "function") els.tuneLookDialog.showModal();
}

function showAppToast(message, tone = "info") {
  const existing = document.querySelector(".app-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = `app-toast app-toast-${tone}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add("is-visible"), 20);
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 220);
  }, 1800);
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
    setEmptyStateLoading(false);

    // AI recommendation (non-blocking)
    fetchAIRecommendation(data, current, ctx);

    const updated = new Date(data.current.time || Date.now());
    els.updatedAt.textContent = `Updated ${updated.toLocaleString()}`;

    setStatus(`Using: ${loc.name}`);
    saveState({ lastLocation: loc });
  } catch (err) {
    console.error(err);
    setEmptyStateLoading(false);
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
  url.searchParams.set("addressdetails", "1");

  const res = await fetchWithTimeout(
    url.toString(),
    { headers: { "Accept": "application/json" } },
    8000
  );
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
  const data = await res.json();
  const name = data?.display_name
    ? formatCityLevelLocation(data.display_name, data.address)
    : `Lat ${lat.toFixed(3)}, Lon ${lon.toFixed(3)}`;
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
  renderSettingsDataUI();
}

function bindSettingsUI() {
  els.settingsAccountBtn?.addEventListener("click", showAuthDialog);
  els.settingsDeleteAccountBtn?.addEventListener("click", () => els.authDeleteBtn?.click());
  els.settingsPrivacyBtn?.addEventListener("click", () => {
    setSettingsFeedback("");
    showConsentDialog({ forceModal: true, source: "settings" });
  });
  els.settingsClearLocationBtn?.addEventListener("click", async () => {
    setSettingsActionBusy(els.settingsClearLocationBtn, true);
    try {
      const state = loadState();
      if (!state.lastLocation && !els.placeInput?.value.trim()) {
        setSettingsFeedback("There isn’t a saved location to clear right now.", "info");
        return;
      }

      saveState({ lastQuery: "", lastLocation: null });
      if (els.placeInput) els.placeInput.value = "";
      resetTodayLocationState();
      setStatus("");
      setSettingsFeedback(
        canUseFunctionalStorage()
          ? "Saved location cleared from this device."
          : "Current location cleared for this session.",
        "success"
      );
    } finally {
      setSettingsActionBusy(els.settingsClearLocationBtn, false);
    }
  });
  els.settingsResetPrefsBtn?.addEventListener("click", async () => {
    setSettingsActionBusy(els.settingsResetPrefsBtn, true);
    try {
      const state = loadState();
      const alreadyDefault = areRecommendationPrefsDefault(state.prefs) && !pendingRecommendationPrefs;
      const nextPrefs = structuredClone(DEFAULT_STATE.prefs);
      pendingRecommendationPrefs = null;
      saveState({ prefs: nextPrefs });
      syncPreferenceInputs(nextPrefs);

      if (state.lastLocation) {
        setSettingsFeedback("Resetting outfit tuning and refreshing your recommendation…", "busy", { persist: true });
        await runForLocation(state.lastLocation);
      }

      setSettingsFeedback(
        alreadyDefault
          ? "Outfit tuning is already using the default settings."
          : "Outfit tuning reset to defaults.",
        "success"
      );
    } catch (err) {
      setSettingsFeedback(`Could not reset outfit tuning: ${err.message}`, "error", { persist: true });
    } finally {
      setSettingsActionBusy(els.settingsResetPrefsBtn, false);
    }
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
  if (isNative) return;
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
    setSettingsFeedback("");
    showConsentDialog({ forceModal: true, source: "settings" });
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
    const source = consentDialogSource;
    saveConsent({ seen: true, functionalStorage: false, deviceLocation: false });
    closeConsentDialog();
    renderWardrobe();
    if (source === "settings") {
      setSettingsFeedback(`Privacy choices saved. ${summarizeConsentSettings()}`, "success");
    }
  });

  els.consentAccept?.addEventListener("click", (e) => {
    e.preventDefault();
    const source = consentDialogSource;
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
    renderWardrobe();

    if (source === "settings") {
      setSettingsFeedback(`Privacy choices saved. ${summarizeConsentSettings()}`, "success");
    }

    // Auto-trigger geolocation after consent if location was granted and no saved location
    if (!!els.consentLocation?.checked) {
      const st = loadState();
      if (!st.lastLocation) onUseMyLocation();
    }
  });
}

function bindPullToRefresh() {
  const container = document.getElementById("tabToday");
  if (!container) return;

  const DEAD_ZONE = 72;
  const TRIGGER_DISTANCE = 176;
  const MAX_VISUAL_OFFSET = 72;
  const HORIZONTAL_CANCEL_RATIO = 1.15;
  let gesture = null;
  let refreshing = false;

  const isBlockedTarget = (target) => target?.closest?.(
    "input, textarea, select, option, [contenteditable='true'], .location-input-wrap, .today-chip-toggle"
  );

  const resetPullState = () => {
    gesture = null;
    container.classList.remove("is-pulling");
    container.style.removeProperty("--pull-progress");
    container.style.removeProperty("--pull-offset");
  };

  const triggerRefresh = async () => {
    if (refreshing) return;
    refreshing = true;
    container.classList.remove("is-pulling");
    container.classList.add("is-refreshing");
    try {
      els.refreshBtn?.click();
    } finally {
      window.setTimeout(() => {
        refreshing = false;
        container.classList.remove("is-refreshing");
        container.style.removeProperty("--pull-progress");
        container.style.removeProperty("--pull-offset");
      }, 900);
    }
  };

  container.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1 || refreshing) return;
    if (!container.classList.contains("active")) return;
    if (isBlockedTarget(event.target)) return;
    if (container.scrollTop > 0) return;

    const touch = event.touches[0];
    gesture = {
      startX: touch.clientX,
      startY: touch.clientY,
      pullDistance: 0,
      cancelled: false,
      visible: false,
    };
  }, { passive: true });

  container.addEventListener("touchmove", (event) => {
    if (!gesture || refreshing || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const moveY = touch.clientY - gesture.startY;
    const moveX = touch.clientX - gesture.startX;

    if (gesture.cancelled || moveY <= 0 || container.scrollTop > 0) {
      resetPullState();
      return;
    }

    if (Math.abs(moveX) > Math.max(18, moveY * HORIZONTAL_CANCEL_RATIO)) {
      gesture.cancelled = true;
      resetPullState();
      return;
    }

    if (moveY < DEAD_ZONE) return;

    gesture.visible = true;
    gesture.pullDistance = moveY;
    const effectivePull = moveY - DEAD_ZONE;
    const progress = Math.min(effectivePull / (TRIGGER_DISTANCE - DEAD_ZONE), 1);
    const offset = Math.min(MAX_VISUAL_OFFSET, Math.round(effectivePull * 0.42));
    container.classList.add("is-pulling");
    container.style.setProperty("--pull-progress", `${progress}`);
    container.style.setProperty("--pull-offset", `${offset}px`);
  }, { passive: true });

  container.addEventListener("touchend", async () => {
    if (!gesture) return;
    const shouldRefresh = gesture.visible && gesture.pullDistance >= TRIGGER_DISTANCE && container.scrollTop <= 0;
    resetPullState();
    if (shouldRefresh) {
      await triggerRefresh();
    }
  }, { passive: true });

  container.addEventListener("touchcancel", resetPullState, { passive: true });
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
  const res = await authFetch(`${API_BASE}/api/wardrobe`);
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
      await authFetch(`${API_BASE}/api/wardrobe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
    } catch {}
  }
  // Clear local wardrobe after sync
  localStorage.removeItem(WARDROBE_KEY);
}

function typeEmoji(type) {
  return renderInlineIcon(itemTypeIconKey(type), "wardrobe-type-icon");
}

function getWardrobeCategory(item = {}) {
  const key = `${item.type || ""} ${item.name || ""}`.toLowerCase();
  if (/(jacket|coat|hoodie|blazer|vest|outer|parka|windbreaker)/.test(key)) return "jackets";
  if (/(jeans|pants|trousers|chinos|shorts|leggings|skirt|bottom)/.test(key)) return "pants";
  if (/(shirt|t-shirt|tee|polo|sweater|tank|top|blouse)/.test(key)) return "shirts";
  if (/(shoe|sneaker|boot|sandal|loafer)/.test(key)) return "shoes";
  if (/(scarf|hat|beanie|glove|sunglasses|belt|bag|watch|cap|sock|accessor)/.test(key)) return "accessories";
  return "other";
}

function getWardrobeCategoryLabel(category) {
  return {
    all: "All",
    shirts: "Shirts",
    pants: "Pants",
    jackets: "Jackets",
    shoes: "Shoes",
    accessories: "Accessories",
    other: "Other",
  }[category] || "Other";
}

function normalizeFilterValue(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getFilteredWardrobeItems(items = []) {
  const filtered = items.filter((item) => {
    if (wardrobeFilterState.favoritesOnly && !item.favorite) return false;
    if (wardrobeFilterState.category !== "all" && getWardrobeCategory(item) !== wardrobeFilterState.category) return false;
    if (wardrobeFilterState.color !== "all" && normalizeFilterValue(item.color) !== wardrobeFilterState.color) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime() || 0;
    const bTime = new Date(b.createdAt || 0).getTime() || 0;
    return wardrobeFilterState.sort === "oldest" ? aTime - bTime : bTime - aTime;
  });
}

function renderWardrobeFilters(items = []) {
  if (!els.wardrobeFilters) return;
  if (!items.length) {
    els.wardrobeFilters.innerHTML = "";
    return;
  }

  const categoryCounts = items.reduce((acc, item) => {
    const category = getWardrobeCategory(item);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, { all: items.length });
  const categories = ["all", "shirts", "pants", "jackets", "shoes", "accessories", "other"]
    .filter((category) => category === "all" || categoryCounts[category]);
  const colors = [...new Set(items.map((item) => normalizeFilterValue(item.color)).filter(Boolean))].sort();

  els.wardrobeFilters.innerHTML = `
    <div class="wardrobe-filter-row">
      <label class="wardrobe-filter-select">
        <span>Category</span>
        <select data-wardrobe-filter="category">
          ${categories.map((category) => `<option value="${escapeHtml(category)}" ${wardrobeFilterState.category === category ? "selected" : ""}>${escapeHtml(getWardrobeCategoryLabel(category))} (${categoryCounts[category] || 0})</option>`).join("")}
        </select>
      </label>
      <label class="wardrobe-filter-select">
        <span>Color</span>
        <select data-wardrobe-filter="color">
          <option value="all">All colors</option>
          ${colors.map((color) => `<option value="${escapeHtml(color)}" ${wardrobeFilterState.color === color ? "selected" : ""}>${escapeHtml(color.charAt(0).toUpperCase() + color.slice(1))}</option>`).join("")}
        </select>
      </label>
      <label class="wardrobe-filter-select">
        <span>Date</span>
        <select data-wardrobe-filter="sort">
          <option value="newest" ${wardrobeFilterState.sort === "newest" ? "selected" : ""}>Newest first</option>
          <option value="oldest" ${wardrobeFilterState.sort === "oldest" ? "selected" : ""}>Oldest first</option>
        </select>
      </label>
      <button type="button" class="wardrobe-filter-chip wardrobe-favorite-filter ${wardrobeFilterState.favoritesOnly ? "is-active" : ""}" data-wardrobe-favorites="toggle">
        <span aria-hidden="true">★</span> Favorites
      </button>
    </div>
  `;
}

async function renderWardrobe() {
  const items = await loadWardrobeAsync();
  const visibleItems = getFilteredWardrobeItems(items);
  els.wardrobeList.innerHTML = "";
  els.wardrobeEmpty.style.display = items.length ? "none" : "flex";
  if (els.addItemBtn) els.addItemBtn.style.display = items.length ? "inline-flex" : "none";
  if (els.wardrobeExplainer) els.wardrobeExplainer.style.display = items.length ? "" : "none";
  updateWardrobeCtas(items);
  syncTodayWardrobeDialog(items);
  renderWardrobeFilters(items);

  if (items.length && !visibleItems.length) {
    els.wardrobeList.innerHTML = `
      <div class="wardrobe-filter-empty">
        <strong>No items match these filters.</strong>
        <span>Try another category, color, or turn off Favorites.</span>
      </div>
    `;
    return;
  }

  visibleItems.forEach((item) => {
    const div = document.createElement("div");
    div.className = "wardrobe-item";
    div.setAttribute("data-id", item.id);

    const photoHtml = item.photoDataUrl
      ? `<img class="wardrobe-item-photo" src="${escapeHtml(item.photoDataUrl)}" alt="" />`
      : `<div class="wardrobe-item-placeholder" aria-hidden="true">${typeEmoji(item.type)}</div>`;

    const meta = [item.type, item.color, item.material].filter(Boolean).join(" · ");
    div.innerHTML = `
      <button type="button" class="wardrobe-favorite-btn ${item.favorite ? "is-active" : ""}" data-wardrobe-favorite="${escapeHtml(String(item.id))}" aria-label="${item.favorite ? "Remove from favorites" : "Add to favorites"}">★</button>
      ${photoHtml}
      <div class="wardrobe-item-info">
        <div class="wardrobe-item-name">${escapeHtml(item.name)}</div>
        <div class="wardrobe-item-meta">${escapeHtml(meta)}</div>
      </div>
    `;
    div.addEventListener("click", () => openItemDialog(item));
    els.wardrobeList.appendChild(div);
  });
}

async function toggleWardrobeFavorite(itemId) {
  const items = await loadWardrobeAsync();
  const item = items.find((entry) => String(entry.id) === String(itemId));
  if (!item) return;
  const nextItem = { ...item, favorite: !item.favorite };

  if (isLoggedIn()) {
    try {
      const res = await authFetch(`${API_BASE}/api/wardrobe/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextItem),
      });
      const saved = await res.json().catch(() => ({}));
      if (res.status === 401) return;
      if (!res.ok) throw new Error(saved.error || "Could not update favorite");
      saveWardrobe(items.map((entry) => String(entry.id) === String(item.id) ? saved : entry));
    } catch (err) {
      console.error("favorite toggle error:", err);
      alert(err.message || "Could not update favorite.");
      return;
    }
  } else {
    const nextItems = items.map((entry) => String(entry.id) === String(item.id) ? nextItem : entry);
    saveWardrobeLocal(nextItems);
  }

  await renderWardrobe();
}

function syncTodayWardrobeDialog(items) {
  const emptyWardrobe = !Array.isArray(items) || items.length === 0;
  if (els.todayWardrobeInlineCta) {
    els.todayWardrobeInlineCta.style.display = emptyWardrobe ? "grid" : "none";
  }
  if (els.todayWardrobeDialog?.open) els.todayWardrobeDialog.close();
}

function updateWardrobeCtas(items) {
  const count = Array.isArray(items) ? items.length : 0;
  const categories = new Set((items || []).map((item) => getWardrobeCategory(item)).filter((category) => ["shirts", "pants", "jackets"].includes(category)));
  const starterProgress = `${categories.size} of 3 starter groups`;
  const starterHtml = `
    <span class="starter-pill ${categories.has("shirts") ? "is-complete" : ""}">Shirts</span>
    <span class="starter-pill ${categories.has("pants") ? "is-complete" : ""}">Pants</span>
    <span class="starter-pill ${categories.has("jackets") ? "is-complete" : ""}">Jackets</span>
  `;

  if (els.todayWardrobeInlineProgress) {
    els.todayWardrobeInlineProgress.innerHTML = `
      <span class="starter-progress-label">${starterProgress}</span>
      <div class="starter-pill-row">${starterHtml}</div>
    `;
  }
  if (els.wardrobeExplainerProgress) {
    els.wardrobeExplainerProgress.innerHTML = `
      <span class="starter-progress-label">${starterProgress}</span>
      <div class="starter-pill-row">${starterHtml}</div>
    `;
  }

  if (count === 0) {
    if (els.todayCtaKicker) els.todayCtaKicker.textContent = "Level up";
    if (els.todayCtaTitle) els.todayCtaTitle.textContent = "Build your closet to unlock sharper outfit picks.";
    if (els.todayWardrobeCtaBtn) els.todayWardrobeCtaBtn.textContent = "Add wardrobe";
    if (els.wardrobeExplainerKicker) els.wardrobeExplainerKicker.textContent = "Get personalized fast";
    if (els.wardrobeExplainerTitle) els.wardrobeExplainerTitle.textContent = "Your wardrobe powers smarter outfit picks";
    if (els.wardrobeExplainerText) els.wardrobeExplainerText.textContent = "Add photos or care tags once, then WearCast can recommend pieces you actually own instead of generic outfits.";
    return;
  }

  if (count < 4) {
    if (els.todayCtaKicker) els.todayCtaKicker.textContent = "Nice start";
    if (els.todayCtaTitle) els.todayCtaTitle.textContent = "A few more pieces will make today’s picks feel much more you.";
    if (els.todayWardrobeCtaBtn) els.todayWardrobeCtaBtn.textContent = "Add more";
    if (els.wardrobeExplainerKicker) els.wardrobeExplainerKicker.textContent = "Keep going";
    if (els.wardrobeExplainerTitle) els.wardrobeExplainerTitle.textContent = "Add some more items to your wardrobe to get better suggestions.";
    if (els.wardrobeExplainerText) els.wardrobeExplainerText.textContent = `You have ${count} item${count === 1 ? "" : "s"} in your wardrobe. Build out the starter mix for stronger outfit picks.`;
    return;
  }

  if (els.todayCtaKicker) els.todayCtaKicker.textContent = "Looking good";
  if (els.todayCtaTitle) els.todayCtaTitle.textContent = "Your closet is shaping up. Keep it fresh with one more standout piece.";
  if (els.todayWardrobeCtaBtn) els.todayWardrobeCtaBtn.textContent = "Keep building";
  if (els.wardrobeExplainerKicker) els.wardrobeExplainerKicker.textContent = "Strong foundation";
  if (els.wardrobeExplainerTitle) els.wardrobeExplainerTitle.textContent = `Your ${count}-item wardrobe is already helping`;
  if (els.wardrobeExplainerText) els.wardrobeExplainerText.textContent = "WearCast can now make more specific recommendations from what you own. Add new pieces anytime to keep the suggestions sharp.";
}

let editingItemId = null;
let pendingPhotoDataUrl = null;
let isSavingItem = false;
let isReadingItemPhoto = false;
let isReadingScanPhoto = false;
let isAnalyzingItemPhoto = false;
const wardrobeFilterState = {
  category: "all",
  color: "all",
  sort: "newest",
  favoritesOnly: false,
};

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

function setItemPhotoStatus(message = "", busy = false, tone = "") {
  if (!els.itemPhotoStatus) return;
  els.itemPhotoStatus.textContent = message;
  els.itemPhotoStatus.classList.toggle("is-busy", !!busy);
  els.itemPhotoStatus.dataset.tone = tone;
}

function setItemFormError(message = "") {
  if (!els.itemFormStatus) return;
  els.itemFormStatus.textContent = message;
  els.itemFormStatus.style.display = message ? "block" : "none";
}

function setFieldError(input, errorEl, message = "") {
  if (errorEl) errorEl.textContent = message;
  if (input) {
    input.classList.toggle("is-invalid", !!message);
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }
}

function clearItemValidationErrors() {
  setFieldError(els.itemType, els.itemTypeError, "");
  setFieldError(els.itemName, els.itemNameError, "");
  setItemFormError("");
}

function setItemMoreDetailsOpen(open) {
  const moreDetails = document.querySelector(".item-more-details");
  if (!moreDetails) return;
  if (open) moreDetails.setAttribute("open", "open");
  else moreDetails.removeAttribute("open");
}

function revealItemManualDetails({ focus = false } = {}) {
  els.itemManualDetails?.setAttribute("open", "open");
  if (!focus) return;
  window.setTimeout(() => {
    if (!els.itemType?.value) els.itemType?.focus?.();
    else els.itemName?.focus?.();
  }, 60);
}

function validateItemForm() {
  clearItemValidationErrors();
  const type = els.itemType.value.trim();
  const name = els.itemName.value.trim();
  const errors = [];

  if (!type) {
    setFieldError(els.itemType, els.itemTypeError, "Choose the item type.");
    errors.push(els.itemType);
  }
  if (!name) {
    setFieldError(els.itemName, els.itemNameError, "Enter a short item name.");
    errors.push(els.itemName);
  }

  if (errors.length) {
    revealItemManualDetails();
    setItemFormError("Add the required details before saving this item.");
    errors[0]?.focus?.();
    return false;
  }

  return true;
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
  if (els.itemVisualEmoji) els.itemVisualEmoji.innerHTML = typeEmoji(type || "Other");
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

function normalizeCareInstructionsInput(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]+/)
      : [];
  return values.map((item) => compactText(item, "")).filter(Boolean);
}

function applyItemPhotoPrefill(data) {
  if (!data || data.error) return false;
  let applied = false;
  if (data.type && !els.itemType.value) els.itemType.value = data.type;
  if (data.type) applied = true;
  if (data.name && !els.itemName.value.trim()) {
    els.itemName.value = data.name;
    applied = true;
  }
  if (data.color && !els.itemColor.value.trim()) {
    els.itemColor.value = data.color;
    applied = true;
  }
  if (data.material && !els.itemMaterial.value.trim()) {
    els.itemMaterial.value = data.material;
    applied = true;
  }
  const careInstructions = normalizeCareInstructionsInput(data.careInstructions);
  if (careInstructions.length && !els.itemCare.value.trim()) {
    els.itemCare.value = careInstructions.join(", ");
    applied = true;
  }
  if (data.color || data.material || careInstructions.length) {
    setItemMoreDetailsOpen(true);
  }
  if (data.type || data.name || data.color || data.material || careInstructions.length) {
    revealItemManualDetails();
  }
  return applied;
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
  clearItemValidationErrors();
  setItemMoreDetailsOpen(false);

  if (item) {
    els.itemDialogTitle = $("itemDialogTitle");
    if (els.itemDialogTitle) els.itemDialogTitle.textContent = "Edit Clothing Item";
    els.itemType.value = item.type || "";
    els.itemName.value = item.name || "";
    els.itemColor.value = item.color || "";
    els.itemMaterial.value = item.material || "";
    els.itemCare.value = (item.careInstructions || []).join(", ");
    setItemMoreDetailsOpen(!!(item.color || item.material || item.careInstructions?.length));
    if (item.photoDataUrl) {
      pendingPhotoDataUrl = item.photoDataUrl;
      els.itemPhotoImg.src = item.photoDataUrl;
    }
    els.itemDeleteBtn.style.display = "inline-flex";
    revealItemManualDetails();
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
  if (!validateItemForm()) return;
  const type = els.itemType.value.trim();
  const name = els.itemName.value.trim();

  const careRaw = els.itemCare.value.trim();
  const careInstructions = careRaw ? careRaw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : [];
  const existingItems = editingItemId ? await loadWardrobeAsync() : [];
  const existingItem = editingItemId
    ? existingItems.find((item) => String(item.id) === String(editingItemId))
    : null;

  const itemData = {
    type, name,
    color: els.itemColor.value.trim() || null,
    material: els.itemMaterial.value.trim() || null,
    careInstructions,
    photoDataUrl: pendingPhotoDataUrl || null,
    favorite: !!existingItem?.favorite,
  };

  if (await hasDuplicateWardrobeItem(itemData, editingItemId)) {
    els.itemManualDetails?.setAttribute("open", "open");
    setItemFormError("This item already exists in your wardrobe. Edit the existing item or change the name/details.");
    return;
  }

  isSavingItem = true;
  updateItemSaveState();

  try {
    if (isLoggedIn()) {
      let savedItem = null;
      if (editingItemId) {
        const res = await authFetch(`${API_BASE}/api/wardrobe/${editingItemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemData),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) return;
        if (!res.ok) throw new Error(data.error || "Could not update wardrobe item");
        savedItem = data;
      } else {
        const res = await authFetch(`${API_BASE}/api/wardrobe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemData),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) return;
        if (!res.ok) throw new Error(data.error || "Could not save wardrobe item");
        savedItem = data;
      }
      const currentItems = Array.isArray(_wardrobeCache) ? [..._wardrobeCache] : await loadWardrobeAsync();
      const nextItems = editingItemId
        ? currentItems.map((item) => String(item.id) === String(editingItemId) ? savedItem : item)
        : [savedItem, ...currentItems];
      saveWardrobe(nextItems);
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
    els.itemManualDetails?.setAttribute("open", "open");
    setItemFormError(err.message || "Could not save that item. Check the details and try again.");
  } finally {
    isSavingItem = false;
    updateItemSaveState();
  }
}

async function deleteItem() {
  if (!editingItemId) return;

  if (isLoggedIn()) {
    try {
      await authFetch(`${API_BASE}/api/wardrobe/${editingItemId}`, {
        method: "DELETE",
        headers: {},
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

async function optimizeImageDataUrl(file, { maxEdge = 1600, quality = 0.82 } = {}) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to process image"));
    img.src = sourceDataUrl;
  });

  const longestEdge = Math.max(image.width, image.height) || 1;
  const scale = Math.min(1, maxEdge / longestEdge);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceDataUrl;
  ctx.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

function bindWardrobeUI() {
  els.addItemBtn?.addEventListener("click", () => openItemDialog());
  els.itemManualToggleBtn?.addEventListener("click", () => revealItemManualDetails({ focus: true }));
  els.wardrobeFilters?.addEventListener("click", async (event) => {
    const favoritesButton = event.target.closest("[data-wardrobe-favorites]");
    if (favoritesButton) {
      wardrobeFilterState.favoritesOnly = !wardrobeFilterState.favoritesOnly;
      await renderWardrobe();
    }
  });
  els.wardrobeFilters?.addEventListener("change", async (event) => {
    const filter = event.target?.dataset?.wardrobeFilter;
    if (filter === "category") {
      wardrobeFilterState.category = event.target.value || "all";
      await renderWardrobe();
    }
    if (filter === "color") {
      wardrobeFilterState.color = event.target.value || "all";
      await renderWardrobe();
    }
    if (filter === "sort") {
      wardrobeFilterState.sort = event.target.value || "newest";
      await renderWardrobe();
    }
  });
  els.wardrobeList?.addEventListener("click", async (event) => {
    const favoriteButton = event.target.closest("[data-wardrobe-favorite]");
    if (!favoriteButton) return;
    event.preventDefault();
    event.stopPropagation();
    await toggleWardrobeFavorite(favoriteButton.dataset.wardrobeFavorite);
  }, true);
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
      pendingPhotoDataUrl = await optimizeImageDataUrl(file);
      els.itemPhotoImg.src = pendingPhotoDataUrl;
      updateItemVisual();
      isAnalyzingItemPhoto = true;
      updateItemSaveState();
      setItemPhotoStatus("Looking at the clothing photo…", true);
      const analysis = await analyzeItemPhoto(pendingPhotoDataUrl);
      const appliedPrefill = applyItemPhotoPrefill(analysis);
      updateItemVisual();
      if (appliedPrefill && els.itemType.value.trim() && els.itemName.value.trim()) {
        setItemPhotoStatus("Details prefilled from your photo.", false, "success");
        clearItemValidationErrors();
      } else {
        revealItemManualDetails();
        setItemPhotoStatus("Photo added. Add type and name below to save it.", false, "warning");
      }
    } catch (err) {
      console.error("item photo error:", err);
      revealItemManualDetails();
      setItemPhotoStatus("Photo added. Add type and name below to save it.", false, "warning");
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
  els.itemType?.addEventListener("change", () => {
    if (els.itemType.value.trim()) setFieldError(els.itemType, els.itemTypeError, "");
    if (els.itemType.value.trim() && els.itemName.value.trim()) setItemFormError("");
  });
  els.itemName?.addEventListener("input", () => {
    if (els.itemName.value.trim()) setFieldError(els.itemName, els.itemNameError, "");
    if (els.itemType.value.trim() && els.itemName.value.trim()) setItemFormError("");
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
      scanImageDataUrl = await optimizeImageDataUrl(file, { maxEdge: 1400, quality: 0.8 });
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
const RECOMMENDATION_DECK_HINT_KEY = "wearcastRecommendationDeckHintSeen";

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function hasRecommendationCardContent() {
  const content = els.aiRecContent;
  return !!(content && content.children.length && content.textContent.trim());
}

async function animateRecommendationRefreshOut() {
  const section = els.aiRecSection;
  const content = els.aiRecContent;
  if (!section || !content) return;

  section.classList.add("is-refreshing");
  if (!hasRecommendationCardContent()) return;

  const currentHeight = Math.max(content.offsetHeight || 0, content.scrollHeight || 0);
  if (!currentHeight) return;

  content.classList.remove("is-expanding");
  content.style.height = `${currentHeight}px`;
  content.style.overflow = "hidden";

  requestAnimationFrame(() => {
    content.classList.add("is-collapsing");
    content.style.height = `${Math.max(156, Math.round(currentHeight * 0.9))}px`;
  });

  await wait(240);
}

function animateRecommendationRefreshIn() {
  const section = els.aiRecSection;
  const content = els.aiRecContent;
  if (!section || !content) return;

  const currentHeight = Math.max(parseFloat(content.style.height) || 0, 112);
  const nextHeight = Math.max(content.scrollHeight || 0, 112);

  content.classList.remove("is-collapsing");
  content.classList.add("is-expanding");
  content.style.overflow = "hidden";
  content.style.height = `${currentHeight}px`;

  requestAnimationFrame(() => {
    content.style.height = `${nextHeight}px`;
  });

  window.setTimeout(() => {
    content.classList.remove("is-expanding");
    content.style.removeProperty("height");
    content.style.removeProperty("overflow");
    section.classList.remove("is-refreshing");
    if (els.aiRecLoading) els.aiRecLoading.style.display = "none";
  }, 360);
}

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

  const hasExistingRecommendation = hasRecommendationCardContent();
  els.aiRecSection.style.display = "";
  els.aiRecWarnings.innerHTML = "";
  els.aiRecMissing.innerHTML = "";
  if (!hasExistingRecommendation) {
    els.aiRecSection.classList.add("is-loading-first");
    els.aiRecContent.innerHTML = `
      <div class="recommendation-first-load">
        <div class="rec-skeleton-hero">
          <div class="rec-skeleton-summary">
            <span class="rec-skeleton-icon"></span>
            <div class="rec-skeleton-lines">
              <span class="rec-skeleton-line rec-skeleton-line-title"></span>
              <span class="rec-skeleton-line"></span>
              <span class="rec-skeleton-line rec-skeleton-line-short"></span>
            </div>
          </div>
          <div class="rec-skeleton-meta">
            <span class="rec-skeleton-pill"></span>
            <span class="rec-skeleton-pill rec-skeleton-pill-short"></span>
          </div>
        </div>
        <div class="rec-skeleton-card"></div>
        <div class="rec-skeleton-actions">
          <span class="rec-skeleton-action"></span>
          <span class="rec-skeleton-action"></span>
          <span class="rec-skeleton-action rec-skeleton-action-accent"></span>
        </div>
        <div class="rec-skeleton-caption">Styling your day from weather and wardrobe context…</div>
      </div>
    `;
  }
  await animateRecommendationRefreshOut();
  if (hasExistingRecommendation && els.aiRecLoading) els.aiRecLoading.style.display = "flex";

  const recommendationController = new AbortController();
  const recommendationTimeoutId = window.setTimeout(() => recommendationController.abort(), 28000);

  try {
    const res = await fetch(`${API_BASE}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: recommendationController.signal,
      body: JSON.stringify({ weather, wardrobe, preferences, location }),
    });
    const data = await res.json();
    if (data.error) {
      renderAIRecommendation(buildClientFallbackRecommendation(weather, data.error || "AI service returned an error"));
      return;
    }
    renderAIRecommendation(data);
  } catch (err) {
    const reason = err?.name === "AbortError"
      ? "AI took too long to respond"
      : "AI service could not be reached";
    renderAIRecommendation(buildClientFallbackRecommendation(weather, reason));
  } finally {
    window.clearTimeout(recommendationTimeoutId);
    els.aiRecSection?.classList.remove("is-loading-first");
    if (!els.aiRecSection.classList.contains("is-refreshing") && els.aiRecLoading) {
      els.aiRecLoading.style.display = "none";
    }
  }
}

function renderAIRecommendation(data) {
  pendingRecommendationPrefs = null;
  els.aiRecSection?.classList.remove("is-loading-first");
  const outfit = data.outfit || {};
  const weather = lastWeatherForAI || {};
  const headline = buildOutfitHeadline(outfit);
  const aiSubtitle = shortenRecommendationSubtitle(data.reasoning);
  const subtitle = isGenericRecommendationSubtitle(aiSubtitle)
    ? buildLocalRecommendationSubtitle(weather)
    : aiSubtitle;
  const chips = getTodayContextChips();
  const imageMatches = data.outfitImages || {};
  const slotReasons = data.slotReasons || {};
  const accessories = Array.isArray(outfit.accessories)
    ? outfit.accessories.map(preserveUsefulItemLabel).filter(Boolean)
    : [preserveUsefulItemLabel(outfit.accessories)].filter(Boolean);
  const rowEntries = [
    { label: "Top", value: preserveUsefulItemLabel(outfit.top), key: "top" },
    { label: "Bottom", value: preserveUsefulItemLabel(outfit.bottom), key: "bottom" },
    { label: "Outer", value: preserveUsefulItemLabel(outfit.outer), key: "outer" },
    { label: "Shoes", value: preserveUsefulItemLabel(outfit.shoes), key: "shoes" },
    ...accessories.map((value, index) => ({
      label: "Accessory",
      value,
      key: `accessory-${index}`,
    })),
  ].filter((entry) => entry.value);
  const wardrobePhotoMatches = buildWardrobePhotoMatches(rowEntries, loadWardrobe());
  const detailsItems = buildRecommendationDetails(data, weather, rowEntries, slotReasons);
  const metaChips = buildRecommendationMeta(weather, outfit);
  const collageItems = rowEntries.map((entry, index) => {
    const slotKey = String(entry.label || "").toLowerCase();
    const imageMatch = { ...imageMatches, ...wardrobePhotoMatches }[entry.key] || { ...imageMatches, ...wardrobePhotoMatches }[slotKey] || null;
    const art = getRecommendationCardArt(entry.label, entry.value, imageMatch);
    return {
      label: entry.label,
      value: entry.value,
      reason: buildRecommendationItemReason(entry.label, entry.value, weather, slotReasons?.[entry.key] || slotReasons?.[slotKey] || ""),
      photo: art.photo,
      icon: art.icon,
      tone: art.tone,
      wardrobeDetails: imageMatch?.source === "wardrobe" ? imageMatch : null,
    };
  });

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
            ${renderRecommendationMeta(metaChips)}
          </div>
        </div>
        ${renderRecommendationWeatherStrip(weather)}
      </div>
      ${rowEntries.length ? renderRecommendationDeckHint(rowEntries) : ""}
      ${rowEntries.length ? renderRecommendationDeck(rowEntries, weather, { ...imageMatches, ...wardrobePhotoMatches }, slotReasons) : ""}
      <div class="today-feedback-panel" aria-label="Refine recommendation">
        <div class="today-feedback-copy">
          <span class="today-feedback-kicker">Make it better</span>
          <strong>Tap items to inspect, then tune the look</strong>
        </div>
        <div class="today-feedback-actions">
          <button type="button" class="today-feedback-chip" data-rec-feedback="too_cold">${renderInlineIcon("cold")} Too cold</button>
          <button type="button" class="today-feedback-chip" data-rec-feedback="too_warm">${renderInlineIcon("hot")} Too warm</button>
          <button type="button" class="today-feedback-chip today-feedback-chip-tune" data-rec-action="tune">${renderTuneIcon()} Tune</button>
        </div>
        <div class="today-secondary-actions">
          ${detailsItems.length ? `<button type="button" class="today-details-button today-details-button-wide" data-rec-action="why">View details</button>` : ""}
        </div>
      </div>
    </div>
  `;
  els.aiRecContent.dataset.whyItems = JSON.stringify(detailsItems);
  els.aiRecContent.dataset.collageItems = JSON.stringify(collageItems);
  els.aiRecWarnings.innerHTML = "";
  els.aiRecMissing.innerHTML = "";
  initializeRecommendationDeck();
  animateRecommendationRefreshIn();
}

function bindRecommendationControls() {
  const applyRecommendationFeedback = async (feedback, sourceButton = null) => {
    const latestState = loadState();
    const basePrefs = latestState.prefs || {};
    let nextPrefs = { ...basePrefs };

    if (feedback === "too_cold") {
      nextPrefs = { ...nextPrefs, cold: true, hot: false };
    } else if (feedback === "too_warm") {
      nextPrefs = { ...nextPrefs, cold: false, hot: true };
    }

    saveState({ prefs: nextPrefs });
    pendingRecommendationPrefs = null;
    syncPreferenceInputs(nextPrefs);
    sourceButton?.classList.add("is-active");
    if (latestState.lastLocation) {
      await runForLocation(latestState.lastLocation);
    }
  };
  window.handleRecommendationSwipeFeedback = null;

  const handleRecommendationControlInteraction = async (event) => {
    const itemButton = event.target.closest("[data-rec-item-index]");
    if (itemButton) {
      try {
        const items = JSON.parse(els.aiRecContent?.dataset?.collageItems || "[]");
        const itemIndex = Number(itemButton.dataset.recItemIndex || -1);
        const item = items[itemIndex];
        if (item) openRecommendationItemDialog(item, itemIndex);
      } catch {}
      return;
    }

    const feedbackButton = event.target.closest("[data-rec-feedback]");
    if (feedbackButton) {
      await applyRecommendationFeedback(feedbackButton.dataset.recFeedback, feedbackButton);
      return;
    }

    const actionButton = event.target.closest("[data-rec-action='apply']");
    if (actionButton) {
      const latestState = loadState();
      const nextPrefs = normalizeRecommendationPrefs(pendingRecommendationPrefs || latestState.prefs);
      pendingRecommendationPrefs = null;
      saveState({ prefs: nextPrefs });
      syncPreferenceInputs(nextPrefs);
      if (typeof els.tuneLookDialog?.close === "function") els.tuneLookDialog.close();
      if (latestState.lastLocation) {
        await runForLocation(latestState.lastLocation);
      }
      return;
    }

    const whyButton = event.target.closest("[data-rec-action='why']");
    if (whyButton) {
      let whyItems = [];
      try {
        whyItems = JSON.parse(els.aiRecContent?.dataset?.whyItems || "[]");
      } catch {}
      openWhyWorksDialog(whyItems);
      return;
    }

    const tuneButton = event.target.closest("[data-rec-action='tune']");
    if (tuneButton) {
      openTuneLookDialog();
      return;
    }

    const chipButton = event.target.closest("[data-rec-pref]");
    if (!chipButton) return;

    const key = chipButton.dataset.recPref;
    const value = chipButton.dataset.recValue;
    if (!key || !value) return;

    const basePrefs = pendingRecommendationPrefs || loadState().prefs;
    if (key === "comfortBias") {
      pendingRecommendationPrefs = {
        ...basePrefs,
        cold: value === "cold",
        hot: value === "hot",
      };
    } else {
      pendingRecommendationPrefs = {
        ...basePrefs,
        [key]: value,
      };
    }

    const allButtons = document.querySelectorAll(`#aiRecContent [data-rec-pref="${key}"], #tuneLookDialogBody [data-rec-pref="${key}"]`);
    allButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.recValue === value);
    });
  };

  els.aiRecContent?.addEventListener("click", handleRecommendationControlInteraction);
  els.tuneLookDialogBody?.addEventListener("click", handleRecommendationControlInteraction);
  els.todayItemDialogCloseBtn?.addEventListener("click", () => {
    if (els.todayItemDialog?.open) els.todayItemDialog.close();
  });
  els.todayItemDialog?.addEventListener("click", (event) => {
    if (event.target === els.todayItemDialog && els.todayItemDialog.open) {
      els.todayItemDialog.close();
    }
  });
  els.todayItemDialogBody?.addEventListener("touchstart", (event) => {
    if (!els.todayItemDialog?.open || event.touches.length !== 1) return;
    recommendationDialogTouchStartX = event.touches[0].clientX;
    recommendationDialogTouchDeltaX = 0;
    recommendationDialogSwipeActive = true;
  }, { passive: true });
  els.todayItemDialogBody?.addEventListener("touchmove", (event) => {
    if (!els.todayItemDialog?.open || event.touches.length !== 1) return;
    recommendationDialogTouchDeltaX = event.touches[0].clientX - recommendationDialogTouchStartX;
    const visual = getRecommendationDialogVisual();
    const stage = getRecommendationDialogStage();
    const preview = getRecommendationDialogPreview();
    if (!visual || !stage || !preview) return;
    const items = getRecommendationDialogItems();
    const width = Math.max(visual.clientWidth || 1, 1);
    const progress = Math.max(-1, Math.min(1, recommendationDialogTouchDeltaX / width));
    const direction = recommendationDialogTouchDeltaX < 0 ? 1 : recommendationDialogTouchDeltaX > 0 ? -1 : 0;
    const previewIndex = direction === 1
      ? activeRecommendationDialogIndex + 1
      : direction === -1
        ? activeRecommendationDialogIndex - 1
        : -1;
    const previewItem = previewIndex >= 0 && previewIndex < items.length ? items[previewIndex] : null;
    if (previewItem) {
      const currentPreviewIndex = Number(preview.dataset.previewIndex || -1);
      if (currentPreviewIndex !== previewIndex) {
        preview.innerHTML = renderRecommendationItemDialogMedia(previewItem, "today-item-dialog-photo today-item-dialog-photo-preview");
        preview.dataset.previewIndex = String(previewIndex);
      }
      preview.classList.add("is-visible");
      preview.style.transition = "none";
      preview.style.opacity = `${0.5 + Math.abs(progress) * 0.5}`;
      preview.style.transform = `translateX(${direction === 1 ? width * 0.18 + recommendationDialogTouchDeltaX * 0.18 : -width * 0.18 + recommendationDialogTouchDeltaX * 0.18}px) scale(${0.98 + Math.abs(progress) * 0.02})`;
    } else {
      preview.classList.remove("is-visible");
      preview.innerHTML = "";
      preview.dataset.previewIndex = "";
      preview.style.removeProperty("transform");
      preview.style.removeProperty("opacity");
    }
    stage.style.transition = "none";
    stage.style.transform = `translateX(${recommendationDialogTouchDeltaX}px) scale(${1 - Math.abs(progress) * 0.03})`;
    stage.style.opacity = `${1 - Math.abs(progress) * 0.18}`;
  }, { passive: true });
  els.todayItemDialogBody?.addEventListener("touchend", () => {
    if (!els.todayItemDialog?.open) return;
    const stage = getRecommendationDialogStage();
    const preview = getRecommendationDialogPreview();
    const threshold = 44;
    if (recommendationDialogTouchDeltaX <= -threshold) {
      recommendationDialogSwipeActive = false;
      if (stage) {
        stage.style.removeProperty("transition");
        stage.style.removeProperty("transform");
        stage.style.removeProperty("opacity");
      }
      if (preview) {
        preview.style.removeProperty("transition");
        preview.style.removeProperty("transform");
        preview.style.removeProperty("opacity");
      }
      stepRecommendationItemDialog(1);
    } else if (recommendationDialogTouchDeltaX >= threshold) {
      recommendationDialogSwipeActive = false;
      if (stage) {
        stage.style.removeProperty("transition");
        stage.style.removeProperty("transform");
        stage.style.removeProperty("opacity");
      }
      if (preview) {
        preview.style.removeProperty("transition");
        preview.style.removeProperty("transform");
        preview.style.removeProperty("opacity");
      }
      stepRecommendationItemDialog(-1);
    } else if (stage) {
      stage.style.transition = "transform .24s cubic-bezier(.22, 1, .36, 1), opacity .24s cubic-bezier(.22, 1, .36, 1)";
      stage.style.transform = "translateX(0) scale(1)";
      stage.style.opacity = "1";
      if (preview) {
        preview.style.transition = "transform .24s cubic-bezier(.22, 1, .36, 1), opacity .24s cubic-bezier(.22, 1, .36, 1)";
        preview.style.transform = "translateX(0) scale(.98)";
        preview.style.opacity = "0";
      }
      window.setTimeout(() => {
        stage.style.removeProperty("transition");
        stage.style.removeProperty("transform");
        stage.style.removeProperty("opacity");
        if (preview) {
          preview.classList.remove("is-visible");
          preview.innerHTML = "";
          preview.dataset.previewIndex = "";
          preview.style.removeProperty("transition");
          preview.style.removeProperty("transform");
          preview.style.removeProperty("opacity");
        }
      }, 240);
    }
    recommendationDialogTouchStartX = 0;
    recommendationDialogTouchDeltaX = 0;
    recommendationDialogSwipeActive = false;
  });
  els.todayItemDialogBody?.addEventListener("touchcancel", () => {
    const stage = getRecommendationDialogStage();
    const preview = getRecommendationDialogPreview();
    if (stage) {
      stage.style.transition = "transform .24s cubic-bezier(.22, 1, .36, 1), opacity .24s cubic-bezier(.22, 1, .36, 1)";
      stage.style.transform = "translateX(0) scale(1)";
      stage.style.opacity = "1";
      if (preview) {
        preview.style.transition = "transform .24s cubic-bezier(.22, 1, .36, 1), opacity .24s cubic-bezier(.22, 1, .36, 1)";
        preview.style.transform = "translateX(0) scale(.98)";
        preview.style.opacity = "0";
      }
      window.setTimeout(() => {
        stage.style.removeProperty("transition");
        stage.style.removeProperty("transform");
        stage.style.removeProperty("opacity");
        if (preview) {
          preview.classList.remove("is-visible");
          preview.innerHTML = "";
          preview.dataset.previewIndex = "";
          preview.style.removeProperty("transition");
          preview.style.removeProperty("transform");
          preview.style.removeProperty("opacity");
        }
      }, 240);
    }
    recommendationDialogTouchStartX = 0;
    recommendationDialogTouchDeltaX = 0;
    recommendationDialogSwipeActive = false;
  });
  els.todayItemDialogBody?.addEventListener("click", (event) => {
    const navButton = event.target.closest("[data-rec-dialog-nav]");
    if (!navButton) return;
    const direction = navButton.dataset.recDialogNav === "next" ? 1 : -1;
    stepRecommendationItemDialog(direction);
  });
  els.todayItemDialog?.addEventListener("close", () => {
    activeRecommendationDialogIndex = -1;
    recommendationDialogTouchStartX = 0;
    recommendationDialogTouchDeltaX = 0;
    recommendationDialogSwipeActive = false;
  });
}

// ─── Tab navigation ──────────────────────────────────────────
function getActiveTabId() {
  return document.querySelector(".tab-page.active")?.id || TAB_ORDER[0];
}

let tabTransitionTimeoutId = null;
let tabGestureStartTabId = "";

function syncTabIndicators(tabId) {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  document.querySelectorAll(".nav-swipe-dot").forEach((dot, index) => {
    dot.classList.toggle("active", TAB_ORDER[index] === tabId);
  });
}

function clearTabGestureStyles() {
  document.querySelectorAll(".tab-page").forEach((page) => {
    page.classList.remove("tab-enter-from-right", "tab-enter-from-left", "tab-exit-to-left", "tab-exit-to-right", "tab-swipe-active");
    page.style.removeProperty("transform");
    page.style.removeProperty("transition");
  });
}

function switchTab(tabId, options = {}) {
  const currentTabId = getActiveTabId();
  if (tabId === currentTabId) {
    syncTabIndicators(tabId);
    return;
  }

  const direction = Number(options.direction || 0);
  const currentPage = document.getElementById(currentTabId);
  const nextPage = document.getElementById(tabId);
  if (!nextPage) return;

  if (tabTransitionTimeoutId) {
    window.clearTimeout(tabTransitionTimeoutId);
    tabTransitionTimeoutId = null;
  }

  clearTabGestureStyles();

  syncTabIndicators(tabId);

  if (!currentPage || direction === 0) {
    document.querySelectorAll(".tab-page").forEach((page) => page.classList.remove("active"));
    nextPage.classList.add("active");
    return;
  }

  nextPage.classList.add("active", direction > 0 ? "tab-enter-from-right" : "tab-enter-from-left");
  currentPage.classList.add(direction > 0 ? "tab-exit-to-left" : "tab-exit-to-right");

  tabTransitionTimeoutId = window.setTimeout(() => {
    currentPage.classList.remove("active", "tab-exit-to-left", "tab-exit-to-right");
    nextPage.classList.remove("tab-enter-from-right", "tab-enter-from-left");
    tabTransitionTimeoutId = null;
  }, 250);
}

function bindIOSSwipeTabs() {
  if (!isNative || !isIOS()) return;

  const container = document.querySelector("main");
  if (!container) return;

  const SWIPE_MIN_X = 72;
  const SWIPE_MAX_Y = 42;
  const AXIS_LOCK_THRESHOLD = 14;
  let tracking = false;
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let deltaY = 0;
  let axisLocked = "";
  let currentPage = null;
  let adjacentPage = null;
  let adjacentTabId = "";

  const shouldIgnoreSwipe = (target) => {
    if (!(target instanceof Element)) return true;
    return !!target.closest(
      [
        "dialog[open]",
        "input",
        "textarea",
        "select",
        "a",
        "label",
        "summary",
        "[contenteditable='true']",
        "[data-rec-pref]",
        "[data-rec-action]",
        ".today-rec-deck-wrap",
        ".today-rec-deck",
        ".today-rec-deck-card",
        ".today-rec-deck-copy",
        ".today-rec-deck-media",
        ".today-chip-row-controls",
        ".ac-dropdown",
        ".location-input-wrap",
        "#geoBtn",
        "#searchBtn",
        "#userBtn",
        "#addItemBtn",
        "#todayWardrobeCtaBtn",
        ".wardrobe-item",
        ".nav-item",
      ].join(", ")
    );
  };

  const prepareAdjacentPage = (direction) => {
    const currentTabId = tabGestureStartTabId || getActiveTabId();
    const currentIndex = TAB_ORDER.indexOf(currentTabId);
    if (currentIndex === -1) return false;
    adjacentTabId = TAB_ORDER[currentIndex + direction] || "";
    currentPage = document.getElementById(currentTabId);
    adjacentPage = adjacentTabId ? document.getElementById(adjacentTabId) : null;
    if (!currentPage || !adjacentPage) return false;

    clearTabGestureStyles();
    currentPage.classList.add("active", "tab-swipe-active");
    adjacentPage.classList.add("active", "tab-swipe-active");
    currentPage.style.transition = "none";
    adjacentPage.style.transition = "none";
    adjacentPage.style.transform = `translateX(${direction * container.clientWidth}px)`;
    return true;
  };

  const settleSwipe = (commit, direction) => {
    if (!currentPage) return;

    const width = container.clientWidth;
    const finalCurrent = commit ? -direction * width : 0;
    const finalAdjacent = commit ? 0 : direction * width;

    [currentPage, adjacentPage].forEach((page) => {
      if (!page) return;
      page.style.transition = "transform 240ms ease";
    });

    currentPage.style.transform = `translateX(${finalCurrent}px)`;
    if (adjacentPage) {
      adjacentPage.style.transform = `translateX(${finalAdjacent}px)`;
    }

    window.setTimeout(() => {
      if (commit && adjacentPage && adjacentTabId) {
        document.querySelectorAll(".tab-page").forEach((page) => page.classList.remove("active"));
        adjacentPage.classList.add("active");
        syncTabIndicators(adjacentTabId);
      } else if (currentPage) {
        document.querySelectorAll(".tab-page").forEach((page) => page.classList.remove("active"));
        currentPage.classList.add("active");
        syncTabIndicators(currentPage.id);
      }
      clearTabGestureStyles();
      currentPage = null;
      adjacentPage = null;
      adjacentTabId = "";
      tabGestureStartTabId = "";
    }, 250);
  };

  container.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) {
      tracking = false;
      return;
    }

    if (document.querySelector("dialog[open]")) {
      tracking = false;
      return;
    }

    const target = event.target;
    if (shouldIgnoreSwipe(target)) {
      tracking = false;
      return;
    }

    const activePage = document.querySelector(".tab-page.active");
    if (!activePage || !activePage.contains(target)) {
      tracking = false;
      return;
    }

    tracking = true;
    tabGestureStartTabId = activePage.id;
    axisLocked = "";
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    deltaX = 0;
    deltaY = 0;
    currentPage = null;
    adjacentPage = null;
    adjacentTabId = "";
  }, { passive: true });

  container.addEventListener("touchmove", (event) => {
    if (!tracking || event.touches.length !== 1) return;

    deltaX = event.touches[0].clientX - startX;
    deltaY = event.touches[0].clientY - startY;

    if (!axisLocked) {
      if (Math.abs(deltaX) > Math.abs(deltaY) + AXIS_LOCK_THRESHOLD) {
        axisLocked = "x";
      } else if (Math.abs(deltaY) > Math.abs(deltaX) + AXIS_LOCK_THRESHOLD) {
        axisLocked = "y";
      }
    }

    if (axisLocked === "x") {
      const direction = deltaX < 0 ? 1 : -1;
      if (!adjacentPage && !prepareAdjacentPage(direction)) {
        return;
      }
      const width = container.clientWidth;
      const clampedDeltaX = Math.max(-width, Math.min(width, deltaX));
      currentPage.style.transform = `translateX(${clampedDeltaX}px)`;
      if (adjacentPage) {
        adjacentPage.style.transform = `translateX(${direction * width + clampedDeltaX}px)`;
      }
      event.preventDefault();
    }
  }, { passive: false });

  container.addEventListener("touchend", () => {
    if (!tracking) return;

    const currentTabId = tabGestureStartTabId || getActiveTabId();
    const currentIndex = TAB_ORDER.indexOf(currentTabId);
    tracking = false;

    if (axisLocked !== "x") {
      clearTabGestureStyles();
      tabGestureStartTabId = "";
      return;
    }
    if (Math.abs(deltaY) > SWIPE_MAX_Y || !adjacentPage) {
      settleSwipe(false, deltaX < 0 ? 1 : -1);
      return;
    }

    const direction = deltaX < 0 ? 1 : -1;
    const nextTabId = TAB_ORDER[currentIndex + direction];
    settleSwipe(!!nextTabId && Math.abs(deltaX) >= SWIPE_MIN_X, direction);
  }, { passive: true });

  container.addEventListener("touchcancel", () => {
    tracking = false;
    axisLocked = "";
    settleSwipe(false, deltaX < 0 ? 1 : -1);
  }, { passive: true });
}

function bindTabNav() {
  els.bottomNav?.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const currentIndex = Math.max(0, TAB_ORDER.indexOf(getActiveTabId()));
      const nextIndex = TAB_ORDER.indexOf(btn.dataset.tab);
      const direction = nextIndex > currentIndex ? 1 : nextIndex < currentIndex ? -1 : 0;
      switchTab(btn.dataset.tab, { direction });
    });
  });
  els.todayWardrobeCtaBtn?.addEventListener("click", () => {
    if (els.todayWardrobeDialog?.open) els.todayWardrobeDialog.close();
    switchTab("tabWardrobe", { direction: 1 });
  });
  els.todayWardrobeInlineBtn?.addEventListener("click", () => {
    switchTab("tabWardrobe", { direction: 1 });
    window.setTimeout(() => openItemDialog(), 240);
  });

  els.whyWorksDialogCloseBtn?.addEventListener("click", () => {
    if (els.whyWorksDialog?.open) els.whyWorksDialog.close();
  });
  els.tuneLookDialogCloseBtn?.addEventListener("click", () => {
    if (els.tuneLookDialog?.open) els.tuneLookDialog.close();
  });
}

// ─── Auto-geolocation (silent, no prompt) ────────────────────
async function tryAutoGeo() {
  if (!navigator.geolocation) return;
  try {
    setEmptyStateLoading(true, "Looking up your location and loading today’s weather…");
    setStatus("Detecting location…");
    const pos = await getGeo(); // uses maximumAge:5min, won't prompt if already granted
    const loc = await resolveLocationFromCoords(pos.coords.latitude, pos.coords.longitude);
    els.placeInput.value = loc.name;
    saveState({ lastQuery: "", lastLocation: loc });
    await runForLocation(loc);
  } catch {
    setEmptyStateLoading(false);
    // Permission not granted yet or blocked — just show a nudge
    setStatus("Tap the location button or search for a city to get started.");
  }
}

// ─── Autocomplete with country flags ─────────────────────────
function countryFlag(code) {
  const label = String(code || "").slice(0, 2).toUpperCase();
  return `
    <span class="country-badge-icon" aria-hidden="true">${renderInlineIcon("globe")}</span>
    ${label ? `<span class="country-badge-code">${escapeHtml(label)}</span>` : ""}
  `;
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
    const short = formatCityLevelLocation(r.display_name, r.address);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-item";
    btn.innerHTML = `<span class="ac-flag">${flag}</span><span class="ac-text">${short}</span>`;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      els.placeInput.value = short;
      hideAC();
      const loc = { name: short, lat: Number(r.lat), lon: Number(r.lon) };
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
  els.userBtn.addEventListener("click", showUserMenu);
  els.userMenuCloseBtn?.addEventListener("click", () => els.userMenuDialog?.close());
  els.userMenuAccountBtn?.addEventListener("click", () => {
    els.userMenuDialog?.close();
    showAuthDialog();
  });
  els.userMenuSettingsBtn?.addEventListener("click", () => {
    els.userMenuDialog?.close();
    switchTab("tabPrefs", { direction: 0 });
  });
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
      await finalizeAuthSuccess(data.token, data.user, data.refreshToken);
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

  els.authLogoutBtn.addEventListener("click", async () => {
    if (authToken) {
      try {
        await authFetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: authRefreshToken }),
        }, { retryOnAuth: false });
      } catch {}
    }
    setAuth(null, null, null);
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
      const res = await authFetch(`${API_BASE}/api/auth/account`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: els.deleteAccountPassword.value,
          confirmText: els.deleteAccountConfirmText.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete account");
      setAuth(null, null, null);
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
      finalizeAuthSuccess(e.data.token, e.data.user, e.data.refreshToken).catch((err) => {
        alert(`Login failed: ${err.message}`);
      });
    }
  });
}

function showUserMenu() {
  if (!els.userMenuDialog) {
    showAuthDialog();
    return;
  }
  if (typeof els.userMenuDialog.showModal === "function") els.userMenuDialog.showModal();
}

// Handle Google OAuth code in URL (web flow)
window.addEventListener('DOMContentLoaded', async () => {
  await handleGoogleAuthRedirect(window.location.href, { clearBrowserUrl: true });
});

function init() {
  configureNativeViewport();
  disableNativeDoubleTapZoom();
  bindTabNav();
  bindIOSSwipeTabs();
  bindPullToRefresh();
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
    els.placeInput.value = formatCityLevelLocation(st.lastLocation.name);
    runForLocation(st.lastLocation);
  } else if (consent.seen) {
    // No saved location — silently try cached/granted geolocation (no prompt)
    tryAutoGeo();
  }
  // If consent not yet seen, auto-geo triggers after consent accept (see bindConsentUI)

  registerSW();
}

init();
