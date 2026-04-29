// Google OAuth Client IDs
const GOOGLE_CLIENT_ID_WEB = "263164817169-ft9s72dno3i766j00dtvogaj8bmckec5.apps.googleusercontent.com";

// Google OAuth Redirect URIs
const GOOGLE_REDIRECT_IOS = "https://wearcast.fly.dev/oauth2redirect/google";
const GOOGLE_REDIRECT_WEB = "https://wearcast.fly.dev/api/auth/google/callback";

// Detect if running in Capacitor (native app)
const isNative = typeof window.Capacitor !== "undefined" && !!window.Capacitor.isNativePlatform;
const nativePlugins = window.Capacitor?.Plugins || {};
const runtimeConfig = window.WEARCAST_RUNTIME_CONFIG || {};
const APP_VERSION = runtimeConfig.sentryRelease || "wearcast-local";
const subscriptionsPlugin = typeof window.Capacitor?.registerPlugin === "function"
  ? window.Capacitor.registerPlugin("Subscriptions")
  : null;

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
  tabToday: $("tabToday"),
  placeInput: $("placeInput"),
  placeStatus: $("placeStatus"),
  geoBtn: $("geoBtn"),
  searchBtn: $("searchBtn"),
  refreshBtn: $("refreshBtn"),
  pullRefreshIndicator: $("pullRefreshIndicator"),
  onboardingOverlay: $("onboardingOverlay"),
  onboardingProgressBar: $("onboardingProgressBar"),
  onboardingSkipBtn: $("onboardingSkipBtn"),
  onboardingPrevBtn: $("onboardingPrevBtn"),
  onboardingNextBtn: $("onboardingNextBtn"),
  onboardingUseLocationBtn: $("onboardingUseLocationBtn"),
  onboardingSearchBtn: $("onboardingSearchBtn"),
  onboardingSkipFinalBtn: $("onboardingSkipFinalBtn"),

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
  weatherHeroHeadline: $("weatherHeroHeadline"),
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
  wardrobeSubtitle: $("wardrobeSubtitle"),
  wardrobeSearchWrap: $("wardrobeSearchWrap"),
  wardrobeSearchInput: $("wardrobeSearchInput"),
  itemDialog: $("itemDialog"),
  itemDialogTitle: $("itemDialogTitle"),
  itemForm: $("itemForm"),
  itemType: $("itemType"),
  itemName: $("itemName"),
  itemNameError: $("itemNameError"),
  itemColor: $("itemColor"),
  itemMaterial: $("itemMaterial"),
  itemCare: $("itemCare"),
  itemEditColor: $("itemEditColor"),
  itemEditMaterial: $("itemEditMaterial"),
  itemEditCare: $("itemEditCare"),
  itemTypeError: $("itemTypeError"),
  itemFormStatus: $("itemFormStatus"),
  itemPhoto: $("itemPhoto"),
  itemGalleryPhotos: $("itemGalleryPhotos"),
  itemPhotoPreview: $("itemPhotoPreview"),
  itemPhotoImg: $("itemPhotoImg"),
  itemPhotoStatus: $("itemPhotoStatus"),
  itemPhotoLabel: $("itemPhotoLabel"),
  itemQueueSummary: $("itemQueueSummary"),
  itemBatchReview: $("itemBatchReview"),
  itemBatchTitle: $("itemBatchTitle"),
  itemBatchSummary: $("itemBatchSummary"),
  itemBatchStats: $("itemBatchStats"),
  itemBatchList: $("itemBatchList"),
  itemBatchListDots: $("itemBatchListDots"),
  itemBatchKeepToggleBtn: $("itemBatchKeepToggleBtn"),
  itemRejectedResults: $("itemRejectedResults"),
  itemRejectedTitle: $("itemRejectedTitle"),
  itemRejectedList: $("itemRejectedList"),
  itemRejectedListDots: $("itemRejectedListDots"),
  itemScanningSubtitle: $("itemScanningSubtitle"),
  itemScanningStatusPrimary: $("itemScanningStatusPrimary"),
  itemScanningStatusSecondary: $("itemScanningStatusSecondary"),
  itemScanningThumbs: $("itemScanningThumbs"),
  itemBatchEditDialog: $("itemBatchEditDialog"),
  itemBatchEditPhoto: $("itemBatchEditPhoto"),
  itemBatchEditPhotoPlaceholder: $("itemBatchEditPhotoPlaceholder"),
  itemBatchEditTitle: $("itemBatchEditTitle"),
  itemBatchEditMeta: $("itemBatchEditMeta"),
  itemBatchEditType: $("itemBatchEditType"),
  itemBatchEditName: $("itemBatchEditName"),
  itemBatchEditColor: $("itemBatchEditColor"),
  itemBatchEditMaterial: $("itemBatchEditMaterial"),
  itemBatchEditCare: $("itemBatchEditCare"),
  itemBatchEditFavorite: $("itemBatchEditFavorite"),
  itemBatchEditStatus: $("itemBatchEditStatus"),
  itemBatchEditRemoveBtn: $("itemBatchEditRemoveBtn"),
  itemBatchEditSaveBtn: $("itemBatchEditSaveBtn"),
  itemBatchEditCloseBtn: $("itemBatchEditCloseBtn"),
  itemBatchEditWrongCategoryBtn: $("itemBatchEditWrongCategoryBtn"),
  itemBatchEditNotItemBtn: $("itemBatchEditNotItemBtn"),
  itemBatchEditCropBtn: $("itemBatchEditCropBtn"),
  itemBatchEditUseAnywayBtn: $("itemBatchEditUseAnywayBtn"),
  itemRejectedDialog: $("itemRejectedDialog"),
  itemRejectedDialogPhoto: $("itemRejectedDialogPhoto"),
  itemRejectedDialogTitle: $("itemRejectedDialogTitle"),
  itemRejectedDialogMessage: $("itemRejectedDialogMessage"),
  itemRejectedDialogFullBtn: $("itemRejectedDialogFullBtn"),
  itemRejectedDialogCropBtn: $("itemRejectedDialogCropBtn"),
  itemRejectedDialogSkipBtn: $("itemRejectedDialogSkipBtn"),
  itemRejectedDialogCloseBtn: $("itemRejectedDialogCloseBtn"),
  itemCropDialog: $("itemCropDialog"),
  itemCropCloseBtn: $("itemCropCloseBtn"),
  itemCropDialogTitle: $("itemCropDialogTitle"),
  itemCropDialogSubtitle: $("itemCropDialogSubtitle"),
  itemCropStage: $("itemCropStage"),
  itemCropImage: $("itemCropImage"),
  itemCropSelection: $("itemCropSelection"),
  itemCropHandle: $("itemCropHandle"),
  itemCropStatus: $("itemCropStatus"),
  itemCropResetBtn: $("itemCropResetBtn"),
  itemCropApplyBtn: $("itemCropApplyBtn"),
  itemManualToggleBtn: $("itemManualToggleBtn"),
  itemVisualPlaceholder: $("itemVisualPlaceholder"),
  itemVisualEmoji: $("itemVisualEmoji"),
  itemVisualName: $("itemVisualName"),
  itemVisualMeta: $("itemVisualMeta"),
  itemManualDetails: $("itemManualDetails"),
  removePhotoBtn: $("removePhotoBtn"),
  recropPhotoBtn: $("recropPhotoBtn"),
  itemBackBtn: $("itemBackBtn"),
  itemFlowKicker: $("itemFlowKicker"),
  itemFlowAssist: $("itemFlowAssist"),
  itemSaveBtn: $("itemSaveBtn"),
  itemNextPhotoBtn: $("itemNextPhotoBtn"),
  itemEditDetailsBtn: $("itemEditDetailsBtn"),
  itemCancelBtn: $("itemCancelBtn"),
  itemDeleteBtn: $("itemDeleteBtn"),
  deleteItemConfirmDialog: $("deleteItemConfirmDialog"),
  deleteItemConfirmBtn: $("deleteItemConfirmBtn"),
  deleteItemCancelBtn: $("deleteItemCancelBtn"),
  scanTagBtn: $("scanTagBtn"),
  itemEditScanTagBtn: $("itemEditScanTagBtn"),
  itemFavorite: $("itemFavorite"),
  itemEditFavorite: $("itemEditFavorite"),
  itemConfirmDetailsPanel: $("itemConfirmDetailsPanel"),

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
  aiRecAdjustBtn: $("aiRecAdjustBtn"),
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
  tuneLookDialogKicker: $("tuneLookDialogKicker"),
  tuneLookDialogTitle: $("tuneLookDialogTitle"),
  tuneLookDialogSubtitle: $("tuneLookDialogSubtitle"),

  // Fashion notes
  fashionNotes: $("fashionNotes"),
  settingsAccountTitle: $("settingsAccountTitle"),
  settingsAccountStatus: $("settingsAccountStatus"),
  settingsAccountBtn: $("settingsAccountBtn"),
  settingsUpgradeBtn: $("settingsUpgradeBtn"),
  settingsUpgradeStatus: $("settingsUpgradeStatus"),
  settingsRestorePurchasesBtn: $("settingsRestorePurchasesBtn"),
  settingsManageSubscriptionBtn: $("settingsManageSubscriptionBtn"),
  settingsDeleteAccountBtn: $("settingsDeleteAccountBtn"),
  settingsSupportBtn: $("settingsSupportBtn"),
  settingsPrivacyBtn: $("settingsPrivacyBtn"),
  settingsPrivacyStatus: $("settingsPrivacyStatus"),
  settingsClearLocationBtn: $("settingsClearLocationBtn"),
  settingsClearLocationStatus: $("settingsClearLocationStatus"),
  settingsResetPrefsBtn: $("settingsResetPrefsBtn"),
  settingsResetPrefsStatus: $("settingsResetPrefsStatus"),
  settingsSavedLooksStatus: $("settingsSavedLooksStatus"),
  settingsProfileValidationStatus: $("settingsProfileValidationStatus"),
  settingsDiagnosticsStatus: $("settingsDiagnosticsStatus"),
  settingsDiagnosticsEvents: $("settingsDiagnosticsEvents"),
  settingsDiagnosticsRefreshBtn: $("settingsDiagnosticsRefreshBtn"),
  settingsDiagnosticsCopyBtn: $("settingsDiagnosticsCopyBtn"),
  settingsFeedback: $("settingsFeedback"),
  userMenuDialog: $("userMenuDialog"),
  userMenuCloseBtn: $("userMenuCloseBtn"),
  userMenuAccountBtn: $("userMenuAccountBtn"),
  userMenuSettingsBtn: $("userMenuSettingsBtn"),

  // New UI
  weatherHero: $("weatherHero"),
  weatherExpandedPanel: $("weatherExpandedPanel"),
  weatherExpandToggle: $("weatherExpandToggle"),
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
  todayWardrobeInlineDismissBtn: $("todayWardrobeInlineDismissBtn"),
  wardrobeExplainerBtn: $("wardrobeExplainerBtn"),
  todayCtaKicker: $("todayCtaKicker"),
  todayCtaTitle: $("todayCtaTitle"),
  wardrobeExplainerKicker: $("wardrobeExplainerKicker"),
  wardrobeExplainerTitle: $("wardrobeExplainerTitle"),
  wardrobeExplainerText: $("wardrobeExplainerText"),
  wardrobeExplainerProgress: $("wardrobeExplainerProgress"),
  wardrobeExplainer: $("wardrobeDashboard"),
  wardrobeDashboard: $("wardrobeDashboard"),
  wardrobeCoverageCircle: $("wardrobeCoverageCircle"),
  wardrobeCoverageValue: $("wardrobeCoverageValue"),
  wardrobeCoverageLabel: $("wardrobeCoverageLabel"),
  wardrobeMissingChips: $("wardrobeMissingChips"),
  wardrobeSyncPrompt: $("wardrobeSyncPrompt"),
  wardrobeFilters: $("wardrobeFilters"),
  wardrobeFilterDialog: $("wardrobeFilterDialog"),
  wardrobeFilterDialogCloseBtn: $("wardrobeFilterDialogCloseBtn"),
  wardrobeColorFilter: $("wardrobeColorFilter"),
  wardrobeMaterialFilter: $("wardrobeMaterialFilter"),
  wardrobeSeasonFilter: $("wardrobeSeasonFilter"),
  wardrobeSortFilter: $("wardrobeSortFilter"),
  wardrobeRecentOnlyFilter: $("wardrobeRecentOnlyFilter"),
  wardrobeMissingMetadataFilter: $("wardrobeMissingMetadataFilter"),
  wardrobeMatchedFilter: $("wardrobeMatchedFilter"),
  wardrobeFilterResetBtn: $("wardrobeFilterResetBtn"),
  wardrobeFilterApplyBtn: $("wardrobeFilterApplyBtn"),

  // Wardrobe auth gate
  wardrobeAuthGate: $("wardrobeAuthGate"),
  wardrobeAuthGateBtn: $("wardrobeAuthGateBtn"),
  wardrobeContent: $("wardrobeContent"),
  wardrobeSignInBtn: $("wardrobeSignInBtn"),
  itemDetailDialog: $("itemDetailDialog"),
  wardrobeItemActionsDialog: $("wardrobeItemActionsDialog"),
  wardrobeItemActionsCloseBtn: $("wardrobeItemActionsCloseBtn"),
  wardrobeItemActionsBody: $("wardrobeItemActionsBody"),
  itemDetailBody: $("itemDetailBody"),
  itemDetailCloseBtn: $("itemDetailCloseBtn"),

  // Auth
  userBtn: $("userBtn"),
  userBtnIcon: $("userBtnIcon"),
  userBtnAvatar: $("userBtnAvatar"),
  todayUserBtn: $("todayUserBtn"),
  todayUserBtnIcon: $("todayUserBtnIcon"),
  todayUserBtnAvatar: $("todayUserBtnAvatar"),
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
  authUpgradeBtn: $("authUpgradeBtn"),
  authRestorePurchasesBtn: $("authRestorePurchasesBtn"),
  authLogoutBtn: $("authLogoutBtn"),
  authDeleteBtn: $("authDeleteBtn"),
  authCloseBtn: $("authCloseBtn"),
  paywallDialog: $("paywallDialog"),
  paywallCloseBtn: $("paywallCloseBtn"),
  paywallKicker: $("paywallKicker"),
  paywallTitle: $("paywallTitle"),
  paywallSubtitle: $("paywallSubtitle"),
  paywallFeatureList: $("paywallFeatureList"),
  paywallPrimaryBtn: $("paywallPrimaryBtn"),
  paywallSecondaryBtn: $("paywallSecondaryBtn"),
  paywallRestoreBtn: $("paywallRestoreBtn"),
  paywallAnnualPrice: $("paywallAnnualPrice"),
  paywallAnnualMeta: $("paywallAnnualMeta"),
  paywallMonthlyPrice: $("paywallMonthlyPrice"),
  paywallMonthlyMeta: $("paywallMonthlyMeta"),
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
const SIGNED_OUT_WARDROBE_ITEM_LIMIT = 5;
const WARDROBE_PROMPT_EARLY_USE_DAY_LIMIT = 7;
const FREE_WARDROBE_ITEM_LIMIT = 15;
const FREE_SAVED_LOOK_LIMIT = 3;
const FREE_PHOTO_SCANS_PER_WINDOW = 5;
const PHOTO_SCAN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PREMIUM_SAVED_LOOK_LIMIT = 100;
const PRODUCT_ID_MONTHLY = "wearcast_ai_premium_monthly";
const PRODUCT_ID_ANNUAL = "wearcast_ai_premium_annual";
const APPLE_MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

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
  if (sentryEnabled()) {
    if (user?.email || user?.id) {
      window.Sentry.setUser({
        id: user?.id ? String(user.id) : undefined,
        email: user?.email || undefined,
      });
    } else {
      window.Sentry.setUser(null);
    }
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
    enableHighAccuracy: false,
    timeout: 12000,
    maximumAge: 5 * 60 * 1000,
  });
}

async function finalizeAuthSuccess(token, user, refreshToken = authRefreshToken) {
  const wasLoggedIn = !!authToken;
  setAuth(token, user, refreshToken);
  if (els.authDialog?.open) els.authDialog.close();
  trackAnalyticsEvent("auth_completed", {
    title: `auth_completed:${user?.authProvider || "email"}`,
    method: user?.authProvider || "email",
    mode: wasLoggedIn ? "refresh" : "new_session",
  });
  if (!wasLoggedIn && typeof showAppToast === "function") {
    showAppToast(`Signed in${user?.name ? ` as ${user.name}` : ""}`, "success");
  }
  await refreshSubscriptionState({ silent: true });
  try {
    await syncLocalWardrobeToServer();
    await renderWardrobe();
  } catch (err) {
    console.error("post-auth wardrobe sync error:", err);
    showAppToast("Signed in, but your wardrobe is still loading. Pull to refresh or reopen the Wardrobe tab.", "warning");
  }
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
  if (closeBrowser) await closeNativeBrowser();
  try {
    const handled = await completeGoogleAuth(url.searchParams);
    if (!handled) return false;
    if (clearBrowserUrl) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    return true;
  } catch (err) {
    showAppToast(`Login failed: ${err.message}`, "error");
    return false;
  }
}

function bindNativeGoogleAuth() {
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin) return;

  appPlugin.addListener?.("appUrlOpen", async ({ url }) => {
    await handleGoogleAuthRedirect(url, { closeBrowser: true });
  });

  appPlugin.addListener?.("appStateChange", ({ isActive }) => {
    if (isActive) resetWardrobePromptSessionDismissal();
  });

  appPlugin.getLaunchUrl?.().then(async ({ url }) => {
    if (url) await handleGoogleAuthRedirect(url, { closeBrowser: true });
  }).catch(() => {});
}

function updateAuthUI() {
  const syncAccountButton = (avatarEl, iconEl) => {
    if (!avatarEl || !iconEl) return;
    if (authUser?.avatarUrl) {
      avatarEl.src = authUser.avatarUrl;
      avatarEl.style.display = "";
      iconEl.style.display = "none";
    } else {
      avatarEl.style.display = "none";
      iconEl.style.display = "";
    }
  };

  syncAccountButton(els.userBtnAvatar, els.userBtnIcon);
  syncAccountButton(els.todayUserBtnAvatar, els.todayUserBtnIcon);

  // Signed-out users can build a small local trial wardrobe. The account prompt
  // now lives inside the wardrobe surface instead of blocking the tab.
  const loggedIn = isLoggedIn();
  if (els.wardrobeAuthGate) els.wardrobeAuthGate.style.display = "none";
  if (els.wardrobeContent) els.wardrobeContent.style.display = "";
  if (els.wardrobeSyncPrompt && loggedIn) els.wardrobeSyncPrompt.style.display = "none";
  renderSettingsUI();
}

const DEFAULT_STATE = {
  lastQuery: "",
  lastLocation: null, // { name, lat, lon }
  savedLooks: [],
  latestRecommendation: {
    matchedItemIds: [],
    outfit: null,
    signature: "",
    updatedAt: null,
  },
  recommendationCache: [],
  productValidation: {
    tabs: {
      tabToday: { opens: 0, dwellMs: 0 },
      tabWardrobe: { opens: 0, dwellMs: 0 },
      tabPrefs: { opens: 0, dwellMs: 0 },
    },
  },
  onboarding: {
    completed: false,
    firstRecommendationSeen: false,
    tuningCompleted: false,
    wardrobePromptCompleted: false,
  },
  analytics: {
    firstOpenTracked: false,
    onboardingDeckSeen: false,
    activationTuneSeen: false,
    wardrobePromptSeen: false,
    firstWardrobeItemTracked: false,
    fiveWardrobeItemsTracked: false,
    firstWardrobeRecommendationTracked: false,
    lastEvents: [],
  },
  subscription: {
    status: "free",
    plan: "free",
    trialActive: false,
    renewalStatus: "none",
    usagePromptShown: false,
  },
  usage: {
    photoScans: [],
    successfulUseDays: [],
  },
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
    // Gender presentation preference for outfit recommendations.
    //   "unspecified" — no bias (legacy behaviour)
    //   "male"        — bias toward menswear silhouettes
    //   "female"      — bias toward womenswear silhouettes
    //   "nonbinary"   — bias toward unisex / mixed
    gender: "unspecified",
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
let savedLooksExpanded = false;
let wardrobeLongPressTimerId = null;
let wardrobeLongPressHandled = false;
let wardrobeLongPressItemId = null;
let highlightedWardrobeItemIds = [];
let activeItemCropSession = null;
let activeItemCropPointerState = null;
let wardrobeVisibleItemIds = [];
let wardrobeItemViewerState = {
  isOpen: false,
  source: "all",
  visibleItemIds: [],
  currentIndex: 0,
  pagerFromIndex: null,
  isEditOpen: false,
};
let wardrobeViewerPointerState = null;
const WARDROBE_VIEWER_SWIPE_THRESHOLD = 54;
const WARDROBE_VIEWER_DRAG_INTENT_THRESHOLD = 12;
let recommendationDialogTouchStartX = 0;
let recommendationDialogTouchDeltaX = 0;
let recommendationDialogSwipeActive = false;
let settingsFeedbackTimeoutId = null;
let consentDialogSource = null;
let activeTabTrackedAt = Date.now();
let activeOnboardingSlide = 0;
let activeItemStarterPreset = null;
let activePaywallPlan = "annual";
let subscriptionCatalog = {};
let subscriptionProductsLoadAttempted = false;
let subscriptionRefreshPromise = null;
let latestWeatherSnapshot = null;
let latestRecommendationSnapshot = null;
let wardrobePromptDismissedThisSession = false;
let pendingLocalWardrobeConsentPreset = null;
let isWeatherExpanded = false;
const TAB_ORDER = ["tabToday", "tabWardrobe"];
const ANALYTICS_EVENT_HISTORY_LIMIT = 40;
const ANALYTICS_SESSION_ID = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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
      productValidation: {
        ...structuredClone(DEFAULT_STATE).productValidation,
        ...(parsed.productValidation || {}),
        tabs: {
          ...structuredClone(DEFAULT_STATE).productValidation.tabs,
          ...((parsed.productValidation && parsed.productValidation.tabs) || {}),
        },
      },
      onboarding: {
        ...structuredClone(DEFAULT_STATE).onboarding,
        ...(parsed.onboarding || {}),
      },
      analytics: {
        ...structuredClone(DEFAULT_STATE).analytics,
        ...(parsed.analytics || {}),
        lastEvents: Array.isArray(parsed.analytics?.lastEvents) ? parsed.analytics.lastEvents : [],
      },
      subscription: {
        ...structuredClone(DEFAULT_STATE).subscription,
        ...(parsed.subscription || {}),
      },
      usage: {
        ...structuredClone(DEFAULT_STATE).usage,
        ...(parsed.usage || {}),
        photoScans: Array.isArray(parsed.usage?.photoScans) ? parsed.usage.photoScans : [],
        successfulUseDays: Array.isArray(parsed.usage?.successfulUseDays) ? parsed.usage.successfulUseDays : [],
      },
      recommendationCache: Array.isArray(parsed.recommendationCache) ? parsed.recommendationCache : [],
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
    onboarding: {
      ...prev.onboarding,
      ...(partial.onboarding || {}),
    },
    analytics: {
      ...prev.analytics,
      ...(partial.analytics || {}),
      lastEvents: Array.isArray(partial.analytics?.lastEvents)
        ? partial.analytics.lastEvents
        : prev.analytics?.lastEvents || [],
    },
    subscription: {
      ...prev.subscription,
      ...(partial.subscription || {}),
    },
    usage: {
      ...prev.usage,
      ...(partial.usage || {}),
      photoScans: Array.isArray(partial.usage?.photoScans) ? partial.usage.photoScans : prev.usage?.photoScans || [],
      successfulUseDays: Array.isArray(partial.usage?.successfulUseDays) ? partial.usage.successfulUseDays : prev.usage?.successfulUseDays || [],
    },
    recommendationCache: Array.isArray(partial.recommendationCache) ? partial.recommendationCache : prev.recommendationCache || [],
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
  const genderMap = { male: "Men's", female: "Women's", nonbinary: "Mixed" };
  if (resolved.gender && resolved.gender !== "unspecified" && genderMap[resolved.gender]) {
    chips.push(genderMap[resolved.gender]);
  }
  if (resolved.cold) chips.push("Usually cold");
  if (resolved.hot) chips.push("Usually hot");

  return chips.length ? `Current tuning: ${chips.slice(0, 3).join(" • ")}.` : "Using custom outfit tuning.";
}

function getSubscriptionState(state = loadState()) {
  return {
    ...structuredClone(DEFAULT_STATE).subscription,
    ...(state?.subscription || {}),
  };
}

function hasPremiumAccess(state = loadState()) {
  const subscription = getSubscriptionState(state);
  return ["premium_active", "premium_trial", "premium_grace_period"].includes(subscription.status);
}

function getRecentPhotoScanTimestamps(state = loadState(), now = Date.now()) {
  const usage = state?.usage || {};
  return (Array.isArray(usage.photoScans) ? usage.photoScans : [])
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value) && value >= now - PHOTO_SCAN_WINDOW_MS)
    .sort((a, b) => a - b);
}

function getRemainingWardrobeSlots(items = loadWardrobe(), state = loadState()) {
  if (!isLoggedIn()) return Math.max(0, SIGNED_OUT_WARDROBE_ITEM_LIMIT - (Array.isArray(items) ? items.length : 0));
  if (hasPremiumAccess(state)) return Number.POSITIVE_INFINITY;
  return Math.max(0, FREE_WARDROBE_ITEM_LIMIT - (Array.isArray(items) ? items.length : 0));
}

function getRemainingSavedLooks(state = loadState()) {
  if (hasPremiumAccess(state)) return Number.POSITIVE_INFINITY;
  const count = Array.isArray(state.savedLooks) ? state.savedLooks.length : 0;
  return Math.max(0, FREE_SAVED_LOOK_LIMIT - count);
}

function getRemainingPhotoScans(state = loadState(), now = Date.now()) {
  if (hasPremiumAccess(state)) return Number.POSITIVE_INFINITY;
  return Math.max(0, FREE_PHOTO_SCANS_PER_WINDOW - getRecentPhotoScanTimestamps(state, now).length);
}

function consumePhotoScanCredits(count = 1) {
  if (!Number.isFinite(count) || count <= 0) return loadState();
  const state = loadState();
  if (hasPremiumAccess(state)) return state;
  const now = Date.now();
  const nextPhotoScans = [
    ...getRecentPhotoScanTimestamps(state, now).map((value) => new Date(value).toISOString()),
    ...Array.from({ length: count }, () => new Date(now).toISOString()),
  ];
  return saveState({
    usage: {
      ...(state.usage || {}),
      photoScans: nextPhotoScans,
    },
  });
}

function getPlanSummary(state = loadState()) {
  const subscription = getSubscriptionState(state);
  if (hasPremiumAccess(state)) {
    const planLabel = subscription.plan === "annual" ? "Premium annual" : "Premium monthly";
    const trialLabel = subscription.trialActive ? " • Trial active" : "";
    return `${planLabel}${trialLabel}`;
  }
  return "Free plan";
}

function getSubscriptionsPlugin() {
  return subscriptionsPlugin || nativePlugins?.Subscriptions || null;
}

function hasNativeSubscriptionsPlugin() {
  const plugin = getSubscriptionsPlugin();
  return !!(isNative && plugin?.getEntitlements && plugin?.getProducts && plugin?.purchase && plugin?.restorePurchases);
}

function updateSubscriptionCatalog(products = []) {
  subscriptionProductsLoadAttempted = true;
  const nextCatalog = {};
  for (const product of Array.isArray(products) ? products : []) {
    if (product?.id) nextCatalog[product.id] = product;
  }
  subscriptionCatalog = nextCatalog;
  if (els.paywallAnnualPrice && nextCatalog[PRODUCT_ID_ANNUAL]?.displayPrice) {
    els.paywallAnnualPrice.textContent = `${nextCatalog[PRODUCT_ID_ANNUAL].displayPrice} / year`;
  }
  if (els.paywallAnnualMeta && nextCatalog[PRODUCT_ID_ANNUAL]?.subscriptionPeriod) {
    els.paywallAnnualMeta.textContent = nextCatalog[PRODUCT_ID_ANNUAL].introductoryOffer
      ? nextCatalog[PRODUCT_ID_ANNUAL].introductoryOffer
      : nextCatalog[PRODUCT_ID_ANNUAL].subscriptionPeriod;
  }
  if (els.paywallMonthlyPrice && nextCatalog[PRODUCT_ID_MONTHLY]?.displayPrice) {
    els.paywallMonthlyPrice.textContent = `${nextCatalog[PRODUCT_ID_MONTHLY].displayPrice} / month`;
  }
  if (els.paywallMonthlyMeta && nextCatalog[PRODUCT_ID_MONTHLY]?.subscriptionPeriod) {
    els.paywallMonthlyMeta.textContent = nextCatalog[PRODUCT_ID_MONTHLY].subscriptionPeriod;
  }
  setActivePaywallPlan(activePaywallPlan);
}

function applySubscriptionSnapshot(snapshot = {}) {
  if (Array.isArray(snapshot.products)) updateSubscriptionCatalog(snapshot.products);
  const state = loadState();
  const previousSubscription = getSubscriptionState(state);
  if (previousSubscription.trialActive && !snapshot.trialActive && snapshot.status === "premium_active") {
    trackAnalyticsEvent("trial_converted", {
      title: "trial_converted",
      plan: snapshot.plan || previousSubscription.plan || "unknown",
    });
  }
  const nextState = saveState({
    subscription: {
      ...getSubscriptionState(state),
      status: snapshot.status || "free",
      plan: snapshot.plan || "free",
      trialActive: !!snapshot.trialActive,
      renewalStatus: snapshot.renewalStatus || "none",
      usagePromptShown: !!(state.subscription?.usagePromptShown),
    },
  });
  updateAuthUI();
  return nextState;
}

async function loadSubscriptionProducts({ force = false } = {}) {
  if (!hasNativeSubscriptionsPlugin()) {
    subscriptionProductsLoadAttempted = true;
    setActivePaywallPlan(activePaywallPlan);
    return [];
  }
  if (!force && Object.keys(subscriptionCatalog).length) return Object.values(subscriptionCatalog);
  try {
    const plugin = getSubscriptionsPlugin();
    const result = await plugin.getProducts({
      productIds: [PRODUCT_ID_ANNUAL, PRODUCT_ID_MONTHLY],
    });
    const products = Array.isArray(result?.products) ? result.products : [];
    updateSubscriptionCatalog(products);
    return products;
  } catch (err) {
    subscriptionProductsLoadAttempted = true;
    setActivePaywallPlan(activePaywallPlan);
    console.error("subscription products error:", err);
    return [];
  }
}

async function refreshSubscriptionState({ silent = true } = {}) {
  if (!hasNativeSubscriptionsPlugin()) return loadState();
  if (subscriptionRefreshPromise) return subscriptionRefreshPromise;
  const plugin = getSubscriptionsPlugin();
  subscriptionRefreshPromise = (async () => {
    try {
      const result = await plugin.getEntitlements();
      return applySubscriptionSnapshot(result);
    } catch (err) {
      if (!silent) {
        console.error("subscription entitlement refresh error:", err);
        showAppToast(err?.message || "Could not refresh subscription status right now.", "warning");
      }
      return loadState();
    } finally {
      subscriptionRefreshPromise = null;
    }
  })();
  return subscriptionRefreshPromise;
}

function getPaywallPlanLabel(plan = activePaywallPlan) {
  return plan === "monthly" ? "monthly" : "annual";
}

function getProductIdForPlan(plan = activePaywallPlan) {
  return plan === "monthly" ? PRODUCT_ID_MONTHLY : PRODUCT_ID_ANNUAL;
}

function getActiveSubscriptionPlan(state = loadState()) {
  const subscription = getSubscriptionState(state);
  return subscription.plan === "monthly" || subscription.plan === "annual" ? subscription.plan : "free";
}

function isSelectedCurrentPremiumPlan(plan = activePaywallPlan, state = loadState()) {
  return hasPremiumAccess(state) && getActiveSubscriptionPlan(state) === getPaywallPlanLabel(plan);
}

function planHasIntroductoryOffer(plan = activePaywallPlan) {
  const product = subscriptionCatalog[getProductIdForPlan(plan)];
  return !!product?.introductoryOffer;
}

function isPaywallProductAvailable(plan = activePaywallPlan) {
  if (!isLoggedIn()) return true;
  if (isSelectedCurrentPremiumPlan(plan)) return true;
  return !!(hasNativeSubscriptionsPlugin() && subscriptionCatalog[getProductIdForPlan(plan)]);
}

function getPaywallPrimaryLabel(plan = activePaywallPlan, state = loadState()) {
  if (isSelectedCurrentPremiumPlan(plan, state)) return "Current plan";
  if (hasPremiumAccess(state)) return `Switch to ${getPaywallPlanLabel(plan)}`;
  if (!isLoggedIn()) return "Create account";
  if (!hasNativeSubscriptionsPlugin()) return "Subscription unavailable";
  if (!subscriptionCatalog[getProductIdForPlan(plan)]) {
    return subscriptionProductsLoadAttempted ? "Subscription unavailable" : "Loading products...";
  }
  if (plan === "annual") return "Start 7-day free trial";
  return "Choose monthly";
}

function setActivePaywallPlan(plan = "annual") {
  activePaywallPlan = plan === "monthly" ? "monthly" : "annual";
  document.querySelectorAll("[data-paywall-plan]").forEach((node) => {
    node.classList.toggle("is-selected", node.getAttribute("data-paywall-plan") === activePaywallPlan);
  });
  if (els.paywallPrimaryBtn) {
    els.paywallPrimaryBtn.textContent = getPaywallPrimaryLabel(activePaywallPlan);
    els.paywallPrimaryBtn.disabled = isLoggedIn()
      && !hasPremiumAccess()
      && !isPaywallProductAvailable(activePaywallPlan);
  }
}

async function openManageSubscription() {
  try {
    const plugin = getSubscriptionsPlugin();
    if (isNative && typeof plugin?.manageSubscriptions === "function") {
      await plugin.manageSubscriptions();
      return;
    }
    if (isNative && nativePlugins?.Browser?.open) {
      await nativePlugins.Browser.open({ url: APPLE_MANAGE_SUBSCRIPTIONS_URL });
      return;
    }
    window.location.href = APPLE_MANAGE_SUBSCRIPTIONS_URL;
  } catch {
    showAppToast("Could not open subscription settings right now.", "warning");
  }
}

async function purchaseSelectedPlan() {
  if (!hasNativeSubscriptionsPlugin()) {
    showAppToast("Native checkout support is not available in this build yet.", "warning");
    return false;
  }
  const plugin = getSubscriptionsPlugin();
  const plan = getPaywallPlanLabel(activePaywallPlan);
  const productId = getProductIdForPlan(activePaywallPlan);
  const trigger = els.paywallDialog?.dataset?.trigger || "generic";
  const source = els.paywallDialog?.dataset?.source || "paywall";
  const wasPremiumBeforePurchase = hasPremiumAccess();
  if (isSelectedCurrentPremiumPlan(activePaywallPlan)) {
    showAppToast("This is your current Premium plan. Use Manage subscription to cancel or review billing.", "info");
    return false;
  }
  try {
    const products = await loadSubscriptionProducts({ force: true });
    const productAvailable = products.some((product) => product?.id === productId);
    if (!productAvailable) {
      trackAnalyticsEvent("purchase_failed", {
        title: `purchase_failed:${plan}:product_unavailable`,
        plan,
        trigger,
        source,
        productId,
        loadedProductIds: products.map((product) => product?.id).filter(Boolean).join(","),
        reason: "product_unavailable",
      });
      showAppToast("This subscription is not available to this build yet. Check App Store Connect setup and try again shortly.", "warning");
      return false;
    }
    trackAnalyticsEvent("purchase_started", {
      title: `purchase_started:${plan}`,
      plan,
      trigger,
      source,
      productId,
    });
    if (els.paywallPrimaryBtn) {
      els.paywallPrimaryBtn.disabled = true;
      els.paywallPrimaryBtn.textContent = hasPremiumAccess()
        ? `Switching to ${plan}…`
        : plan === "annual"
          ? "Starting trial…"
          : "Starting checkout…";
    }
    const result = await plugin.purchase({ productId });
    applySubscriptionSnapshot(result);
    if (result?.status === "premium_active" || result?.status === "premium_trial" || result?.status === "premium_grace_period") {
      trackAnalyticsEvent("purchase_succeeded", {
        title: `purchase_succeeded:${plan}`,
        plan,
        trigger,
        source,
        trialActive: !!result?.trialActive,
      });
      if (result?.trialActive) {
        trackAnalyticsEvent("trial_started", {
          title: `trial_started:${plan}`,
          plan,
          trigger,
          source,
        });
      }
      closePaywall();
      showAppToast(
        wasPremiumBeforePurchase
          ? `Switched to ${plan} billing. Apple may apply the billing change at renewal depending on your subscription.`
          : result?.trialActive
          ? `Started your ${plan} trial. Premium is now active.`
          : `Started your ${plan} subscription. Premium is now active.`,
        "success"
      );
      return true;
    }
    if (result?.purchaseState === "cancelled") {
      trackAnalyticsEvent("purchase_cancelled", {
        title: `purchase_cancelled:${plan}`,
        plan,
        trigger,
        source,
      });
      return false;
    }
    if (result?.purchaseState === "pending") {
      trackAnalyticsEvent("purchase_pending", {
        title: `purchase_pending:${plan}`,
        plan,
        trigger,
        source,
      });
      showAppToast("Purchase is pending approval. We’ll unlock premium once Apple confirms it.", "info");
      return false;
    }
    trackAnalyticsEvent("purchase_failed", {
      title: `purchase_failed:${plan}`,
      plan,
      trigger,
      source,
      reason: result?.purchaseState || "incomplete",
    });
    showAppToast("Purchase didn’t complete. Please try again.", "warning");
    return false;
  } catch (err) {
    trackAnalyticsEvent("purchase_failed", {
      title: `purchase_failed:${plan}`,
      plan,
      trigger,
      source,
      reason: err?.message || "error",
    });
    console.error("subscription purchase error:", err);
    showAppToast(err?.message || "Could not complete the purchase right now.", "error");
    return false;
  } finally {
    if (els.paywallPrimaryBtn) {
      els.paywallPrimaryBtn.disabled = isLoggedIn()
        && !hasPremiumAccess()
        && !isPaywallProductAvailable(activePaywallPlan);
      els.paywallPrimaryBtn.textContent = getPaywallPrimaryLabel(activePaywallPlan);
    }
  }
}

function recordSuccessfulUseDay() {
  const state = loadState();
  const today = new Date().toISOString().slice(0, 10);
  const days = Array.isArray(state.usage?.successfulUseDays) ? state.usage.successfulUseDays : [];
  if (days.includes(today)) return state;
  return saveState({
    usage: {
      ...(state.usage || {}),
      successfulUseDays: [...days, today].slice(-14),
    },
  });
}

function maybePromptUsageMilestonePaywall() {
  const state = loadState();
  const days = Array.isArray(state.usage?.successfulUseDays) ? state.usage.successfulUseDays : [];
  const subscription = getSubscriptionState(state);
  if (hasPremiumAccess(state) || subscription.usagePromptShown || days.length < 3) return;
  saveState({
    subscription: {
      ...subscription,
      usagePromptShown: true,
    },
  });
  window.setTimeout(() => openPaywall("generic", { source: "three-successful-days", successfulUseDays: days.length }), 260);
}

function buildPaywallContent(trigger = "generic", context = {}) {
  const copyMap = {
    generic: {
      kicker: "WearCast Premium",
      title: "Unlock your full digital closet",
      subtitle: "Get more from your wardrobe with unlimited items, more saved looks, and more scans.",
    },
    manage_subscription: {
      kicker: "WearCast Premium",
      title: "Manage your Premium plan",
      subtitle: "Switch between annual and monthly billing here. To cancel or review billing dates, open your App Store subscription settings.",
    },
    wardrobe_cap: {
      kicker: "Closet full",
      title: "Keep building your full wardrobe",
      subtitle: `Free includes up to ${FREE_WARDROBE_ITEM_LIMIT} items. Go premium to keep growing the closet WearCast can style from.`,
    },
    saved_looks_cap: {
      kicker: "Saved looks limit",
      title: "Keep a bigger library of outfit references",
      subtitle: `Free includes ${FREE_SAVED_LOOK_LIMIT} saved looks. Go premium to save more outfits and revisit them anytime.`,
    },
    scan_cap: {
      kicker: "Weekly scan limit",
      title: "Scan your wardrobe without the weekly cap",
      subtitle: `Free includes ${FREE_PHOTO_SCANS_PER_WINDOW} clothing photo scans every 7 days. Go premium for unlimited scans.`,
    },
    starter_ready: {
      kicker: "Starter ready",
      title: "You’ve unlocked the best moment to upgrade",
      subtitle: "Your starter wardrobe is ready. Go premium to keep building your full closet and get more from every recommendation.",
    },
  };
  return {
    ...(copyMap[trigger] || copyMap.generic),
    primaryLabel: getPaywallPrimaryLabel(activePaywallPlan),
    features: [
      "Unlimited wardrobe items",
      "Unlimited photo scans",
      "Unlimited saved looks",
      "Smarter recommendations from your closet",
    ],
    context,
  };
}

function openPaywall(trigger = "generic", context = {}) {
  if (!els.paywallDialog) return;
  const activePlan = getActiveSubscriptionPlan();
  if (activePlan === "monthly" || activePlan === "annual") {
    activePaywallPlan = activePlan;
  }
  const content = buildPaywallContent(trigger, context);
  const state = loadState();
  els.paywallDialog.dataset.trigger = trigger;
  els.paywallDialog.dataset.source = context?.source || "";
  if (els.paywallKicker) els.paywallKicker.textContent = content.kicker;
  if (els.paywallTitle) els.paywallTitle.textContent = content.title;
  if (els.paywallSubtitle) els.paywallSubtitle.textContent = content.subtitle;
  if (els.paywallPrimaryBtn) els.paywallPrimaryBtn.textContent = content.primaryLabel;
  if (els.paywallRestoreBtn) {
    els.paywallRestoreBtn.textContent = hasPremiumAccess(state) ? "Manage or cancel in App Store" : "Restore purchases";
  }
  if (els.paywallFeatureList) {
    els.paywallFeatureList.innerHTML = content.features
      .map((feature) => `<div class="paywall-feature">${escapeHtml(feature)}</div>`)
      .join("");
  }
  setActivePaywallPlan(activePaywallPlan);
  void loadSubscriptionProducts();
  trackAnalyticsEvent("paywall_viewed", {
    title: `paywall_viewed:${trigger}`,
    trigger,
    source: context?.source || "",
    selectedPlan: activePaywallPlan,
    wardrobeCount: Array.isArray(_wardrobeCache) ? _wardrobeCache.length : loadWardrobeLocal().length,
    savedLooksCount: Array.isArray(state.savedLooks) ? state.savedLooks.length : 0,
    successfulUseDays: Array.isArray(state.usage?.successfulUseDays) ? state.usage.successfulUseDays.length : 0,
  });
  if (typeof els.paywallDialog.showModal === "function" && !els.paywallDialog.open) els.paywallDialog.showModal();
}

function closePaywall() {
  if (els.paywallDialog?.open) els.paywallDialog.close();
}

async function restorePurchases() {
  trackAnalyticsEvent("restore_started", { title: "restore_started" });
  if (!hasNativeSubscriptionsPlugin()) {
    showAppToast("Restore is available once native subscriptions are enabled in this build.", "info");
    return false;
  }
  try {
    const plugin = getSubscriptionsPlugin();
    const result = await plugin.restorePurchases();
    applySubscriptionSnapshot(result);
    if (hasPremiumAccess(loadState())) {
      trackAnalyticsEvent("restore_succeeded", {
        title: "restore_succeeded",
        plan: result?.plan || "unknown",
        trialActive: !!result?.trialActive,
      });
      showAppToast("Purchases restored. Premium is active again.", "success");
      return true;
    }
    trackAnalyticsEvent("restore_failed", {
      title: "restore_failed:none_found",
      reason: "none_found",
    });
    showAppToast("No active premium purchases were found to restore.", "info");
    return false;
  } catch (err) {
    trackAnalyticsEvent("restore_failed", {
      title: "restore_failed:error",
      reason: err?.message || "error",
    });
    console.error("subscription restore error:", err);
    showAppToast(err?.message || "Could not restore purchases right now.", "error");
    return false;
  }
}

function summarizeSavedLooksStatus(state = loadState()) {
  const count = Array.isArray(state.savedLooks) ? state.savedLooks.length : 0;
  const remaining = getRemainingSavedLooks(state);
  const limitText = hasPremiumAccess(state)
    ? "Unlimited with premium."
    : `${remaining} free save${remaining === 1 ? "" : "s"} left.`;
  if (!count) return `Saved looks stay on this device for now. You haven’t saved any yet. ${limitText}`;
  return `${count} saved look${count === 1 ? "" : "s"} stored on this device. These are local for now and are not removed unless you clear device data. ${limitText}`;
}

function summarizeProfileValidationStatus(state = loadState()) {
  const metrics = state.productValidation?.tabs?.tabPrefs || {};
  const opens = Number(metrics.opens || 0);
  const dwellMs = Number(metrics.dwellMs || 0);
  if (!opens) {
    return "Tracking how often people use settings so we can simplify the app over time.";
  }
  const avgSeconds = Math.max(1, Math.round(dwellMs / Math.max(1, opens) / 1000));
  return `Opened ${opens} time${opens === 1 ? "" : "s"} on this device • average dwell ${avgSeconds}s. Use this to decide what settings should become simpler or more visible.`;
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
  if (els.settingsSavedLooksStatus) {
    els.settingsSavedLooksStatus.textContent = summarizeSavedLooksStatus(state);
  }
  if (els.settingsProfileValidationStatus) {
    els.settingsProfileValidationStatus.textContent = summarizeProfileValidationStatus(state);
  }
  renderSettingsDiagnosticsUI();
}

function buildDiagnosticsPayload(extra = {}) {
  const state = loadState();
  const analytics = getAnalyticsState(state);
  return {
    generatedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    native: isNative,
    backend: API_BASE,
    sentryConfigured: sentryConfigured(),
    subscriptionPluginAvailable: hasNativeSubscriptionsPlugin(),
    subscriptionProductsLoaded: Object.keys(subscriptionCatalog).length,
    plan: getPlanSummary(state),
    signedIn: isLoggedIn(),
    wardrobeItems: loadWardrobe().length,
    savedLooks: Array.isArray(state.savedLooks) ? state.savedLooks.length : 0,
    recentEvents: analytics.lastEvents.slice(-20),
    ...extra,
  };
}

function renderSettingsDiagnosticsUI(extra = {}) {
  if (els.settingsDiagnosticsStatus) {
    const productCount = Object.keys(subscriptionCatalog).length;
    const pluginText = hasNativeSubscriptionsPlugin()
      ? productCount
        ? `${productCount} StoreKit product${productCount === 1 ? "" : "s"} loaded`
        : "StoreKit plugin ready; products not loaded yet"
      : "StoreKit plugin unavailable in this build";
    const healthText = extra.backendOk === true
      ? "Backend healthy"
      : extra.backendOk === false
        ? "Backend check failed"
        : "Backend not checked";
    els.settingsDiagnosticsStatus.textContent = `${healthText} • ${pluginText} • ${getPlanSummary()}`;
  }
  if (els.settingsDiagnosticsEvents) {
    const recent = getAnalyticsState(loadState()).lastEvents.slice(-8).reverse();
    els.settingsDiagnosticsEvents.innerHTML = recent.length
      ? recent.map((event) => `
        <div class="settings-diagnostics-event">
          <strong>${escapeHtml(event.name || "event")}</strong>
          <span>${escapeHtml(formatEventTimestamp(event.at))}</span>
        </div>
      `).join("")
      : `<div class="settings-diagnostics-empty">Recent local app events will appear here.</div>`;
  }
}

function formatEventTimestamp(value = "") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "just now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

async function refreshSettingsDiagnostics() {
  setSettingsActionBusy(els.settingsDiagnosticsRefreshBtn, true);
  try {
    const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
    renderSettingsDiagnosticsUI({ backendOk: res.ok });
    setSettingsFeedback(res.ok ? "Diagnostics refreshed. Backend is healthy." : "Diagnostics refreshed. Backend health check failed.", res.ok ? "success" : "warning");
  } catch (err) {
    renderSettingsDiagnosticsUI({ backendOk: false });
    setSettingsFeedback(`Diagnostics refresh failed: ${err.message}`, "warning");
  } finally {
    setSettingsActionBusy(els.settingsDiagnosticsRefreshBtn, false);
  }
}

async function copySettingsDiagnostics() {
  const payload = buildDiagnosticsPayload();
  const text = JSON.stringify(payload, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    setSettingsFeedback("Diagnostics copied.", "success");
  } catch {
    setSettingsFeedback("Could not copy diagnostics in this browser.", "warning");
  }
}

function getAnalyticsState(state = loadState()) {
  return {
    ...structuredClone(DEFAULT_STATE).analytics,
    ...(state?.analytics || {}),
    lastEvents: Array.isArray(state?.analytics?.lastEvents) ? state.analytics.lastEvents : [],
  };
}

function sentryConfigured() {
  return !!runtimeConfig.sentryBrowserDsn;
}

function sentryEnabled() {
  return !!(window.Sentry && sentryConfigured());
}

function initBrowserSentry(attempt = 0) {
  if (!sentryConfigured() || window.__wearcastSentryInitialized) return;
  if (!window.Sentry) {
    if (attempt < 10) {
      window.setTimeout(() => initBrowserSentry(attempt + 1), 300);
    }
    return;
  }
  window.Sentry.init({
    dsn: runtimeConfig.sentryBrowserDsn,
    environment: runtimeConfig.sentryEnvironment || "production",
    release: runtimeConfig.sentryRelease || APP_VERSION,
    sendDefaultPii: false,
  });
  window.Sentry.setTag("platform", isNative ? "native" : "web");
  if (authUser?.email || authUser?.id) {
    window.Sentry.setUser({
      id: authUser?.id ? String(authUser.id) : undefined,
      email: authUser?.email || undefined,
    });
  }
  window.__wearcastSentryInitialized = true;
}

function getRecentAnalyticsEventsForReporting(limit = 8) {
  return getAnalyticsState(loadState()).lastEvents.slice(-limit);
}

let clientErrorReportInFlight = false;

function reportClientError(payload = {}) {
  if (clientErrorReportInFlight) return;
  clientErrorReportInFlight = true;
  const body = JSON.stringify({
    type: payload.type || "client_error",
    message: payload.message || "",
    stack: payload.stack || "",
    source: payload.source || "",
    line: payload.line || null,
    column: payload.column || null,
    url: payload.url || window.location.href,
    native: isNative,
    appVersion: APP_VERSION,
    recentEvents: getRecentAnalyticsEventsForReporting(),
  });

  const finalize = () => {
    window.setTimeout(() => {
      clientErrorReportInFlight = false;
    }, 1500);
  };

  try {
    fetch(`${API_BASE}/api/client-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {}).finally(finalize);
  } catch {
    finalize();
  }
}

function bindClientSafetyReporting() {
  window.addEventListener("error", (event) => {
    const message = event?.message || "Unhandled client error";
    trackAnalyticsEvent("client_error", {
      title: "client_error",
      source: "window.error",
      message,
    });
    if (sentryEnabled() && event?.error) {
      window.Sentry.captureException(event.error);
    } else if (sentryEnabled()) {
      window.Sentry.captureMessage(message, "error");
    }
    reportClientError({
      type: "window_error",
      message,
      stack: event?.error?.stack || "",
      source: event?.filename || "",
      line: event?.lineno || null,
      column: event?.colno || null,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const message = reason?.message || String(reason || "Unhandled promise rejection");
    trackAnalyticsEvent("client_error", {
      title: "client_error:unhandledrejection",
      source: "window.unhandledrejection",
      message,
    });
    if (sentryEnabled()) {
      if (reason instanceof Error) window.Sentry.captureException(reason);
      else window.Sentry.captureMessage(message, "error");
    }
    reportClientError({
      type: "unhandled_rejection",
      message,
      stack: reason?.stack || "",
      source: "promise",
    });
  });
}

function sanitizeAnalyticsMetadata(metadata = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      sanitized[key] = value.slice(0, 160);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      sanitized[key] = value.map((entry) => String(entry)).slice(0, 8).join("|").slice(0, 160);
      continue;
    }
    try {
      sanitized[key] = JSON.stringify(value).slice(0, 160);
    } catch {
      sanitized[key] = String(value).slice(0, 160);
    }
  }
  return sanitized;
}

function trackAnalyticsEvent(name, metadata = {}) {
  const details = sanitizeAnalyticsMetadata(metadata);
  try {
    const state = loadState();
    const analytics = getAnalyticsState(state);
    saveState({
      analytics: {
        ...analytics,
        lastEvents: [
          ...analytics.lastEvents,
          {
            name,
            at: new Date().toISOString(),
            sessionId: ANALYTICS_SESSION_ID,
            ...details,
          },
        ].slice(-ANALYTICS_EVENT_HISTORY_LIMIT),
      },
    });
  } catch {}
  try {
    window.goatcounter?.count?.({
      path: `${window.location.pathname}#${name}`,
      title: details.title || name,
      event: true,
    });
  } catch {}
}

function flushTabDwellMetrics(tabId = getActiveTabId(), { now = Date.now() } = {}) {
  if (!tabId || !activeTabTrackedAt) return;
  const elapsed = Math.max(0, now - activeTabTrackedAt);
  if (!elapsed) return;
  const state = loadState();
  const current = state.productValidation?.tabs?.[tabId] || { opens: 0, dwellMs: 0 };
  saveState({
    productValidation: {
      ...state.productValidation,
      tabs: {
        ...state.productValidation?.tabs,
        [tabId]: {
          ...current,
          dwellMs: Number(current.dwellMs || 0) + elapsed,
        },
      },
    },
  });
  activeTabTrackedAt = now;
}

function trackTabOpen(tabId, { now = Date.now() } = {}) {
  const state = loadState();
  const current = state.productValidation?.tabs?.[tabId] || { opens: 0, dwellMs: 0 };
  saveState({
    productValidation: {
      ...state.productValidation,
      tabs: {
        ...state.productValidation?.tabs,
        [tabId]: {
          ...current,
          opens: Number(current.opens || 0) + 1,
        },
      },
    },
  });
  activeTabTrackedAt = now;
  if (tabId === "tabPrefs") {
    trackAnalyticsEvent("profile-tab-open", { title: "Profile tab open" });
  }
}

function resetTodayLocationState() {
  pendingRecommendationPrefs = null;
  lastWeatherForAI = null;
  els.tabToday?.classList.remove("has-results", "has-recommendation", "has-wardrobe-banner");
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
  if (els.emptyState) els.emptyState.style.display = "";
  setEmptyStateLoading(false);
  if (els.updatedAt) els.updatedAt.textContent = "—";
  if (els.weatherHeroHeadline) els.weatherHeroHeadline.textContent = "—";
  updateTodayOnboardingUI();
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
      : "Search a city or share your location to get a weather-smart outfit recommendation for today.";
  }
}

function getOnboardingState(state = loadState()) {
  return {
    ...structuredClone(DEFAULT_STATE).onboarding,
    ...(state?.onboarding || {}),
  };
}

function shouldShowOnboardingDeck(state = loadState()) {
  const onboarding = getOnboardingState(state);
  return !state?.lastLocation && !onboarding.completed && !onboarding.firstRecommendationSeen;
}

function setActiveOnboardingSlide(index = 0) {
  const slides = Array.from(document.querySelectorAll("[data-onboarding-slide]"));
  const dots = Array.from(document.querySelectorAll(".onboarding-dot"));
  const maxIndex = Math.max(0, slides.length - 1);
  activeOnboardingSlide = Math.max(0, Math.min(maxIndex, index));

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === activeOnboardingSlide);
  });
  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === activeOnboardingSlide);
  });

  if (els.onboardingProgressBar) {
    const progress = slides.length > 1
      ? ((activeOnboardingSlide + 1) / slides.length) * 100
      : 100;
    els.onboardingProgressBar.style.width = `${progress}%`;
  }

  if (els.onboardingPrevBtn) {
    els.onboardingPrevBtn.disabled = activeOnboardingSlide === 0;
  }
  if (els.onboardingNextBtn) {
    const isLastSlide = activeOnboardingSlide === maxIndex;
    els.onboardingNextBtn.style.display = isLastSlide ? "none" : "";
  }
}

function completeOnboarding(extra = {}) {
  const state = loadState();
  const onboarding = getOnboardingState(state);
  const nextState = saveState({
    onboarding: {
      ...onboarding,
      completed: true,
      ...extra,
    },
  });
  updateTodayOnboardingUI(nextState);
  return nextState;
}

function shouldPromptActivationTune(state = loadState()) {
  const onboarding = getOnboardingState(state);
  return !!(onboarding.completed && onboarding.firstRecommendationSeen && !onboarding.tuningCompleted);
}

function completeActivationTune(extra = {}) {
  const state = loadState();
  const onboarding = getOnboardingState(state);
  const nextState = saveState({
    onboarding: {
      ...onboarding,
      tuningCompleted: true,
      ...extra,
    },
  });
  syncTodayWardrobeDialog(loadWardrobe());
  return nextState;
}

function shouldShowWardrobeUpgradePrompt(items = [], state = loadState()) {
  const count = Array.isArray(items) ? items.length : 0;
  const successfulUseDays = Array.isArray(state.usage?.successfulUseDays) ? state.usage.successfulUseDays.length : 0;
  const isIncompleteStarterWardrobe = count < SIGNED_OUT_WARDROBE_ITEM_LIMIT;
  const isEarlyUsageWindow = successfulUseDays <= WARDROBE_PROMPT_EARLY_USE_DAY_LIMIT;
  return !!(
    !wardrobePromptDismissedThisSession
    && isIncompleteStarterWardrobe
    && isEarlyUsageWindow
  );
}

function getPendingRecommendationPromptState(state = loadState()) {
  const onboarding = getOnboardingState(state);
  return {
    ...state,
    onboarding: {
      ...onboarding,
      completed: true,
      firstRecommendationSeen: true,
    },
  };
}

function completeWardrobeUpgradePrompt(extra = {}) {
  const state = loadState();
  const onboarding = getOnboardingState(state);
  const nextState = saveState({
    onboarding: {
      ...onboarding,
      wardrobePromptCompleted: true,
      ...extra,
    },
  });
  syncTodayWardrobeDialog(loadWardrobe());
  return nextState;
}

function dismissWardrobeUpgradePromptForSession() {
  wardrobePromptDismissedThisSession = true;
  if (els.todayWardrobeInlineCta) els.todayWardrobeInlineCta.style.display = "none";
  els.tabToday?.classList.remove("has-wardrobe-banner");
  syncTodayWardrobeDialog(loadWardrobe());
}

function resetWardrobePromptSessionDismissal() {
  if (!wardrobePromptDismissedThisSession) return;
  wardrobePromptDismissedThisSession = false;
  syncTodayWardrobeDialog(loadWardrobe());
}

function updateTodayOnboardingUI(state = loadState()) {
  const showDeck = shouldShowOnboardingDeck(state);
  if (els.onboardingOverlay) {
    els.onboardingOverlay.style.display = showDeck ? "" : "none";
    els.onboardingOverlay.setAttribute("aria-hidden", showDeck ? "false" : "true");
  }
  const analytics = getAnalyticsState(state);
  if (showDeck && !analytics.onboardingDeckSeen) {
    trackAnalyticsEvent("onboarding_viewed", { title: "onboarding_viewed" });
    saveState({
      analytics: {
        ...analytics,
        onboardingDeckSeen: true,
      },
    });
  }
  if (showDeck) {
    setActiveOnboardingSlide(activeOnboardingSlide);
  } else {
    syncTodayWardrobeDialog(loadWardrobe(), state);
  }
}

function markOnboardingRecommendationSeen() {
  const state = loadState();
  const onboarding = getOnboardingState(state);
  if (onboarding.firstRecommendationSeen && onboarding.completed) {
    updateTodayOnboardingUI(state);
    syncTodayWardrobeDialog(loadWardrobe());
    return;
  }

  const nextState = completeOnboarding({ firstRecommendationSeen: true });
  syncTodayWardrobeDialog(loadWardrobe(), nextState);
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
  if (!Number.isFinite(Number(code))) return "Weather";
  // Open-Meteo WMO weather interpretation codes (simplified labels)
  const normalizedCode = Number(code);
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
  return m[normalizedCode] ?? "Weather";
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

function getCurrentPrecipChance(current = {}, hourly = {}, derived = {}) {
  const direct = Number(derived?.precipProb ?? current?.precipitation_probability);
  if (Number.isFinite(direct)) return Math.max(0, Math.round(direct));
  const hourlyNow = pickHourlyAtTime(hourly, current?.time);
  const hourlyProb = Number(hourlyNow?.precipProb);
  if (Number.isFinite(hourlyProb)) return Math.max(0, Math.round(hourlyProb));
  const precipitation = Number(current?.precipitation ?? hourlyNow?.precip ?? hourlyNow?.rain);
  if (Number.isFinite(precipitation)) return precipitation > 0 ? 100 : 0;
  return null;
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
  els.tabToday?.classList.add("has-results");
  els.weatherHero.style.display = "";
  els.emptyState.style.display = "none";

  els.temp.textContent = `${fmt1(current.temperature_2m, "°")}`;
  els.apparent.textContent = `${fmt1(current.apparent_temperature, "°C")}`;
  els.wind.textContent = `${fmt(current.wind_speed_10m)} km/h`;
  if (els.humidity) els.humidity.textContent = `${fmt(current.relative_humidity_2m)}%`;
  els.heroHumidity.textContent = `${fmt(current.relative_humidity_2m)}%`;
  if (els.cloud) els.cloud.textContent = `${fmt(current.cloud_cover, "%")}`;
  if (els.precip) els.precip.textContent = `${fmt1(current.precipitation)} mm`;
  const precipChance = getCurrentPrecipChance(current, hourly, derived);
  if (els.precipProb) els.precipProb.textContent = precipChance != null ? `${fmt(precipChance, "%")}` : "—";
  if (els.heroPrecipProb) {
    els.heroPrecipProb.textContent = precipChance != null ? `${fmt(precipChance, "%")}` : "—";
  }

  const dew = dewPointC(current.temperature_2m, current.relative_humidity_2m);
  const hx = humidex(current.temperature_2m, dew);
  const wc = windChillC(current.temperature_2m, current.wind_speed_10m);
  let effective = current.apparent_temperature;
  if (wc != null) effective = wc;
  else if (hx != null && hx >= current.temperature_2m + 1.0) effective = hx;

  if (els.weatherHeroHeadline) {
    els.weatherHeroHeadline.textContent = buildWeatherHeroHeadline(current, derived, effective);
  }

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
  latestWeatherSnapshot = {
    ...(latestWeatherSnapshot || {}),
    current,
    derived,
    hourly,
    effective,
    severity: sev,
    conditionLabel,
    headline: buildWeatherHeroHeadline(current, derived, effective),
  };
  renderWeatherExpandedPanel();
}

function getNextWeatherHours(current, hourly, count = 15) {
  const times = Array.isArray(hourly?.time) ? hourly.time : [];
  if (!times.length || !current?.time) return [];
  const exactIndex = times.indexOf(current.time);
  const startIndex = exactIndex >= 0
    ? exactIndex
    : Math.max(0, times.findIndex((time) => new Date(time).getTime() >= new Date(current.time).getTime()));
  const indices = [];
  for (let offset = 0; offset < count && startIndex + offset < times.length; offset += 1) {
    indices.push(startIndex + offset);
  }
  return indices.map((index, itemIndex) => {
    const time = new Date(times[index]);
    const hour = Number.isNaN(time.getTime())
      ? (itemIndex === 0 ? "Now" : "")
      : itemIndex === 0
        ? "Now"
        : time.toLocaleTimeString([], { hour: "numeric" }).replace(/\s/g, "");
    const temp = hourly.apparent_temperature?.[index] ?? hourly.temperature_2m?.[index];
    const precipAmount = hourly.precipitation?.[index] ?? hourly.rain?.[index];
    const rawRain = hourly.precipitation_probability?.[index];
    const rain = Number.isFinite(Number(rawRain))
      ? Number(rawRain)
      : Number.isFinite(Number(precipAmount))
        ? Number(precipAmount) > 0 ? 100 : 0
        : null;
    const wind = hourly.wind_speed_10m?.[index];
    const code = hourly.weather_code?.[index];
    const label = weatherCodeLabel(code);
    return { index, itemIndex, time, hour, temp, rain, wind, code, label };
  });
}

function renderWeatherExpandedPanel() {
  if (!els.weatherExpandedPanel) return;
  const snapshot = latestWeatherSnapshot;
  if (!snapshot?.current) {
    els.weatherExpandedPanel.innerHTML = "";
    return;
  }
  const { current, hourly } = snapshot;
  const hours = getNextWeatherHours(current, hourly, 15);
  const timeline = hours.length
    ? hours.map((hour) => `
        <div class="weather-expanded-hour ${hour.itemIndex === 0 ? "is-now" : ""}">
          <span class="weather-expanded-hour-time">${escapeHtml(hour.hour || "—")}</span>
          <span class="weather-expanded-hour-icon" aria-hidden="true">${renderTimelineWeatherIcon(hour.label)}</span>
          <strong>${Number.isFinite(Number(hour.temp)) ? fmt1(hour.temp, "°") : "—"}</strong>
          <span class="weather-expanded-hour-meta">${Number.isFinite(Number(hour.rain)) ? `${fmt(Math.round(Number(hour.rain)), "")}% rain` : "Rain —"}</span>
        </div>
      `).join("")
    : `<p class="weather-expanded-muted">Hourly forecast is not available right now.</p>`;
  const outlook = renderOutfitDayOutlook(hours, latestRecommendationSnapshot);

  els.weatherExpandedPanel.innerHTML = `
    <div class="weather-expanded-inner">
      <section class="weather-expanded-section">
        <div class="weather-expanded-section-head">
        <span class="today-cta-kicker">Next 15 hours</span>
        <p>Swipe sideways</p>
      </div>
        <div class="weather-expanded-timeline" aria-label="Hourly forecast for the next 15 hours">
        ${timeline}
      </div>
    </section>
      ${outlook}
    </div>
  `;
}

function getRecommendedOutfitItemsForOutlook() {
  const snapshot = latestRecommendationSnapshot;
  if (!snapshot?.outfit) return [];
  return [
    preserveUsefulItemLabel(snapshot.outfit.top),
    preserveUsefulItemLabel(snapshot.outfit.bottom),
    preserveUsefulItemLabel(snapshot.outfit.outer),
    preserveUsefulItemLabel(snapshot.outfit.shoes),
    ...(Array.isArray(snapshot.outfit.accessories) ? snapshot.outfit.accessories : [snapshot.outfit.accessories])
      .map(preserveUsefulItemLabel),
  ].filter(Boolean);
}

function summarizeOutlookWindow(items = [], fallbackLabel = "Later") {
  const validTemps = items.map((item) => Number(item.temp)).filter(Number.isFinite);
  const validRain = items.map((item) => Number(item.rain)).filter(Number.isFinite);
  const validWind = items.map((item) => Number(item.wind)).filter(Number.isFinite);
  const labels = items.map((item) => item.label).filter(Boolean);
  const minTemp = validTemps.length ? Math.min(...validTemps) : null;
  const maxTemp = validTemps.length ? Math.max(...validTemps) : null;
  const maxRain = validRain.length ? Math.max(...validRain) : null;
  const maxWind = validWind.length ? Math.max(...validWind) : null;
  const labelCounts = labels.reduce((acc, label) => {
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  const dominantLabel = Object.entries(labelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || fallbackLabel;
  return { minTemp, maxTemp, maxRain, maxWind, label: dominantLabel };
}

function cleanOutlookItemName(value = "") {
  return String(value || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\b(smart|casual|weather[- ]ready|breathable|durable|lightweight)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getOutlookPieceNames(outfitItems = []) {
  const cleaned = outfitItems.map(cleanOutlookItemName).filter(Boolean);
  const outerSlot = cleaned[2] || "";
  return {
    top: cleaned[0] || "the top",
    bottom: cleaned[1] || "the bottoms",
    outer: outerSlot || cleaned.find((item) => /jacket|coat|overshirt|hoodie|layer/i.test(item)) || "",
    shoes: cleaned.find((item) => /shoe|sneaker|boot|loafer|trainer/i.test(item)) || cleaned[3] || "your shoes",
    lead: cleaned.slice(0, 3),
  };
}

function buildOutlookHeading(outfitItems = [], fallback = "") {
  const pieces = getOutlookPieceNames(outfitItems);
  if (pieces.lead.length >= 3) return `${pieces.lead[0]}, ${pieces.lead[1]}, and ${pieces.lead[2]}`;
  if (pieces.lead.length === 2) return `${pieces.lead[0]} with ${pieces.lead[1]}`;
  if (pieces.lead.length === 1) return `${pieces.lead[0]} through the day`;
  return fallback || "How today’s look should wear";
}

function buildOutlookGuidance(summary, outfitItems, period) {
  const pieces = getOutlookPieceNames(outfitItems);
  const outer = pieces.outer || outfitItems.find((item) => /jacket|coat|overshirt|hoodie|layer/i.test(item));
  const shoes = outfitItems.find((item) => /shoe|sneaker|boot|loafer|trainer/i.test(item));
  const top = pieces.top;
  const layer = cleanOutlookItemName(outer || pieces.outer || "the extra layer");
  const footwear = cleanOutlookItemName(shoes || pieces.shoes);
  const tempSwing = Number.isFinite(summary.maxTemp) && Number.isFinite(summary.minTemp)
    ? summary.maxTemp - summary.minTemp
    : 0;
  if (Number(summary.maxRain) >= 45) {
    return `Keep the look practical here: ${footwear} matters most, and a rain layer would be worth carrying.`;
  } else if (/rain|drizzle|shower/i.test(summary.label)) {
    return `The outfit still works, but keep a light shell nearby in case the showers actually show up.`;
  } else if (Number(summary.maxWind) >= 24) {
    return `${layer} is doing useful work in this window; the wind can make things feel cooler than the number suggests.`;
  } else if (tempSwing >= 4) {
    return `${layer} gives the outfit some flexibility, so you can wear it open or take it off as the day softens.`;
  }
  if (period === "later" && Number(summary.maxTemp) >= 20 && Number(summary.maxRain || 0) < 35) {
    return `This is the easiest part of the day for the outfit; ${top} can carry more of the look once it warms up.`;
  }
  if (period === "evening" && Number(summary.minTemp) <= 13) {
    return `If you will still be out, keep ${layer} with you rather than treating it as optional.`;
  }
  if (period === "now") return `A comfortable start: ${top} and ${footwear} should feel easy without needing much adjustment.`;
  return `No major outfit change needed here; the recommendation should stay balanced and wearable.`;
}

function renderOutfitDayOutlook(hours = [], recommendationSnapshot = latestRecommendationSnapshot) {
  const outfitItems = getRecommendedOutfitItemsForOutlook();
  const windows = [
    { label: "Now", period: "now", items: hours.slice(0, 4) },
    { label: "Later", period: "later", items: hours.slice(4, 10) },
    { label: "Evening", period: "evening", items: hours.slice(10, 15) },
  ].filter((entry) => entry.items.length);
  if (!windows.length) {
    return `
      <section class="weather-expanded-outlook">
        <span class="today-cta-kicker">Outfit outlook</span>
        <strong>Outlook will appear once hourly weather loads</strong>
        <p>WearCast will connect the forecast to today’s outfit recommendation here.</p>
      </section>
    `;
  }
  const llmOutlook = recommendationSnapshot?.outlook && typeof recommendationSnapshot.outlook === "object"
    ? recommendationSnapshot.outlook
    : null;
  const llmWindows = llmOutlook?.windows && typeof llmOutlook.windows === "object" ? llmOutlook.windows : null;
  // Accept either { copy: "..." }, { text/description/summary }, or a raw string
  // so the model can return the natural shape `windows: { now: "..." }`.
  const readWindowCopy = (entry) => {
    if (entry == null) return "";
    if (typeof entry === "string") return entry.trim();
    if (typeof entry !== "object") return "";
    for (const key of ["copy", "text", "description", "summary"]) {
      const v = entry[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };
  const fallbackHeadline = buildOutlookHeading(outfitItems, recommendationSnapshot?.headline);
  const headline = (typeof llmOutlook?.headline === "string" && llmOutlook.headline.trim())
    ? llmOutlook.headline.trim()
    : fallbackHeadline;
  if (typeof window !== "undefined" && window.__DEBUG_OUTLOOK) {
    console.info("[outlook] render", {
      hasOutlook: !!llmOutlook,
      headline: llmOutlook?.headline || null,
      windowKeys: llmWindows ? Object.keys(llmWindows) : [],
      sample: llmWindows ? Object.fromEntries(Object.entries(llmWindows).map(([k, v]) => [k, readWindowCopy(v).slice(0, 60)])) : null,
    });
  }
  return `
    <section class="weather-expanded-outlook">
      <div class="weather-expanded-section-head">
        <span class="today-cta-kicker">Outfit outlook</span>
        <p>${outfitItems.length ? "Based on today’s look" : "Weather-aware"}</p>
      </div>
      <strong>${escapeHtml(headline)}</strong>
      <div class="weather-expanded-outlook-list">
        ${windows.map((window) => {
          const summary = summarizeOutlookWindow(window.items, window.label);
          const tempLabel = Number.isFinite(summary.minTemp) && Number.isFinite(summary.maxTemp)
            ? `${fmt1(summary.minTemp, "°")}–${fmt1(summary.maxTemp, "°")}`
            : "—";
          const rainLabel = Number.isFinite(summary.maxRain) ? `${Math.round(summary.maxRain)}% rain` : "Rain —";
          const llmCopy = llmWindows
            ? readWindowCopy(llmWindows[window.period])
              || readWindowCopy(llmWindows[window.label])
              || readWindowCopy(llmWindows[window.label?.toLowerCase?.() || window.period])
            : "";
          const copy = llmCopy || buildOutlookGuidance(summary, outfitItems, window.period);
          return `
            <article class="weather-expanded-outlook-row">
              <div>
                <span>${escapeHtml(window.label)}</span>
                <strong>${escapeHtml(tempLabel)}</strong>
              </div>
              <p>${escapeHtml(copy)}</p>
              <small>${escapeHtml(summary.label)} • ${escapeHtml(rainLabel)}</small>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function setWeatherExpanded(expanded) {
  isWeatherExpanded = !!expanded;
  els.weatherHero?.classList.toggle("is-expanded", isWeatherExpanded);
  els.weatherHero?.setAttribute("aria-expanded", isWeatherExpanded ? "true" : "false");
  els.weatherHero?.setAttribute("aria-label", isWeatherExpanded ? "Collapse weather details" : "Expand weather details");
  els.weatherExpandToggle?.setAttribute("aria-label", isWeatherExpanded ? "Collapse weather details" : "Expand weather details");
  els.aiRecSection?.classList.toggle("is-weather-collapsed", isWeatherExpanded);
  els.weatherHero?.closest(".today-column-primary")?.classList.toggle("is-weather-expanded", isWeatherExpanded);
  if (isWeatherExpanded) renderWeatherExpandedPanel();
}

function toggleWeatherExpanded() {
  setWeatherExpanded(!isWeatherExpanded);
}

function renderTimelineWeatherIcon(label = "") {
  const text = String(label).toLowerCase();
  if (text.includes("thunder")) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 14.2h8.1a3.1 3.1 0 0 0 .6-6.1A4.9 4.9 0 0 0 6.5 7a3.5 3.5 0 0 0 .9 7.2Z" fill="currentColor" opacity=".58"/><path d="m12.3 13.2-1.4 4h2.2l-1.2 4.3 4.4-6.2H14l1-2.1Z" fill="currentColor"/></svg>';
  }
  if (text.includes("snow")) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 13.6h8.1a3.1 3.1 0 0 0 .6-6.1A4.9 4.9 0 0 0 6.5 6.4a3.5 3.5 0 0 0 .9 7.2Z" fill="currentColor" opacity=".55"/><path d="M10 17.2h4M12 15.2v4M9.9 15.9l4.2 2.6M14.1 15.9l-4.2 2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  }
  if (text.includes("rain") || text.includes("drizzle")) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 13.7h8.1a3.1 3.1 0 0 0 .6-6.1A4.9 4.9 0 0 0 6.5 6.5a3.5 3.5 0 0 0 .9 7.2Z" fill="currentColor" opacity=".58"/><path d="M9.5 16.2v2.4M13 16.6v2.8M16.5 16.2v2.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }
  if (text.includes("partly")) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.2" cy="8.2" r="3.6" fill="currentColor" opacity=".68"/><path d="M8 16.2h8.1a3 3 0 0 0 .5-6 4.7 4.7 0 0 0-8.9 1.1A2.9 2.9 0 0 0 8 16.2Z" fill="currentColor"/></svg>';
  }
  if (text.includes("cloud") || text.includes("overcast")) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 16.3h9.4a3.5 3.5 0 0 0 .5-7A5.6 5.6 0 0 0 6.6 8a4.1 4.1 0 0 0 .6 8.3Z" fill="currentColor"/></svg>';
  }
  if (text.includes("fog")) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.4h14M3.8 12h16.4M5 15.6h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.6" fill="currentColor"/><path d="M12 2.8v2.1M12 19.1v2.1M4.3 4.3l1.5 1.5M18.2 18.2l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.3 19.7l1.5-1.5M18.2 5.8l1.5-1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
}

function buildWeatherHeroHeadline(current, derived, effectiveTemp) {
  const effective = Number.isFinite(Number(effectiveTemp)) ? Number(effectiveTemp) : Number(current?.apparent_temperature);
  const wind = Number(current?.wind_speed_10m);
  const precipProb = Number(derived?.precipProb);
  const precip = Number(current?.precipitation);

  if ((Number.isFinite(precipProb) && precipProb >= 50) || (Number.isFinite(precip) && precip >= 0.5)) {
    return "Keep a rain layer close today.";
  }
  if (Number.isFinite(wind) && wind >= 28 && Number.isFinite(effective) && effective <= 15) {
    return "Light layers plus wind protection.";
  }
  if (Number.isFinite(effective) && effective <= 5) {
    return "Cold enough for full layers.";
  }
  if (Number.isFinite(effective) && effective <= 12) {
    return "A light jacket will carry the day.";
  }
  if (Number.isFinite(effective) && effective <= 20) {
    return "Light layers should feel just right.";
  }
  if (Number.isFinite(effective) && effective <= 27) {
    return "Keep it airy and breathable.";
  }
  return "Stay cool with the lightest pieces.";
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
      <span class="today-rec-weather-condition">
        <span class="today-rec-weather-condition-icon" aria-hidden="true">${weatherConditionIcon(condition || "Clear")}</span>
        <span>${escapeHtml(condition)}</span>
      </span>
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
  if (/(jacket|coat|hoodie|sweater|blazer|vest|overshirt|shacket|shell|parka|windbreaker|outer)/.test(key)) return "jacket";
  if (/(jeans|chinos|shorts|pants|trousers|trouser|slacks|sweatpants|skirt|bottom)/.test(key)) return "pants";
  if (/(dress)/.test(key)) return "dress";
  if (/(sneakers|boots|sandals|shoes)/.test(key)) return "shoes";
  if (/(scarf|hat|beanie|gloves|sunglasses|belt|bag|umbrella|watch|cap|socks|accessor)/.test(key)) return "accessory";
  return "top";
}

function getRecommendationSlotArtKey(label = "", value = "") {
  const slot = String(label || "").toLowerCase();
  if (slot === "top") return "top";
  if (slot === "bottom") return "pants";
  if (slot === "outer") return "jacket";
  if (slot === "shoes") return "shoes";
  if (slot === "accessory") return "accessory";
  return itemTypeIconKey(`${label} ${value}`);
}

function getRecommendationFallbackPhoto(label = "", value = "") {
  const slotKey = getRecommendationSlotArtKey(label, value);
  const text = `${label} ${value}`.toLowerCase();
  if (slotKey === "jacket") {
    if (/\b(fleece|sherpa|hoodie|soft layer)\b/.test(text)) return "assets/recommendation-stock/outer-gray-hoodie-cotton-studio.jpg";
    if (/\b(rain|waterproof|weatherproof|shell|windbreaker)\b/.test(text)) return "assets/recommendation-stock/outer-gray-shell-jacket-tech-studio.jpg";
    if (/\bovershirt|shacket|shirt jacket\b/.test(text)) return "assets/recommendation-stock/outer-charcoal-overshirt-studio.jpg";
    if (/\bblazer\b/.test(text)) return "assets/recommendation-stock/outer-black-blazer-studio.jpg";
  }
  if (slotKey === "accessory") {
    if (/\bwatch|wristwatch\b/.test(text)) return "assets/recommendation-stock/accessory-watch-studio.jpg";
    if (/\bbaseball cap|dad cap|snapback|sport cap|cap\b/.test(text)) return "assets/recommendation-stock/accessory-baseball-cap-studio.svg";
    if (/\bumbrella\b/.test(text)) return "assets/recommendation-stock/accessory-white-umbrella-studio.jpg";
    if (/\bbeanie\b/.test(text)) return "assets/recommendation-stock/accessory-white-beanie-studio.jpg";
    if (/\bscarf\b/.test(text)) return "assets/recommendation-stock/accessory-pattern-scarf-studio.jpg";
    if (/\bgloves?\b/.test(text)) return "assets/recommendation-stock/accessory-white-gloves-studio.jpg";
    if (/\bbag|tote|backpack\b/.test(text)) return "assets/recommendation-stock/accessory-tote-bag-studio.jpg";
    return "assets/recommendation-stock/accessory-watch-studio.jpg";
  }
  if (slotKey === "top" && /\b(thermal|base layer|baselayer|wool|merino|sweater|jumper|pullover|knit)\b/.test(text)) {
    return "assets/recommendation-stock/top-knit-sweater-hanger-studio.jpg";
  }
  return {
    top: "assets/recommendation-stock/top-white-tshirt-studio.jpg",
    pants: "assets/recommendation-stock/bottom-black-trousers-studio.jpg",
    jacket: "assets/recommendation-stock/outer-gray-jacket-studio.jpg",
    shoes: "assets/recommendation-stock/shoes-black-white-sneakers-studio.jpg",
    dress: "assets/recommendation-stock/top-black-wrap-dress-jersey-studio-fem.jpg",
  }[slotKey] || "assets/recommendation-stock/top-white-tshirt-studio.jpg";
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

function toWardrobeTitleCase(text = "") {
  const value = compactText(text, "");
  if (!value) return "";
  const smallWords = new Set(["and", "or", "of", "in", "with", "to"]);
  return value
    .split(/\s+/)
    .map((word, index) => word
      .split(/([/-])/)
      .map((part) => {
        if (part === "/" || part === "-") return part;
        const lower = part.toLowerCase();
        if (!part) return part;
        if (/^[A-Z0-9]{2,}$/.test(part)) return part;
        if (smallWords.has(lower) && index > 0) return lower;
        if (lower === "t") return "T";
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(""))
    .join(" ")
    .replace(/\bT Shirt\b/g, "T-shirt");
}

function normalizeWardrobeColorValue(value = "") {
  const text = compactText(value, "");
  if (!text) return "";
  const aliases = {
    grey: "Gray",
    offwhite: "Off-white",
    "off-white": "Off-white",
    creme: "Cream",
  };
  const normalizedKey = text.toLowerCase().replace(/\s+/g, "");
  if (aliases[normalizedKey]) return aliases[normalizedKey];
  return toWardrobeTitleCase(text).replace(/\bGrey\b/g, "Gray");
}

function normalizeWardrobeMaterialValue(value = "") {
  return toWardrobeTitleCase(value)
    .replace(/\bDenim Cotton\b/g, "Cotton Denim")
    .replace(/\bPu\b/g, "PU");
}

function normalizeWardrobeNameValue(value = "", fallbackType = "") {
  const normalized = preserveUsefulItemLabel(value || fallbackType);
  return normalized || preserveUsefulItemLabel(fallbackType);
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

function getRecommendationTileIcon(label) {
  const key = String(label || "").toLowerCase();
  if (key === "top") return renderInlineIcon("top");
  if (key === "bottom") return renderInlineIcon("pants");
  if (key === "outer") return renderInlineIcon("jacket");
  if (key === "shoes") return renderInlineIcon("shoes");
  return renderInlineIcon("accessory");
}

function getRecommendationCardArt(label, value, imageMatch = null) {
  const key = getRecommendationSlotArtKey(label, value);
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
    photo: imageMatch?.path || getRecommendationFallbackPhoto(label, value),
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
    itemDetails: {
      top: { color: "Easy neutral", material: cold ? "Soft knit jersey" : hot ? "Breathable cotton" : "Versatile jersey" },
      bottom: { color: wet ? "Dark neutral" : "Easy neutral", material: hot ? "Light cotton weave" : "Structured woven fabric" },
      outer: outer ? { color: "Weather-ready neutral", material: wet ? "Water-resistant shell" : "Light outerwear fabric" } : { color: "", material: "" },
      shoes: { color: "Neutral", material: wet ? "Water-resistant textile" : "Mesh and rubber" },
      accessory: accessories[0] === "Umbrella"
        ? { color: "Neutral", material: "Waterproof canopy fabric" }
        : accessories[0] === "Sunglasses"
          ? { color: "Dark neutral", material: "Tinted acetate and metal" }
          : accessories[0] === "Warm Scarf"
            ? { color: "Soft neutral", material: "Cozy knit" }
            : { color: "Classic neutral", material: "Polished mixed materials" },
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

function canonicalizeDetectedItemType(type = "") {
  const value = compactText(type, "");
  const key = value.toLowerCase();
  if (!key) return "";

  if (/^polo(\s+shirt)?$/.test(key)) return "Polo";
  if (/^(t[\s-]?shirt|tee|tee shirt)$/.test(key)) return "T-shirt";
  if (/^(shirt|button[\s-]?up|button[\s-]?down|dress shirt|oxford)$/.test(key)) return "Shirt";
  if (/^(tank|tank top)$/.test(key)) return "Tank top";
  if (/^(jacket|coat|hoodie|blazer|vest|sweater|jeans|shorts|skirt|dress|sneakers|boots|sandals|dress shoes|hat|gloves|sunglasses|belt|bag|other)$/.test(key)) {
    return value
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  if (/^(pants|trousers|slacks)$/.test(key)) return "Dress pants";
  if (/^(chino|chinos)$/.test(key)) return "Chinos";
  if (/^(sweatpant|sweatpants|joggers)$/.test(key)) return "Sweatpants";
  if (/^(shoe|loafer|loafers)$/.test(key)) return "Dress shoes";
  if (/^(cap|baseball cap|beanie|sun hat)$/.test(key)) return "Hat";
  if (/^(scarf)$/.test(key)) return "Scarf";
  if (/^(belt bag|tote bag|backpack|handbag)$/.test(key)) return "Bag";
  if (/^(watch|bracelet|socks|umbrella)$/.test(key)) return "Other";

  return value;
}

function inferDetectedItemType(type = "", name = "") {
  const rawType = compactText(type, "");
  const rawName = compactText(name, "");
  const combined = `${rawType} ${rawName}`.toLowerCase();
  if (!combined) return canonicalizeDetectedItemType(rawType);

  if (/\bpolo\b/.test(combined)) return "Polo";
  if (/\b(t[\s-]?shirt|tee)\b/.test(combined)) return "T-shirt";
  if (/\b(button[\s-]?up|button[\s-]?down|oxford|dress shirt)\b/.test(combined)) return "Shirt";
  if (/\b(tank(\s+top)?)\b/.test(combined)) return "Tank top";
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

  return canonicalizeDetectedItemType(rawType);
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
    ? wardrobeItems.filter((item) => getItemDisplayPhoto(item) && item?.name)
    : [];
  if (!photoItems.length) return {};

  const inferClientRecommendationSubtype = (slotKey, text = "") => {
    const slot = String(slotKey || "").toLowerCase();
    const valueText = normalizeItemLabel(text).toLowerCase();
    if (!valueText) return "";
    if (slot === "top") {
      if (/\b(sweater dress|knit dress|dress)\b/.test(valueText)) return "dress";
      if (/\b(thermal|base layer|baselayer)\b/.test(valueText)) return "thermal";
      if (/\bcardigan\b/.test(valueText)) return "cardigan";
      if (/\bhoodie\b/.test(valueText)) return "hoodie";
      if (/\bpolo\b/.test(valueText)) return "polo";
      if (/\b(t-?shirt|tee)\b/.test(valueText)) return "tee";
      if (/\b(sweater|jumper|pullover|crewneck|knit|merino)\b/.test(valueText)) return "sweater";
      if (/\bshirt|button[-\s]?up|oxford|blouse\b/.test(valueText)) return "shirt";
    }
    if (slot === "bottom") {
      if (/\bjeans?|denim\b/.test(valueText)) return "jeans";
      if (/\bchinos?\b/.test(valueText)) return "chinos";
      if (/\bshorts?\b/.test(valueText)) return "shorts";
      if (/\bskirt\b/.test(valueText)) return "skirt";
      if (/\btrousers?|pants|slacks?\b/.test(valueText)) return "trousers";
    }
    if (slot === "outer") {
      if (/\bfleece|sherpa\b/.test(valueText)) return "fleece";
      if (/\brain|waterproof|shell|weatherproof|windbreaker\b/.test(valueText)) return "shell";
      if (/\bparka|puffer|down\b/.test(valueText)) return "parka";
      if (/\bcoat|overcoat|trench\b/.test(valueText)) return "coat";
      if (/\bhoodie\b/.test(valueText)) return "hoodie";
      if (/\bovershirt|shacket|shirt jacket\b/.test(valueText)) return "overshirt";
      if (/\bjacket\b/.test(valueText)) return "jacket";
    }
    if (slot === "shoes") {
      if (/\bboot|chelsea\b/.test(valueText)) return "boots";
      if (/\bsneakers?|trainers?|runners?\b/.test(valueText)) return "sneakers";
      if (/\bloafer|oxford|derby|brogue\b/.test(valueText)) return "dress-shoes";
      if (/\bsandal|slide\b/.test(valueText)) return "sandals";
    }
    if (slot === "accessory") {
      if (/\bbaseball cap|dad cap|snapback|cap\b/.test(valueText)) return "baseball-cap";
      if (/\bgloves?\b/.test(valueText)) return "gloves";
      if (/\bbeanie|beret\b/.test(valueText)) return "beanie";
      if (/\bsunglasses?\b/.test(valueText)) return "sunglasses";
      if (/\bwatch\b/.test(valueText)) return "watch";
      if (/\bbag|tote|backpack|clutch\b/.test(valueText)) return "bag";
    }
    return "";
  };

  const scoredMatchFor = (slotKey, value) => {
    const normalizedValue = normalizeItemLabel(value).toLowerCase();
    if (!normalizedValue) return null;
    const wantedType = normalizeWardrobeType(slotKey);
    const wantedTokens = normalizedValue.split(/\s+/).filter((token) => token.length > 2);
    const wantedSubtype = inferClientRecommendationSubtype(wantedType, normalizedValue);

    let best = null;
    let bestScore = 0;
    let bestReasons = [];

    for (const item of photoItems) {
      const itemType = normalizeWardrobeType(item.type);
      if (wantedType && itemType && itemType !== wantedType) continue;

      const itemName = normalizeItemLabel(item.name).toLowerCase();
      const itemText = normalizeItemLabel(`${item.name || ""} ${item.type || ""} ${item.color || ""} ${item.material || ""}`).toLowerCase();
      if (!itemName) continue;
      const itemSubtype = inferClientRecommendationSubtype(wantedType, item.name)
        || inferClientRecommendationSubtype(wantedType, item.type)
        || inferClientRecommendationSubtype(wantedType, itemText);

      let score = 0;
      const reasons = [];
      const exactName = itemName === normalizedValue;
      const nameContains = itemName.includes(normalizedValue) || normalizedValue.includes(itemName);
      if (exactName) {
        score += 14;
        reasons.push("exact_name");
      }
      if (nameContains) {
        score += 10;
        reasons.push("name_contains");
      }
      if (wantedSubtype && itemSubtype && wantedSubtype === itemSubtype) {
        score += 8;
        reasons.push("subtype_match");
      } else if (wantedSubtype && itemSubtype && !nameContains) {
        score -= 12;
        reasons.push("subtype_mismatch");
      }

      const itemTokens = itemText.split(/\s+/).filter((token) => token.length > 2);
      const overlap = wantedTokens.filter((token) => itemTokens.includes(token)).length;
      if (overlap) {
        score += overlap * 2;
        reasons.push("token_overlap");
      }

      if (wantedTokens.length && overlap === wantedTokens.length) {
        score += 3;
        reasons.push("all_tokens_match");
      }

      if (score > bestScore) {
        bestScore = score;
        best = item;
        bestReasons = reasons;
      }
    }

    if (!best || bestScore < 12) return null;
    return {
      path: getItemDisplayPhoto(best),
      source: "wardrobe",
      matchQuality: bestScore >= 22 ? "strong_local_wardrobe" : "local_wardrobe",
      matchScore: bestScore,
      matchReasons: bestReasons,
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

function mergeRecommendationImageMatches(serverMatches = {}, wardrobeMatches = {}) {
  const merged = { ...(serverMatches || {}) };
  Object.entries(wardrobeMatches || {}).forEach(([key, match]) => {
    if (!match || match.source !== "wardrobe") return;
    const serverMatch = merged[key];
    if (serverMatch?.source === "wardrobe") return;
    if (!serverMatch || Number(match.matchScore || 0) >= 18) {
      merged[key] = match;
    }
  });
  return merged;
}

function buildWardrobeItemMatches(entries, wardrobeItems = []) {
  const items = Array.isArray(wardrobeItems)
    ? wardrobeItems.filter((item) => item?.name)
    : [];
  if (!items.length) return {};

  const scoredMatchFor = (slotKey, value) => {
    const normalizedValue = normalizeItemLabel(value).toLowerCase();
    if (!normalizedValue) return null;
    const wantedType = normalizeWardrobeType(slotKey);
    const wantedTokens = normalizedValue.split(/\s+/).filter((token) => token.length > 2);

    let best = null;
    let bestScore = 0;

    for (const item of items) {
      const itemType = normalizeWardrobeType(item.type);
      if (wantedType && itemType && itemType !== wantedType) continue;

      const itemName = normalizeItemLabel(`${item.name || ""} ${item.type || ""}`).toLowerCase();
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

    if (!best || bestScore < 4) return null;
    return best;
  };

  return entries.reduce((acc, entry, index) => {
    const normalizedEntry = normalizeRecommendationEntry(entry, index);
    const slotKey = String(normalizedEntry.label || "").toLowerCase();
    const match = scoredMatchFor(slotKey, normalizedEntry.value);
    if (match) acc[normalizedEntry.key] = match;
    return acc;
  }, {});
}

function getRecommendationCategoryPreset(label = "") {
  const normalized = normalizeWardrobeType(label);
  if (normalized === "top") return "T-shirt";
  if (normalized === "bottom") return "Jeans";
  if (normalized === "outer") return "Jacket";
  if (normalized === "shoes") return "Sneakers";
  if (normalized === "accessory") return "Bag";
  return "Other";
}

function getRecommendationWardrobeSummary(rowEntries = [], wardrobeItems = [], imageMatches = {}) {
  const serverMatches = rowEntries.reduce((acc, entry) => {
    const normalizedEntry = normalizeRecommendationEntry(entry);
    const slotKey = String(normalizedEntry.label || "").toLowerCase();
    const match = imageMatches?.[normalizedEntry.key] || imageMatches?.[slotKey] || null;
    if (match?.source !== "wardrobe") return acc;
    acc[normalizedEntry.key] = {
      id: match.itemId ?? null,
      type: match.type || normalizedEntry.label || "",
      name: match.itemName || normalizedEntry.value || "",
      color: match.color || "",
      material: match.material || "",
      careInstructions: Array.isArray(match.careInstructions) ? match.careInstructions : [],
    };
    return acc;
  }, {});
  const directMatches = Object.keys(serverMatches).length
    ? serverMatches
    : buildWardrobeItemMatches(rowEntries, wardrobeItems);
  const matchedCount = rowEntries.filter((entry) => directMatches[entry.key]).length;
  const totalCount = rowEntries.length;
  const missingCount = Math.max(0, totalCount - matchedCount);
  const coverage = totalCount ? Math.round((matchedCount / totalCount) * 100) : 0;
  const confidence = coverage >= 75 ? "High" : coverage >= 40 ? "Medium" : "Low";
  return { matchedCount, totalCount, missingCount, coverage, confidence, directMatches };
}

function describeRecommendationCoverage(summary = {}) {
  const coverage = Number(summary.coverage || 0);
  if (coverage >= 80) return `${coverage}% closet match`;
  if (coverage >= 50) return `${coverage}% of this look already lives in your wardrobe`;
  return `${coverage}% matched so far`;
}

function describeRecommendationConfidence(summary = {}) {
  const confidence = String(summary.confidence || "").toLowerCase();
  if (confidence === "high") return "Strong match confidence";
  if (confidence === "medium") return "Solid match confidence";
  return "Early match confidence";
}

function buildLookSignature(outfit = {}) {
  return [
    outfit.top || "",
    outfit.bottom || "",
    outfit.outer || "",
    outfit.shoes || "",
    ...(Array.isArray(outfit.accessories) ? outfit.accessories : [outfit.accessories || ""]),
  ].map((value) => normalizeItemLabel(value).toLowerCase()).filter(Boolean).join("|");
}

function saveRecommendationLook(payload) {
  if (!payload) return false;
  const state = loadState();
  const existing = Array.isArray(state.savedLooks) ? state.savedLooks : [];
  const signature = payload.signature || buildLookSignature(payload.outfit);
  const isAlreadySaved = existing.some((entry) => entry.signature === signature);
  if (!hasPremiumAccess(state) && !isAlreadySaved && existing.length >= FREE_SAVED_LOOK_LIMIT) {
    openPaywall("saved_looks_cap", { source: "save-look" });
    showAppToast(`Free includes ${FREE_SAVED_LOOK_LIMIT} saved looks. Go premium to keep more outfit references.`, "warning");
    trackAnalyticsEvent("free_limit_hit", { title: "free_limit_hit:saved_looks_cap" });
    return false;
  }
  const nextEntry = {
    id: payload.id || `look-${Date.now()}`,
    createdAt: payload.createdAt || new Date().toISOString(),
    headline: payload.headline || "Saved look",
    subtitle: payload.subtitle || "",
    locationName: payload.locationName || "",
    coverage: payload.coverage || 0,
    missingItems: Array.isArray(payload.missingItems) ? payload.missingItems : [],
    signature,
    outfit: payload.outfit || {},
  };
  const nextLooks = [nextEntry, ...existing.filter((entry) => entry.signature !== signature)]
    .slice(0, hasPremiumAccess(state) ? PREMIUM_SAVED_LOOK_LIMIT : FREE_SAVED_LOOK_LIMIT);
  saveState({ savedLooks: nextLooks });
  trackAnalyticsEvent("saved_look_added", {
    title: "saved_look_added",
    totalSavedLooks: nextLooks.length,
    coverage: Number(nextEntry.coverage || 0),
  });
  return true;
}

function renderSavedLookHistory(savedLooks = []) {
  if (!savedLooks.length) return "";
  const visibleLooks = savedLooksExpanded ? savedLooks : savedLooks.slice(0, 2);
  const toggleLabel = savedLooksExpanded ? "Show fewer" : `View all ${savedLooks.length}`;
  return `
    <section class="today-wardrobe-history">
      <div class="today-wardrobe-history-head">
        <span class="today-cta-kicker">Saved looks</span>
        <strong>Recent outfit references</strong>
        <span>Saved to this device for now so you can find them again from Today.</span>
      </div>
      <div class="today-wardrobe-history-list">
        ${visibleLooks.map((look) => `
          <div class="today-wardrobe-history-item">
            <strong>${escapeHtml(look.headline || "Saved look")}</strong>
            <span>${escapeHtml(look.locationName || "Saved on this device")}</span>
          </div>
        `).join("")}
      </div>
      ${savedLooks.length > 2 ? `
        <div class="today-wardrobe-history-actions">
          <button type="button" class="today-details-button" data-rec-action="toggle-saved-looks">${toggleLabel}</button>
        </div>
      ` : ""}
    </section>
  `;
}

function renderRecommendationWardrobeLoop(summary, data) {
  const savedLooks = Array.isArray(loadState().savedLooks) ? loadState().savedLooks : [];
  const missingItems = Array.isArray(data?.missingItems) ? data.missingItems.filter(Boolean) : [];
  const currentSignature = buildLookSignature(data?.outfit || {});
  const isAlreadySaved = savedLooks.some((entry) => entry.signature === currentSignature);
  const matchedCount = Number(summary?.matchedCount || 0);
  const totalCount = Number(summary?.totalCount || 0);
  const missingCount = Number(summary?.missingCount || 0);
  const matchHeadline = matchedCount
    ? `${matchedCount} of ${totalCount || 0} pieces already match what you own`
    : "Add your first pieces to make this look yours";
  const matchCopy = matchedCount
    ? (missingCount ? `${missingCount} piece${missingCount === 1 ? "" : "s"} still need a match, so this look is partly grounded in your closet already.` : "This look is fully grounded in your real wardrobe, so it should be easy to wear today.")
    : "Add a few staples and WearCast can replace these suggestions with clothes you actually own.";

  return `
    <section class="today-wardrobe-loop">
      <div class="today-wardrobe-loop-summary">
        <div>
          <span class="today-cta-kicker">From your wardrobe</span>
          <strong>${matchHeadline}</strong>
          <p>${matchCopy}</p>
        </div>
        <div class="today-wardrobe-loop-metrics">
          <span class="today-rec-meta-chip">${escapeHtml(describeRecommendationCoverage(summary))}</span>
          <span class="today-rec-meta-chip">${escapeHtml(describeRecommendationConfidence(summary))}</span>
        </div>
      </div>
      <div class="today-wardrobe-loop-actions">
        <button type="button" class="btn-primary today-wardrobe-loop-primary" data-rec-action="open-wardrobe">Open wardrobe</button>
        <button type="button" class="today-details-button" data-rec-action="save-look">${isAlreadySaved ? "Saved to looks" : "Save this look"}</button>
      </div>
      ${missingItems.length ? `
        <div class="today-wardrobe-gap-list">
          <div class="today-wardrobe-gap-section-head">
            <span class="today-cta-kicker">Recommendation gap</span>
            <strong>Add or swap one of these pieces to close the look</strong>
          </div>
          ${missingItems.map((item) => `
            <div class="today-wardrobe-gap-card">
              <div>
                <strong>${escapeHtml(item)}</strong>
                <p>Add a similar piece or swap to something you already own.</p>
              </div>
              <div class="today-wardrobe-gap-actions">
                <button type="button" class="today-feedback-chip" data-rec-action="use-owned" data-rec-missing-item="${escapeHtml(item)}">Use one I own instead</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : ""}
      ${renderSavedLookHistory(savedLooks)}
    </section>
  `;
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
        color: compactText(wardrobeDetails.color, ""),
        material: compactText(wardrobeDetails.material, ""),
        note: item.reason || "",
      }
    : aiDetails
      ? {
          color: compactText(aiDetails.color, ""),
          material: compactText(aiDetails.material, ""),
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

function getRecommendationCollageTextPlacement(positionClass = "") {
  const position = String(positionClass || "");
  if (/middle-right/.test(position)) return "has-text-middle-right";
  if (/middle-left/.test(position)) return "has-text-middle-left";
  if (/top-right/.test(position)) return "has-text-top-right";
  if (/top-center/.test(position)) return "has-text-top-center";
  if (/top-left/.test(position)) return "has-text-top-left";
  if (/bottom-right|bottom-right-wide/.test(position)) return "has-text-bottom-right";
  if (/bottom-center/.test(position)) return "has-text-bottom-center";
  if (/bottom-left|bottom-left-wide/.test(position)) return "has-text-bottom-left";
  return "has-text-bottom-left";
}

function renderRecommendationDeck(entries, weather, imageMatches = {}, slotReasons = {}) {
  if (!entries.length) return "";
  const normalizedEntries = entries.map((entry, index) => normalizeRecommendationEntry(entry, index));
  const accessoryCount = normalizedEntries.filter((entry) => compactText(entry.label, "").toLowerCase() === "accessory").length;
  const positionClasses = buildRecommendationCollageLayout(normalizedEntries);
  const collageItems = normalizedEntries.map((normalizedEntry, index) => {
    const slotKey = String(normalizedEntry.label || "").toLowerCase();
    const imageMatch = imageMatches?.[normalizedEntry.key] || imageMatches?.[slotKey] || null;
    const art = getRecommendationCardArt(normalizedEntry.label, normalizedEntry.value, imageMatch);
    const reason = buildRecommendationItemReason(normalizedEntry.label, normalizedEntry.value, weather, slotReasons?.[normalizedEntry.key] || slotReasons?.[slotKey] || "");
    return {
      index,
      label: normalizedEntry.label,
      value: normalizedEntry.value,
      key: normalizedEntry.key,
      tone: art.tone,
      photo: art.photo,
      icon: art.icon,
      fromWardrobe: imageMatch?.source === "wardrobe",
      imageConfidence: Number(imageMatch?.confidence || 0),
      reason,
      positionClass: positionClasses[index] || "is-grid-center",
      textPlacementClass: getRecommendationCollageTextPlacement(positionClasses[index] || "is-grid-center"),
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
            class="today-rec-collage-item today-rec-collage-item-${escapeHtml(item.tone)} ${escapeHtml(item.positionClass)} ${escapeHtml(item.textPlacementClass)}"
            data-rec-item-index="${item.index}"
            aria-label="Open ${escapeHtml(item.value)}"
          >
            <span class="today-rec-collage-photo-wrap">
              ${item.photo ? `<img class="today-rec-collage-photo" src="${item.photo}" alt="" draggable="false" />` : `<span class="today-rec-collage-art">${item.icon}</span>`}
            </span>
            ${item.fromWardrobe ? `<span class="today-rec-collage-wardrobe-mark">W A R D R O B E</span>` : ""}
            <span class="today-rec-collage-chip">${escapeHtml(item.label)}</span>
            <span class="today-rec-collage-name">${escapeHtml(item.value)}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function buildRecommendationCollageLayout(entries = []) {
  const count = entries.length;
  if (count <= 1) return ["is-grid-center"];
  if (count === 2) return ["is-grid-middle-left", "is-grid-middle-right"];
  if (count === 3) return ["is-grid-top-left", "is-grid-top-right", "is-grid-bottom-center"];
  if (count === 4) return ["is-grid-top-left", "is-grid-top-right", "is-grid-bottom-left", "is-grid-bottom-right"];
  if (count === 5) return ["is-grid-top-left", "is-grid-top-center", "is-grid-top-right", "is-grid-bottom-left-wide", "is-grid-bottom-right-wide"];
  return ["is-grid-top-left", "is-grid-top-center", "is-grid-top-right", "is-grid-bottom-left", "is-grid-bottom-center", "is-grid-bottom-right"];
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

function renderRecommendationControls({ mode = "default" } = {}) {
  const prefs = pendingRecommendationPrefs || loadState().prefs || {};
  const comfortValue = prefs.cold ? "cold" : prefs.hot ? "hot" : "neutral";
  const isActivationMode = mode === "activation";
  const groups = isActivationMode
    ? [
        {
          label: "Comfort",
          key: "comfortBias",
          activeValue: comfortValue,
          options: [
            ["neutral", "Balanced"],
            ["cold", "Usually cold"],
            ["hot", "Usually warm"],
          ],
        },
        {
          label: "Day type",
          key: "activityContext",
          activeValue: prefs.activityContext || DEFAULT_STATE.prefs.activityContext,
          options: [
            ["everyday", "Everyday"],
            ["office", "Office"],
            ["workout", "Active"],
            ["evening", "Evening"],
          ],
        },
        {
          label: "Style",
          key: "styleFocus",
          activeValue: prefs.styleFocus || DEFAULT_STATE.prefs.styleFocus,
          options: [
            ["casual", "Casual"],
            ["polished", "Polished"],
            ["sporty", "Sporty"],
            ["minimalist", "Minimalist"],
          ],
        },
        {
          label: "Cut",
          key: "gender",
          activeValue: prefs.gender || DEFAULT_STATE.prefs.gender,
          options: [
            ["unspecified", "Auto"],
            ["male", "Men's"],
            ["female", "Women's"],
            ["nonbinary", "Mixed"],
          ],
        },
      ]
    : [
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
        {
          label: "Cut",
          key: "gender",
          activeValue: prefs.gender || DEFAULT_STATE.prefs.gender,
          options: [
            ["unspecified", "Auto"],
            ["male", "Men's"],
            ["female", "Women's"],
            ["nonbinary", "Mixed"],
          ],
        },
      ];

  const descriptions = isActivationMode
    ? {
        Comfort: "Tell WearCast whether you usually need a warmer or lighter outfit.",
        "Day type": "Choose the shape of today so the recommendation fits the moment.",
        Style: "Pick the vibe you want without losing the weather logic.",
      }
    : {
        Comfort: "Bias the outfit warmer or lighter based on how you usually feel.",
        Activity: "Adjust the look for how much movement your day actually has.",
        Setting: "Tell WearCast whether you’ll stay inside, outside, or in transit.",
        Style: "Shift the overall vibe without changing the weather logic.",
      };

  return `
    <div class="today-control-groups">
      <div class="today-control-intro">
        <span class="today-control-intro-kicker">${isActivationMode ? "Quick tune" : "Personal fit"}</span>
        <strong>${isActivationMode ? "Make the next recommendation feel more like you." : "Tell WearCast what kind of day this really is."}</strong>
        <p>${isActivationMode ? "Answer three quick questions and WearCast will refresh today’s look with a better fit." : "Adjust the human context around the forecast. Weather still stays in charge, but the outfit should feel more like yours."}</p>
        <div class="today-control-summary">${escapeHtml(summarizeRecommendationTuning(prefs))}</div>
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
      ${!isActivationMode ? `
        <div class="today-control-group today-control-notes">
          <div class="today-control-heading">
            <div>
              <div class="today-control-label">Notes</div>
              <p class="today-control-help">Optional details like “dinner after work”, “walking a lot”, or “avoid bulky layers”.</p>
            </div>
            <span class="today-control-current">Optional</span>
          </div>
          <textarea
            class="today-tuning-notes"
            data-rec-notes
            maxlength="180"
            placeholder="Anything WearCast should know about today?"
          >${escapeHtml(prefs.fashionNotes || "")}</textarea>
        </div>
      ` : ""}
      <div class="today-control-actions">
        <button type="button" class="btn-primary-sm today-update-btn" data-rec-action="apply">${isActivationMode ? "Save and refresh" : "Refresh today’s look"}</button>
        ${isActivationMode
          ? '<button type="button" class="today-secondary-action" data-rec-action="skip-activation-tune">Maybe later</button>'
          : '<button type="button" class="today-secondary-action" data-rec-action="reset-tuning">Reset to defaults</button>'}
      </div>
    </div>
  `;
}

function normalizeRecommendationPrefs(prefs = {}) {
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
  const allowedGender = new Set(["unspecified", "male", "female", "nonbinary"]);
  const rawGender = String(prefs.gender || "").toLowerCase().trim();
  const normalizedGender = genderAliases[rawGender] || rawGender;
  const gender = allowedGender.has(normalizedGender)
    ? normalizedGender
    : DEFAULT_STATE.prefs.gender;
  const normalized = {
    ...prefs,
    gender,
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
  if (note) {
    practicalNotes.push(/unavailable/i.test(note) ? "AI stylist temporarily unavailable." : note);
  }
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

function renderRecommendationTrustSignals(data = {}, weather = {}, wardrobeSummary = {}) {
  const serverSignals = Array.isArray(data.trustSignals) ? data.trustSignals.filter(Boolean) : [];
  const localSignals = buildRecommendationMeta(weather, data.outfit || {}).map((chip) => chip.text).filter(Boolean);
  const wardrobeSignal = Number(wardrobeSummary.matchedCount || 0) > 0
    ? `${wardrobeSummary.matchedCount} from your wardrobe`
    : "Suggested staples";
  const qualitySignals = data.quality?.severeCount > 0
    ? ["Needs review"]
    : ["Weather checked"];
  const chips = Array.from(new Set([...serverSignals, ...localSignals, wardrobeSignal, ...qualitySignals]))
    .slice(0, 5)
    .map((text) => ({ kind: /review/i.test(text) ? "warning" : /wardrobe|closet/i.test(text) ? "wardrobe" : "default", text }));
  return renderRecommendationMeta(chips);
}

function renderRecommendationFeedbackPanel() {
  const options = [
    ["good", "This was good"],
    ["too_warm", "Too warm"],
    ["too_cold", "Too cold"],
    ["too_formal", "Too formal"],
    ["too_casual", "Too casual"],
    ["not_my_style", "Not my style"],
    ["use_more_wardrobe", "Use more wardrobe"],
  ];
  return `
    <section class="today-feedback-panel" aria-label="Recommendation feedback">
      <div class="today-feedback-copy">
        <span class="today-feedback-kicker">Tune WearCast</span>
        <strong>Did this feel right for today?</strong>
      </div>
      <div class="today-feedback-actions">
        ${options.map(([value, label]) => `<button type="button" class="today-feedback-chip" data-rec-feedback="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join("")}
      </div>
    </section>
  `;
}

function renderActivationTunePrompt(state = loadState()) {
  if (!shouldPromptActivationTune(state)) return "";
  const analytics = getAnalyticsState(state);
  if (!analytics.activationTunePromptSeen) {
    window.setTimeout(() => {
      const latest = loadState();
      const latestAnalytics = getAnalyticsState(latest);
      if (latestAnalytics.activationTunePromptSeen || !shouldPromptActivationTune(latest)) return;
      trackAnalyticsEvent("activation_tune_prompt_viewed", { title: "activation_tune_prompt_viewed" });
      saveState({
        analytics: {
          ...latestAnalytics,
          activationTunePromptSeen: true,
        },
      });
    }, 0);
  }
  return `
    <section class="today-activation-tune-panel" aria-label="Recommendation tuning">
      <div class="today-activation-tune-copy">
        <span class="today-cta-kicker">Make it yours</span>
        <strong>Want the next recommendation to fit your day better?</strong>
        <p>Answer a few quick questions about warmth, plans, and style. WearCast will refresh today’s look without losing the weather logic.</p>
      </div>
      <div class="today-activation-tune-actions">
        <button type="button" class="btn-primary-sm" data-rec-action="activation-tune">Adjust</button>
        <button type="button" class="today-details-button" data-rec-action="skip-activation-tune">Maybe later</button>
      </div>
    </section>
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
        <strong>Using weather-based styling today</strong>
        <span>A quick read on the look, the weather fit, and anything practical to keep in mind.</span>
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
          ${item.reason ? `<p class="today-item-dialog-info-copy">${escapeHtml(item.reason || "")}</p>` : ""}
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

function openTuneLookDialog({ mode = "default" } = {}) {
  if (!els.tuneLookDialog || !els.tuneLookDialogBody) return;
  const isActivationMode = mode === "activation";
  const analytics = getAnalyticsState(loadState());
  if (isActivationMode && !analytics.activationTuneSeen) {
    trackAnalyticsEvent("activation_tune_viewed", { title: "activation_tune_viewed" });
    saveState({
      analytics: {
        ...analytics,
        activationTuneSeen: true,
      },
    });
  }
  els.tuneLookDialog.dataset.mode = mode;
  if (els.tuneLookDialogKicker) {
    els.tuneLookDialogKicker.textContent = isActivationMode ? "Quick tune" : "Outfit tuning";
  }
  if (els.tuneLookDialogTitle) {
    els.tuneLookDialogTitle.textContent = isActivationMode
      ? "Make the next recommendation fit you better"
      : "Adjust today’s recommendation";
  }
  if (els.tuneLookDialogSubtitle) {
    els.tuneLookDialogSubtitle.textContent = isActivationMode
      ? "Answer three quick questions and WearCast will refresh today’s outfit with a more personal fit."
      : "Tune comfort, plans, setting, style, and any notes before WearCast rebuilds the look.";
  }
  els.tuneLookDialogBody.innerHTML = renderRecommendationControls({ mode });
  if (typeof els.tuneLookDialog.showModal === "function") els.tuneLookDialog.showModal();
}

function getStarterTypePreset(type = "") {
  const normalized = compactText(type, "").toLowerCase();
  if (!normalized) return {};
  const presetMap = {
    shirt: {
      type: "Shirt",
      name: "Everyday shirt",
      guideLabel: "Staple tops",
      benefit: "This gives WearCast a reliable top to build around.",
    },
    "t-shirt": {
      type: "T-shirt",
      name: "Everyday tee",
      guideLabel: "Staple tops",
      benefit: "This gives WearCast a reliable top to build around.",
    },
    jacket: {
      type: "Jacket",
      name: "Light jacket",
      guideLabel: "Outerwear",
      benefit: "This helps future recommendations handle layering and temperature swings.",
    },
    jeans: {
      type: "Jeans",
      name: "Everyday jeans",
      guideLabel: "Bottoms",
      benefit: "This gives future recommendations a dependable bottom option.",
    },
    chinos: {
      type: "Chinos",
      name: "Everyday trousers",
      guideLabel: "Bottoms",
      benefit: "This gives future recommendations a dependable bottom option.",
    },
    sneakers: {
      type: "Sneakers",
      name: "Daily sneakers",
      guideLabel: "Shoes",
      benefit: "Shoes make outfit recommendations feel much more wearable.",
    },
    boots: {
      type: "Boots",
      name: "Weather-ready boots",
      guideLabel: "Shoes",
      benefit: "This helps WearCast handle rain and cold-weather outfit picks.",
    },
  };
  return {
    type,
    name: "",
    guideLabel: "",
    benefit: "",
    ...(presetMap[normalized] || {}),
  };
}

function showAppToast(message, tone = "info", options = {}) {
  const existing = document.querySelector(".app-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = `app-toast app-toast-${tone}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  if (options?.clickable) {
    toast.setAttribute("role", "button");
    toast.tabIndex = 0;
    toast.style.cursor = "pointer";
    toast.title = options.clickLabel || "Open";
    const activate = () => {
      try { options.onClick?.(); } finally {
        toast.classList.remove("is-visible");
        window.setTimeout(() => toast.remove(), 120);
      }
    };
    toast.addEventListener("click", activate);
    toast.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  }
  // A <dialog> opened via showModal() enters the top layer, which covers any
  // element in document.body regardless of z-index. If a modal is open, append
  // the toast inside it so it shares the same top-layer stack.
  let openModal = null;
  try {
    openModal = Array.from(document.querySelectorAll("dialog[open]"))
      .reverse()
      .find((d) => {
        try { return d.matches(":modal"); } catch { return false; }
      }) || null;
  } catch {}
  (openModal || document.body).appendChild(toast);
  window.setTimeout(() => toast.classList.add("is-visible"), 20);
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 220);
  }, 1800);
}

async function runForLocation(loc) {
  if (!loc) return;

  trackAnalyticsEvent("weather_requested", {
    title: "weather_requested",
    source: shouldShowOnboardingDeck(loadState()) ? "onboarding" : "today",
    locationName: loc.name || "",
  });
  setStatus(`Fetching weather for ${loc.name}…`);
  try {
    const weatherStartedAt = performance.now();
    const data = await fetchWeather(loc.lat, loc.lon);
    trackAnalyticsEvent("weather_fetched", {
      title: "weather_fetched",
      source: shouldShowOnboardingDeck(loadState()) ? "onboarding" : "today",
      durationMs: Math.round(performance.now() - weatherStartedAt),
      provider: data?.provider || "",
      locationName: loc.name || "",
    });
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

    const updated = new Date(data.current.time || Date.now());
    els.updatedAt.textContent = `Updated ${updated.toLocaleString()}`;
    latestWeatherSnapshot = {
      ...(latestWeatherSnapshot || {}),
      location: loc,
      updatedLabel: `Updated ${updated.toLocaleString()}`,
    };
    renderWeatherExpandedPanel();

    setStatus(`Using: ${loc.name}`);
    saveState({ lastLocation: loc });

    // AI recommendation (non-blocking). Save location first so the request
    // and cache key are based on the just-fetched place.
    fetchAIRecommendation(data, current, ctx, loc);
  } catch (err) {
    console.error(err);
    setEmptyStateLoading(false);
    setStatus(`Error: ${err.message}`);
  }
}

async function onSearch() {
  const query = (els.placeInput.value || "").trim();
  hideAC();
  els.placeInput?.blur?.();
  if (!query) {
    setStatus("Enter a location (e.g., \"Berlin\") or use \"Use my location\".");
    return;
  }

  trackAnalyticsEvent("location_search_started", {
    title: "location_search_started",
    source: shouldShowOnboardingDeck(loadState()) ? "onboarding" : "today",
    queryLength: query.length,
  });
  setStatus(`Searching for “${query}”…`);
  try {
    const loc = await geocodePlace(query);
    if (!loc) {
      trackAnalyticsEvent("location_search_failed", {
        title: "location_search_failed:no_result",
        source: shouldShowOnboardingDeck(loadState()) ? "onboarding" : "today",
      });
      setStatus(`No results for “${query}”. Try a city + country (e.g., “Paris, FR”).`);
      return;
    }
    saveState({ lastQuery: query, lastLocation: loc });
    trackAnalyticsEvent("location_search_succeeded", {
      title: "location_search_succeeded",
      source: shouldShowOnboardingDeck(loadState()) ? "onboarding" : "today",
      locationName: loc.name || "",
    });
    hideAC();
    await runForLocation(loc);
  } catch (err) {
    trackAnalyticsEvent("location_search_failed", {
      title: "location_search_failed:error",
      source: shouldShowOnboardingDeck(loadState()) ? "onboarding" : "today",
      reason: err?.message || "error",
    });
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
    return await getGeo();
  } catch (err) {
    const message = String(err?.message || "");
    const shouldFallback =
      /unavailable/i.test(message) ||
      /timeout/i.test(message) ||
      /position/i.test(message);

    if (!shouldFallback) throw err;

    return getGeoFresh();
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

function onUseMyLocation(source = "today") {
  // IMPORTANT (mobile Safari/Chrome): the geolocation permission prompt often only appears
  // when geolocation is requested *synchronously* from a user gesture.
  // So: do NOT open dialogs/confirm prompts before calling geolocation.

  // Quick environment checks
  if (!isNative && typeof window !== "undefined" && window.isSecureContext === false) {
    trackAnalyticsEvent("location_permission_failed", {
      title: "location_permission_failed:insecure_context",
      source,
      reason: "insecure_context",
    });
    setLocationLoading(false);
    setStatus("Location requires HTTPS. Open WearCast via https://… (not a local file or http://)." );
    return;
  }

  trackAnalyticsEvent("location_permission_requested", {
    title: "location_permission_requested",
    source,
  });
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
        trackAnalyticsEvent("location_permission_granted", {
          title: "location_permission_granted",
          source,
          locationName: loc.name || "",
        });
        await runForLocation(loc);
        setLocationLoading(false);
        if (!consent.seen) showConsentDialog({ forceModal: true });
      } catch (err) {
        trackAnalyticsEvent("location_permission_failed", {
          title: "location_permission_failed:native_error",
          source,
          reason: err?.message || "error",
        });
        setLocationLoading(false);
        setStatus(`Location error: ${err.message || "Could not get current location"}`);
        if (!consent.seen) showConsentDialog({ forceModal: true });
      }
    })();
    return;
  }

  if (!navigator.geolocation) {
    trackAnalyticsEvent("location_permission_failed", {
      title: "location_permission_failed:unsupported",
      source,
      reason: "unsupported",
    });
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
      trackAnalyticsEvent("location_permission_granted", {
        title: "location_permission_granted",
        source,
        locationName: loc.name || "",
      });
      await runForLocation(loc);
      setLocationLoading(false);
      if (!consent.seen) showConsentDialog({ forceModal: true });
    } catch (err) {
      trackAnalyticsEvent("location_permission_failed", {
        title: "location_permission_failed:web_error",
        source,
        reason: err?.message || "error",
      });
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
  const state = loadState();
  const planSummary = getPlanSummary(state);
  if (authUser) {
    els.settingsAccountTitle.textContent = authUser.name || authUser.email || "Signed in";
    els.settingsAccountStatus.textContent = authUser.email
      ? `${authUser.email} • ${authUser.authProvider === "google" ? "Google account" : "Email account"} • ${planSummary}`
      : "Your account is connected.";
    if (els.settingsAccountBtn) els.settingsAccountBtn.querySelector("strong").textContent = "Open account";
    if (els.settingsDeleteAccountBtn) els.settingsDeleteAccountBtn.style.display = "";
  } else {
    els.settingsAccountTitle.textContent = "Not signed in";
    els.settingsAccountStatus.textContent = `Sign in to sync your wardrobe and account settings. Current plan: ${planSummary}.`;
    if (els.settingsAccountBtn) els.settingsAccountBtn.querySelector("strong").textContent = "Sign in";
    if (els.settingsDeleteAccountBtn) els.settingsDeleteAccountBtn.style.display = "none";
  }
  if (els.settingsUpgradeBtn) {
    els.settingsUpgradeBtn.querySelector("strong").textContent = hasPremiumAccess(state) ? "Change Premium plan" : "Upgrade to premium";
  }
  if (els.settingsManageSubscriptionBtn) {
    els.settingsManageSubscriptionBtn.style.display = hasPremiumAccess(state) ? "" : "none";
  }
  if (els.settingsUpgradeStatus) {
    const remainingSaves = getRemainingSavedLooks(state);
    const remainingSlots = getRemainingWardrobeSlots(loadWardrobe(), state);
    const remainingScans = getRemainingPhotoScans(state);
    els.settingsUpgradeStatus.textContent = hasPremiumAccess(state)
      ? `${planSummary}. Switch billing plans or manage cancellation from the App Store.`
      : `${remainingSaves} save${remainingSaves === 1 ? "" : "s"} left • ${remainingSlots} item slots left • ${remainingScans} scan${remainingScans === 1 ? "" : "s"} left this week.`;
  }
  renderSettingsDataUI();
}

function bindSettingsUI() {
  els.settingsAccountBtn?.addEventListener("click", showAuthDialog);
  els.settingsUpgradeBtn?.addEventListener("click", () => openPaywall("generic", { source: "settings" }));
  els.settingsRestorePurchasesBtn?.addEventListener("click", restorePurchases);
  els.settingsManageSubscriptionBtn?.addEventListener("click", openManageSubscription);
  els.settingsDeleteAccountBtn?.addEventListener("click", () => els.authDeleteBtn?.click());
  els.settingsSupportBtn?.addEventListener("click", () => {
    setSettingsFeedback("");
    window.location.href = "./support.html";
  });
  els.settingsPrivacyBtn?.addEventListener("click", () => {
    setSettingsFeedback("");
    showConsentDialog({ forceModal: true, source: "settings" });
  });
  els.settingsDiagnosticsRefreshBtn?.addEventListener("click", refreshSettingsDiagnostics);
  els.settingsDiagnosticsCopyBtn?.addEventListener("click", copySettingsDiagnostics);
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
  if (window.__WEARCAST_DEV_LIVE__) return;
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
    if (source === "local_wardrobe") {
      pendingLocalWardrobeConsentPreset = null;
      showAppToast("Local wardrobe storage is off, so staples cannot be saved on this device.", "warning");
    }
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

    if (source === "local_wardrobe") {
      if (canUseFunctionalStorage()) {
        const preset = pendingLocalWardrobeConsentPreset;
        pendingLocalWardrobeConsentPreset = null;
        window.setTimeout(() => openItemDialog(null, preset), 160);
      } else {
        pendingLocalWardrobeConsentPreset = null;
        showAppToast("Local wardrobe storage is off, so staples cannot be saved on this device.", "warning");
      }
    }

    if (source === "settings") {
      setSettingsFeedback(`Privacy choices saved. ${summarizeConsentSettings()}`, "success");
    }

    // Auto-trigger geolocation after consent if location was granted and no saved location
    if (!!els.consentLocation?.checked) {
      const st = loadState();
      if (!st.lastLocation) onUseMyLocation("consent");
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

function getItemSourcePhoto(item = {}) {
  return item.sourcePhotoDataUrl || item.photoDataUrl || null;
}

function hasTrustedCrop(item = {}) {
  return item.cropConfidence === "trusted" && !!item.cropPhotoDataUrl;
}

function getItemDisplayPhoto(item = {}) {
  return hasTrustedCrop(item) ? item.cropPhotoDataUrl : getItemSourcePhoto(item);
}

function normalizeWardrobeItemMedia(item = {}) {
  const subtype = inferDetectedItemType(item.type || "", item.name || "")
    || canonicalizeDetectedItemType(item.type || "")
    || compactText(item.type, "");
  const normalizedName = normalizeWardrobeNameValue(item.name, subtype);
  const normalizedColor = normalizeWardrobeColorValue(item.color);
  const normalizedMaterial = normalizeWardrobeMaterialValue(item.material);
  const sourcePhotoDataUrl = item.sourcePhotoDataUrl || item.photoDataUrl || null;
  const cropPhotoDataUrl = item.cropPhotoDataUrl || null;
  const cropConfidence = item.cropConfidence || (cropPhotoDataUrl ? "trusted" : "none");
  return {
    ...item,
    type: subtype,
    name: normalizedName,
    color: normalizedColor,
    material: normalizedMaterial,
    sourcePhotoDataUrl,
    cropPhotoDataUrl,
    cropConfidence,
    photoDataUrl: cropConfidence === "trusted" && cropPhotoDataUrl ? cropPhotoDataUrl : sourcePhotoDataUrl,
  };
}

function serializeWardrobeItemMedia(item = {}) {
  const normalized = normalizeWardrobeItemMedia(item);
  return {
    ...normalized,
    photoDataUrl: null,
  };
}

function loadWardrobeLocal() {
  if (!canUseFunctionalStorage()) return [];
  try {
    const raw = localStorage.getItem(WARDROBE_KEY);
    return raw ? JSON.parse(raw).map(normalizeWardrobeItemMedia) : [];
  } catch { return []; }
}

function saveWardrobeLocal(items) {
  if (canUseFunctionalStorage()) {
    try { localStorage.setItem(WARDROBE_KEY, JSON.stringify((Array.isArray(items) ? items : []).map(serializeWardrobeItemMedia))); } catch {}
  }
}

async function fetchWardrobeFromServer() {
  const res = await authFetch(`${API_BASE}/api/wardrobe`);
  if (!res.ok) throw new Error("Failed to load wardrobe");
  return (await res.json()).map(normalizeWardrobeItemMedia);
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
  const normalized = (Array.isArray(items) ? items : []).map(normalizeWardrobeItemMedia);
  saveWardrobeLocal(normalized);
  if (isLoggedIn()) _wardrobeCache = normalized;
}

async function syncLocalWardrobeToServer() {
  // Upload localStorage items to server for first-time login migration
  const local = loadWardrobeLocal();
  if (!local.length) return;
  trackAnalyticsEvent("local_wardrobe_sync_started", {
    title: "local_wardrobe_sync_started",
    localItemCount: local.length,
  });
  let syncedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  for (const item of local) {
    try {
      if (!_wardrobeCache) {
        try {
          _wardrobeCache = await fetchWardrobeFromServer();
        } catch {
          _wardrobeCache = [];
        }
      }
      const signature = normalizeItemSignature(item);
      const duplicate = (_wardrobeCache || []).some((serverItem) => normalizeItemSignature(serverItem) === signature);
      if (duplicate) {
        skippedCount += 1;
        continue;
      }
      await authFetch(`${API_BASE}/api/wardrobe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      syncedCount += 1;
    } catch (err) {
      failedCount += 1;
      trackAnalyticsEvent("local_wardrobe_sync_failed", {
        title: "local_wardrobe_sync_failed",
        reason: err?.message || "error",
      });
    }
  }
  if (failedCount === 0) {
    // Clear local wardrobe after all local-only items are either synced or skipped as duplicates.
    localStorage.removeItem(WARDROBE_KEY);
    _wardrobeCache = null;
  }
  trackAnalyticsEvent("local_wardrobe_sync_completed", {
    title: "local_wardrobe_sync_completed",
    syncedCount,
    skippedCount,
    failedCount,
  });
  if (typeof showAppToast === "function") {
    if (failedCount) {
      showAppToast("Signed in, but a few local wardrobe items still need to sync. Try again from Wardrobe.", "warning");
    } else {
      showAppToast(
        syncedCount
          ? `Wardrobe synced. ${syncedCount} item${syncedCount === 1 ? "" : "s"} moved to your account.`
          : "Wardrobe synced. No duplicate items were added.",
        "success"
      );
    }
  }
}

function typeEmoji(type) {
  return renderInlineIcon(itemTypeIconKey(type), "wardrobe-type-icon");
}

function getWardrobeSubtype(item = {}) {
  return inferDetectedItemType(item.type || "", item.name || "")
    || canonicalizeDetectedItemType(item.type || "")
    || preserveUsefulItemLabel(item.type || "")
    || "Other";
}

function getWardrobeCategory(item = {}) {
  const key = `${getWardrobeSubtype(item)} ${item.name || ""}`.toLowerCase();
  if (/(jacket|coat|hoodie|blazer|vest|outer|parka|windbreaker|sweater)/.test(key)) return "jackets";
  if (/(jeans|dress pants|chinos|shorts|sweatpants|leggings|skirt|pants|trousers|bottom)/.test(key)) return "pants";
  if (/(shirt|t-shirt|polo|tank top|top|blouse)/.test(key)) return "shirts";
  if (/(shoe|sneaker|boot|sandal|loafer)/.test(key)) return "shoes";
  if (/(scarf|hat|beanie|glove|sunglasses|belt|bag|watch|sock|umbrella|accessor)/.test(key)) return "accessories";
  return "other";
}

function getWardrobeCategoryLabel(category) {
  return {
    all: "All",
    overview: "Overview",
    favorites: "Favorites",
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

function getWardrobeCollectionStage(items = []) {
  const count = Array.isArray(items) ? items.length : 0;
  if (!count) return "empty";
  if (count <= 8) return "starter";
  if (count <= 30) return "active";
  return "rich";
}

function itemNeedsMetadataReview(item = {}) {
  const normalizedItem = normalizeWardrobeItemMedia(item);
  return !normalizedItem.color || !normalizedItem.material;
}

function getWardrobeSeasonBucket(item = {}) {
  const text = `${item.type || ""} ${item.name || ""} ${item.material || ""}`.toLowerCase();
  if (/\brain|waterproof|shell|trench|parka|boot\b/.test(text)) return "rain";
  if (/\bcoat|jacket|hoodie|sweater|fleece|wool|boot|scarf|glove\b/.test(text)) return "cold";
  if (/\bshort|tank|sandal|linen|tee|t-shirt|polo|dress\b/.test(text)) return "warm";
  return "all";
}

function buildWardrobeSearchIndex(item = {}) {
  const normalizedItem = normalizeWardrobeItemMedia(item);
  return [
    normalizedItem.name,
    normalizedItem.type,
    normalizedItem.color,
    normalizedItem.material,
    getWardrobeCategoryLabel(getWardrobeCategory(normalizedItem)),
  ].filter(Boolean).join(" ").toLowerCase();
}

function countItemUsageInSavedLooks(item = {}, savedLooks = []) {
  const normalizedItem = normalizeWardrobeItemMedia(item);
  const candidates = [normalizedItem.name, normalizedItem.type]
    .map((value) => normalizeItemLabel(value).toLowerCase())
    .filter((value) => value.length >= 3);
  if (!candidates.length) return 0;
  return savedLooks.reduce((count, look) => {
    const text = buildLookSignature(look?.outfit || {});
    if (!text) return count;
    return candidates.some((candidate) => text.includes(candidate)) ? count + 1 : count;
  }, 0);
}

function isItemMatchedToRecommendations(item = {}, state = loadState()) {
  const itemId = String(item?.id || "");
  const matchedIds = Array.isArray(state.latestRecommendation?.matchedItemIds) ? state.latestRecommendation.matchedItemIds.map(String) : [];
  if (itemId && matchedIds.includes(itemId)) return true;
  return countItemUsageInSavedLooks(item, Array.isArray(state.savedLooks) ? state.savedLooks : []) > 0;
}

function getItemRecommendationUsage(item = {}, state = loadState()) {
  const savedLooks = Array.isArray(state.savedLooks) ? state.savedLooks : [];
  const usageCount = countItemUsageInSavedLooks(item, savedLooks);
  const itemId = String(item?.id || "");
  const matchedIds = Array.isArray(state.latestRecommendation?.matchedItemIds) ? state.latestRecommendation.matchedItemIds.map(String) : [];
  const latestMatched = itemId && matchedIds.includes(itemId);
  return {
    usageCount,
    latestMatched,
  };
}

function markWardrobeItemsHighlighted(itemIds = []) {
  highlightedWardrobeItemIds = itemIds.map((id) => String(id)).filter(Boolean);
}

function getFilteredWardrobeItems(items = []) {
  const filtered = items.filter((item) => {
    if (wardrobeFilterState.view === "favorites" && !item.favorite) return false;
    if (wardrobeFilterState.category !== "all" && getWardrobeCategory(item) !== wardrobeFilterState.category) return false;
    if (wardrobeFilterState.color !== "all" && normalizeFilterValue(item.color) !== wardrobeFilterState.color) return false;
    if (wardrobeFilterState.material !== "all" && normalizeFilterValue(item.material) !== wardrobeFilterState.material) return false;
    if (wardrobeFilterState.season !== "all" && getWardrobeSeasonBucket(item) !== wardrobeFilterState.season) return false;
    if (wardrobeFilterState.recentOnly) {
      const createdAt = new Date(item.createdAt || 0).getTime() || 0;
      if (createdAt < Date.now() - (30 * 24 * 60 * 60 * 1000)) return false;
    }
    if (wardrobeFilterState.missingMetadataOnly && !itemNeedsMetadataReview(item)) return false;
    if (wardrobeFilterState.search) {
      const query = wardrobeFilterState.search.toLowerCase();
      if (!buildWardrobeSearchIndex(item).includes(query)) return false;
    }
    if (wardrobeFilterState.matchedOnly && !isItemMatchedToRecommendations(item)) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    if (wardrobeFilterState.sort === "name") {
      return normalizeWardrobeNameValue(a.name, a.type).localeCompare(normalizeWardrobeNameValue(b.name, b.type));
    }
    if (wardrobeFilterState.sort === "type") {
      return getWardrobeSubtype(a).localeCompare(getWardrobeSubtype(b));
    }
    const aTime = new Date(a.createdAt || 0).getTime() || 0;
    const bTime = new Date(b.createdAt || 0).getTime() || 0;
    return wardrobeFilterState.sort === "oldest" ? aTime - bTime : bTime - aTime;
  });
}

function getWardrobeMissingCategories(items = []) {
  const present = new Set(items.map((item) => getWardrobeCategory(item)));
  const missing = [];
  if (!present.has("jackets")) missing.push("Outerwear");
  if (!present.has("shoes")) missing.push("Shoes");
  if (!present.has("shirts")) missing.push("Staple tops");
  if (!present.has("pants")) missing.push("Bottoms");
  if (!items.some((item) => /\b(rain|shell|waterproof|trench|parka|coat|boot)\b/i.test(`${item.type || ""} ${item.name || ""}`))) {
    missing.push("Rain layer");
  }
  return missing.slice(0, 4);
}

function getWardrobeStarterGroupsCovered(items = []) {
  return new Set(
    (items || [])
      .map((item) => getWardrobeCategory(item))
      .filter((category) => ["shirts", "pants", "jackets"].includes(category))
  );
}

function isWardrobeStarterReady(items = []) {
  const categories = getWardrobeStarterGroupsCovered(items);
  return Array.isArray(items) && items.length >= 5 && categories.size === 3;
}

function getWardrobeCoverage(items = []) {
  const itemProgress = Math.min((Array.isArray(items) ? items.length : 0) / 5, 1);
  const groupProgress = getWardrobeStarterGroupsCovered(items).size / 3;
  return Math.max(0, Math.min(100, Math.round(((itemProgress * 0.55) + (groupProgress * 0.45)) * 100)));
}

function getWardrobeStarterQualityCopy(items = []) {
  const count = Array.isArray(items) ? items.length : 0;
  if (count <= 0) return "Add your first few staples to unlock better daily outfit picks.";
  if (count < 3) return "Good start. A few more staples will make recommendations feel more personal.";
  if (!isWardrobeStarterReady(items) && count >= 5) {
    return "You have enough pieces, but one core category is still missing. Add the last gap to make recommendations feel grounded.";
  }
  if (count < 5) return "Almost there. One or two more staples will make daily outfits much easier to ground in your closet.";
  return "Starter wardrobe ready. WearCast now has enough core pieces to build stronger recommendations from your closet.";
}

function getWardrobeStarterHeadline(items = []) {
  const count = Array.isArray(items) ? items.length : 0;
  if (count <= 0) return "Add 5 staples to unlock wardrobe-powered daily outfits";
  if (count < 3) return "Your starter wardrobe is taking shape";
  if (!isWardrobeStarterReady(items) && count >= 5) return "You are one missing staple group away from a recommendation-ready closet";
  if (count < 5) return "You are one or two pieces away from a recommendation-ready closet";
  return "Starter wardrobe ready to dress from";
}

function getStarterTypeForLabel(label = "") {
  const map = {
    "Outerwear": "Jacket",
    "Shoes": "Sneakers",
    "Rain layer": "Jacket",
    "Staple tops": "T-shirt",
    "Bottoms": "Jeans",
  };
  return map[label] || "Other";
}

function buildWardrobeSaveMomentum(items = [], { savedCount = 0, skippedCount = 0 } = {}) {
  const totalCount = Array.isArray(items) ? items.length : 0;
  const nextLabel = getWardrobeMissingCategories(items)[0] || "";

  if (isWardrobeStarterReady(items)) {
    return {
      message: skippedCount
        ? `Starter wardrobe ready. Saved ${savedCount} item${savedCount === 1 ? "" : "s"} and skipped ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"}.`
        : "Starter wardrobe ready. WearCast can now build stronger outfit picks from your closet.",
      nextLabel: "",
    };
  }

  const progressMessage = `${Math.min(totalCount, 5)} of 5 staples added.`;
  const nextMessage = nextLabel
    ? ` Add ${nextLabel.toLowerCase()} next to improve recommendation coverage.`
    : " Add another staple to improve recommendation coverage.";
  const skippedMessage = skippedCount
    ? ` Skipped ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"}.`
    : "";

  return {
    message: `${progressMessage}${nextMessage}${skippedMessage}`,
    nextLabel,
  };
}

function buildWardrobeStarterProgress(items = []) {
  const categories = getWardrobeStarterGroupsCovered(items);
  const starterProgress = `${categories.size} of 3 starter groups`;
  const starterHtml = `
    <span class="starter-pill ${categories.has("shirts") ? "is-complete" : ""}">Shirts</span>
    <span class="starter-pill ${categories.has("pants") ? "is-complete" : ""}">Pants</span>
    <span class="starter-pill ${categories.has("jackets") ? "is-complete" : ""}">Layers</span>
  `;
  const nextSuggestions = getWardrobeMissingCategories(items).slice(0, 2);
  const nextHtml = nextSuggestions.length
    ? `
      <div class="starter-next-row">
        <span class="starter-next-label">Add next</span>
        <div class="starter-next-actions">
          ${nextSuggestions.map((label) => `<button type="button" class="starter-next-chip" data-starter-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`).join("")}
        </div>
      </div>
    `
    : `<div class="starter-next-row"><span class="starter-next-label is-complete">Starter set covered</span></div>`;

  return `
    <span class="starter-progress-label">${starterProgress}</span>
    <div class="starter-pill-row">${starterHtml}</div>
    <p class="starter-progress-note">${escapeHtml(getWardrobeStarterQualityCopy(items))}</p>
    ${nextHtml}
  `;
}

function renderWardrobeDashboard(items = []) {
  const stage = getWardrobeCollectionStage(items);
  const coverage = getWardrobeCoverage(items);
  const circumference = 2 * Math.PI * 48;
  const filledLength = circumference * (coverage / 100);
  const missing = getWardrobeMissingCategories(items);
  const shouldShowDashboard = stage === "starter";
  const isStarterReady = isWardrobeStarterReady(items);

  if (els.wardrobeDashboard) {
    els.wardrobeDashboard.style.display = shouldShowDashboard ? "" : "none";
    els.wardrobeDashboard.classList.toggle("is-compact", shouldShowDashboard);
    els.wardrobeDashboard.classList.toggle("is-ready", isStarterReady);
  }
  if (els.wardrobeCoverageCircle) {
    els.wardrobeCoverageCircle.style.strokeDasharray = `${filledLength} ${circumference}`;
  }
  if (els.wardrobeCoverageValue) els.wardrobeCoverageValue.textContent = `${coverage}%`;
  if (els.wardrobeCoverageLabel) {
    els.wardrobeCoverageLabel.textContent = isStarterReady
      ? "Ready to style"
      : items.length >= 5
        ? `${Math.max(1, missing.length)} gap left`
        : `${Math.max(0, 5 - items.length)} left`;
  }
  if (els.wardrobeMissingChips) {
    els.wardrobeMissingChips.innerHTML = missing.length
      ? missing.map((label) => `<button type="button" class="wardrobe-missing-chip" data-starter-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`).join("")
      : `<span class="wardrobe-missing-chip is-complete">Starter set covered</span>`;
  }
  if (els.wardrobeSyncPrompt) {
    els.wardrobeSyncPrompt.style.display = !isLoggedIn() && items.length ? "grid" : "none";
  }
}

function buildWardrobeItemCard(item = {}) {
  const normalizedItem = normalizeWardrobeItemMedia(item);
  const displayPhoto = getItemDisplayPhoto(normalizedItem);
  const recommendationUsage = getItemRecommendationUsage(normalizedItem);
  const isHighlighted = highlightedWardrobeItemIds.includes(String(normalizedItem.id));
  const photoHtml = displayPhoto
    ? `<img class="wardrobe-item-photo" src="${escapeHtml(displayPhoto)}" alt="" loading="lazy" decoding="async" draggable="false" />`
    : `<div class="wardrobe-item-placeholder" aria-hidden="true">${typeEmoji(normalizedItem.type)}</div>`;
  const meta = [
    getWardrobeSubtype(normalizedItem) || getWardrobeCategoryLabel(getWardrobeCategory(normalizedItem)),
    normalizeWardrobeColorValue(normalizedItem.color) || normalizeWardrobeMaterialValue(normalizedItem.material),
  ].filter(Boolean).join(" · ");
  const createdAt = new Date(normalizedItem.createdAt || 0).getTime() || 0;
  const isNew = createdAt >= Date.now() - (7 * 24 * 60 * 60 * 1000);
  const badges = [];
  if (normalizedItem.favorite) badges.push(`<span class="wardrobe-item-badge is-favorite">Favorite</span>`);
  if (itemNeedsMetadataReview(normalizedItem)) badges.push(`<span class="wardrobe-item-badge is-review">Needs review</span>`);
  else if (isNew) badges.push(`<span class="wardrobe-item-badge">New</span>`);
  if (recommendationUsage.latestMatched) badges.push(`<span class="wardrobe-item-badge is-match">In today’s look</span>`);
  const visibleBadges = badges.slice(0, 2);
  if (badges.length > visibleBadges.length) {
    visibleBadges.push(`<span class="wardrobe-item-badge is-more">+${badges.length - visibleBadges.length}</span>`);
  }

  return `
    <article class="wardrobe-item ${isHighlighted ? "is-highlighted" : ""}" data-id="${escapeHtml(String(normalizedItem.id))}">
      <div class="wardrobe-item-visual">
        <button type="button" class="wardrobe-favorite-btn ${normalizedItem.favorite ? "is-active" : ""}" data-wardrobe-favorite="${escapeHtml(String(normalizedItem.id))}" aria-label="${normalizedItem.favorite ? "Remove from favorites" : "Add to favorites"}">★</button>
        ${visibleBadges.length ? `<div class="wardrobe-item-badges">${visibleBadges.join("")}</div>` : ""}
        ${photoHtml}
      </div>
      <div class="wardrobe-item-info">
        <div class="wardrobe-item-caption">
          <div class="wardrobe-item-name">${escapeHtml(normalizedItem.name)}</div>
          <div class="wardrobe-item-meta">${escapeHtml(meta || "Ready for outfit recommendations")}</div>
        </div>
      </div>
    </article>
  `;
}

function getWardrobeViewerSource() {
  if (wardrobeFilterState.search) return "search";
  if (wardrobeFilterState.view === "favorites") return "favorites";
  if (wardrobeFilterState.category !== "all") return "category";
  return "all";
}

function getWardrobeViewerMetaLine(item = {}) {
  const normalizedItem = normalizeWardrobeItemMedia(item);
  return [
    getWardrobeSubtype(normalizedItem) || getWardrobeCategoryLabel(getWardrobeCategory(normalizedItem)),
    normalizeWardrobeColorValue(normalizedItem.color) || normalizeWardrobeMaterialValue(normalizedItem.material),
  ].filter(Boolean).join(" · ");
}

function getWardrobeViewerPagerOffset(total = 0, currentIndex = 0, visibleCount = Math.min(5, total || 0)) {
  if (total <= 1) return 0;
  return Math.max(0, Math.min(currentIndex - Math.floor(visibleCount / 2), total - visibleCount));
}

function buildWardrobeViewerPager(total = 0, currentIndex = 0, initialOffset = null) {
  if (total <= 1) return "";
  const visibleCount = Math.min(5, total);
  const slotSize = 18;
  const targetOffset = getWardrobeViewerPagerOffset(total, currentIndex, visibleCount);
  const renderOffset = Number.isFinite(initialOffset) ? initialOffset : targetOffset;
  const dots = [];
  for (let index = 0; index < total; index += 1) {
    dots.push(`<span class="item-viewer-pager-dot ${index === currentIndex ? "is-active" : ""}"></span>`);
  }
  return `
    <span class="item-viewer-pager-window" style="--pager-visible-count:${visibleCount}; --pager-slot-size:${slotSize}px;">
      <span class="item-viewer-pager-track" data-item-viewer-pager-track data-target-offset="${targetOffset}" style="--pager-offset:${renderOffset};">
        ${dots.join("")}
      </span>
    </span>
  `;
}

function buildWardrobeViewerMedia(item = null, className = "item-viewer-photo") {
  if (!item) return "";
  const displayPhoto = getItemDisplayPhoto(item);
  if (displayPhoto) {
    return `<img class="${className}" src="${escapeHtml(displayPhoto)}" alt="${escapeHtml(item.name || "Wardrobe item")}" draggable="false" />`;
  }
  return `<div class="${className} item-viewer-photo-placeholder">${typeEmoji(item.type)}</div>`;
}

function getWardrobeViewerElements() {
  return {
    viewer: els.itemDetailBody?.querySelector("[data-item-viewer-id]") || null,
    shell: els.itemDetailBody?.querySelector("[data-item-viewer-shell]") || null,
    stage: els.itemDetailBody?.querySelector("[data-item-viewer-stage]") || null,
    prevPreview: els.itemDetailBody?.querySelector('[data-item-viewer-preview="prev"]') || null,
    nextPreview: els.itemDetailBody?.querySelector('[data-item-viewer-preview="next"]') || null,
  };
}

function resetWardrobeViewerDragStyles() {
  const { stage, prevPreview, nextPreview } = getWardrobeViewerElements();
  [stage, prevPreview, nextPreview].forEach((element) => {
    if (!element) return;
    element.classList.remove("is-visible");
    element.style.removeProperty("transition");
    element.style.removeProperty("transform");
    element.style.removeProperty("opacity");
  });
}

function updateWardrobeViewerDrag(deltaX = 0, deltaY = 0, axis = "horizontal") {
  const { stage, prevPreview, nextPreview } = getWardrobeViewerElements();
  if (!stage) return;

  if (axis === "vertical") {
    const height = Math.max(stage.clientHeight || window.innerHeight || 1, 1);
    const progress = Math.max(0, Math.min(1, Math.abs(deltaY) / height));
    [prevPreview, nextPreview].forEach((preview) => {
      if (!preview) return;
      preview.classList.remove("is-visible");
      preview.style.removeProperty("transition");
      preview.style.removeProperty("transform");
      preview.style.removeProperty("opacity");
    });
    stage.style.transition = "none";
    stage.style.transform = `translateY(${deltaY}px) scale(${1 - progress * 0.05})`;
    stage.style.opacity = `${1 - progress * 0.26}`;
    return;
  }

  const width = Math.max(stage.clientWidth || window.innerWidth || 1, 1);
  const progress = Math.max(-1, Math.min(1, deltaX / width));
  const direction = deltaX < 0 ? 1 : deltaX > 0 ? -1 : 0;
  const activePreview = direction === 1 ? nextPreview : direction === -1 ? prevPreview : null;
  const inactivePreview = direction === 1 ? prevPreview : nextPreview;

  if (inactivePreview) {
    inactivePreview.classList.remove("is-visible");
    inactivePreview.style.removeProperty("transition");
    inactivePreview.style.removeProperty("transform");
    inactivePreview.style.removeProperty("opacity");
  }

  if (activePreview && activePreview.childElementCount) {
    activePreview.classList.add("is-visible");
    activePreview.style.transition = "none";
    activePreview.style.opacity = `${0.28 + Math.abs(progress) * 0.72}`;
    activePreview.style.transform = `translateX(${direction === 1 ? width * 0.16 + deltaX * 0.16 : -width * 0.16 + deltaX * 0.16}px) scale(${0.97 + Math.abs(progress) * 0.03})`;
  } else if (activePreview) {
    activePreview.classList.remove("is-visible");
    activePreview.style.removeProperty("transition");
    activePreview.style.removeProperty("transform");
    activePreview.style.removeProperty("opacity");
  }

  stage.style.transition = "none";
  stage.style.transform = `translateX(${deltaX}px) scale(${1 - Math.abs(progress) * 0.028})`;
  stage.style.opacity = `${1 - Math.abs(progress) * 0.2}`;
}

function animateWardrobeViewerReset() {
  const { stage, prevPreview, nextPreview } = getWardrobeViewerElements();
  if (!stage) return;
  stage.style.transition = "transform .24s cubic-bezier(.22, 1, .36, 1), opacity .24s cubic-bezier(.22, 1, .36, 1)";
  stage.style.transform = "translateX(0) scale(1)";
  stage.style.opacity = "1";
  [prevPreview, nextPreview].forEach((preview) => {
    if (!preview) return;
    preview.style.transition = "transform .24s cubic-bezier(.22, 1, .36, 1), opacity .24s cubic-bezier(.22, 1, .36, 1)";
    preview.style.transform = "translateX(0) scale(.98)";
    preview.style.opacity = "0";
  });
  window.setTimeout(resetWardrobeViewerDragStyles, 240);
}

async function animateWardrobeViewerCommit(direction = 1, deltaX = 0) {
  const { stage, prevPreview, nextPreview } = getWardrobeViewerElements();
  if (!stage) {
    await moveWardrobeItemViewer(direction);
    return;
  }

  const activePreview = direction === 1 ? nextPreview : prevPreview;
  const width = Math.max(stage.clientWidth || window.innerWidth || 1, 1);
  const exitX = direction === 1 ? -width * 1.04 : width * 1.04;
  const previewStartX = direction === 1
    ? width * 0.12 + deltaX * 0.14
    : -width * 0.12 + deltaX * 0.14;

  stage.style.transition = "transform .22s cubic-bezier(.22, 1, .36, 1), opacity .22s cubic-bezier(.22, 1, .36, 1)";
  stage.style.transform = `translateX(${exitX}px) scale(.94)`;
  stage.style.opacity = "0";

  if (activePreview && activePreview.childElementCount) {
    activePreview.classList.add("is-visible");
    activePreview.style.transition = "transform .22s cubic-bezier(.22, 1, .36, 1), opacity .22s cubic-bezier(.22, 1, .36, 1)";
    activePreview.style.transform = `translateX(${previewStartX}px) scale(1.02)`;
    activePreview.style.opacity = "0.96";
    requestAnimationFrame(() => {
      activePreview.style.transform = "translateX(0) scale(1)";
      activePreview.style.opacity = "1";
    });
  }

  await new Promise((resolve) => window.setTimeout(resolve, 200));
  await moveWardrobeItemViewer(direction);
}

async function animateWardrobeViewerClose(deltaY = -140) {
  const { stage, prevPreview, nextPreview } = getWardrobeViewerElements();
  if (!stage) {
    closeWardrobeItemViewer();
    return;
  }
  [prevPreview, nextPreview].forEach((preview) => {
    if (!preview) return;
    preview.classList.remove("is-visible");
    preview.style.removeProperty("transition");
    preview.style.removeProperty("transform");
    preview.style.removeProperty("opacity");
  });
  stage.style.transition = "transform .2s cubic-bezier(.22, 1, .36, 1), opacity .2s cubic-bezier(.22, 1, .36, 1)";
  stage.style.transform = `translateY(${Math.min(deltaY, -180)}px) scale(.94)`;
  stage.style.opacity = "0";
  await new Promise((resolve) => window.setTimeout(resolve, 180));
  closeWardrobeItemViewer();
}

function closeWardrobeItemViewer() {
  wardrobeItemViewerState = {
    isOpen: false,
    source: "all",
    visibleItemIds: [],
    currentIndex: 0,
    pagerFromIndex: null,
    isEditOpen: false,
  };
  wardrobeViewerPointerState = null;
  els.itemDetailDialog?.close?.();
}

async function renderWardrobeItemViewer(items = null) {
  if (!wardrobeItemViewerState.isOpen || !els.itemDetailBody) return;
  const sourceItems = Array.isArray(items) ? items : loadWardrobe();
  const itemMap = new Map(sourceItems.map((item) => [String(item.id), normalizeWardrobeItemMedia(item)]));
  const visibleIds = wardrobeItemViewerState.visibleItemIds.filter((id) => itemMap.has(String(id)));

  if (!visibleIds.length) {
    closeWardrobeItemViewer();
    return;
  }

  const boundedIndex = Math.max(0, Math.min(wardrobeItemViewerState.currentIndex, visibleIds.length - 1));
  wardrobeItemViewerState.visibleItemIds = visibleIds;
  wardrobeItemViewerState.currentIndex = boundedIndex;

  const currentId = String(visibleIds[boundedIndex]);
  const currentItem = itemMap.get(currentId);
  if (!currentItem) {
    closeWardrobeItemViewer();
    return;
  }
  const pagerVisibleCount = Math.min(5, visibleIds.length);
  const pagerInitialOffset = Number.isFinite(wardrobeItemViewerState.pagerFromIndex)
    ? getWardrobeViewerPagerOffset(visibleIds.length, wardrobeItemViewerState.pagerFromIndex, pagerVisibleCount)
    : null;

  const recommendationUsage = getItemRecommendationUsage(currentItem);
  const metaLine = getWardrobeViewerMetaLine(currentItem) || "Ready to use in outfits";
  const prevItem = boundedIndex > 0 ? itemMap.get(String(visibleIds[boundedIndex - 1])) : null;
  const nextItem = boundedIndex < visibleIds.length - 1 ? itemMap.get(String(visibleIds[boundedIndex + 1])) : null;
  const detailLines = [
    currentItem.material ? `Material: ${normalizeWardrobeMaterialValue(currentItem.material)}` : "",
    Array.isArray(currentItem.careInstructions) && currentItem.careInstructions.length ? `Care: ${currentItem.careInstructions.join(", ")}` : "",
    itemNeedsMetadataReview(currentItem) ? "Needs review before this item feels fully polished." : "",
    recommendationUsage.latestMatched ? "Last matched on Today." : "",
    recommendationUsage.usageCount ? `Used in ${recommendationUsage.usageCount} saved look${recommendationUsage.usageCount === 1 ? "" : "s"}.` : "",
  ].filter(Boolean);

  els.itemDetailBody.innerHTML = `
    <div class="item-viewer" data-item-viewer-id="${escapeHtml(currentId)}">
      <div class="item-viewer-shell" data-item-viewer-shell>
        <div class="item-viewer-preview item-viewer-preview-prev" data-item-viewer-preview="prev" aria-hidden="true">
          <div class="item-viewer-preview-card">
            ${buildWardrobeViewerMedia(prevItem, "item-viewer-preview-photo")}
          </div>
        </div>
        <div class="item-viewer-preview item-viewer-preview-next" data-item-viewer-preview="next" aria-hidden="true">
          <div class="item-viewer-preview-card">
            ${buildWardrobeViewerMedia(nextItem, "item-viewer-preview-photo")}
          </div>
        </div>
        <div class="item-viewer-stage" data-item-viewer-stage>
          ${buildWardrobeViewerMedia(currentItem)}
          <div class="item-viewer-scrim item-viewer-scrim-top"></div>
          <div class="item-viewer-scrim item-viewer-scrim-bottom"></div>
          <div class="item-viewer-overlay item-viewer-overlay-top">
            <button type="button" class="item-viewer-icon-btn" data-item-viewer-action="close" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div class="item-viewer-top-actions">
              <button type="button" class="item-viewer-icon-btn ${currentItem.favorite ? "is-active" : ""}" data-item-viewer-action="favorite" aria-label="${currentItem.favorite ? "Remove from favorites" : "Add to favorites"}">
                <svg viewBox="0 0 24 24" fill="${currentItem.favorite ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.9"><path d="M12 21s-6.7-4.35-8.39-7.68C2.33 10.83 3.57 7 7.4 7c1.96 0 3.18.92 4.6 2.5C13.42 7.92 14.64 7 16.6 7c3.83 0 5.07 3.83 3.79 6.32C18.7 16.65 12 21 12 21Z"/></svg>
              </button>
              <button type="button" class="item-viewer-icon-btn" data-item-viewer-action="more" aria-label="More actions">
                <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
              </button>
            </div>
          </div>
          <div class="item-viewer-overlay item-viewer-overlay-bottom">
            <div class="item-viewer-position">${boundedIndex + 1} of ${visibleIds.length}</div>
            <div class="item-viewer-copy">
              <h2 id="itemDetailTitle" class="item-viewer-title">${escapeHtml(currentItem.name || "Wardrobe item")}</h2>
              <p class="item-viewer-meta">${escapeHtml(metaLine)}</p>
            </div>
            <div class="item-viewer-actions">
              <button type="button" class="item-viewer-action-btn is-primary${itemNeedsMetadataReview(currentItem) ? " is-attention" : ""}" data-item-viewer-action="edit">${itemNeedsMetadataReview(currentItem) ? "Fix details" : "Edit"}</button>
            </div>
            <div class="item-viewer-details-body">
              ${detailLines.length
                ? detailLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")
                : `<p>Nothing else needs attention right now.</p>`}
            </div>
          </div>
        </div>
      </div>
      <div class="item-viewer-pager-rail" data-item-viewer-pager-rail>
        <div class="item-viewer-pager item-viewer-pager-bottom" aria-label="Wardrobe item position">${buildWardrobeViewerPager(visibleIds.length, boundedIndex, pagerInitialOffset)}</div>
      </div>
    </div>
  `;
  const pagerTrack = els.itemDetailBody.querySelector("[data-item-viewer-pager-track]");
  const targetOffset = Number(pagerTrack?.dataset.targetOffset);
  if (pagerTrack && Number.isFinite(targetOffset) && pagerInitialOffset !== null && pagerInitialOffset !== targetOffset) {
    requestAnimationFrame(() => {
      pagerTrack.style.setProperty("--pager-offset", String(targetOffset));
    });
  }
  wardrobeItemViewerState.pagerFromIndex = null;

  if (els.itemDetailDialog) {
    els.itemDetailDialog.classList.remove("is-opening");
    void els.itemDetailDialog.offsetWidth;
    els.itemDetailDialog.classList.add("is-opening");
  }
  if (!els.itemDetailDialog?.open) els.itemDetailDialog?.showModal?.();
  window.setTimeout(() => els.itemDetailDialog?.classList.remove("is-opening"), 280);
}

async function openWardrobeItemViewer(itemId, visibleItemIds = wardrobeVisibleItemIds) {
  const ids = (Array.isArray(visibleItemIds) ? visibleItemIds : []).map(String).filter(Boolean);
  const currentIndex = Math.max(0, ids.indexOf(String(itemId)));
  wardrobeItemViewerState = {
    isOpen: true,
    source: getWardrobeViewerSource(),
    visibleItemIds: ids.length ? ids : [String(itemId)],
    currentIndex,
    pagerFromIndex: null,
    isEditOpen: false,
  };
  await renderWardrobeItemViewer();
}

async function moveWardrobeItemViewer(direction = 1) {
  if (!wardrobeItemViewerState.isOpen) return;
  const total = wardrobeItemViewerState.visibleItemIds.length;
  if (total <= 1) return;
  const previousIndex = wardrobeItemViewerState.currentIndex;
  wardrobeItemViewerState.currentIndex = Math.max(0, Math.min(total - 1, wardrobeItemViewerState.currentIndex + direction));
  wardrobeItemViewerState.pagerFromIndex = previousIndex;
  await renderWardrobeItemViewer();
}

async function syncWardrobeItemViewer(items = null) {
  if (!wardrobeItemViewerState.isOpen) return;
  await renderWardrobeItemViewer(items);
}

function renderWardrobeFilters(items = []) {
  if (!els.wardrobeFilters) return;
  if (!items.length) {
    els.wardrobeFilters.innerHTML = "";
    return;
  }

  const stage = getWardrobeCollectionStage(items);
  const categoryCounts = items.reduce((acc, item) => {
    const category = getWardrobeCategory(item);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const categories = ["shirts", "pants", "jackets", "shoes", "accessories", "other"]
    .filter((category) => categoryCounts[category]);
  const favoriteCount = items.filter((item) => item.favorite).length;
  const activeRefinements = [
    wardrobeFilterState.color !== "all",
    wardrobeFilterState.material !== "all",
    wardrobeFilterState.season !== "all",
    wardrobeFilterState.sort !== "newest",
    wardrobeFilterState.recentOnly,
    wardrobeFilterState.missingMetadataOnly,
    wardrobeFilterState.matchedOnly,
  ].filter(Boolean).length;
  const showCategoryRail = stage === "active" || stage === "rich";
  const showFilterButton = stage !== "starter";

  els.wardrobeFilters.innerHTML = `
    <div class="wardrobe-section-nav">
      <div class="wardrobe-filter-row wardrobe-filter-row-sections">
        <button type="button" class="wardrobe-filter-chip ${wardrobeFilterState.view === "all" ? "is-active" : ""}" data-wardrobe-view="all">
          All
        </button>
        <button type="button" class="wardrobe-filter-chip ${wardrobeFilterState.view === "favorites" ? "is-active" : ""}" data-wardrobe-view="favorites">
          Favorites
          <span>${favoriteCount}</span>
        </button>
        ${showFilterButton ? `
          <button type="button" class="wardrobe-filter-chip ${activeRefinements ? "has-value" : ""}" data-open-wardrobe-filter>
            Filter
            <span>${activeRefinements}</span>
          </button>
        ` : ""}
      </div>
      ${showCategoryRail ? `
        <div class="wardrobe-filter-row wardrobe-filter-row-categories">
          ${categories.map((category) => `
            <button type="button" class="wardrobe-filter-chip ${wardrobeFilterState.category === category ? "is-active" : ""}" data-wardrobe-category="${escapeHtml(category)}">
              ${escapeHtml(getWardrobeCategoryLabel(category))}
              <span>${categoryCounts[category] || 0}</span>
            </button>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

async function renderWardrobe() {
  const items = await loadWardrobeAsync();
  const stage = getWardrobeCollectionStage(items);
  const visibleItems = getFilteredWardrobeItems(items);
  wardrobeVisibleItemIds = visibleItems.map((item) => String(item.id)).filter(Boolean);
  if (els.wardrobeList) {
    els.wardrobeList.classList.remove("is-refreshing");
    void els.wardrobeList.offsetWidth;
    els.wardrobeList.classList.add("is-refreshing");
  }
  els.wardrobeList.innerHTML = "";
  els.wardrobeEmpty.style.display = items.length ? "none" : "flex";
  if (els.addItemBtn) {
    const shouldShowFab = items.length > 0;
    els.addItemBtn.style.display = shouldShowFab ? "inline-flex" : "none";
  }
  if (els.wardrobeSubtitle) {
    els.wardrobeSubtitle.textContent =
      stage === "empty" ? "A calm collection of the pieces you actually wear."
      : stage === "starter" ? "Start with a few staples and grow the collection naturally."
      : stage === "active" ? "Browse, inspect, and refine your closet in one place."
      : "Search, filter, and scan your full collection quickly.";
  }
  if (els.wardrobeSearchWrap) {
    els.wardrobeSearchWrap.style.display = stage === "rich" ? "" : "none";
  }
  if (els.wardrobeSearchInput && stage !== "rich") {
    els.wardrobeSearchInput.value = "";
    wardrobeFilterState.search = "";
  }
  updateWardrobeCtas(items);
  syncTodayWardrobeDialog(items);
  renderWardrobeDashboard(items);
  renderWardrobeFilters(items);

  if (items.length && !visibleItems.length) {
    els.wardrobeList.innerHTML = `
      <div class="wardrobe-filter-empty">
        <strong>Nothing to show in this section yet.</strong>
        <span>${wardrobeFilterState.view === "favorites" ? "Favorite a few pieces to keep them close." : "Try another filter or add another item."}</span>
      </div>
    `;
    return;
  }
  const collectionTitle =
    wardrobeFilterState.view === "favorites" ? "Favorite pieces"
    : wardrobeFilterState.category !== "all" ? getWardrobeCategoryLabel(wardrobeFilterState.category)
    : "All items";
  const collectionDescription =
    stage === "starter"
      ? "A lighter collection view while your wardrobe is still taking shape."
      : `${visibleItems.length} piece${visibleItems.length === 1 ? "" : "s"} ready to browse.`;

  els.wardrobeList.innerHTML = `
    <section class="wardrobe-collection">
      <div class="wardrobe-collection-head">
        <div>
          <span class="wardrobe-section-kicker">Collection</span>
          <h3>${escapeHtml(collectionTitle)}</h3>
        </div>
        <span class="wardrobe-collection-meta">${escapeHtml(collectionDescription)}</span>
      </div>
      <div class="wardrobe-grid wardrobe-collection-grid" data-wardrobe-stage="${escapeHtml(stage)}">
        ${visibleItems.map((item) => buildWardrobeItemCard(item)).join("")}
      </div>
    </section>
  `;
  window.requestAnimationFrame(() => {
    els.wardrobeList?.classList.remove("is-refreshing");
  });
  if (highlightedWardrobeItemIds.length) {
    window.setTimeout(() => {
      highlightedWardrobeItemIds = [];
      const highlighted = els.wardrobeList?.querySelectorAll(".wardrobe-item.is-highlighted");
      highlighted?.forEach((node) => node.classList.remove("is-highlighted"));
    }, 1800);
  }
  await syncWardrobeItemViewer(items);
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
      showAppToast(err.message || "Could not update favorite", "error");
      return;
    }
  } else {
    const nextItems = items.map((entry) => String(entry.id) === String(item.id) ? nextItem : entry);
    saveWardrobeLocal(nextItems);
  }

  await renderWardrobe();
  showAppToast(nextItem.favorite ? "Added to favorites" : "Removed from favorites", "success");
}

function syncTodayWardrobeDialog(items, state = loadState()) {
  const count = Array.isArray(items) ? items.length : 0;
  const starterReady = isWardrobeStarterReady(items);
  const showInlinePrompt = shouldShowWardrobeUpgradePrompt(items, state);
  if (els.todayWardrobeInlineCta) {
    els.todayWardrobeInlineCta.style.display = showInlinePrompt ? "" : "none";
  }
  els.tabToday?.classList.toggle("has-wardrobe-banner", !!showInlinePrompt);
  const title = els.todayWardrobeInlineCta?.querySelector("strong");
  const copy = els.todayWardrobeInlineCta?.querySelector("p");
  if (title) {
    title.textContent = count > 0
      ? `Add ${Math.max(1, 5 - count)} more staple${5 - count === 1 ? "" : "s"}`
      : "Add 5 staples";
  }
  if (copy) {
    copy.textContent = "Get outfit picks from your closet.";
  }
  if (els.todayWardrobeInlineBtn) {
    els.todayWardrobeInlineBtn.textContent = count ? "Add items" : "Start";
  }
  const analytics = getAnalyticsState(state);
  if (showInlinePrompt && !analytics.wardrobePromptSeen) {
    trackAnalyticsEvent("wardrobe_prompt_viewed", { title: "wardrobe_prompt_viewed" });
    saveState({
      analytics: {
        ...analytics,
        wardrobePromptSeen: true,
      },
    });
  }
  if (!showInlinePrompt && els.todayWardrobeDialog?.open) els.todayWardrobeDialog.close();
}

function updateWardrobeCtas(items) {
  const count = Array.isArray(items) ? items.length : 0;
  const starterReady = isWardrobeStarterReady(items);
  if (els.todayWardrobeInlineProgress) {
    els.todayWardrobeInlineProgress.innerHTML = buildWardrobeStarterProgress(items);
  }
  if (els.wardrobeExplainerProgress) {
    els.wardrobeExplainerProgress.innerHTML = buildWardrobeStarterProgress(items);
  }

  if (count === 0) {
    if (els.todayCtaKicker) els.todayCtaKicker.textContent = "From your closet";
    if (els.todayCtaTitle) els.todayCtaTitle.textContent = "Make tomorrow’s recommendation work from the clothes you already own.";
    if (els.todayWardrobeCtaBtn) els.todayWardrobeCtaBtn.textContent = "Start my wardrobe";
    if (els.wardrobeExplainerKicker) els.wardrobeExplainerKicker.textContent = "Closet assistant";
    if (els.wardrobeExplainerTitle) els.wardrobeExplainerTitle.textContent = getWardrobeStarterHeadline(items);
    if (els.wardrobeExplainerText) els.wardrobeExplainerText.textContent = "Start with the pieces you wear most. WearCast will organize them and build recommendations from what you already own.";
    return;
  }

  if (count < 4) {
    if (els.todayCtaKicker) els.todayCtaKicker.textContent = "Nice start";
    if (els.todayCtaTitle) els.todayCtaTitle.textContent = "Keep building your closet so today’s outfit picks can use more of what you own.";
    if (els.todayWardrobeCtaBtn) els.todayWardrobeCtaBtn.textContent = "Add more";
    if (els.wardrobeExplainerKicker) els.wardrobeExplainerKicker.textContent = "Starter wardrobe";
    if (els.wardrobeExplainerTitle) els.wardrobeExplainerTitle.textContent = getWardrobeStarterHeadline(items);
    if (els.wardrobeExplainerText) els.wardrobeExplainerText.textContent = `You have ${count} item${count === 1 ? "" : "s"} saved. Add a few more core pieces so WearCast can build stronger daily outfits from your closet.`;
    return;
  }

  if (els.todayCtaKicker) els.todayCtaKicker.textContent = starterReady ? "Starter ready" : "Looking good";
  if (els.todayCtaTitle) els.todayCtaTitle.textContent = starterReady
    ? "Your closet is ready to shape outfit picks from what you actually own."
    : count >= 5
      ? "You have enough pieces. Add the last missing staple group so outfit picks feel more grounded."
      : "Your closet is ready to shape today’s outfit recommendation.";
  if (els.todayWardrobeCtaBtn) els.todayWardrobeCtaBtn.textContent = "Keep building";
  if (els.wardrobeExplainerKicker) els.wardrobeExplainerKicker.textContent = starterReady ? "Starter ready" : "Collection progress";
  if (els.wardrobeExplainerTitle) els.wardrobeExplainerTitle.textContent = starterReady
    ? getWardrobeStarterHeadline(items)
    : `Your ${count}-item wardrobe is ready to dress from`;
  if (els.wardrobeExplainerText) els.wardrobeExplainerText.textContent = starterReady
    ? "WearCast now has enough core pieces to build recommendations that feel much more grounded in your real closet."
    : count >= 5
      ? "You have enough pieces to build from. Fill the last starter gap and WearCast will make much stronger recommendations from your closet."
      : "WearCast can now use more of your real closet in daily recommendations. Add standout pieces anytime to sharpen the mix.";
}

let editingItemId = null;
let pendingPhotoDataUrl = null;
let isSavingItem = false;
let isReadingItemPhoto = false;
let isReadingScanPhoto = false;
let isAnalyzingItemPhoto = false;
let itemFlowStep = "capture";
let itemBatchItems = [];
let activeItemBatchIndex = -1;
let itemRejectedPhotos = [];
const itemRescanningKeys = new Set();
let itemImportSession = { totalPhotos: 0, acceptedPhotos: 0, rejectedPhotos: 0 };
let itemProcessingPlaceholders = 0;
let editingBatchItemIndex = -1;
let activeRejectedPhotoIndex = -1;
let pendingCropPhotoDataUrl = null;
let pendingCropConfidence = "none";
let itemMoreDetailsOpen = false;
let itemQueuedPhotoPreviews = [];
const wardrobeFilterState = {
  view: "all",
  category: "all",
  color: "all",
  material: "all",
  season: "all",
  recentOnly: false,
  missingMetadataOnly: false,
  search: "",
  sort: "newest",
  matchedOnly: false,
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

function currentBatchItem() {
  if (activeItemBatchIndex < 0) return null;
  return itemBatchItems[activeItemBatchIndex] || null;
}

function normalizeDetectedBox(value) {
  if (!value || typeof value !== "object") return null;
  const clamp01 = (n) => Math.max(0, Math.min(1, Number(n)));
  const x = clamp01(value.x);
  const y = clamp01(value.y);
  const right = clamp01(Number(value.x) + Number(value.width));
  const bottom = clamp01(Number(value.y) + Number(value.height));
  const width = right - x;
  const height = bottom - y;
  if (![x, y, width, height].every((part) => Number.isFinite(part))) return null;
  if (width <= 0.03 || height <= 0.03) return null;
  return { x, y, width, height };
}

function usesExactDetectedBox(geometrySource = "") {
  return /product-foreground|product-segmentation|outfit-segmentation|product-llm/.test(String(geometrySource || ""));
}

function usesProductExactDetectedBox(geometrySource = "") {
  return /product-foreground|product-segmentation|product-llm/.test(String(geometrySource || ""));
}

function getDetectedCropTuning(type = "") {
  const normalizedType = String(type || "").toLowerCase();
  if (/sneaker|boot|sandal|dress shoe|shoe/.test(normalizedType)) {
    return { padding: 0.12, minWidth: 0.18, minHeight: 0.14 };
  }
  if (/hat|bag|belt|sunglass|scarf|glove|accessor/.test(normalizedType)) {
    return { padding: 0.14, minWidth: 0.16, minHeight: 0.14 };
  }
  if (/dress/.test(normalizedType)) {
    return { padding: 0.12, minWidth: 0.34, minHeight: 0.5 };
  }
  if (/jacket|coat|hoodie|blazer|vest|shirt|t-shirt|polo|sweater|tank/.test(normalizedType)) {
    return { padding: 0.12, minWidth: 0.34, minHeight: 0.34 };
  }
  if (/jean|chino|short|pant|skirt/.test(normalizedType)) {
    return { padding: 0.12, minWidth: 0.3, minHeight: 0.34 };
  }
  return { padding: 0.14, minWidth: 0.28, minHeight: 0.28 };
}

function expandDetectedBox(box, type = "") {
  const normalizedBox = normalizeDetectedBox(box);
  if (!normalizedBox) return null;
  const tuning = getDetectedCropTuning(type);
  const centerX = normalizedBox.x + normalizedBox.width / 2;
  const centerY = normalizedBox.y + normalizedBox.height / 2;
  const width = Math.max(normalizedBox.width * (1 + tuning.padding * 2), tuning.minWidth);
  const height = Math.max(normalizedBox.height * (1 + tuning.padding * 2), tuning.minHeight);
  const left = Math.max(0, Math.min(1 - width, centerX - width / 2));
  const top = Math.max(0, Math.min(1 - height, centerY - height / 2));
  return {
    x: left,
    y: top,
    width: Math.min(1, width),
    height: Math.min(1, height),
  };
}

function normalizeRegion(value) {
  return normalizeDetectedBox(value);
}

function isAccessoryOrShoeType(type = "") {
  return /hat|bag|belt|sunglass|scarf|glove|accessor|sneaker|boot|sandal|dress shoe|shoe/.test(String(type || "").toLowerCase());
}

function getDefaultMainSubjectRegion(aspectRatio = 0.75) {
  if (aspectRatio > 1.15) return { x: 0.2, y: 0.04, width: 0.6, height: 0.92 };
  if (aspectRatio < 0.85) return { x: 0.14, y: 0.03, width: 0.72, height: 0.94 };
  return { x: 0.16, y: 0.03, width: 0.68, height: 0.94 };
}

function unionBoxes(boxes = []) {
  const normalized = boxes.map(normalizeRegion).filter(Boolean);
  if (!normalized.length) return null;
  const left = Math.min(...normalized.map((box) => box.x));
  const top = Math.min(...normalized.map((box) => box.y));
  const right = Math.max(...normalized.map((box) => box.x + box.width));
  const bottom = Math.max(...normalized.map((box) => box.y + box.height));
  return normalizeRegion({ x: left, y: top, width: right - left, height: bottom - top });
}

function expandRegion(box, { padX = 0.12, padY = 0.1, minWidth = 0.5, minHeight = 0.72 } = {}) {
  const normalized = normalizeRegion(box);
  if (!normalized) return null;
  const centerX = normalized.x + normalized.width / 2;
  const centerY = normalized.y + normalized.height / 2;
  const width = Math.min(1, Math.max(normalized.width * (1 + padX * 2), minWidth));
  const height = Math.min(1, Math.max(normalized.height * (1 + padY * 2), minHeight));
  return normalizeRegion({
    x: Math.max(0, Math.min(1 - width, centerX - width / 2)),
    y: Math.max(0, Math.min(1 - height, centerY - height / 2)),
    width,
    height,
  });
}

function boxCenterWithinRegion(box, region, tolerance = 0) {
  const normalizedBox = normalizeRegion(box);
  const normalizedRegion = normalizeRegion(region);
  if (!normalizedBox || !normalizedRegion) return false;
  const centerX = normalizedBox.x + normalizedBox.width / 2;
  const centerY = normalizedBox.y + normalizedBox.height / 2;
  return centerX >= normalizedRegion.x - tolerance
    && centerX <= normalizedRegion.x + normalizedRegion.width + tolerance
    && centerY >= normalizedRegion.y - tolerance
    && centerY <= normalizedRegion.y + normalizedRegion.height + tolerance;
}

function constrainBoxToRegion(box, region) {
  const normalizedBox = normalizeRegion(box);
  const normalizedRegion = normalizeRegion(region);
  if (!normalizedBox || !normalizedRegion) return normalizedBox;
  const left = Math.max(normalizedBox.x, normalizedRegion.x);
  const top = Math.max(normalizedBox.y, normalizedRegion.y);
  const right = Math.min(normalizedBox.x + normalizedBox.width, normalizedRegion.x + normalizedRegion.width);
  const bottom = Math.min(normalizedBox.y + normalizedBox.height, normalizedRegion.y + normalizedRegion.height);
  if (right - left <= 0.03 || bottom - top <= 0.03) return normalizedBox;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

async function estimateMainSubjectRegion(photoDataUrl, items = []) {
  if (!photoDataUrl) return null;
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load source image for subject region"));
    img.src = photoDataUrl;
  }).catch(() => null);

  const aspectRatio = image ? image.width / Math.max(1, image.height) : 0.75;
  const prior = getDefaultMainSubjectRegion(aspectRatio);
  const normalizedItems = (Array.isArray(items) ? items : []).filter((item) => normalizeRegion(item?.box));

  const anchorBoxes = normalizedItems
    .filter((item) => !isAccessoryOrShoeType(item.type))
    .map((item) => item.box)
    .filter((box) => boxCenterWithinRegion(box, prior, 0.08));

  const fallbackBoxes = normalizedItems
    .map((item) => item.box)
    .filter((box) => boxCenterWithinRegion(box, prior, 0.12));

  const subjectSeed = unionBoxes(anchorBoxes.length ? anchorBoxes : fallbackBoxes) || prior;
  return expandRegion(subjectSeed, {
    padX: 0.12,
    padY: 0.08,
    minWidth: Math.max(0.46, prior.width * 0.82),
    minHeight: Math.max(0.7, prior.height * 0.82),
  });
}

function validateDetectedCropHint(box, type = "", subjectRegion = null, geometrySource = "") {
  const normalizedBox = normalizeDetectedBox(box);
  if (!normalizedBox) return { trusted: false, reason: "missing-box" };
  if (usesExactDetectedBox(geometrySource)) {
    const area = normalizedBox.width * normalizedBox.height;
    const touchesAllEdges = normalizedBox.x <= 0.005
      && normalizedBox.y <= 0.005
      && normalizedBox.x + normalizedBox.width >= 0.995
      && normalizedBox.y + normalizedBox.height >= 0.995;
    if (touchesAllEdges || area >= 0.985) return { trusted: false, reason: "frame-sized" };
    if (area <= 0.0025) return { trusted: false, reason: "too-small" };
    if (/product-llm/.test(String(geometrySource || ""))) {
      const normalizedType = String(type || "").toLowerCase();
      if (/hat|bag|belt|sunglass|scarf|glove|accessor/.test(normalizedType) && area > 0.18) {
        return { trusted: false, reason: "product-accessory-too-large" };
      }
      if (/sneaker|boot|sandal|dress shoe|shoe|watch/.test(normalizedType) && area > 0.26) {
        return { trusted: false, reason: "product-small-item-too-large" };
      }
    }
    return { trusted: true, reason: "validated-segmentation" };
  }
  const normalizedSubjectRegion = normalizeRegion(subjectRegion);

  const normalizedType = String(type || "").toLowerCase();
  const area = normalizedBox.width * normalizedBox.height;
  const aspect = normalizedBox.width / Math.max(0.001, normalizedBox.height);
  const touchesThreeEdges = [normalizedBox.x <= 0.01, normalizedBox.y <= 0.01, normalizedBox.x + normalizedBox.width >= 0.99, normalizedBox.y + normalizedBox.height >= 0.99].filter(Boolean).length >= 3;

  if (normalizedSubjectRegion && !boxCenterWithinRegion(normalizedBox, normalizedSubjectRegion, 0.06)) {
    return { trusted: false, reason: "outside-subject-region" };
  }
  if (touchesThreeEdges) return { trusted: false, reason: "frame-sized" };
  if (area >= 0.72) return { trusted: false, reason: "too-large" };

  if (/hat|bag|belt|sunglass|scarf|glove|accessor/.test(normalizedType)) {
    if (area < 0.008 || area > 0.24) return { trusted: false, reason: "accessory-area" };
    if (aspect < 0.18 || aspect > 4.8) return { trusted: false, reason: "accessory-aspect" };
    return { trusted: true, reason: "validated" };
  }
  if (/sneaker|boot|sandal|dress shoe|shoe/.test(normalizedType)) {
    if (area < 0.015 || area > 0.3) return { trusted: false, reason: "shoe-area" };
    if (aspect < 0.35 || aspect > 4.5) return { trusted: false, reason: "shoe-aspect" };
    return { trusted: true, reason: "validated" };
  }
  if (/dress/.test(normalizedType)) {
    if (area < 0.08 || area > 0.6) return { trusted: false, reason: "dress-area" };
    if (aspect < 0.28 || aspect > 1.8) return { trusted: false, reason: "dress-aspect" };
    return { trusted: true, reason: "validated" };
  }
  if (/jacket|coat|hoodie|blazer|vest|shirt|t-shirt|polo|sweater|tank/.test(normalizedType)) {
    if (area < 0.05 || area > 0.52) return { trusted: false, reason: "top-area" };
    if (aspect < 0.35 || aspect > 2.6) return { trusted: false, reason: "top-aspect" };
    return { trusted: true, reason: "validated" };
  }
  if (/jean|chino|short|pant|skirt/.test(normalizedType)) {
    if (area < 0.05 || area > 0.55) return { trusted: false, reason: "bottom-area" };
    if (aspect < 0.28 || aspect > 2.2) return { trusted: false, reason: "bottom-aspect" };
    return { trusted: true, reason: "validated" };
  }

  if (area < 0.03 || area > 0.5) return { trusted: false, reason: "generic-area" };
  if (aspect < 0.2 || aspect > 3.5) return { trusted: false, reason: "generic-aspect" };
  return { trusted: true, reason: "validated" };
}

async function cropImageDataUrlToBox(sourceDataUrl, box, { type = "", padding = 0.06, subjectRegion = null, geometrySource = "" } = {}) {
  if (!sourceDataUrl) return sourceDataUrl;
  let cropBox = usesExactDetectedBox(geometrySource) ? normalizeDetectedBox(box) : expandDetectedBox(box, type);
  if (subjectRegion && !usesExactDetectedBox(geometrySource)) {
    const subjectBounds = expandRegion(subjectRegion, {
      padX: 0.04,
      padY: 0.03,
      minWidth: normalizeRegion(subjectRegion)?.width || 0.5,
      minHeight: normalizeRegion(subjectRegion)?.height || 0.72,
    });
    cropBox = constrainBoxToRegion(cropBox, subjectBounds);
  }
  if (!cropBox) return sourceDataUrl;

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load source image for crop"));
    img.src = sourceDataUrl;
  });

  const effectivePadding = usesExactDetectedBox(geometrySource)
    ? (usesProductExactDetectedBox(geometrySource) ? 0.018 : 0.035)
    : padding;
  const xPad = cropBox.width * effectivePadding;
  const yPad = cropBox.height * effectivePadding;
  const left = Math.max(0, cropBox.x - xPad);
  const top = Math.max(0, cropBox.y - yPad);
  const right = Math.min(1, cropBox.x + cropBox.width + xPad);
  const bottom = Math.min(1, cropBox.y + cropBox.height + yPad);

  const cropX = Math.max(0, Math.round(image.width * left));
  const cropY = Math.max(0, Math.round(image.height * top));
  const cropWidth = Math.max(1, Math.round(image.width * (right - left)));
  const cropHeight = Math.max(1, Math.round(image.height * (bottom - top)));

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceDataUrl;

  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return compressLoadedImageToDataUrl(canvas, {
    maxEdge: 960,
    quality: 0.74,
    maxBytes: 380 * 1024,
  });
}

async function cropImageDataUrlToRegion(sourceDataUrl, region) {
  if (!sourceDataUrl) return sourceDataUrl;
  const cropRegion = normalizeDetectedBox(region);
  if (!cropRegion) return sourceDataUrl;

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load source image for crop"));
    img.src = sourceDataUrl;
  });

  const cropX = Math.max(0, Math.round(image.width * cropRegion.x));
  const cropY = Math.max(0, Math.round(image.height * cropRegion.y));
  const cropWidth = Math.max(1, Math.round(image.width * cropRegion.width));
  const cropHeight = Math.max(1, Math.round(image.height * cropRegion.height));

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceDataUrl;
  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return compressLoadedImageToDataUrl(canvas, {
    maxEdge: 960,
    quality: 0.74,
    maxBytes: 380 * 1024,
  });
}

// Display aspect ratio (width / height) used by wardrobe thumbnails and the
// viewer stage. All crops are constrained to this ratio so cropped content
// fills every display slot without being clipped by object-fit: cover.
const CROP_DISPLAY_RATIO = 0.92;

function getDefaultManualCropRegion() {
  return { x: 0.12, y: 0.08, width: 0.76, height: 0.84 };
}

function constrainRegionToDisplayRatio(region, imageWidth = 0, imageHeight = 0) {
  if (!imageWidth || !imageHeight) return region;
  // region.width / region.height (in normalized coords) should equal
  // CROP_DISPLAY_RATIO * (imageHeight / imageWidth) so that the pixel output
  // has CROP_DISPLAY_RATIO aspect.
  const targetWH = CROP_DISPLAY_RATIO * (imageHeight / imageWidth);
  let { x, y, width, height } = region;
  // Pick whichever dimension is smaller relative to the target to avoid
  // growing beyond the image bounds.
  if (width / height > targetWH) {
    width = height * targetWH;
  } else {
    height = width / targetWH;
  }
  width = Math.min(1, Math.max(0.1, width));
  height = Math.min(1, Math.max(0.1, height));
  // Re-check after clamping
  if (width / height > targetWH) width = height * targetWH;
  else height = width / targetWH;
  x = Math.min(Math.max(0, x), 1 - width);
  y = Math.min(Math.max(0, y), 1 - height);
  return { x, y, width, height };
}

function normalizeManualCropRegion(region = null, { imageWidth = 0, imageHeight = 0 } = {}) {
  const fallback = getDefaultManualCropRegion();
  const base = normalizeDetectedBox(region) || fallback;
  const minSize = 0.16;
  const width = Math.max(minSize, Math.min(1, Number(base.width || fallback.width)));
  const height = Math.max(minSize, Math.min(1, Number(base.height || fallback.height)));
  const x = Math.min(Math.max(0, Number(base.x || fallback.x)), 1 - width);
  const y = Math.min(Math.max(0, Number(base.y || fallback.y)), 1 - height);
  const region2 = { x, y, width, height };
  if (imageWidth && imageHeight) {
    return constrainRegionToDisplayRatio(region2, imageWidth, imageHeight);
  }
  return region2;
}

async function waitForImageReady(imageEl) {
  if (!imageEl) throw new Error("Missing image element");
  if (imageEl.complete && imageEl.naturalWidth) return;
  await new Promise((resolve, reject) => {
    imageEl.onload = () => resolve();
    imageEl.onerror = () => reject(new Error("Image failed to load"));
  });
}

function setItemCropStatus(message = "") {
  if (!els.itemCropStatus) return;
  els.itemCropStatus.textContent = message;
  els.itemCropStatus.style.display = message ? "block" : "none";
}

function getItemCropImageBounds() {
  const session = activeItemCropSession;
  const stage = els.itemCropStage;
  if (!session || !stage) return null;
  const stageWidth = stage.clientWidth || 0;
  const stageHeight = stage.clientHeight || 0;
  if (!stageWidth || !stageHeight || !session.imageWidth || !session.imageHeight) return null;
  const scale = Math.min(stageWidth / session.imageWidth, stageHeight / session.imageHeight);
  const width = session.imageWidth * scale;
  const height = session.imageHeight * scale;
  return {
    left: (stageWidth - width) / 2,
    top: (stageHeight - height) / 2,
    width,
    height,
  };
}

function renderItemCropSelection() {
  const session = activeItemCropSession;
  const selection = els.itemCropSelection;
  const bounds = getItemCropImageBounds();
  if (!session || !selection || !bounds) return;
  const region = normalizeManualCropRegion(session.region);
  session.region = region;
  selection.style.left = `${bounds.left + region.x * bounds.width}px`;
  selection.style.top = `${bounds.top + region.y * bounds.height}px`;
  selection.style.width = `${region.width * bounds.width}px`;
  selection.style.height = `${region.height * bounds.height}px`;
}

function closeItemCropDialog({ restore = true } = {}) {
  const session = activeItemCropSession;
  activeItemCropPointerState = null;
  activeItemCropSession = null;
  setItemCropStatus("");
  if (els.itemCropImage) els.itemCropImage.removeAttribute("src");
  els.itemCropDialog?.close?.();
  if (restore) session?.onCancel?.();
}

async function openItemCropDialog({
  sourcePhotoDataUrl,
  title = "Crop this item",
  subtitle = "Move the crop box over the item, then drag the corner to resize it.",
  initialRegion = null,
  onApply = null,
  onCancel = null,
} = {}) {
  if (!sourcePhotoDataUrl || !els.itemCropDialog || !els.itemCropImage) return false;
  activeItemCropPointerState = null;
  activeItemCropSession = {
    sourcePhotoDataUrl,
    region: normalizeManualCropRegion(initialRegion),
    onApply,
    onCancel,
    imageWidth: 0,
    imageHeight: 0,
  };
  if (els.itemCropDialogTitle) els.itemCropDialogTitle.textContent = title;
  if (els.itemCropDialogSubtitle) els.itemCropDialogSubtitle.textContent = subtitle;
  setItemCropStatus("");
  els.itemCropImage.src = sourcePhotoDataUrl;
  try {
    await waitForImageReady(els.itemCropImage);
  } catch (err) {
    setItemCropStatus(err.message || "Couldn’t load this photo for cropping.");
    const failedSession = activeItemCropSession;
    activeItemCropSession = null;
    failedSession?.onCancel?.();
    return false;
  }
  activeItemCropSession.imageWidth = els.itemCropImage.naturalWidth || 0;
  activeItemCropSession.imageHeight = els.itemCropImage.naturalHeight || 0;
  activeItemCropSession.region = normalizeManualCropRegion(activeItemCropSession.region, {
    imageWidth: activeItemCropSession.imageWidth,
    imageHeight: activeItemCropSession.imageHeight,
  });
  els.itemCropDialog.showModal?.();
  window.requestAnimationFrame(renderItemCropSelection);
  return true;
}

function beginItemCropPointerInteraction(event, mode = "move") {
  if (!activeItemCropSession) return;
  const bounds = getItemCropImageBounds();
  if (!bounds) return;
  event.preventDefault();
  event.target?.setPointerCapture?.(event.pointerId);
  activeItemCropPointerState = {
    mode,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    region: { ...activeItemCropSession.region },
  };
}

function updateItemCropPointerInteraction(event) {
  if (!activeItemCropPointerState || !activeItemCropSession) return;
  if (event.pointerId !== activeItemCropPointerState.pointerId) return;
  const bounds = getItemCropImageBounds();
  if (!bounds) return;
  event.preventDefault();
  const deltaX = (event.clientX - activeItemCropPointerState.startX) / bounds.width;
  const deltaY = (event.clientY - activeItemCropPointerState.startY) / bounds.height;
  const start = activeItemCropPointerState.region;
  const minSize = 0.16;

  const imageDims = {
    imageWidth: activeItemCropSession.imageWidth || 0,
    imageHeight: activeItemCropSession.imageHeight || 0,
  };
  if (activeItemCropPointerState.mode === "resize") {
    // Lock to display aspect ratio while resizing. Use the diagonal drag
    // magnitude to infer the new size and recompute width/height from ratio.
    const width = Math.max(minSize, Math.min(1 - start.x, start.width + deltaX));
    const height = Math.max(minSize, Math.min(1 - start.y, start.height + deltaY));
    activeItemCropSession.region = normalizeManualCropRegion({
      x: start.x,
      y: start.y,
      width,
      height,
    }, imageDims);
  } else {
    const x = Math.min(Math.max(0, start.x + deltaX), 1 - start.width);
    const y = Math.min(Math.max(0, start.y + deltaY), 1 - start.height);
    activeItemCropSession.region = normalizeManualCropRegion({
      x,
      y,
      width: start.width,
      height: start.height,
    }, imageDims);
  }
  renderItemCropSelection();
}

function endItemCropPointerInteraction(event) {
  if (!activeItemCropPointerState) return;
  if (event.pointerId && event.pointerId !== activeItemCropPointerState.pointerId) return;
  activeItemCropPointerState = null;
}

async function normalizeDetectedItems(data, photoDataUrl) {
  const rawItems = Array.isArray(data?.items) && data.items.length ? data.items : [data];
  const normalized = rawItems
    .map((item, index) => {
      const rawType = compactText(item?.type, "");
      const rawName = compactText(item?.name, "");
      return {
        id: `detected-${Date.now()}-${index}`,
        type: inferDetectedItemType(rawType, rawName),
        detectedType: rawType || rawName,
        name: rawName,
        color: compactText(item?.color, ""),
        material: compactText(item?.material, ""),
        careInstructions: normalizeCareInstructionsInput(item?.careInstructions),
        box: normalizeDetectedBox(item?.box),
        geometrySource: compactText(item?.geometrySource || data?.source, ""),
        kept: item?.kept !== false,
      };
    })
    .filter((item) => item.type || item.name || item.color || item.material || item.careInstructions.length);

  const subjectRegion = await estimateMainSubjectRegion(photoDataUrl, normalized);

  return Promise.all(normalized.map(async (item) => {
    const cropType = item.detectedType || item.type;
    const cropAssessment = validateDetectedCropHint(item.box, cropType, subjectRegion, item.geometrySource);
    const cropPhotoDataUrl = cropAssessment.trusted
      ? await cropImageDataUrlToBox(photoDataUrl, item.box, { type: cropType, subjectRegion, geometrySource: item.geometrySource })
      : null;
    const sourcePhotoDataUrl = photoDataUrl || null;
    const cropConfidence = cropPhotoDataUrl ? "trusted" : "fallback";
    return normalizeWardrobeItemMedia({
      ...item,
      sourcePhotoDataUrl,
      cropPhotoDataUrl,
      cropConfidence,
      cropFallbackReason: cropAssessment.reason,
    });
  }));
}

function collectItemFormData() {
  const usingCompactEditFields = !!editingItemId && !!els.itemEditColor;
  const colorValue = usingCompactEditFields ? (els.itemEditColor?.value || "") : (els.itemColor?.value || "");
  const materialValue = usingCompactEditFields ? (els.itemEditMaterial?.value || "") : (els.itemMaterial?.value || "");
  const careValue = usingCompactEditFields ? (els.itemEditCare?.value || "") : (els.itemCare?.value || "");
  const favoriteValue = usingCompactEditFields ? !!els.itemEditFavorite?.checked : !!els.itemFavorite?.checked;
  const careRaw = careValue.trim() || "";
  const currentItem = currentBatchItem();
  const sourcePhotoDataUrl = currentItem?.sourcePhotoDataUrl || pendingPhotoDataUrl || null;
  const cropPhotoDataUrl = currentItem?.cropPhotoDataUrl || pendingCropPhotoDataUrl || null;
  const cropConfidence = currentItem?.cropConfidence || pendingCropConfidence || (cropPhotoDataUrl ? "trusted" : "none");
  return {
    type: canonicalizeDetectedItemType(els.itemType?.value?.trim() || ""),
    name: normalizeWardrobeNameValue(els.itemName?.value?.trim() || "", els.itemType?.value?.trim() || ""),
    color: normalizeWardrobeColorValue(colorValue.trim() || ""),
    material: normalizeWardrobeMaterialValue(materialValue.trim() || ""),
    careInstructions: careRaw ? careRaw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [],
    sourcePhotoDataUrl,
    cropPhotoDataUrl,
    cropConfidence,
    photoDataUrl: cropConfidence === "trusted" && cropPhotoDataUrl ? cropPhotoDataUrl : sourcePhotoDataUrl,
    favorite: favoriteValue,
  };
}

function syncCompactEditFieldsFromPrimary() {
  if (!els.itemEditColor) return;
  els.itemEditColor.value = els.itemColor?.value || "";
  els.itemEditMaterial.value = els.itemMaterial?.value || "";
  els.itemEditCare.value = els.itemCare?.value || "";
  if (els.itemEditFavorite) els.itemEditFavorite.checked = !!els.itemFavorite?.checked;
}

function syncPrimaryFieldsFromCompactEdit() {
  if (!els.itemEditColor) return;
  if (els.itemColor) els.itemColor.value = els.itemEditColor.value;
  if (els.itemMaterial) els.itemMaterial.value = els.itemEditMaterial.value;
  if (els.itemCare) els.itemCare.value = els.itemEditCare.value;
  if (els.itemFavorite) els.itemFavorite.checked = !!els.itemEditFavorite?.checked;
}

function fillItemForm(item = {}) {
  if (els.itemType) els.itemType.value = getWardrobeSubtype(item);
  if (els.itemName) els.itemName.value = normalizeWardrobeNameValue(item.name, item.type);
  if (els.itemColor) els.itemColor.value = normalizeWardrobeColorValue(item.color);
  if (els.itemMaterial) els.itemMaterial.value = normalizeWardrobeMaterialValue(item.material);
  if (els.itemCare) els.itemCare.value = Array.isArray(item.careInstructions) ? item.careInstructions.join(", ") : "";
  if (els.itemFavorite) els.itemFavorite.checked = !!item.favorite;
  syncCompactEditFieldsFromPrimary();
  setItemMoreDetailsOpen(!!(item.color || item.material || item.careInstructions?.length));
}

function updateNeedsReviewFieldFlags() {
  if (!els.itemDialog?.classList.contains("is-needs-review")) return;
  const colorValue = (els.itemEditColor?.value ?? els.itemColor?.value ?? "").trim();
  const materialValue = (els.itemEditMaterial?.value ?? els.itemMaterial?.value ?? "").trim();
  const colorGroups = [els.itemColor?.closest(".form-group"), els.itemEditColor?.closest(".form-group")];
  const materialGroups = [els.itemMaterial?.closest(".form-group"), els.itemEditMaterial?.closest(".form-group")];
  colorGroups.forEach((group) => group?.classList.toggle("is-needs-review", !colorValue));
  materialGroups.forEach((group) => group?.classList.toggle("is-needs-review", !materialValue));
  if (colorValue && materialValue) {
    els.itemDialog.classList.remove("is-needs-review");
  }
}

function syncActiveBatchItemFromForm() {
  if (!editingItemId && itemBatchItems.length && itemFlowStep === "review") return;
  const item = currentBatchItem();
  if (!item) return;
  Object.assign(item, collectItemFormData());
}

function clearItemBatch() {
  itemBatchItems = [];
  activeItemBatchIndex = -1;
}

function hasItemImportSession() {
  return itemImportSession.totalPhotos > 0;
}

function clearItemImportSession() {
  itemImportSession = { totalPhotos: 0, acceptedPhotos: 0, rejectedPhotos: 0 };
}

function clearItemQueuedPhotoPreviews() {
  itemQueuedPhotoPreviews.forEach((entry) => {
    if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl);
  });
  itemQueuedPhotoPreviews = [];
}

function setItemQueuedPhotoPreviews(files = []) {
  clearItemQueuedPhotoPreviews();
  itemQueuedPhotoPreviews = files.map((file, index) => ({
    id: `${Date.now()}-${index}`,
    name: file?.name || `Photo ${index + 1}`,
    objectUrl: URL.createObjectURL(file),
  }));
}

function appendItemQueuedPhotoPreviews(files = []) {
  const startingIndex = itemQueuedPhotoPreviews.length;
  itemQueuedPhotoPreviews.push(...files.map((file, index) => ({
    id: `${Date.now()}-${startingIndex + index}`,
    name: file?.name || `Photo ${startingIndex + index + 1}`,
    objectUrl: URL.createObjectURL(file),
  })));
}

function updateItemScanningUI() {
  if (!els.itemScanningThumbs) return;
  const totalPhotos = itemImportSession.totalPhotos || itemQueuedPhotoPreviews.length || itemProcessingPlaceholders || 0;
  const acceptedPhotos = itemImportSession.acceptedPhotos || 0;
  const rejectedPhotos = itemImportSession.rejectedPhotos || 0;
  const remainingPhotos = Math.max(totalPhotos - acceptedPhotos - rejectedPhotos, itemProcessingPlaceholders, 0);

  if (els.itemScanningSubtitle) {
    els.itemScanningSubtitle.textContent = totalPhotos > 1
      ? `Analyzing ${totalPhotos} photos and pulling out the clothing items that look save-ready.`
      : "Analyzing your photo and detecting the clothing item that looks save-ready.";
  }
  if (els.itemScanningStatusPrimary) {
    els.itemScanningStatusPrimary.textContent = remainingPhotos > 0
      ? `Scanning ${totalPhotos} photo${totalPhotos === 1 ? "" : "s"}`
      : "Preparing review";
  }
  if (els.itemScanningStatusSecondary) {
    els.itemScanningStatusSecondary.textContent = remainingPhotos > 0
      ? `${acceptedPhotos} ready${rejectedPhotos ? ` • ${rejectedPhotos} need help` : ""}`
      : `Detected ${itemBatchItems.length} item${itemBatchItems.length === 1 ? "" : "s"}${rejectedPhotos ? ` • ${rejectedPhotos} need attention` : ""}`;
  }
  els.itemScanningThumbs.innerHTML = itemQueuedPhotoPreviews.map((entry, index) => {
    const state = index < acceptedPhotos + rejectedPhotos
      ? (index < acceptedPhotos ? "done" : "warning")
      : "active";
    return `
      <div class="item-scanning-thumb is-${state}">
        <img src="${escapeHtml(entry.objectUrl)}" alt="${escapeHtml(entry.name)}" />
      </div>
    `;
  }).join("");
}

function updateItemQueueSummary() {
  if (!els.itemQueueSummary) return;
  if (!hasItemImportSession()) {
    els.itemQueueSummary.style.display = "none";
    els.itemQueueSummary.textContent = "";
    return;
  }
  els.itemQueueSummary.style.display = "block";
  const keptCount = itemBatchItems.filter((item) => item.kept !== false).length;
  const { totalPhotos, acceptedPhotos, rejectedPhotos } = itemImportSession;
  els.itemQueueSummary.textContent = `Scanned ${totalPhotos} photo${totalPhotos === 1 ? "" : "s"} in parallel. Detected ${keptCount} item${keptCount === 1 ? "" : "s"} from ${acceptedPhotos} photo${acceptedPhotos === 1 ? "" : "s"}${rejectedPhotos ? `, and flagged ${rejectedPhotos} photo${rejectedPhotos === 1 ? "" : "s"} for another shot.` : "."}`;
}

function currentRejectedPhoto() {
  if (activeRejectedPhotoIndex < 0) return null;
  return itemRejectedPhotos[activeRejectedPhotoIndex] || null;
}

function collectBatchEditFormData() {
  const careRaw = els.itemBatchEditCare?.value?.trim() || "";
  return {
    type: canonicalizeDetectedItemType(els.itemBatchEditType?.value?.trim() || ""),
    name: normalizeWardrobeNameValue(els.itemBatchEditName?.value?.trim() || "", els.itemBatchEditType?.value?.trim() || ""),
    color: normalizeWardrobeColorValue(els.itemBatchEditColor?.value?.trim() || ""),
    material: normalizeWardrobeMaterialValue(els.itemBatchEditMaterial?.value?.trim() || ""),
    careInstructions: careRaw ? careRaw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [],
    favorite: !!els.itemBatchEditFavorite?.checked,
  };
}

function setBatchEditStatus(message = "") {
  if (!els.itemBatchEditStatus) return;
  els.itemBatchEditStatus.textContent = message;
  els.itemBatchEditStatus.style.display = message ? "block" : "none";
}

function openBatchEditDialog(index) {
  const item = itemBatchItems[index];
  if (!item) return;
  editingBatchItemIndex = index;
  if (els.itemBatchEditTitle) els.itemBatchEditTitle.textContent = item.name || item.type || `Item ${index + 1}`;
  if (els.itemBatchEditMeta) {
    els.itemBatchEditMeta.textContent = [item.batchSourceLabel, getWardrobeCategoryLabel(getWardrobeCategory(item)), normalizeWardrobeColorValue(item.color)].filter(Boolean).join(" · ") || "Review the details before saving.";
  }
  const displayPhoto = getItemDisplayPhoto(item);
  if (els.itemBatchEditPhoto) {
    if (displayPhoto) {
      els.itemBatchEditPhoto.src = displayPhoto;
      els.itemBatchEditPhoto.style.display = "block";
    } else {
      els.itemBatchEditPhoto.removeAttribute("src");
      els.itemBatchEditPhoto.style.display = "none";
    }
  }
  if (els.itemBatchEditPhotoPlaceholder) {
    els.itemBatchEditPhotoPlaceholder.style.display = displayPhoto ? "none" : "flex";
    els.itemBatchEditPhotoPlaceholder.innerHTML = typeEmoji(item.type || "Other");
  }
  if (els.itemBatchEditType) els.itemBatchEditType.value = getWardrobeSubtype(item);
  if (els.itemBatchEditName) els.itemBatchEditName.value = normalizeWardrobeNameValue(item.name, item.type);
  if (els.itemBatchEditColor) els.itemBatchEditColor.value = normalizeWardrobeColorValue(item.color);
  if (els.itemBatchEditMaterial) els.itemBatchEditMaterial.value = normalizeWardrobeMaterialValue(item.material);
  if (els.itemBatchEditCare) els.itemBatchEditCare.value = Array.isArray(item.careInstructions) ? item.careInstructions.join(", ") : "";
  if (els.itemBatchEditFavorite) els.itemBatchEditFavorite.checked = !!item.favorite;
  if (els.itemBatchEditRemoveBtn) {
    els.itemBatchEditRemoveBtn.textContent = item.kept === false ? "Keep item" : "Discard item";
  }
  const needsReview = itemNeedsMetadataReview(item);
  els.itemBatchEditDialog?.classList.toggle("is-needs-review", needsReview);
  updateBatchEditNeedsReviewFlags();
  setBatchEditStatus("");
  els.itemBatchEditDialog?.showModal?.();
}

function updateBatchEditNeedsReviewFlags() {
  if (!els.itemBatchEditDialog?.classList.contains("is-needs-review")) {
    els.itemBatchEditColor?.closest(".form-group")?.classList.remove("is-needs-review");
    els.itemBatchEditMaterial?.closest(".form-group")?.classList.remove("is-needs-review");
    return;
  }
  const colorMissing = !els.itemBatchEditColor?.value.trim();
  const materialMissing = !els.itemBatchEditMaterial?.value.trim();
  els.itemBatchEditColor?.closest(".form-group")?.classList.toggle("is-needs-review", colorMissing);
  els.itemBatchEditMaterial?.closest(".form-group")?.classList.toggle("is-needs-review", materialMissing);
  if (!colorMissing && !materialMissing) {
    els.itemBatchEditDialog.classList.remove("is-needs-review");
  }
}

function closeBatchEditDialog() {
  editingBatchItemIndex = -1;
  els.itemBatchEditDialog?.close?.();
}

function saveBatchEditDialog() {
  const item = itemBatchItems[editingBatchItemIndex];
  if (!item) return;
  const next = collectBatchEditFormData();
  if (!next.type || !next.name) {
    setBatchEditStatus("Add the item type and name before saving your changes.");
    return;
  }
  Object.assign(item, next);
  activeItemBatchIndex = editingBatchItemIndex;
  if (!pendingPhotoDataUrl) pendingPhotoDataUrl = item.sourcePhotoDataUrl || null;
  renderItemBatchReview();
  updateItemSaveState();
  closeBatchEditDialog();
}

function toggleBatchEditItemKept(forceKept = null) {
  const item = itemBatchItems[editingBatchItemIndex];
  if (!item) return;
  item.kept = typeof forceKept === "boolean" ? forceKept : item.kept === false;
  renderItemBatchReview();
  updateItemSaveState();
  if (els.itemBatchEditRemoveBtn) {
    els.itemBatchEditRemoveBtn.textContent = item.kept === false ? "Keep item" : "Discard item";
  }
  closeBatchEditDialog();
}

function focusBatchEditType() {
  setBatchEditStatus("Pick the right category and subtype, then save when it looks right.");
  els.itemBatchEditType?.focus();
}

async function openBatchEditCropDialog() {
  const batchIndex = editingBatchItemIndex;
  const item = itemBatchItems[batchIndex];
  if (!item?.sourcePhotoDataUrl) {
    setBatchEditStatus("This item doesn’t have a source photo available for a new crop.");
    return;
  }
  closeBatchEditDialog();
  await openItemCropDialog({
    sourcePhotoDataUrl: item.sourcePhotoDataUrl,
    title: "Crop detected item",
    subtitle: "Move the crop box over the item, then drag the corner to resize it before saving.",
    onApply: async ({ cropPhotoDataUrl }) => {
      Object.assign(item, normalizeWardrobeItemMedia({
        ...item,
        cropPhotoDataUrl,
        cropConfidence: "trusted",
        photoDataUrl: cropPhotoDataUrl,
      }));
      renderItemBatchReview();
      updateItemSaveState();
      openBatchEditDialog(batchIndex);
      setBatchEditStatus("Updated the crop for this item.");
    },
    onCancel: () => openBatchEditDialog(batchIndex),
  });
}

function markBatchEditAsNotItem() {
  toggleBatchEditItemKept(false);
}

function keepBatchEditItemAnyway() {
  const item = itemBatchItems[editingBatchItemIndex];
  if (!item) return;
  item.kept = true;
  renderItemBatchReview();
  updateItemSaveState();
  closeBatchEditDialog();
}

async function createManualBatchItemFromRejected(entry, { cropRegion = null, entryIndex = activeRejectedPhotoIndex } = {}) {
  if (!entry?.photoDataUrl) return;
  let cropPhotoDataUrl = null;
  if (cropRegion) {
    cropPhotoDataUrl = await cropImageDataUrlToRegion(entry.photoDataUrl, cropRegion).catch(() => null);
  }
  itemBatchItems.push(normalizeWardrobeItemMedia({
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "",
    name: "",
    color: "",
    material: "",
    careInstructions: [],
    kept: true,
    batchSourceLabel: `Photo ${entry.photoIndex || itemRejectedPhotos.length + 1}`,
    batchSourceIndex: entry.photoIndex || itemRejectedPhotos.length + 1,
    sourcePhotoDataUrl: entry.photoDataUrl,
    cropPhotoDataUrl: cropPhotoDataUrl || null,
    cropConfidence: cropPhotoDataUrl ? "trusted" : "fallback",
    photoDataUrl: cropPhotoDataUrl || entry.photoDataUrl,
    favorite: false,
  }));
  itemRejectedPhotos = itemRejectedPhotos.filter((candidate, index) => index !== entryIndex);
  itemImportSession.rejectedPhotos = itemRejectedPhotos.length;
  if (!itemImportSession.acceptedPhotos) itemImportSession.acceptedPhotos = 1;
  activeItemBatchIndex = itemBatchItems.length - 1;
  renderItemBatchReview();
  updateItemQueueSummary();
  updateItemVisual();
  closeRejectedPhotoDialog();
  openBatchEditDialog(activeItemBatchIndex);
}

async function openRejectedPhotoCropDialog(index, { restoreDialog = false } = {}) {
  const entry = itemRejectedPhotos[index];
  if (!entry?.photoDataUrl) return;
  if (restoreDialog) closeRejectedPhotoDialog();
  await openItemCropDialog({
    sourcePhotoDataUrl: entry.photoDataUrl,
    title: "Crop and continue",
    subtitle: "Frame the clothing item you want to keep — we’ll re-scan that region.",
    onApply: async ({ region }) => {
      await reanalyzeRejectedPhotoCrop(entry, region, index);
    },
    onCancel: restoreDialog ? (() => openRejectedPhotoDialog(index)) : null,
  });
}

function getRejectedEntryKey(entry, index) {
  return entry?.photoIndex ? `p${entry.photoIndex}` : `i${index}`;
}
function setRejectedRescanState(key, isScanning) {
  if (!key) return;
  if (isScanning) itemRescanningKeys.add(key);
  else itemRescanningKeys.delete(key);
  renderItemBatchReview();
}

async function reanalyzeRejectedPhotoCrop(entry, cropRegion, entryIndex) {
  if (!entry?.photoDataUrl) return;
  const rescanKey = getRejectedEntryKey(entry, entryIndex);
  setRejectedRescanState(rescanKey, true);
  let croppedDataUrl = null;
  try {
    croppedDataUrl = await cropImageDataUrlToRegion(entry.photoDataUrl, cropRegion);
  } catch (err) {
    console.error("recrop failed", err);
  }
  if (!croppedDataUrl) {
    setRejectedRescanState(rescanKey, false);
    await createManualBatchItemFromRejected(entry, { cropRegion, entryIndex });
    showAppToast("Couldn't re-scan that crop — added it manually instead.", "warning");
    return;
  }

  try {
    const analysis = await analyzeItemPhoto(croppedDataUrl);
    const detectedItems = await normalizeDetectedItems(analysis, croppedDataUrl);
    if (!detectedItems.length) {
      setRejectedRescanState(rescanKey, false);
      await createManualBatchItemFromRejected(entry, { cropRegion, entryIndex });
      showAppToast("Still couldn't detect an item — added it manually so you can finish it.", "warning");
      return;
    }

    const photoIndex = entry.photoIndex || (itemBatchItems.length + itemRejectedPhotos.length + 1);
    const addedItems = detectedItems.map((item, itemIndex) => normalizeWardrobeItemMedia({
      ...item,
      id: item.id || `detected-recrop-${Date.now()}-${itemIndex}`,
      batchSourceLabel: `Photo ${photoIndex}`,
      batchSourceIndex: photoIndex,
      // Preserve the original source photo so further recrops can re-scan;
      // the detection already produced its own crop hint.
      sourcePhotoDataUrl: entry.photoDataUrl,
      cropPhotoDataUrl: item.cropPhotoDataUrl || croppedDataUrl,
      cropConfidence: item.cropPhotoDataUrl ? item.cropConfidence : "trusted",
      kept: true,
    }));
    itemBatchItems.push(...addedItems);
    itemRejectedPhotos = itemRejectedPhotos.filter((_, i) => i !== entryIndex);
    itemImportSession.rejectedPhotos = itemRejectedPhotos.length;
    itemImportSession.acceptedPhotos = (itemImportSession.acceptedPhotos || 0) + 1;
    setItemFlowStep("review");
    renderItemBatchReview();
    updateItemQueueSummary();
    updateItemSaveState();
    showAppToast(
      addedItems.length === 1
        ? "Re-scanned and added to your items."
        : `Re-scanned and added ${addedItems.length} items.`,
      "success"
    );
  } catch (err) {
    console.error("reanalyze crop failed", err);
    setRejectedRescanState(rescanKey, false);
    await createManualBatchItemFromRejected(entry, { cropRegion, entryIndex });
    showAppToast("Re-scan failed — added the crop manually so you can finish it.", "warning");
  } finally {
    itemRescanningKeys.delete(rescanKey);
  }
}

function openRejectedPhotoDialog(index) {
  const entry = itemRejectedPhotos[index];
  if (!entry) return;
  activeRejectedPhotoIndex = index;
  if (els.itemRejectedDialogTitle) els.itemRejectedDialogTitle.textContent = entry.fileName || `Photo ${index + 1}`;
  if (els.itemRejectedDialogMessage) els.itemRejectedDialogMessage.textContent = entry.message || "WearCast flagged this photo before detection. Crop it first, add it manually, or skip it.";
  if (els.itemRejectedDialogPhoto) {
    if (entry.photoDataUrl) {
      els.itemRejectedDialogPhoto.src = entry.photoDataUrl;
      els.itemRejectedDialogPhoto.style.display = "block";
    } else {
      els.itemRejectedDialogPhoto.removeAttribute("src");
      els.itemRejectedDialogPhoto.style.display = "none";
    }
  }
  els.itemRejectedDialog?.showModal?.();
}

function closeRejectedPhotoDialog() {
  activeRejectedPhotoIndex = -1;
  els.itemRejectedDialog?.close?.();
}

function dismissRejectedPhoto(index) {
  itemRejectedPhotos = itemRejectedPhotos.filter((_, entryIndex) => entryIndex !== index);
  itemImportSession.rejectedPhotos = itemRejectedPhotos.length;
  renderItemBatchReview();
  updateItemQueueSummary();
  if (!itemBatchItems.length && !itemRejectedPhotos.length) {
    resetNewItemFlow("");
  }
}

function renderItemBatchReview() {
  const hasBatch = itemBatchItems.length > 0 && !editingItemId;
  const hasRejected = itemRejectedPhotos.length > 0 && !editingItemId;
  const isProcessing = itemProcessingPlaceholders > 0 && !editingItemId;
  const showReview = itemFlowStep === "review" && (hasBatch || hasRejected);
  const hidePhotoPreview = itemFlowStep === "review" || itemFlowStep === "scanning";
  if (els.itemBatchReview) els.itemBatchReview.style.display = showReview ? "flex" : "none";
  if (els.itemPhotoPreview) els.itemPhotoPreview.style.display = hidePhotoPreview ? "none" : "";
  if (els.itemPhotoLabel) {
    els.itemPhotoLabel.textContent = hasBatch || hasRejected ? "Take more photos" : "Take photos";
  }
  if (els.itemRejectedResults) els.itemRejectedResults.style.display = hasRejected ? "flex" : "none";
  if (els.itemRejectedTitle) {
    els.itemRejectedTitle.textContent = itemRejectedPhotos.length === 1
      ? "1 photo needs help"
      : `${itemRejectedPhotos.length} photos need help`;
  }
  if (els.itemRejectedList) {
    els.itemRejectedList.dataset.layout = itemRejectedPhotos.length <= 1
      ? "single"
      : itemRejectedPhotos.length === 2
        ? "double"
        : itemRejectedPhotos.length <= 4
          ? "compact"
          : "dense";
    els.itemRejectedList.innerHTML = itemRejectedPhotos.map((entry, index) => {
      const isRescanning = itemRescanningKeys.has(getRejectedEntryKey(entry, index));
      const photoLabel = `Photo ${entry.photoIndex || index + 1}`;
      const fileName = entry.fileName || photoLabel;
      return `
      <article class="item-rejected-card${isRescanning ? " is-rescanning" : ""}" data-rejected-index="${index}" role="button" tabindex="0"${isRescanning ? ' aria-busy="true"' : ""}>
        ${entry.photoDataUrl ? `<div class="item-rejected-photo-wrap">
          <img src="${escapeHtml(entry.photoDataUrl)}" alt="" />
          <div class="item-rejected-photo-overlay">
            <strong class="item-rejected-photo-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</strong>
            <span class="item-rejected-photo-hint">Tap to fix</span>
          </div>
          ${isRescanning ? `<div class="item-rejected-rescan-overlay" role="status" aria-label="Re-scanning">
            <div class="item-rejected-rescan-orb"></div>
            <span>Re-scanning…</span>
          </div>` : ""}
        </div>` : `<div class="item-rejected-copy">
          <strong title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</strong>
          <span class="item-rejected-photo-hint">Tap to fix</span>
        </div>`}
      </article>
    `;
    }).join("");
  }
  if (isProcessing) {
    if (els.itemBatchTitle) els.itemBatchTitle.textContent = `Scanning ${itemProcessingPlaceholders} photo${itemProcessingPlaceholders === 1 ? "" : "s"}`;
    if (els.itemBatchSummary) els.itemBatchSummary.textContent = "Preparing your results.";
    if (els.itemBatchStats) els.itemBatchStats.textContent = "";
    if (els.itemBatchKeepToggleBtn) els.itemBatchKeepToggleBtn.disabled = true;
    if (els.itemBatchList) {
      els.itemBatchList.innerHTML = Array.from({ length: itemProcessingPlaceholders }).map(() => `
        <div class="item-batch-chip item-batch-chip-skeleton" aria-hidden="true">
          <span class="item-batch-chip-photo-wrap item-batch-skeleton-block"></span>
          <span class="item-batch-chip-overlay">
            <span class="item-batch-chip-copy">
              <strong class="item-batch-skeleton-line item-batch-skeleton-line-title"></strong>
              <span class="item-batch-skeleton-line item-batch-skeleton-line-meta"></span>
            </span>
          </span>
        </div>
      `).join("");
    }
    updateItemScanningUI();
    return;
  }

  if (!hasBatch) {
    if (els.itemBatchTitle) els.itemBatchTitle.textContent = hasRejected ? "Review results" : "No items detected yet";
    if (els.itemBatchSummary) els.itemBatchSummary.textContent = hasRejected
      ? "Fix the photos below to keep going."
      : "Scan photos to see your items here.";
    if (els.itemBatchStats) {
      els.itemBatchStats.textContent = hasRejected
        ? `${itemRejectedPhotos.length} photo${itemRejectedPhotos.length === 1 ? "" : "s"} need attention`
        : "";
    }
    if (els.itemBatchList) els.itemBatchList.innerHTML = "";
    if (els.itemBatchKeepToggleBtn) els.itemBatchKeepToggleBtn.style.display = "none";
    return;
  }

  const keptCount = itemBatchItems.filter((item) => item.kept !== false).length;
  if (els.itemBatchTitle) {
    els.itemBatchTitle.textContent = keptCount
      ? `${keptCount} item${keptCount === 1 ? "" : "s"} ready`
      : "No items selected from these photos";
  }
  if (els.itemBatchSummary) {
    els.itemBatchSummary.textContent = "Tap any item to edit it, then save when you're ready.";
  }
  if (els.itemBatchStats) {
    const parts = [
      `${keptCount} ready`,
      itemRejectedPhotos.length ? `${itemRejectedPhotos.length} fix` : "",
      itemBatchItems.length > 1 ? `${itemBatchItems.length} scanned` : "",
    ].filter(Boolean);
    els.itemBatchStats.textContent = parts.join(" • ");
  }
  if (els.itemBatchKeepToggleBtn) {
    els.itemBatchKeepToggleBtn.style.display = "none";
    els.itemBatchKeepToggleBtn.disabled = true;
  }
  if (els.itemBatchList) {
    els.itemBatchList.dataset.layout = itemBatchItems.length <= 1
      ? "single"
      : itemBatchItems.length === 2
        ? "double"
        : itemBatchItems.length <= 4
          ? "compact"
          : "dense";
    els.itemBatchList.innerHTML = itemBatchItems.map((item, index) => {
      const label = item.name || item.type || `Item ${index + 1}`;
      const stateLabel = item.kept === false ? "Discarded" : itemNeedsMetadataReview(item) ? "Needs review" : "Ready";
      const meta = [getWardrobeSubtype(item), normalizeWardrobeColorValue(item.color)].filter(Boolean).join(" · ");
      const removedClass = item.kept === false ? " is-removed" : "";
      const displayPhoto = getItemDisplayPhoto(item);
      const stateTone = item.kept === false
        ? "discarded"
        : itemNeedsMetadataReview(item)
          ? "review"
          : "ready";
      return `
        <button
          type="button"
          class="item-batch-chip${removedClass}"
          data-item-batch-index="${index}"
          data-state-tone="${stateTone}"
          aria-pressed="false"
        >
          ${displayPhoto ? `<span class="item-batch-chip-photo-wrap"><img class="item-batch-chip-photo" src="${escapeHtml(displayPhoto)}" alt="" /></span>` : `<span class="item-batch-chip-photo-wrap item-batch-chip-photo-wrap-empty"></span>`}
          <span class="item-batch-chip-dismiss" data-item-batch-discard="${index}" role="button" aria-label="${item.kept === false ? "Keep item" : "Discard item"}">${item.kept === false ? "+" : "&times;"}</span>
          <span class="item-batch-chip-state" data-state-tone="${stateTone}">${escapeHtml(stateLabel)}</span>
          <span class="item-batch-chip-overlay">
            <span class="item-batch-chip-copy">
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(meta || stateLabel)}</span>
            </span>
          </span>
        </button>
      `;
    }).join("");
  }
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(syncItemScrollIndicators);
  } else {
    syncItemScrollIndicators();
  }
}

const itemScrollIndicatorBindings = new WeakSet();
function updateScrollIndicator(list, indicator) {
  if (!list || !indicator) return;
  const overflow = list.scrollWidth - list.clientWidth;
  if (overflow <= 4 || list.children.length <= 1) {
    indicator.classList.remove("is-visible");
    indicator.innerHTML = "";
    return;
  }
  indicator.classList.add("is-visible");
  const count = Math.max(2, Math.min(list.children.length, Math.ceil(list.scrollWidth / list.clientWidth) + 1));
  const progress = Math.max(0, Math.min(1, list.scrollLeft / overflow));
  const activeIndex = Math.round(progress * (count - 1));
  if (indicator.childElementCount !== count) {
    indicator.innerHTML = Array.from({ length: count })
      .map(() => '<span class="item-scroll-dot"></span>')
      .join("");
  }
  Array.from(indicator.children).forEach((dot, i) => {
    dot.classList.toggle("is-active", i === activeIndex);
  });
}
function bindScrollIndicator(list, indicator) {
  if (!list || !indicator || itemScrollIndicatorBindings.has(list)) return;
  itemScrollIndicatorBindings.add(list);
  const update = () => updateScrollIndicator(list, indicator);
  list.addEventListener("scroll", update, { passive: true });
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(update);
    ro.observe(list);
  } else {
    window.addEventListener("resize", update);
  }
}
function syncItemScrollIndicators() {
  const pairs = [
    [els.itemBatchList, els.itemBatchListDots],
    [els.itemRejectedList, els.itemRejectedListDots],
  ];
  for (const [list, indicator] of pairs) {
    if (!list || !indicator) continue;
    bindScrollIndicator(list, indicator);
    updateScrollIndicator(list, indicator);
  }
}
function loadBatchItemIntoForm(index) {
  if (!itemBatchItems[index]) return;
  syncActiveBatchItemFromForm();
  activeItemBatchIndex = index;
  fillItemForm(itemBatchItems[index]);
  revealItemManualDetails();
  clearItemValidationErrors();
  updateItemVisual();
  renderItemBatchReview();
  updateItemSaveState();
}

function updateItemSaveState() {
  if (!els.itemSaveBtn) return;
  const footer = els.itemForm?.querySelector?.(".item-save-footer");
  const busy = isSavingItem || isReadingItemPhoto || isAnalyzingItemPhoto;
  syncActiveBatchItemFromForm();
  const keptItems = itemBatchItems.filter((item) => item.kept !== false);
  const hasRequiredFields = editingItemId
    ? !!(els.itemType?.value?.trim() && els.itemName?.value?.trim())
    : itemBatchItems.length
      ? keptItems.length > 0 && keptItems.every((item) => item.type && item.name)
      : !!(els.itemType?.value?.trim() && els.itemName?.value?.trim());
  const canContinue = itemFlowStep === "review"
    ? !busy && keptItems.length > 0
    : itemFlowStep === "confirm"
      ? !busy && hasRequiredFields
      : false;
  // Use aria-disabled instead of the native disabled attribute so a tap still
  // reaches the submit handler and can surface a reason toast explaining why
  // the action is blocked. Keep `disabled` only while we are actually busy
  // (saving / scanning) — those states genuinely shouldn't be re-triggered.
  if (busy) {
    els.itemSaveBtn.disabled = true;
    els.itemSaveBtn.removeAttribute("aria-disabled");
    els.itemSaveBtn.classList.remove("is-blocked");
  } else {
    els.itemSaveBtn.disabled = false;
    if (canContinue) {
      els.itemSaveBtn.removeAttribute("aria-disabled");
      els.itemSaveBtn.classList.remove("is-blocked");
    } else {
      els.itemSaveBtn.setAttribute("aria-disabled", "true");
      els.itemSaveBtn.classList.add("is-blocked");
    }
  }
  if (footer) footer.style.display = itemFlowStep === "review" || itemFlowStep === "confirm" || !!editingItemId ? "" : "none";
  els.itemSaveBtn.textContent = isSavingItem
    ? (editingItemId ? "Saving…" : "Saving items…")
    : isReadingItemPhoto || isAnalyzingItemPhoto
      ? "Scanning…"
      : itemFlowStep === "review"
        ? (!editingItemId && keptItems.length > 1 ? `Save ${keptItems.length} items` : "Save item")
        : !editingItemId && keptItems.length > 1
          ? `Save ${keptItems.length} items`
          : "Save item";
  if (els.itemNextPhotoBtn) {
    const showAddMore = !editingItemId && itemFlowStep === "review";
    els.itemNextPhotoBtn.style.display = showAddMore ? "inline-flex" : "none";
    els.itemNextPhotoBtn.disabled = busy;
    els.itemNextPhotoBtn.textContent = "Add more photos";
  }
  if (els.itemEditDetailsBtn) {
    const showEditDetails = itemFlowStep === "confirm" && !itemBatchItems.length;
    els.itemEditDetailsBtn.style.display = showEditDetails ? "inline-flex" : "none";
    els.itemEditDetailsBtn.disabled = busy;
    els.itemEditDetailsBtn.textContent = itemMoreDetailsOpen ? "Hide color, material, care" : "Color, material, care";
  }
  if (els.itemBackBtn) {
    els.itemBackBtn.style.display = (editingItemId || itemFlowStep === "review" || itemFlowStep === "confirm") ? "inline-flex" : "none";
    els.itemBackBtn.disabled = busy;
    els.itemBackBtn.textContent = itemFlowStep === "confirm" && !editingItemId ? "Add/change photo" : "Back";
  }
}

function setItemPhotoStatus(message = "", busy = false, tone = "") {
  if (!els.itemPhotoStatus) return;
  els.itemPhotoStatus.textContent = message;
  els.itemPhotoStatus.classList.toggle("is-busy", !!busy);
  els.itemPhotoStatus.dataset.tone = tone;
}

function setItemFormError(message = "") {
  if (message && itemFlowStep === "confirm" && !itemMoreDetailsOpen) {
    setItemMoreDetailsOpen(true);
    updateItemSaveState();
  }
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

function setItemMoreDetailsOpen(open = false) {
  itemMoreDetailsOpen = !!open;
  if (els.itemConfirmDetailsPanel) {
    els.itemConfirmDetailsPanel.style.display = itemMoreDetailsOpen && itemFlowStep === "confirm" ? "" : "none";
  }
  if (els.itemManualDetails) {
    els.itemManualDetails.classList.toggle("is-compact", itemFlowStep === "confirm" && !itemMoreDetailsOpen);
  }
}

function setItemFlowStep(step, { focus = false } = {}) {
  itemFlowStep = step;
  els.itemDialog?.classList.toggle("is-review-mode", step === "review" && !editingItemId);
  els.itemDialog?.classList.toggle("is-confirm-mode", step === "confirm" && !editingItemId);
  document.querySelectorAll("[data-item-step-panel]").forEach((panel) => {
    if (panel.id === "itemConfirmDetailsPanel") {
      panel.style.display = panel.dataset.itemStepPanel === step && itemMoreDetailsOpen ? "" : "none";
      return;
    }
    panel.style.display = panel.dataset.itemStepPanel === step ? "" : "none";
  });
  document.querySelectorAll("[data-item-step-dot]").forEach((dot) => {
    const dotStep = dot.dataset.itemStepDot;
    const order = ["capture", "scanning", "review", "confirm"];
    const currentIndex = order.indexOf(step);
    const dotIndex = order.indexOf(dotStep);
    dot.classList.toggle("is-active", dotStep === step);
    dot.classList.toggle("is-complete", dotIndex < currentIndex);
  });
  if (els.itemFlowKicker) {
    const labelMap = {
      capture: "Capture",
      scanning: "Scanning",
      review: "Review",
      confirm: "Details",
    };
    els.itemFlowKicker.textContent = labelMap[step] || "Step";
  }
  if (els.itemFlowAssist) {
    const starterGuideText = activeItemStarterPreset?.guideLabel
      ? `${activeItemStarterPreset.guideLabel} starter`
      : "starter piece";
    const assistMap = {
      capture: hasItemImportSession()
        ? "Batch scan is active."
        : activeItemStarterPreset?.benefit
          ? `Add a clear photo for this ${starterGuideText}. ${activeItemStarterPreset.benefit}`
          : "Start with a clear clothing photo.",
      scanning: "Analyzing your photos and preparing the review.",
      review: "",
      confirm: activeItemStarterPreset?.benefit
        ? `${activeItemStarterPreset.benefit} Check the basics first, then save it to move your starter wardrobe forward.`
        : "Check the basics first. Open more details only if needed.",
    };
    els.itemFlowAssist.textContent = assistMap[step] || "";
  }
  setItemMoreDetailsOpen(itemMoreDetailsOpen);
  if (focus) {
    window.setTimeout(() => {
      if (step === "confirm") {
        if (!els.itemType?.value) els.itemType?.focus?.();
        else els.itemName?.focus?.();
      }
      if (step === "confirm" && itemMoreDetailsOpen) els.itemColor?.focus?.();
    }, 60);
  }
  updateItemScanningUI();
  updateItemSaveState();
}

function revealItemManualDetails({ focus = false } = {}) {
  setItemMoreDetailsOpen(false);
  setItemFlowStep("confirm", { focus });
}

function resolveItemFlowAfterScanning() {
  if (editingItemId || itemFlowStep !== "scanning") return;
  if (itemBatchItems.length || itemRejectedPhotos.length) {
    setItemFlowStep("review");
    return;
  }
  setItemFlowStep("capture");
}

function validateItemForm() {
  syncActiveBatchItemFromForm();
  if (!editingItemId && itemBatchItems.length) {
    const firstInvalid = itemBatchItems.findIndex((item) => item.kept !== false && (!item.type || !item.name));
    if (firstInvalid !== -1) {
      activeItemBatchIndex = firstInvalid;
      renderItemBatchReview();
      const invalid = itemBatchItems[firstInvalid];
      setItemFormError("Review each kept item and add its type and name before saving.");
      openBatchEditDialog(firstInvalid);
      return false;
    }
    if (!itemBatchItems.some((item) => item.kept !== false)) {
      setItemFormError("Keep at least one detected item or add a different photo.");
      return false;
    }
    return true;
  }

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
  syncActiveBatchItemFromForm();
  const item = normalizeWardrobeItemMedia(currentBatchItem() || collectItemFormData());
  const type = item.type;
  const name = item.name;
  const meta = [item.color, item.material].filter(Boolean).join(" · ");
  const photo = getItemDisplayPhoto(item) || pendingPhotoDataUrl;

  if (els.itemPhotoImg) {
    if (photo) els.itemPhotoImg.src = photo;
    els.itemPhotoImg.style.display = photo ? "block" : "none";
  }
  if (els.itemVisualPlaceholder) {
    els.itemVisualPlaceholder.style.display = photo ? "none" : "flex";
  }
  if (els.removePhotoBtn) {
    els.removePhotoBtn.style.display = photo ? "flex" : "none";
  }
  if (els.recropPhotoBtn) {
    const source = getItemSourcePhoto(item) || pendingPhotoDataUrl || null;
    const canRecrop = !!editingItemId && !!source;
    els.recropPhotoBtn.style.display = canRecrop ? "inline-flex" : "none";
  }
  if (els.itemVisualEmoji) els.itemVisualEmoji.innerHTML = typeEmoji(type || "Other");
  if (els.itemVisualName) els.itemVisualName.textContent = name || (photo ? "Selected clothing item" : "Upload a photo");
  if (els.itemVisualMeta) {
    els.itemVisualMeta.textContent = meta
      || (photo
        ? (hasTrustedCrop(item) ? "Using a validated crop for this item." : "Using the full source photo until the crop looks trustworthy.")
        : "We’ll detect the basics and you can edit anything after.");
  }
  if (els.itemEditSummaryImg) {
    if (photo) {
      els.itemEditSummaryImg.src = photo;
      els.itemEditSummaryImg.style.display = "";
    } else {
      els.itemEditSummaryImg.style.display = "none";
      els.itemEditSummaryImg.removeAttribute("src");
    }
  }
  if (els.itemEditSummaryPlaceholder) {
    els.itemEditSummaryPlaceholder.style.display = photo ? "none" : "grid";
    els.itemEditSummaryPlaceholder.innerHTML = typeEmoji(type || "Other");
  }
  if (els.itemEditSummaryName) {
    els.itemEditSummaryName.textContent = name || (editingItemId ? "Wardrobe item" : "New item");
  }
  if (els.itemEditSummaryMeta) {
    els.itemEditSummaryMeta.textContent = meta
      || (editingItemId
        ? "Update the essentials, then save and keep moving."
        : "We’ll detect the basics and you can edit anything after.");
  }
  updateItemQueueSummary();
  renderItemBatchReview();
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

async function applyItemPhotoPrefill(data) {
  if (!data || data.error) return false;
  const detectedItems = await normalizeDetectedItems(data, pendingPhotoDataUrl);
  itemRejectedPhotos = [];
  itemImportSession = { totalPhotos: 1, acceptedPhotos: 1, rejectedPhotos: 0 };
  if (detectedItems.length > 1) {
    itemBatchItems = detectedItems;
    activeItemBatchIndex = 0;
    itemProcessingPlaceholders = 0;
    fillItemForm(itemBatchItems[0]);
    setItemFlowStep("review");
    renderItemBatchReview();
    return true;
  }
  let applied = false;
  if (data.type && !els.itemType.value) els.itemType.value = inferDetectedItemType(data.type, data.name);
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
  if (typeof data.favorite === "boolean" && els.itemFavorite && !els.itemFavorite.checked) {
    els.itemFavorite.checked = data.favorite;
    applied = true;
  }
  const careInstructions = normalizeCareInstructionsInput(data.careInstructions);
  if (careInstructions.length && !els.itemCare.value.trim()) {
    els.itemCare.value = careInstructions.join(", ");
    applied = true;
  }
  if (data.type || data.name || data.color || data.material || careInstructions.length) {
    setItemFlowStep("confirm");
  }

  if (detectedItems[0]?.cropPhotoDataUrl) pendingCropPhotoDataUrl = detectedItems[0].cropPhotoDataUrl;
  if (detectedItems[0]?.cropConfidence) pendingCropConfidence = detectedItems[0].cropConfidence;
  return applied;
}

function resetNewItemFlow(message = "") {
  clearItemBatch();
  itemRejectedPhotos = [];
  clearItemImportSession();
  clearItemQueuedPhotoPreviews();
  itemProcessingPlaceholders = 0;
  editingBatchItemIndex = -1;
  activeRejectedPhotoIndex = -1;
  editingItemId = null;
  activeItemStarterPreset = null;
  pendingPhotoDataUrl = null;
  pendingCropPhotoDataUrl = null;
  pendingCropConfidence = "none";
  itemMoreDetailsOpen = false;
  els.itemForm?.reset();
  if (els.itemPhoto) els.itemPhoto.value = "";
  if (els.itemPhotoImg) els.itemPhotoImg.src = "";
  if (els.itemFavorite) els.itemFavorite.checked = false;
  clearItemValidationErrors();
  setItemMoreDetailsOpen(false);
  setItemFlowStep("capture");
  setItemPhotoStatus("", false, "");
  if (message) showAppToast(message, "success");
  updateItemVisual();
  updateItemSaveState();
}

function resetItemPhotoQueue() {
  itemRejectedPhotos = [];
  clearItemImportSession();
  clearItemQueuedPhotoPreviews();
  itemProcessingPlaceholders = 0;
  if (els.itemGalleryPhotos) els.itemGalleryPhotos.value = "";
  updateItemScanningUI();
  updateItemQueueSummary();
  renderItemBatchReview();
}

function resetPendingItemForm() {
  pendingCropPhotoDataUrl = null;
  pendingCropConfidence = "none";
  els.itemType.value = "";
  els.itemName.value = "";
  els.itemColor.value = "";
  els.itemMaterial.value = "";
  els.itemCare.value = "";
  if (els.itemFavorite) els.itemFavorite.checked = false;
  syncCompactEditFieldsFromPrimary();
  clearItemValidationErrors();
  setItemMoreDetailsOpen(false);
}

async function analyzeSelectedItemPhotoFile(file, { photoIndex = 1 } = {}) {
  const optimizedPhotoDataUrl = await optimizeImageDataUrl(file);
  const quality = await assessItemPhotoQuality(optimizedPhotoDataUrl);
  if (!quality.ok) {
    return {
      status: "rejected",
      fileName: file?.name || `Photo ${photoIndex}`,
      photoIndex,
      photoDataUrl: optimizedPhotoDataUrl,
      message: buildPhotoQualityMessage(quality),
      quality,
    };
  }

  try {
    const analysis = await analyzeItemPhoto(optimizedPhotoDataUrl);
    const detectedItems = await normalizeDetectedItems(analysis, optimizedPhotoDataUrl);
    if (!detectedItems.length) {
      return {
        status: "rejected",
        fileName: file?.name || `Photo ${photoIndex}`,
        photoIndex,
        photoDataUrl: optimizedPhotoDataUrl,
        message: "WearCast could not confidently detect an item in this photo. Try a clearer, tighter shot with the clothing piece filling more of the frame.",
      };
    }

    return {
      status: "accepted",
      fileName: file?.name || `Photo ${photoIndex}`,
      photoIndex,
      photoDataUrl: optimizedPhotoDataUrl,
      items: detectedItems.map((item, itemIndex) => ({
        ...item,
        id: item.id || `detected-${Date.now()}-${photoIndex}-${itemIndex}`,
        batchSourceLabel: `Photo ${photoIndex}`,
        batchSourceIndex: photoIndex,
      })),
    };
  } catch (err) {
    console.error("item photo error:", err);
    return {
      status: "rejected",
      fileName: file?.name || `Photo ${photoIndex}`,
      photoIndex,
      photoDataUrl: optimizedPhotoDataUrl,
      message: "WearCast could not analyze this photo. Try another image with the clothing item more clearly visible.",
    };
  }
}

async function processSelectedItemPhotos(files, { reset = true } = {}) {
  let usableFiles = (Array.isArray(files) ? files : []).filter((file) => file?.type?.startsWith("image/"));
  if (!usableFiles.length) return false;
  const state = loadState();
  const remainingScans = getRemainingPhotoScans(state);
  if (!hasPremiumAccess(state) && remainingScans <= 0) {
    if (!isLoggedIn()) {
      showAuthDialog("scan_cap");
      showAppToast("Create an account to sync your starter wardrobe and continue scanning.", "warning");
      trackAnalyticsEvent("local_wardrobe_limit_hit", { title: "local_wardrobe_limit_hit:scan_cap" });
    } else {
      openPaywall("scan_cap", { source: "wardrobe-scan" });
      showAppToast("You have used this week’s free scans. Go premium for unlimited wardrobe scans.", "warning");
      trackAnalyticsEvent("free_limit_hit", { title: "free_limit_hit:scan_cap" });
    }
    return false;
  }
  if (!hasPremiumAccess(state) && usableFiles.length > remainingScans) {
    usableFiles = usableFiles.slice(0, remainingScans);
    if (!isLoggedIn()) {
      showAuthDialog("scan_cap_partial");
      showAppToast(`Processing your next ${remainingScans} starter scan${remainingScans === 1 ? "" : "s"}. Create an account to continue after that.`, "warning");
      trackAnalyticsEvent("local_wardrobe_limit_hit", { title: "local_wardrobe_limit_hit:scan_cap_partial" });
    } else {
      openPaywall("scan_cap", { source: "wardrobe-scan-partial" });
      showAppToast(`Free includes ${FREE_PHOTO_SCANS_PER_WINDOW} scans per week. Processing your next ${remainingScans} photo${remainingScans === 1 ? "" : "s"} now.`, "warning");
      trackAnalyticsEvent("free_limit_hit", { title: "free_limit_hit:scan_cap_partial" });
    }
  }
  const existingAcceptedPhotos = itemImportSession.acceptedPhotos || 0;
  const existingRejectedPhotos = itemImportSession.rejectedPhotos || 0;
  const existingTotalPhotos = itemImportSession.totalPhotos || 0;
  const existingBatchCount = itemBatchItems.length;

  if (reset) {
    clearItemBatch();
    itemRejectedPhotos = [];
    clearItemImportSession();
    setItemQueuedPhotoPreviews(usableFiles);
    itemProcessingPlaceholders = usableFiles.length;
    itemImportSession = { totalPhotos: usableFiles.length, acceptedPhotos: 0, rejectedPhotos: 0 };
    pendingPhotoDataUrl = null;
    resetPendingItemForm();
  } else {
    appendItemQueuedPhotoPreviews(usableFiles);
    itemProcessingPlaceholders += usableFiles.length;
    itemImportSession.totalPhotos = existingTotalPhotos + usableFiles.length;
  }

  setItemFlowStep("scanning");
  renderItemBatchReview();
  isReadingItemPhoto = true;
  isAnalyzingItemPhoto = true;
  consumePhotoScanCredits(usableFiles.length);
  updateItemSaveState();
  setItemPhotoStatus(
    usableFiles.length > 1
      ? `Scanning ${usableFiles.length} photos in parallel…`
      : "Preparing your image…",
    true
  );

  try {
    const results = await Promise.all(usableFiles.map((file, index) => analyzeSelectedItemPhotoFile(file, {
      photoIndex: index + 1,
    })));
    const acceptedResults = results.filter((entry) => entry.status === "accepted");
    const rejectedResults = results.filter((entry) => entry.status === "rejected");

    const appendedItems = acceptedResults.flatMap((entry) => entry.items || []);
    itemBatchItems = reset ? appendedItems : [...itemBatchItems, ...appendedItems];
    itemRejectedPhotos = reset ? rejectedResults : [...itemRejectedPhotos, ...rejectedResults];
    itemProcessingPlaceholders = Math.max(itemProcessingPlaceholders - usableFiles.length, 0);
    itemImportSession = {
      totalPhotos: reset ? usableFiles.length : existingTotalPhotos + usableFiles.length,
      acceptedPhotos: (reset ? 0 : existingAcceptedPhotos) + acceptedResults.length,
      rejectedPhotos: (reset ? 0 : existingRejectedPhotos) + rejectedResults.length,
    };

    if (itemBatchItems.length) {
      activeItemBatchIndex = reset ? 0 : Math.max(activeItemBatchIndex, 0);
      const preferredItem = itemBatchItems[activeItemBatchIndex] || itemBatchItems[existingBatchCount] || itemBatchItems[0];
      pendingPhotoDataUrl = preferredItem?.sourcePhotoDataUrl || acceptedResults[0]?.photoDataUrl || pendingPhotoDataUrl || null;
      pendingCropPhotoDataUrl = preferredItem?.cropPhotoDataUrl || null;
      pendingCropConfidence = preferredItem?.cropConfidence || "none";
      if (preferredItem) fillItemForm(preferredItem);
      setItemMoreDetailsOpen(false);
      setItemFlowStep("review");
      setItemPhotoStatus(
        rejectedResults.length
          ? `Detected ${itemBatchItems.length} item${itemBatchItems.length === 1 ? "" : "s"}. ${rejectedResults.length} photo${rejectedResults.length === 1 ? "" : "s"} need another shot.`
          : `Detected ${itemBatchItems.length} item${itemBatchItems.length === 1 ? "" : "s"} from your photo${usableFiles.length === 1 ? "" : "s"}.`,
        false,
        rejectedResults.length ? "warning" : "success"
      );
      if (rejectedResults.length) {
        showAppToast(
          `${rejectedResults.length} photo${rejectedResults.length === 1 ? "" : "s"} need another shot.`,
          "warning",
          {
            clickable: true,
            clickLabel: "Open photo recovery options",
            onClick: () => openRejectedPhotoDialog(0),
          }
        );
      }
      updateItemVisual();
      renderItemBatchReview();
      return true;
    }

    if (reset) {
      rejectPendingItemPhoto(
        rejectedResults[0]?.message || "These photos need another shot before WearCast can detect the item reliably."
      );
    } else {
      setItemFlowStep("review");
      setItemPhotoStatus(
        rejectedResults.length === 1
          ? "That photo needs another shot before WearCast can detect the item reliably."
          : "Those photos need another shot before WearCast can detect the items reliably.",
        false,
        "warning"
      );
    }
    if (rejectedResults.length) {
      showAppToast(
        rejectedResults.length === 1
          ? "1 photo needs another shot. Tap to recover it manually."
          : `${rejectedResults.length} photos need another shot. Tap to review them.`,
        "warning",
        {
          clickable: true,
          clickLabel: "Open photo recovery options",
          onClick: () => openRejectedPhotoDialog(0),
        }
      );
    }
    renderItemBatchReview();
    return false;
  } finally {
    itemProcessingPlaceholders = 0;
    isReadingItemPhoto = false;
    isAnalyzingItemPhoto = false;
    resolveItemFlowAfterScanning();
    updateItemQueueSummary();
    updateItemSaveState();
  }
}

async function persistNewWardrobeItems(itemsToSave) {
  const savedItems = [];
  const skippedItems = [];
  const limitSkippedItems = [];
  const currentItems = Array.isArray(_wardrobeCache) ? [..._wardrobeCache] : await loadWardrobeAsync();
  const existingSignatures = new Set(currentItems.map((item) => normalizeItemSignature(item)));
  let remainingSlots = getRemainingWardrobeSlots(currentItems);

  for (const item of itemsToSave) {
    if (Number.isFinite(remainingSlots) && remainingSlots <= 0) {
      limitSkippedItems.push(item);
      continue;
    }
    const normalizedMedia = normalizeWardrobeItemMedia(item);
    const normalized = {
      type: normalizedMedia.type,
      name: normalizedMedia.name,
      color: normalizedMedia.color || null,
      material: normalizedMedia.material || null,
      careInstructions: normalizeCareInstructionsInput(item.careInstructions),
      sourcePhotoDataUrl: normalizedMedia.sourcePhotoDataUrl || pendingPhotoDataUrl || null,
      cropPhotoDataUrl: normalizedMedia.cropPhotoDataUrl || null,
      cropConfidence: normalizedMedia.cropConfidence || "none",
      photoDataUrl: getItemDisplayPhoto(normalizedMedia) || pendingPhotoDataUrl || null,
      favorite: !!item.favorite,
    };
    const signature = normalizeItemSignature(normalized);
    if (!normalized.type || !normalized.name || existingSignatures.has(signature)) {
      skippedItems.push(normalized);
      continue;
    }

    if (isLoggedIn()) {
      const res = await authFetch(`${API_BASE}/api/wardrobe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        if (isLoggedIn()) return null;
        savedItems.unshift({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          ...normalized,
          createdAt: new Date().toISOString(),
        });
      } else if (!res.ok) {
        throw new Error(data.error || "Could not save wardrobe item");
      } else {
        savedItems.unshift(data);
      }
    } else {
      savedItems.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        ...normalized,
        createdAt: new Date().toISOString(),
      });
    }

    existingSignatures.add(signature);
    if (Number.isFinite(remainingSlots)) remainingSlots -= 1;
  }

  saveWardrobe([...savedItems, ...currentItems]);
  return {
    savedItems,
    skippedItems,
    limitHit: limitSkippedItems.length
      ? {
          trigger: isLoggedIn() ? "wardrobe_cap" : "local_wardrobe_cap",
          skippedCount: limitSkippedItems.length,
        }
      : null,
  };
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

function getNextItemFlowStep() {
  if (itemFlowStep === "capture") return "confirm";
  if (itemFlowStep === "review") return "review";
  return "confirm";
}

function getPreviousItemFlowStep() {
  if (editingItemId) {
    return "confirm";
  }
  if (itemFlowStep === "confirm") return itemBatchItems.length || itemRejectedPhotos.length ? "review" : "capture";
  if (itemFlowStep === "review") return "capture";
  return "capture";
}

async function handleItemPrimaryAction() {
  if (isSavingItem || isReadingItemPhoto || isAnalyzingItemPhoto) return;
  if (itemFlowStep === "review") {
    const keptItems = itemBatchItems.filter((item) => item.kept !== false);
    if (!keptItems.length) {
      if (itemRejectedPhotos.length) {
        showAppToast("All detected items were discarded. Fix a flagged photo or add another.", "warning");
      } else if (itemBatchItems.length) {
        showAppToast("Keep at least one detected item or add another photo.", "warning");
      } else {
        showAppToast("Add a photo to get started.", "warning");
      }
      setItemFormError("Keep at least one detected item or add a different photo.");
      return;
    }
    const incomplete = keptItems.find((item) => !item.type || !item.name);
    if (incomplete) {
      const idx = itemBatchItems.findIndex((item) => item === incomplete);
      showAppToast(
        `"${incomplete.name || incomplete.type || "One item"}" is missing a type or name. Tap it to finish.`,
        "warning"
      );
      if (idx >= 0) openBatchEditDialog(idx);
      return;
    }
    await saveItem();
    return;
  }
  if (itemFlowStep === "confirm") {
    const type = els.itemType?.value?.trim();
    const name = els.itemName?.value?.trim();
    if (!type || !name) {
      showAppToast(
        !type && !name ? "Add a type and name before saving." : !type ? "Pick a type before saving." : "Add a name before saving.",
        "warning"
      );
      // let validateItemForm inside saveItem highlight the fields
    }
  }
  const saved = await saveItem();
  if (saved && !editingItemId && hasItemImportSession()) updateItemSaveState();
}

function handleItemBackAction() {
  if (isSavingItem || isReadingItemPhoto || isAnalyzingItemPhoto) return;
  if (itemFlowStep === "capture" && !editingItemId) {
    closeItemDialog();
    return;
  }
  setItemFlowStep(getPreviousItemFlowStep(), { focus: false });
}

function openItemDialog(item = null, preset = null) {
  if (!item && !isLoggedIn() && !canUseFunctionalStorage()) {
    pendingLocalWardrobeConsentPreset = preset?.type ? preset : null;
    showConsentDialog({ forceModal: true, source: "local_wardrobe" });
    showAppToast("Enable functional storage to save a local starter wardrobe on this device.", "warning");
    return;
  }
  if (!item && !isLoggedIn() && loadWardrobeLocal().length >= SIGNED_OUT_WARDROBE_ITEM_LIMIT) {
    trackAnalyticsEvent("local_wardrobe_limit_hit", { title: "local_wardrobe_limit_hit:open_item" });
    showAuthDialog("local_wardrobe_cap");
    showAppToast(`Your local starter wardrobe is full at ${SIGNED_OUT_WARDROBE_ITEM_LIMIT} items. Create an account to sync and keep building.`, "warning");
    return;
  }
  activeItemStarterPreset = preset?.type ? preset : null;
  editingItemId = item?.id || null;
  isSavingItem = false;
  isReadingItemPhoto = false;
  isAnalyzingItemPhoto = false;
  clearItemBatch();
  els.itemForm.reset();
  pendingPhotoDataUrl = null;
  pendingCropPhotoDataUrl = null;
  pendingCropConfidence = "none";
  if (els.itemPhoto) els.itemPhoto.value = "";
  if (els.itemGalleryPhotos) els.itemGalleryPhotos.value = "";
  if (els.itemPhotoImg) els.itemPhotoImg.src = "";
  if (els.itemFavorite) els.itemFavorite.checked = false;
  resetItemPhotoQueue();
  setItemPhotoStatus("");
  clearItemValidationErrors();
  setItemMoreDetailsOpen(false);
  itemFlowStep = "capture";

  els.itemDialog.classList.toggle("is-edit-mode", !!item);
  const editingNeedsReview = !!item && itemNeedsMetadataReview(item);
  els.itemDialog.classList.toggle("is-needs-review", editingNeedsReview);
  const colorMissing = editingNeedsReview && !item?.color;
  const materialMissing = editingNeedsReview && !item?.material;
  els.itemColor?.closest(".form-group")?.classList.toggle("is-needs-review", colorMissing);
  els.itemMaterial?.closest(".form-group")?.classList.toggle("is-needs-review", materialMissing);
  els.itemEditColor?.closest(".form-group")?.classList.toggle("is-needs-review", colorMissing);
  els.itemEditMaterial?.closest(".form-group")?.classList.toggle("is-needs-review", materialMissing);
  if (els.itemFlowKicker) {
    els.itemFlowKicker.style.display = item ? "none" : "";
  }
  if (item) {
    activeItemStarterPreset = null;
    const normalizedItem = normalizeWardrobeItemMedia(item);
    if (els.itemDialogTitle) els.itemDialogTitle.textContent = "Edit item";
    els.itemType.value = normalizedItem.type || "";
    els.itemName.value = normalizedItem.name || "";
    els.itemColor.value = normalizedItem.color || "";
    els.itemMaterial.value = normalizedItem.material || "";
    els.itemCare.value = (normalizedItem.careInstructions || []).join(", ");
    if (els.itemFavorite) els.itemFavorite.checked = !!normalizedItem.favorite;
    syncCompactEditFieldsFromPrimary();
    setItemMoreDetailsOpen(!!(normalizedItem.color || normalizedItem.material || normalizedItem.careInstructions?.length));
    if (getItemSourcePhoto(normalizedItem)) {
      pendingPhotoDataUrl = getItemSourcePhoto(normalizedItem);
      pendingCropPhotoDataUrl = normalizedItem.cropPhotoDataUrl || null;
      pendingCropConfidence = normalizedItem.cropConfidence || (normalizedItem.cropPhotoDataUrl ? "trusted" : "none");
      els.itemPhotoImg.src = getItemDisplayPhoto(normalizedItem) || getItemSourcePhoto(normalizedItem);
    }
    els.itemDeleteBtn.style.display = "inline-flex";
    setItemFlowStep("confirm");
  } else {
    if (els.itemDialogTitle) {
      els.itemDialogTitle.textContent = activeItemStarterPreset?.guideLabel
        ? `Add a ${activeItemStarterPreset.guideLabel.toLowerCase()} piece`
        : "Add items";
    }
    els.itemDeleteBtn.style.display = "none";
    if (preset?.type) els.itemType.value = preset.type;
    if (preset?.name) els.itemName.value = preset.name;
    if (preset?.type || preset?.name) setItemFlowStep("confirm");
  }

  renderItemBatchReview();
  updateItemVisual();
  syncCompactEditFieldsFromPrimary();
  if (!item && !(preset?.type || preset?.name)) {
    setItemFlowStep("capture");
  }
  updateItemSaveState();

  if (typeof els.itemDialog.showModal === "function") els.itemDialog.showModal();
}

function closeItemDialog() {
  resetItemPhotoQueue();
  if (typeof els.itemDialog.close === "function") els.itemDialog.close();
}

async function removeCurrentItemPhoto() {
  pendingPhotoDataUrl = null;
  pendingCropPhotoDataUrl = null;
  pendingCropConfidence = "none";
  clearItemBatch();
  if (els.itemPhoto) els.itemPhoto.value = "";
  if (els.itemPhotoImg) els.itemPhotoImg.src = "";
  setItemPhotoStatus("");

  if (editingItemId) {
    updateItemVisual();
    updateItemSaveState();
    return;
  }
  resetNewItemFlow("");
}

function toggleCurrentBatchItemKept() {
  const item = currentBatchItem();
  if (!item) return;
  item.kept = item.kept === false;
  renderItemBatchReview();
  updateItemSaveState();
}

async function saveItem() {
  if (isSavingItem || isReadingItemPhoto) return false;
  if (!validateItemForm()) return false;
  syncActiveBatchItemFromForm();
  const stateBeforeSave = loadState();
  const currentItemsBeforeSave = Array.isArray(_wardrobeCache) ? [..._wardrobeCache] : await loadWardrobeAsync();
  const hadPremiumBeforeSave = hasPremiumAccess(stateBeforeSave);

  isSavingItem = true;
  updateItemSaveState();

  try {
    if (editingItemId) {
      const existingItems = await loadWardrobeAsync();
      const existingItem = existingItems.find((item) => String(item.id) === String(editingItemId));
      const itemData = {
        ...collectItemFormData(),
        color: normalizeWardrobeColorValue(els.itemColor.value.trim()) || null,
        material: normalizeWardrobeMaterialValue(els.itemMaterial.value.trim()) || null,
        favorite: !!els.itemFavorite?.checked,
      };

      if (await hasDuplicateWardrobeItem(itemData, editingItemId)) {
        setItemFlowStep("confirm", { focus: true });
        setItemFormError("This item already exists in your wardrobe. Edit the existing item or change the name/details.");
        return false;
      }

      if (isLoggedIn()) {
        const res = await authFetch(`${API_BASE}/api/wardrobe/${editingItemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemData),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) return false;
        if (!res.ok) throw new Error(data.error || "Could not update wardrobe item");
        markWardrobeItemsHighlighted([data?.id || editingItemId]);
        saveWardrobe(existingItems.map((item) => String(item.id) === String(editingItemId) ? data : item));
      } else {
        const items = loadWardrobeLocal();
        const idx = items.findIndex((item) => item.id === editingItemId);
        if (idx !== -1) {
          items[idx] = normalizeWardrobeItemMedia({
            ...items[idx],
            ...itemData,
            sourcePhotoDataUrl: itemData.sourcePhotoDataUrl || items[idx].sourcePhotoDataUrl || pendingPhotoDataUrl || null,
            cropPhotoDataUrl: itemData.cropPhotoDataUrl || items[idx].cropPhotoDataUrl || null,
            cropConfidence: itemData.cropConfidence || items[idx].cropConfidence || "none",
          });
          markWardrobeItemsHighlighted([items[idx].id]);
        }
        saveWardrobeLocal(items);
      }

      await renderWardrobe();
      closeItemDialog();
      showAppToast("Item updated", "success");
      return true;
    } else {
      const itemsToSave = itemBatchItems.length
        ? itemBatchItems.filter((item) => item.kept !== false)
        : [collectItemFormData()];
      const result = await persistNewWardrobeItems(itemsToSave);
      if (!result) return false;
      markWardrobeItemsHighlighted(result.savedItems.map((item) => item?.id));
      await renderWardrobe();
      const latestItems = Array.isArray(_wardrobeCache) ? _wardrobeCache : await loadWardrobeAsync();

      const savedCount = result.savedItems.length;
      const skippedCount = result.skippedItems.length;
      if (!savedCount) {
        if (result.limitHit) {
          if (result.limitHit.trigger === "local_wardrobe_cap") {
            showAuthDialog("local_wardrobe_cap");
            showAppToast(`Your local starter wardrobe is full at ${SIGNED_OUT_WARDROBE_ITEM_LIMIT} items. Create an account to sync and keep building.`, "warning");
            trackAnalyticsEvent("local_wardrobe_limit_hit", { title: "local_wardrobe_limit_hit" });
          } else {
            openPaywall(result.limitHit.trigger, { source: "wardrobe-save", skippedCount: result.limitHit.skippedCount });
            showAppToast(`Your free closet is full at ${FREE_WARDROBE_ITEM_LIMIT} items. Go premium to keep building your wardrobe.`, "warning");
            trackAnalyticsEvent("free_limit_hit", { title: "free_limit_hit:wardrobe_cap" });
          }
        }
        setItemFlowStep(itemBatchItems.length ? "review" : "confirm", { focus: !itemBatchItems.length });
        setItemFormError(skippedCount ? "Those items already exist in your wardrobe. Adjust the details or use a different photo." : "No items were saved.");
        return false;
      }

      const momentum = buildWardrobeSaveMomentum(latestItems, { savedCount, skippedCount });
      resetNewItemFlow("");
      const latestState = loadState();
      const analytics = getAnalyticsState(latestState);
      if (!analytics.firstWardrobeItemTracked && currentItemsBeforeSave.length === 0 && latestItems.length > 0) {
        trackAnalyticsEvent("first_wardrobe_item_added", {
          title: "first_wardrobe_item_added",
          totalWardrobeItems: latestItems.length,
        });
        saveState({
          analytics: {
            ...analytics,
            firstWardrobeItemTracked: true,
          },
        });
      } else if (!analytics.fiveWardrobeItemsTracked && currentItemsBeforeSave.length < 5 && latestItems.length >= 5) {
        trackAnalyticsEvent("five_wardrobe_items_added", {
          title: "five_wardrobe_items_added",
          totalWardrobeItems: latestItems.length,
          starterReady: isWardrobeStarterReady(latestItems),
        });
        saveState({
          analytics: {
            ...analytics,
            fiveWardrobeItemsTracked: true,
          },
        });
      }
      showAppToast(momentum.message, "success", momentum.nextLabel
        ? {
            clickable: true,
            clickLabel: `Add ${momentum.nextLabel}`,
            onClick: () => openItemDialog(null, getStarterTypePreset(getStarterTypeForLabel(momentum.nextLabel))),
          }
        : {});
      if (!isLoggedIn() && savedCount) {
        trackAnalyticsEvent("local_wardrobe_item_added", {
          title: "local_wardrobe_item_added",
          totalWardrobeItems: latestItems.length,
        });
      }
      if (result.limitHit) {
        if (result.limitHit.trigger === "local_wardrobe_cap") {
          window.setTimeout(() => showAuthDialog("local_wardrobe_cap"), 180);
          trackAnalyticsEvent("local_wardrobe_limit_hit", { title: "local_wardrobe_limit_hit" });
        } else {
          window.setTimeout(() => openPaywall(result.limitHit.trigger, { source: "wardrobe-save", skippedCount: result.limitHit.skippedCount }), 180);
          trackAnalyticsEvent("free_limit_hit", { title: "free_limit_hit:wardrobe_cap" });
        }
      } else if (isLoggedIn() && !hadPremiumBeforeSave && currentItemsBeforeSave.length < 5 && latestItems.length >= 5) {
        window.setTimeout(() => openPaywall("starter_ready", { source: "starter-milestone" }), 180);
      }
      return true;
    }
  } catch (err) {
    console.error("save item error:", err);
    setItemFlowStep(itemBatchItems.length ? "review" : "confirm", { focus: !itemBatchItems.length });
    setItemFormError(err.message || "Could not save that item. Check the details and try again.");
  } finally {
    isSavingItem = false;
    updateItemSaveState();
  }
  return false;
}

function requestDeleteItem() {
  if (!editingItemId) return;
  if (els.deleteItemConfirmDialog?.showModal) {
    els.deleteItemConfirmDialog.showModal();
  } else {
    // Fallback: confirm() can't be guaranteed in Capacitor web views
    deleteItem();
  }
}

async function deleteItem() {
  if (!editingItemId) return;

  if (isLoggedIn()) {
    try {
      const res = await authFetch(`${API_BASE}/api/wardrobe/${editingItemId}`, {
        method: "DELETE",
        headers: {},
      });
      if (!res.ok && res.status !== 404) throw new Error("Server responded " + res.status);
    } catch (err) {
      console.error("delete item error:", err);
      showAppToast("Could not delete item", "error");
      return;
    }
  } else {
    const items = loadWardrobeLocal().filter(i => i.id !== editingItemId);
    saveWardrobeLocal(items);
  }

  await renderWardrobe();
  closeItemDialog();
  showAppToast("Item deleted", "success");
}

function buildItemDetailTags(item = {}) {
  const normalizedItem = normalizeWardrobeItemMedia(item);
  const recommendationUsage = getItemRecommendationUsage(normalizedItem);
  const tags = [];
  if (normalizedItem.favorite) tags.push("Favorite");
  tags.push(getWardrobeSubtype(normalizedItem) || getWardrobeCategoryLabel(getWardrobeCategory(normalizedItem)));
  if (normalizedItem.color) tags.push(normalizeWardrobeColorValue(normalizedItem.color));
  if (normalizedItem.material) tags.push(normalizeWardrobeMaterialValue(normalizedItem.material));
  if (itemNeedsMetadataReview(normalizedItem)) tags.push("Needs review");
  if (recommendationUsage.latestMatched) tags.push("In today’s look");
  if (/\b(rain|waterproof|shell|trench|boot)\b/i.test(`${normalizedItem.type || ""} ${normalizedItem.name || ""}`)) tags.push("Works in rain");
  if (/\b(cardigan|shirt|tee|t-shirt|sweater|hoodie|jacket|coat|vest)\b/i.test(`${normalizedItem.type || ""} ${normalizedItem.name || ""}`)) tags.push("Layer-ready");
  return [...new Set(tags)].slice(0, 4);
}

function openItemDetailDialog(item) {
  if (!item) return;
  openWardrobeItemViewer(item.id);
}

async function openWardrobeItemActionsDialog(itemId) {
  if (!els.wardrobeItemActionsBody || !els.wardrobeItemActionsDialog) return;
  const items = await loadWardrobeAsync();
  const item = items.find((entry) => String(entry.id) === String(itemId));
  if (!item) return;
  const normalizedItem = normalizeWardrobeItemMedia(item);
  const favoriteLabel = normalizedItem.favorite ? "Remove from favorites" : "Add to favorites";
  els.wardrobeItemActionsBody.innerHTML = `
    <div class="wardrobe-item-actions-card">
      <strong>${escapeHtml(normalizedItem.name || "Wardrobe item")}</strong>
      <span>${escapeHtml([getWardrobeSubtype(normalizedItem), normalizeWardrobeColorValue(normalizedItem.color)].filter(Boolean).join(" · ") || "Quick ways to manage this piece.")}</span>
    </div>
    <div class="wardrobe-item-actions-list">
      <button type="button" class="settings-row" data-wardrobe-action="favorite" data-wardrobe-item-id="${escapeHtml(String(normalizedItem.id))}">
        <div class="settings-copy">
          <strong>${escapeHtml(favoriteLabel)}</strong>
          <span>Keep this piece easier to find in your collection.</span>
        </div>
        <span class="settings-chevron">›</span>
      </button>
      <button type="button" class="settings-row" data-wardrobe-action="edit" data-wardrobe-item-id="${escapeHtml(String(normalizedItem.id))}">
        <div class="settings-copy">
          <strong>Edit</strong>
          <span>Adjust the details, crop, or metadata.</span>
        </div>
        <span class="settings-chevron">›</span>
      </button>
      <button type="button" class="settings-row settings-row-danger" data-wardrobe-action="delete" data-wardrobe-item-id="${escapeHtml(String(normalizedItem.id))}">
        <div class="settings-copy">
          <strong>Delete</strong>
          <span>Remove this item from your wardrobe.</span>
        </div>
        <span class="settings-chevron">›</span>
      </button>
    </div>
  `;
  els.wardrobeItemActionsDialog.showModal?.();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(sourceDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = sourceDataUrl;
  });
}

function estimateDataUrlBytes(dataUrl = "") {
  const commaIndex = String(dataUrl || "").indexOf(",");
  if (commaIndex < 0) return String(dataUrl || "").length;
  const base64Length = dataUrl.length - commaIndex - 1;
  return Math.floor((base64Length * 3) / 4);
}

function drawImageToCanvas(image, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

async function compressLoadedImageToDataUrl(image, {
  maxEdge = 1280,
  quality = 0.76,
  minQuality = 0.5,
  maxBytes = 700 * 1024,
  format = "image/jpeg",
} = {}) {
  let width = Math.max(1, Math.round(image.width || 1));
  let height = Math.max(1, Math.round(image.height || 1));
  const longestEdge = Math.max(width, height) || 1;
  const initialScale = Math.min(1, maxEdge / longestEdge);
  width = Math.max(1, Math.round(width * initialScale));
  height = Math.max(1, Math.round(height * initialScale));

  let currentQuality = quality;
  let output = "";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = drawImageToCanvas(image, width, height);
    if (!canvas) throw new Error("Failed to process image");
    output = canvas.toDataURL(format, currentQuality);
    if (estimateDataUrlBytes(output) <= maxBytes || (currentQuality <= minQuality && attempt >= 2)) {
      return output;
    }
    currentQuality = Math.max(minQuality, Number((currentQuality - 0.08).toFixed(2)));
    width = Math.max(1, Math.round(width * 0.88));
    height = Math.max(1, Math.round(height * 0.88));
  }

  return output;
}

async function optimizeImageDataUrl(file, { maxEdge = 1280, quality = 0.76, maxBytes = 700 * 1024 } = {}) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(sourceDataUrl).catch(() => {
    throw new Error("Failed to process image");
  });
  return compressLoadedImageToDataUrl(image, { maxEdge, quality, maxBytes });
}

function buildPhotoQualityMessage(quality = null) {
  const issueLabels = {
    "low-resolution": "low-resolution",
    dark: "dark",
    "washed out": "washed out",
    flat: "flat",
    blurry: "blurry",
    busy: "busy",
    "background-focused": "focused on the background",
  };
  const issues = (Array.isArray(quality?.issues) ? quality.issues : []).map((issue) => issueLabels[issue] || issue);
  if (!issues.length) return "This photo is too low quality for reliable item detection.";
  const issueList = issues.length === 1
    ? issues[0]
    : `${issues.slice(0, -1).join(", ")}, and ${issues[issues.length - 1]}`;
  return `This photo is too ${issueList} for reliable item detection. Use a brighter, sharper photo with the clothing item clearly visible.`;
}

async function assessItemPhotoQuality(sourceDataUrl) {
  const image = await loadImageFromDataUrl(sourceDataUrl);
  const minEdge = Math.min(image.width, image.height);
  const totalPixels = image.width * image.height;

  const sampleMaxEdge = 220;
  const scale = Math.min(1, sampleMaxEdge / Math.max(image.width, image.height, 1));
  const width = Math.max(48, Math.round(image.width * scale));
  const height = Math.max(48, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { ok: true, issues: [], metrics: null };

  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const grayscale = new Float32Array(width * height);
  let brightnessSum = 0;

  for (let index = 0; index < grayscale.length; index += 1) {
    const offset = index * 4;
    const luma = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
    grayscale[index] = luma;
    brightnessSum += luma;
  }

  const brightness = brightnessSum / Math.max(1, grayscale.length);
  let contrastAccumulator = 0;
  for (let index = 0; index < grayscale.length; index += 1) {
    const delta = grayscale[index] - brightness;
    contrastAccumulator += delta * delta;
  }
  const contrast = Math.sqrt(contrastAccumulator / Math.max(1, grayscale.length));

  let laplacianSum = 0;
  let laplacianSquaredSum = 0;
  let laplacianCount = 0;
  let totalEdgeEnergy = 0;
  let centerEdgeEnergy = 0;
  let busyPixels = 0;
  const centerLeft = Math.floor(width * 0.2);
  const centerRight = Math.ceil(width * 0.8);
  const centerTop = Math.floor(height * 0.2);
  const centerBottom = Math.ceil(height * 0.8);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const center = grayscale[index];
      const laplacian = (4 * center)
        - grayscale[index - 1]
        - grayscale[index + 1]
        - grayscale[index - width]
        - grayscale[index + width];
      laplacianSum += laplacian;
      laplacianSquaredSum += laplacian * laplacian;
      laplacianCount += 1;

      const gradientX = grayscale[index + 1] - grayscale[index - 1];
      const gradientY = grayscale[index + width] - grayscale[index - width];
      const edgeEnergy = Math.abs(gradientX) + Math.abs(gradientY);
      totalEdgeEnergy += edgeEnergy;
      if (edgeEnergy > 48) busyPixels += 1;
      if (x >= centerLeft && x <= centerRight && y >= centerTop && y <= centerBottom) {
        centerEdgeEnergy += edgeEnergy;
      }
    }
  }

  const laplacianMean = laplacianSum / Math.max(1, laplacianCount);
  const sharpness = (laplacianSquaredSum / Math.max(1, laplacianCount)) - (laplacianMean * laplacianMean);
  const textureDensity = busyPixels / Math.max(1, laplacianCount);
  const centerFocusRatio = centerEdgeEnergy / Math.max(1, totalEdgeEnergy);
  const outerFocusRatio = Math.max(0, 1 - centerFocusRatio);

  const issues = [];
  let penalty = 0;

  if (minEdge < 320 || totalPixels < 180000) {
    issues.push("low-resolution");
    penalty += minEdge < 260 ? 2 : 1;
  }
  if (brightness < 42) {
    issues.push("dark");
    penalty += brightness < 28 ? 2 : 1;
  } else if (brightness > 238) {
    issues.push("washed out");
    penalty += brightness > 246 ? 2 : 1;
  }
  if (contrast < 24) {
    issues.push("flat");
    penalty += contrast < 16 ? 2 : 1;
  }
  if (sharpness < 110) {
    issues.push("blurry");
    penalty += sharpness < 65 ? 2 : 1;
  }
  if (textureDensity > 0.34 && centerFocusRatio < 0.5) {
    issues.push("busy");
    penalty += textureDensity > 0.42 ? 2 : 1;
  }
  if (centerFocusRatio < 0.34 && outerFocusRatio > 0.66) {
    issues.push("background-focused");
    penalty += centerFocusRatio < 0.28 ? 2 : 1;
  }

  return {
    ok: penalty < 2,
    issues,
    metrics: {
      minEdge,
      totalPixels,
      brightness: Number(brightness.toFixed(1)),
      contrast: Number(contrast.toFixed(1)),
      sharpness: Number(sharpness.toFixed(1)),
      textureDensity: Number(textureDensity.toFixed(3)),
      centerFocusRatio: Number(centerFocusRatio.toFixed(3)),
    },
  };
}

function rejectPendingItemPhoto(message) {
  pendingPhotoDataUrl = null;
  pendingCropPhotoDataUrl = null;
  pendingCropConfidence = "none";
  clearItemBatch();
  if (els.itemPhoto) els.itemPhoto.value = "";
  if (els.itemPhotoImg) els.itemPhotoImg.src = "";
  setItemFlowStep("capture");
  setItemPhotoStatus(message, false, "warning");
  if (message) showAppToast(message, "warning");
  updateItemVisual();
  updateItemSaveState();
}

function openWardrobeFilterDialog() {
  if (!els.wardrobeFilterDialog) return;
  const items = Array.isArray(_wardrobeCache) ? _wardrobeCache : loadWardrobeLocal();
  const colors = [...new Set(items.map((item) => normalizeFilterValue(item.color)).filter(Boolean))].sort();
  const materials = [...new Set(items.map((item) => normalizeFilterValue(item.material)).filter(Boolean))].sort();
  if (els.wardrobeColorFilter) {
    els.wardrobeColorFilter.innerHTML = [
      `<option value="all">All colors</option>`,
      ...colors.map((color) => `<option value="${escapeHtml(color)}">${escapeHtml(color.charAt(0).toUpperCase() + color.slice(1))}</option>`),
    ].join("");
    els.wardrobeColorFilter.value = wardrobeFilterState.color || "all";
  }
  if (els.wardrobeMaterialFilter) {
    els.wardrobeMaterialFilter.innerHTML = [
      `<option value="all">All materials</option>`,
      ...materials.map((material) => `<option value="${escapeHtml(material)}">${escapeHtml(material.charAt(0).toUpperCase() + material.slice(1))}</option>`),
    ].join("");
    els.wardrobeMaterialFilter.value = wardrobeFilterState.material || "all";
  }
  if (els.wardrobeSeasonFilter) {
    els.wardrobeSeasonFilter.value = wardrobeFilterState.season || "all";
  }
  if (els.wardrobeSortFilter) {
    els.wardrobeSortFilter.value = wardrobeFilterState.sort || "newest";
  }
  if (els.wardrobeRecentOnlyFilter) {
    els.wardrobeRecentOnlyFilter.checked = !!wardrobeFilterState.recentOnly;
  }
  if (els.wardrobeMissingMetadataFilter) {
    els.wardrobeMissingMetadataFilter.checked = !!wardrobeFilterState.missingMetadataOnly;
  }
  if (els.wardrobeMatchedFilter) {
    els.wardrobeMatchedFilter.checked = !!wardrobeFilterState.matchedOnly;
  }
  els.wardrobeFilterDialog.showModal?.();
}

function bindWardrobeUI() {
  const clearWardrobeLongPress = () => {
    if (wardrobeLongPressTimerId) window.clearTimeout(wardrobeLongPressTimerId);
    wardrobeLongPressTimerId = null;
    wardrobeLongPressItemId = null;
  };

  els.addItemBtn?.addEventListener("click", () => openItemDialog());
  els.itemManualToggleBtn?.addEventListener("click", () => revealItemManualDetails({ focus: true }));
  els.itemNextPhotoBtn?.addEventListener("click", () => {
    if (isSavingItem || isReadingItemPhoto || isAnalyzingItemPhoto) return;
    setItemFlowStep("capture");
    els.itemPhoto?.click?.();
  });
  els.itemEditDetailsBtn?.addEventListener("click", () => {
    const nextOpen = !itemMoreDetailsOpen;
    setItemMoreDetailsOpen(nextOpen);
    updateItemSaveState();
    if (nextOpen) window.setTimeout(() => els.itemColor?.focus?.(), 60);
  });
  els.itemBackBtn?.addEventListener("click", handleItemBackAction);
  els.itemBatchKeepToggleBtn?.addEventListener("click", toggleCurrentBatchItemKept);
  els.itemBatchList?.addEventListener("click", (event) => {
    const discardButton = event.target.closest("[data-item-batch-discard]");
    if (discardButton) {
      const discardIndex = Number(discardButton.dataset.itemBatchDiscard);
      if (Number.isFinite(discardIndex) && itemBatchItems[discardIndex]) {
        itemBatchItems[discardIndex].kept = itemBatchItems[discardIndex].kept === false;
        renderItemBatchReview();
        updateItemSaveState();
      }
      return;
    }
    const batchButton = event.target.closest("[data-item-batch-index]");
    if (!batchButton) return;
    const nextIndex = Number(batchButton.dataset.itemBatchIndex);
    activeItemBatchIndex = nextIndex;
    renderItemBatchReview();
    openBatchEditDialog(nextIndex);
  });
  els.itemRejectedList?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-rejected-action]");
    if (actionButton) {
      const index = Number(actionButton.dataset.rejectedIndex || -1);
      if (index < 0) return;
      const entry = itemRejectedPhotos[index];
      if (!entry) return;
      const action = actionButton.dataset.rejectedAction;
      if (action === "crop") {
        openRejectedPhotoCropDialog(index);
      } else if (action === "manual") {
        createManualBatchItemFromRejected(entry, { cropRegion: null, entryIndex: index });
      } else if (action === "skip") {
        dismissRejectedPhoto(index);
      }
      return;
    }
    const card = event.target.closest(".item-rejected-card");
    if (!card) return;
    const cards = [...els.itemRejectedList.querySelectorAll(".item-rejected-card")];
    const index = cards.indexOf(card);
    if (index >= 0) openRejectedPhotoDialog(index);
  });
  els.itemBatchEditCloseBtn?.addEventListener("click", closeBatchEditDialog);
  els.itemBatchEditSaveBtn?.addEventListener("click", saveBatchEditDialog);
  els.itemBatchEditRemoveBtn?.addEventListener("click", toggleBatchEditItemKept);
  els.itemBatchEditWrongCategoryBtn?.addEventListener("click", focusBatchEditType);
  els.itemBatchEditNotItemBtn?.addEventListener("click", markBatchEditAsNotItem);
  els.itemBatchEditCropBtn?.addEventListener("click", openBatchEditCropDialog);
  els.itemBatchEditUseAnywayBtn?.addEventListener("click", keepBatchEditItemAnyway);
  els.itemRejectedDialogCloseBtn?.addEventListener("click", closeRejectedPhotoDialog);
  els.itemRejectedDialogSkipBtn?.addEventListener("click", () => {
    if (activeRejectedPhotoIndex >= 0) dismissRejectedPhoto(activeRejectedPhotoIndex);
    closeRejectedPhotoDialog();
  });
  els.itemRejectedDialogFullBtn?.addEventListener("click", async () => {
    const entry = currentRejectedPhoto();
    if (entry) await createManualBatchItemFromRejected(entry, { cropRegion: null, entryIndex: activeRejectedPhotoIndex });
  });
  els.itemRejectedDialogCropBtn?.addEventListener("click", async () => {
    if (activeRejectedPhotoIndex >= 0) await openRejectedPhotoCropDialog(activeRejectedPhotoIndex, { restoreDialog: true });
  });
  els.itemCropCloseBtn?.addEventListener("click", () => closeItemCropDialog());
  els.itemCropResetBtn?.addEventListener("click", () => {
    if (!activeItemCropSession) return;
    activeItemCropSession.region = getDefaultManualCropRegion();
    renderItemCropSelection();
    setItemCropStatus("");
  });
  els.itemCropApplyBtn?.addEventListener("click", async () => {
    if (!activeItemCropSession) return;
    const session = activeItemCropSession;
    const region = normalizeManualCropRegion(session.region);
    setItemCropStatus("Applying crop…");
    els.itemCropApplyBtn.disabled = true;
    try {
      const cropPhotoDataUrl = await cropImageDataUrlToRegion(session.sourcePhotoDataUrl, region);
      closeItemCropDialog({ restore: false });
      await session.onApply?.({ cropPhotoDataUrl, region });
    } catch (err) {
      setItemCropStatus(err.message || "Couldn’t apply this crop. Try again.");
    } finally {
      if (els.itemCropApplyBtn) els.itemCropApplyBtn.disabled = false;
    }
  });
  els.itemCropSelection?.addEventListener("pointerdown", (event) => {
    const mode = event.target.closest(".item-crop-handle") ? "resize" : "move";
    beginItemCropPointerInteraction(event, mode);
  });
  els.itemCropSelection?.addEventListener("pointermove", updateItemCropPointerInteraction);
  els.itemCropSelection?.addEventListener("pointerup", endItemCropPointerInteraction);
  els.itemCropSelection?.addEventListener("pointercancel", endItemCropPointerInteraction);
  els.itemCropStage?.addEventListener("pointermove", updateItemCropPointerInteraction);
  els.itemCropStage?.addEventListener("pointerup", endItemCropPointerInteraction);
  els.itemCropStage?.addEventListener("pointercancel", endItemCropPointerInteraction);
  window.addEventListener("resize", renderItemCropSelection);
  els.itemCropDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeItemCropDialog();
  });
  els.wardrobeFilters?.addEventListener("click", async (event) => {
    const viewButton = event.target.closest("[data-wardrobe-view]");
    if (viewButton) {
      wardrobeFilterState.view = viewButton.dataset.wardrobeView || "all";
      await renderWardrobe();
      return;
    }
    const filterButton = event.target.closest("[data-open-wardrobe-filter]");
    if (filterButton) {
      openWardrobeFilterDialog();
      return;
    }
    const categoryButton = event.target.closest("[data-wardrobe-category]");
    if (categoryButton) {
      wardrobeFilterState.category = categoryButton.dataset.wardrobeCategory || "all";
      await renderWardrobe();
      return;
    }
  });
  els.wardrobeList?.addEventListener("click", async (event) => {
    const favoriteButton = event.target.closest("[data-wardrobe-favorite]");
    if (favoriteButton) {
      event.preventDefault();
      event.stopPropagation();
      await toggleWardrobeFavorite(favoriteButton.dataset.wardrobeFavorite);
      return;
    }
    const itemCard = event.target.closest("[data-id]");
    if (!itemCard) return;
    if (wardrobeLongPressHandled) {
      wardrobeLongPressHandled = false;
      return;
    }
    await openWardrobeItemViewer(itemCard.dataset.id, wardrobeVisibleItemIds);
  }, true);
  els.wardrobeList?.addEventListener("pointerdown", (event) => {
    const itemCard = event.target.closest("[data-id]");
    if (!itemCard || event.target.closest("[data-wardrobe-favorite]")) return;
    wardrobeLongPressHandled = false;
    clearWardrobeLongPress();
    wardrobeLongPressItemId = itemCard.dataset.id || null;
    wardrobeLongPressTimerId = window.setTimeout(async () => {
      wardrobeLongPressHandled = true;
      const targetId = wardrobeLongPressItemId;
      clearWardrobeLongPress();
      if (targetId) await openWardrobeItemActionsDialog(targetId);
    }, 420);
  });
  els.wardrobeList?.addEventListener("pointerup", clearWardrobeLongPress);
  els.wardrobeList?.addEventListener("pointercancel", clearWardrobeLongPress);
  els.wardrobeList?.addEventListener("pointermove", (event) => {
    if (!wardrobeLongPressTimerId) return;
    if (Math.abs(event.movementX || 0) > 8 || Math.abs(event.movementY || 0) > 8) {
      clearWardrobeLongPress();
    }
  });
  els.wardrobeList?.addEventListener("contextmenu", async (event) => {
    const itemCard = event.target.closest("[data-id]");
    if (!itemCard) return;
    event.preventDefault();
    clearWardrobeLongPress();
    await openWardrobeItemActionsDialog(itemCard.dataset.id);
  });
  els.itemCancelBtn?.addEventListener("click", closeItemDialog);
  els.itemDeleteBtn?.addEventListener("click", requestDeleteItem);
  els.deleteItemCancelBtn?.addEventListener("click", () => els.deleteItemConfirmDialog?.close());
  els.deleteItemConfirmBtn?.addEventListener("click", async () => {
    els.deleteItemConfirmDialog?.close();
    await deleteItem();
  });
  els.itemDetailCloseBtn?.addEventListener("click", closeWardrobeItemViewer);
  els.wardrobeItemActionsCloseBtn?.addEventListener("click", () => els.wardrobeItemActionsDialog?.close());
  els.wardrobeItemActionsBody?.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-wardrobe-action]");
    if (!actionButton) return;
    const itemId = actionButton.dataset.wardrobeItemId;
    const action = actionButton.dataset.wardrobeAction;
    els.wardrobeItemActionsDialog?.close();
    if (action === "favorite") {
      await toggleWardrobeFavorite(itemId);
      return;
    }
    if (action === "edit") {
      const items = await loadWardrobeAsync();
      const item = items.find((entry) => String(entry.id) === String(itemId));
      closeWardrobeItemViewer();
      if (item) openItemDialog(item);
      return;
    }
    if (action === "delete") {
      editingItemId = itemId;
      requestDeleteItem();
    }
  });
  els.itemDetailBody?.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-item-viewer-action]");
    if (!actionButton) return;
    const currentId = wardrobeItemViewerState.visibleItemIds[wardrobeItemViewerState.currentIndex];
    const action = actionButton.dataset.itemViewerAction;
    if (!currentId) return;
    if (action === "close") {
      closeWardrobeItemViewer();
      return;
    }
    if (action === "favorite") {
      await toggleWardrobeFavorite(currentId);
      return;
    }
    if (action === "more") {
      await openWardrobeItemActionsDialog(currentId);
      return;
    }
    if (action === "edit") {
      const items = await loadWardrobeAsync();
      const item = items.find((entry) => String(entry.id) === String(currentId));
      const needsReviewFocus = item ? itemNeedsMetadataReview(item) : false;
      closeWardrobeItemViewer();
      if (item) {
        openItemDialog(item);
        if (needsReviewFocus) {
          setItemMoreDetailsOpen(true);
          window.setTimeout(() => {
            const target = !item.color ? els.itemColor : !item.material ? els.itemMaterial : null;
            target?.focus?.();
            target?.scrollIntoView?.({ block: "center", behavior: "smooth" });
          }, 80);
        }
      }
      return;
    }
    if (action === "delete") {
      editingItemId = currentId;
      requestDeleteItem();
    }
  });
  els.itemDetailBody?.addEventListener("pointerdown", (event) => {
    const stage = event.target.closest("[data-item-viewer-stage]");
    if (!stage) return;
    if (event.target.closest("[data-item-viewer-action]")) return;
    wardrobeViewerPointerState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      deltaX: 0,
      deltaY: 0,
      isDragging: false,
      axis: "",
    };
    stage.setPointerCapture?.(event.pointerId);
  });
  els.itemDetailBody?.addEventListener("pointermove", (event) => {
    if (!wardrobeViewerPointerState || wardrobeViewerPointerState.pointerId !== event.pointerId) return;
    wardrobeViewerPointerState.deltaX = event.clientX - wardrobeViewerPointerState.startX;
    wardrobeViewerPointerState.deltaY = event.clientY - wardrobeViewerPointerState.startY;
    if (!wardrobeViewerPointerState.isDragging) {
      const hasHorizontalIntent = Math.abs(wardrobeViewerPointerState.deltaX) > WARDROBE_VIEWER_DRAG_INTENT_THRESHOLD
        && Math.abs(wardrobeViewerPointerState.deltaX) > Math.abs(wardrobeViewerPointerState.deltaY);
      const hasVerticalCloseIntent = wardrobeViewerPointerState.deltaY < -WARDROBE_VIEWER_DRAG_INTENT_THRESHOLD
        && Math.abs(wardrobeViewerPointerState.deltaY) > Math.abs(wardrobeViewerPointerState.deltaX);
      if (!hasHorizontalIntent && !hasVerticalCloseIntent) return;
      wardrobeViewerPointerState.isDragging = true;
      wardrobeViewerPointerState.axis = hasVerticalCloseIntent ? "vertical" : "horizontal";
    }
    updateWardrobeViewerDrag(
      wardrobeViewerPointerState.deltaX,
      wardrobeViewerPointerState.deltaY,
      wardrobeViewerPointerState.axis || "horizontal"
    );
  });
  els.itemDetailBody?.addEventListener("pointerup", async (event) => {
    if (!wardrobeViewerPointerState || wardrobeViewerPointerState.pointerId !== event.pointerId) return;
    const stage = event.target.closest("[data-item-viewer-stage]") || getWardrobeViewerElements().stage;
    stage?.releasePointerCapture?.(event.pointerId);
    const { deltaX, deltaY, isDragging, axis } = wardrobeViewerPointerState;
    wardrobeViewerPointerState = null;
    if (!isDragging) return;
    if (axis === "vertical") {
      if (deltaY <= -WARDROBE_VIEWER_SWIPE_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
        await animateWardrobeViewerClose(deltaY);
      } else {
        animateWardrobeViewerReset();
      }
      return;
    }
    if (Math.abs(deltaX) < WARDROBE_VIEWER_SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) {
      animateWardrobeViewerReset();
      return;
    }
    const direction = deltaX < 0 ? 1 : -1;
    const nextIndex = wardrobeItemViewerState.currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= wardrobeItemViewerState.visibleItemIds.length) {
      animateWardrobeViewerReset();
      return;
    }
    await animateWardrobeViewerCommit(direction, deltaX);
  });
  els.itemDetailBody?.addEventListener("pointercancel", (event) => {
    const stage = event.target.closest("[data-item-viewer-stage]") || getWardrobeViewerElements().stage;
    stage?.releasePointerCapture?.(event.pointerId);
    if (wardrobeViewerPointerState?.isDragging) animateWardrobeViewerReset();
    wardrobeViewerPointerState = null;
  });
  els.itemDetailDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeWardrobeItemViewer();
  });
  els.itemDetailDialog?.addEventListener("click", (event) => {
    if (event.target === els.itemDetailDialog) closeWardrobeItemViewer();
  });
  els.itemDetailBody?.addEventListener("click", (event) => {
    if (event.target.closest("[data-item-viewer-stage]")) return;
    if (event.target.closest("[data-item-viewer-pager-rail]")) return;
    if (event.target.closest("[data-item-viewer-action]")) return;
    closeWardrobeItemViewer();
  });
  els.itemDetailDialog?.addEventListener("close", () => {
    if (!wardrobeItemViewerState.isOpen) return;
    wardrobeItemViewerState = {
      isOpen: false,
      source: "all",
      visibleItemIds: [],
      currentIndex: 0,
      pagerFromIndex: null,
      isEditOpen: false,
    };
    wardrobeViewerPointerState = null;
  });

  els.itemForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    handleItemPrimaryAction();
  });

  els.itemPhoto?.addEventListener("change", async () => {
    const file = els.itemPhoto.files?.[0];
    if (!file) return;
    const append = itemFlowStep === "capture" && (itemBatchItems.length > 0 || itemRejectedPhotos.length > 0 || hasItemImportSession());
    if (!append) resetItemPhotoQueue();
    await processSelectedItemPhotos([file], { reset: !append });
  });

  els.itemGalleryPhotos?.addEventListener("change", async () => {
    const files = Array.from(els.itemGalleryPhotos.files || []).filter((file) => file?.type?.startsWith("image/"));
    if (!files.length) return;
    const append = itemFlowStep === "capture" && (itemBatchItems.length > 0 || itemRejectedPhotos.length > 0 || hasItemImportSession());
    if (!append) resetItemPhotoQueue();
    await processSelectedItemPhotos(files, { reset: !append });
  });

  els.removePhotoBtn?.addEventListener("click", async () => {
    await removeCurrentItemPhoto();
  });

  els.recropPhotoBtn?.addEventListener("click", async () => {
    const source = pendingPhotoDataUrl;
    if (!source) {
      showAppToast("No source photo available to crop", "warning");
      return;
    }
    await openItemCropDialog({
      sourcePhotoDataUrl: source,
      title: "Recrop this item",
      subtitle: "Move the crop box over the item, then drag the corner to resize it.",
      onApply: async ({ cropPhotoDataUrl }) => {
        pendingCropPhotoDataUrl = cropPhotoDataUrl;
        pendingCropConfidence = "trusted";
        if (els.itemPhotoImg && cropPhotoDataUrl) {
          els.itemPhotoImg.src = cropPhotoDataUrl;
        }
        updateItemVisual();
        updateItemSaveState();
        showAppToast("Crop updated", "success");
      },
    });
  });

  [els.itemType, els.itemName, els.itemColor, els.itemMaterial].forEach((input) => {
    input?.addEventListener("input", () => {
      updateItemVisual();
      syncCompactEditFieldsFromPrimary();
      updateNeedsReviewFieldFlags();
      updateItemSaveState();
    });
    input?.addEventListener("change", () => {
      updateItemVisual();
      syncCompactEditFieldsFromPrimary();
      updateNeedsReviewFieldFlags();
      updateItemSaveState();
    });
  });
  [els.itemEditColor, els.itemEditMaterial, els.itemEditCare].forEach((input) => {
    input?.addEventListener("input", () => {
      syncPrimaryFieldsFromCompactEdit();
      updateItemVisual();
      updateNeedsReviewFieldFlags();
      updateItemSaveState();
    });
    input?.addEventListener("change", () => {
      syncPrimaryFieldsFromCompactEdit();
      updateItemVisual();
      updateNeedsReviewFieldFlags();
      updateItemSaveState();
    });
  });
  els.itemType?.addEventListener("change", () => {
    if (els.itemType.value.trim()) setFieldError(els.itemType, els.itemTypeError, "");
    if (els.itemType.value.trim() && els.itemName.value.trim()) setItemFormError("");
  });
  els.itemName?.addEventListener("input", () => {
    if (els.itemName.value.trim()) setFieldError(els.itemName, els.itemNameError, "");
    if (els.itemType.value.trim() && els.itemName.value.trim()) setItemFormError("");
  });
  [els.itemBatchEditColor, els.itemBatchEditMaterial].forEach((input) => {
    input?.addEventListener("input", updateBatchEditNeedsReviewFlags);
    input?.addEventListener("change", updateBatchEditNeedsReviewFlags);
  });
  els.itemFavorite?.addEventListener("change", () => {
    syncCompactEditFieldsFromPrimary();
    updateItemSaveState();
  });
  els.itemEditFavorite?.addEventListener("change", () => {
    syncPrimaryFieldsFromCompactEdit();
    updateItemSaveState();
  });
  els.wardrobeEmpty?.addEventListener("click", (event) => {
    const starterButton = event.target.closest("[data-starter-type]");
    if (!starterButton) return;
    event.preventDefault();
    event.stopPropagation();
    const starterType = starterButton.getAttribute("data-starter-type") || "";
    openItemDialog(null, getStarterTypePreset(starterType));
  });
  els.wardrobeMissingChips?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-starter-label]");
    if (!chip) return;
    const label = chip.dataset.starterLabel || "";
    const map = {
      "Outerwear": "Jacket",
      "Shoes": "Sneakers",
      "Rain layer": "Jacket",
      "Staple tops": "T-shirt",
      "Bottoms": "Jeans",
    };
    openItemDialog(null, getStarterTypePreset(map[label] || "Other"));
  });
  const handleStarterProgressClick = (event) => {
    const chip = event.target.closest("[data-starter-label]");
    if (!chip) return;
    const label = chip.dataset.starterLabel || "";
    const map = {
      "Outerwear": "Jacket",
      "Shoes": "Sneakers",
      "Rain layer": "Jacket",
      "Staple tops": "T-shirt",
      "Bottoms": "Jeans",
    };
    openItemDialog(null, getStarterTypePreset(map[label] || "Other"));
  };
  els.todayWardrobeInlineProgress?.addEventListener("click", handleStarterProgressClick);
  els.wardrobeExplainerProgress?.addEventListener("click", handleStarterProgressClick);

  els.wardrobeFilterDialogCloseBtn?.addEventListener("click", () => els.wardrobeFilterDialog?.close());
  els.wardrobeFilterApplyBtn?.addEventListener("click", async () => {
    wardrobeFilterState.color = normalizeFilterValue(els.wardrobeColorFilter?.value) || "all";
    wardrobeFilterState.material = normalizeFilterValue(els.wardrobeMaterialFilter?.value) || "all";
    wardrobeFilterState.season = els.wardrobeSeasonFilter?.value || "all";
    wardrobeFilterState.sort = els.wardrobeSortFilter?.value || "newest";
    wardrobeFilterState.recentOnly = !!els.wardrobeRecentOnlyFilter?.checked;
    wardrobeFilterState.missingMetadataOnly = !!els.wardrobeMissingMetadataFilter?.checked;
    wardrobeFilterState.matchedOnly = !!els.wardrobeMatchedFilter?.checked;
    els.wardrobeFilterDialog?.close();
    await renderWardrobe();
  });
  els.wardrobeFilterResetBtn?.addEventListener("click", async () => {
    wardrobeFilterState.color = "all";
    wardrobeFilterState.material = "all";
    wardrobeFilterState.season = "all";
    wardrobeFilterState.sort = "newest";
    wardrobeFilterState.recentOnly = false;
    wardrobeFilterState.missingMetadataOnly = false;
    wardrobeFilterState.matchedOnly = false;
    if (els.wardrobeColorFilter) els.wardrobeColorFilter.value = "all";
    if (els.wardrobeMaterialFilter) els.wardrobeMaterialFilter.value = "all";
    if (els.wardrobeSeasonFilter) els.wardrobeSeasonFilter.value = "all";
    if (els.wardrobeSortFilter) els.wardrobeSortFilter.value = "newest";
    if (els.wardrobeRecentOnlyFilter) els.wardrobeRecentOnlyFilter.checked = false;
    if (els.wardrobeMissingMetadataFilter) els.wardrobeMissingMetadataFilter.checked = false;
    if (els.wardrobeMatchedFilter) els.wardrobeMatchedFilter.checked = false;
    els.wardrobeFilterDialog?.close();
    await renderWardrobe();
  });
  els.wardrobeSearchInput?.addEventListener("input", async () => {
    wardrobeFilterState.search = String(els.wardrobeSearchInput?.value || "").trim();
    await renderWardrobe();
  });

  // Scan tag button opens scan dialog
  const openScanTagDialog = () => {
    els.scanPhoto.value = "";
    els.scanPreview.style.display = "none";
    els.scanStatus.textContent = "";
    els.scanSubmitBtn.disabled = true;
    if (typeof els.scanDialog.showModal === "function") els.scanDialog.showModal();
  };
  els.scanTagBtn?.addEventListener("click", openScanTagDialog);
  els.itemEditScanTagBtn?.addEventListener("click", openScanTagDialog);

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
      syncCompactEditFieldsFromPrimary();
      updateItemVisual();
      updateItemSaveState();
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
let activeRecommendationRequestId = 0;
let activeRecommendationController = null;
const RECOMMENDATION_CLIENT_CACHE_LIMIT = 8;
const RECOMMENDATION_CLIENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function recommendationCacheBucket(value, size, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n / size) * size : fallback;
}

function recommendationCacheWeatherFamily(label = "") {
  const text = String(label || "").toLowerCase();
  if (/thunder|storm/.test(text)) return "storm";
  if (/snow|sleet|freezing/.test(text)) return "snow";
  if (/rain|drizzle|shower/.test(text)) return "rain";
  if (/fog|mist|haze/.test(text)) return "fog";
  if (/clear|sun/.test(text)) return "clear";
  if (/cloud|overcast/.test(text)) return "cloud";
  return text.slice(0, 24);
}

function buildRecommendationClientCacheKey({ weather, wardrobe, preferences, location }) {
  const remaining = weather?.remainingForecast || {};
  return JSON.stringify({
    v: 2,
    location: {
      name: String(location?.name || "").trim().toLowerCase(),
      lat: recommendationCacheBucket(location?.lat, 0.05),
      lon: recommendationCacheBucket(location?.lon, 0.05),
    },
    weather: {
      temp: recommendationCacheBucket(weather?.temperature, 2, 0),
      feelsLike: recommendationCacheBucket(weather?.feelsLike, 2, 0),
      wind: recommendationCacheBucket(weather?.wind, 5, 0),
      precipProb: recommendationCacheBucket(weather?.precipProb, 10, 0),
      family: recommendationCacheWeatherFamily(weather?.weatherLabel),
      day: weather?.isDay === false ? "night" : "day",
      laterTemp: remaining.tempRange || "",
      laterFeels: remaining.feelsLikeRange || "",
      laterWind: remaining.maxWind || "",
      laterRain: remaining.maxPrecipProb || "",
    },
    wardrobe: Array.isArray(wardrobe)
      ? wardrobe.map((item) => ({
          id: item.id || null,
          type: String(item.type || "").toLowerCase(),
          name: String(item.name || "").toLowerCase(),
          color: String(item.color || "").toLowerCase(),
          material: String(item.material || "").toLowerCase(),
          favorite: !!item.favorite,
        })).sort((a, b) => String(a.id || a.name || "").localeCompare(String(b.id || b.name || "")))
      : [],
    preferences: {
      cold: !!preferences?.cold,
      hot: !!preferences?.hot,
      activityContext: preferences?.activityContext || "everyday",
      locationContext: preferences?.locationContext || "mixed",
      styleFocus: preferences?.styleFocus || "auto",
      gender: preferences?.gender || "unspecified",
      fashionNotes: String(preferences?.fashionNotes || "").trim().toLowerCase().slice(0, 120),
    },
  });
}

function sanitizeRecommendationImagesForCache(outfitImages = {}) {
  if (!outfitImages || typeof outfitImages !== "object") return {};
  return Object.fromEntries(Object.entries(outfitImages).filter(([, match]) => {
    const path = String(match?.path || "");
    return match && match.source !== "wardrobe" && !path.startsWith("data:");
  }));
}

function trimRecommendationForClientCache(data = {}) {
  return {
    outlook: data.outlook || null,
    outfit: data.outfit || null,
    slotReasons: data.slotReasons || {},
    itemDetails: data.itemDetails || {},
    reasoning: data.reasoning || "",
    detailsOverview: data.detailsOverview || null,
    warnings: Array.isArray(data.warnings) ? data.warnings.slice(0, 1) : [],
    missingItems: Array.isArray(data.missingItems) ? data.missingItems.slice(0, 1) : [],
    trustSignals: data.trustSignals || null,
    outfitImages: sanitizeRecommendationImagesForCache(data.outfitImages || {}),
  };
}

function getCachedRecommendationForRequest(cacheKey) {
  const now = Date.now();
  const state = loadState();
  const cache = Array.isArray(state.recommendationCache) ? state.recommendationCache : [];
  return cache.find((entry) =>
    entry?.cacheKey === cacheKey &&
    entry?.data?.outfit &&
    Number.isFinite(Number(entry.savedAt)) &&
    now - Number(entry.savedAt) <= RECOMMENDATION_CLIENT_CACHE_TTL_MS
  ) || null;
}

function saveRecommendationCacheEntry(cacheKey, data, context = {}) {
  if (!cacheKey || !data?.outfit) return;
  const state = loadState();
  const cache = Array.isArray(state.recommendationCache) ? state.recommendationCache : [];
  const nextEntry = {
    cacheKey,
    savedAt: Date.now(),
    data: trimRecommendationForClientCache(data),
    weather: context.weather || null,
  };
  saveState({
    recommendationCache: [
      nextEntry,
      ...cache.filter((entry) => entry?.cacheKey !== cacheKey),
    ].slice(0, RECOMMENDATION_CLIENT_CACHE_LIMIT),
  });
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

async function fetchAIRecommendation(weatherData, current, ctx, locationOverride = null) {
  const wardrobe = loadWardrobe().map(({ id, type, name, color, material, careInstructions, photoDataUrl, sourcePhotoDataUrl, cropPhotoDataUrl, cropConfidence, favorite }) => ({
    id,
    type,
    name,
    color,
    material,
    careInstructions,
    photoDataUrl,
    sourcePhotoDataUrl,
    cropPhotoDataUrl,
    cropConfidence,
    favorite: !!favorite,
  }));
  const state = loadState();
  const sourceLocation = locationOverride || state.lastLocation;
  const location = sourceLocation
    ? {
        lat: Number(sourceLocation.lat),
        lon: Number(sourceLocation.lon),
        name: sourceLocation.name || null,
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

  // Compact 3-window outlook summary (now / later / evening) for the LLM
  // so it can write the outfit-outlook copy itself instead of us templating it.
  let outlookWindows = null;
  try {
    const nextHours = getNextWeatherHours(current, hourly, 15);
    if (nextHours.length) {
      const fmtRange = (lo, hi) => Number.isFinite(lo) && Number.isFinite(hi)
        ? `${Math.round(lo)}–${Math.round(hi)}°C`
        : null;
      const round = (v) => Number.isFinite(v) ? Math.round(v) : null;
      const buildWindow = (label, slice) => {
        if (!slice.length) return null;
        const s = summarizeOutlookWindow(slice, label);
        return {
          label,
          tempRange: fmtRange(s.minTemp, s.maxTemp),
          maxRain: round(s.maxRain),
          maxWind: round(s.maxWind),
          condition: s.label || null,
          hours: slice.length,
        };
      };
      outlookWindows = [
        buildWindow("Now", nextHours.slice(0, 4)),
        buildWindow("Later", nextHours.slice(4, 10)),
        buildWindow("Evening", nextHours.slice(10, 15)),
      ].filter(Boolean);
    }
  } catch {}

  lastWeatherForAI = weather;

  const preferences = normalizeRecommendationPrefs({
    ...state.prefs,
    fashionNotes: state.prefs.fashionNotes || null,
  });
  const clientCacheKey = buildRecommendationClientCacheKey({ weather, wardrobe, preferences, location });
  const cachedRecommendation = getCachedRecommendationForRequest(clientCacheKey);

  const hasExistingRecommendation = hasRecommendationCardContent();
  els.aiRecSection.style.display = "";
  els.aiRecWarnings.innerHTML = "";
  els.aiRecMissing.innerHTML = "";
  syncTodayWardrobeDialog(loadWardrobe(), getPendingRecommendationPromptState(state));
  if (!hasExistingRecommendation && cachedRecommendation) {
    console.info("[recommend-ui] client-cache-hit", {
      location: location?.name || null,
      savedAt: cachedRecommendation.savedAt,
    });
    renderAIRecommendation(cachedRecommendation.data, {
      fromCache: true,
      cacheKey: clientCacheKey,
    });
    if (els.aiRecLoading) els.aiRecLoading.style.display = "flex";
  } else if (!hasExistingRecommendation) {
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
        <div class="rec-skeleton-caption">Building today’s outfit recommendation from weather and wardrobe context…</div>
      </div>
    `;
  }
  if (!cachedRecommendation) {
    await animateRecommendationRefreshOut();
  }
  if (hasExistingRecommendation && els.aiRecLoading) els.aiRecLoading.style.display = "flex";

  const requestId = ++activeRecommendationRequestId;
  if (activeRecommendationController) {
    try {
      activeRecommendationController.abort("superseded");
    } catch {}
  }
  const recommendationController = new AbortController();
  activeRecommendationController = recommendationController;
  console.info("[recommend-ui] request-start", {
    requestId,
    location: location?.name || null,
    prefs: preferences,
  });
  const recommendationTimeoutId = window.setTimeout(() => recommendationController.abort("timeout"), 70000);

  try {
    const res = await fetch(`${API_BASE}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: recommendationController.signal,
      body: JSON.stringify({ weather, wardrobe, preferences, location, outlookWindows }),
    });
    const data = await res.json();
    if (requestId !== activeRecommendationRequestId) {
      console.info("[recommend-ui] request-stale-response", { requestId, activeRecommendationRequestId });
      return;
    }
    if (data.error) {
      if (!cachedRecommendation) {
        renderAIRecommendation(buildClientFallbackRecommendation(weather, data.error || "AI service returned an error"));
      }
      return;
    }
    console.info("[recommend-ui] request-success", {
      requestId,
      outfit: data?.outfit || null,
      prefs: preferences,
    });
    renderAIRecommendation(data, {
      cacheKey: clientCacheKey,
      cacheContext: { weather, location, preferences, wardrobe },
    });
  } catch (err) {
    if (requestId !== activeRecommendationRequestId) {
      console.info("[recommend-ui] request-stale-error", {
        requestId,
        activeRecommendationRequestId,
        error: err?.message || String(err),
      });
      return;
    }
    const abortReason = recommendationController.signal.reason || err?.message || String(err);
    if (abortReason === "superseded" || err?.message === "superseded" || err === "superseded") {
      console.info("[recommend-ui] request-aborted", { requestId, reason: err?.message || String(err) });
      return;
    }
    const reason = err?.name === "AbortError" || abortReason === "timeout"
      ? "AI took too long to respond"
      : "AI service could not be reached";
    if (!cachedRecommendation) {
      renderAIRecommendation(buildClientFallbackRecommendation(weather, reason));
    } else {
      showAppToast("Refreshed weather, showing the last good outfit while AI catches up.", "info");
    }
  } finally {
    window.clearTimeout(recommendationTimeoutId);
    if (requestId === activeRecommendationRequestId) {
      activeRecommendationController = null;
    }
    els.aiRecSection?.classList.remove("is-loading-first");
    if (!els.aiRecSection.classList.contains("is-refreshing") && els.aiRecLoading) {
      els.aiRecLoading.style.display = "none";
    }
  }
}

function renderAIRecommendation(data, options = {}) {
  const stateBeforeSave = loadState();
  const fromCache = !!options.fromCache;
  pendingRecommendationPrefs = null;
  els.tabToday?.classList.add("has-results", "has-recommendation");
  els.aiRecSection?.classList.remove("is-loading-first");
  const outfit = data.outfit || {};
  const weather = lastWeatherForAI || {};
  const headline = buildOutfitHeadline(outfit);
  const subtitle = buildLocalRecommendationSubtitle(weather);
  const imageMatches = data.outfitImages || {};
  const slotReasons = data.slotReasons || {};
  const itemDetails = data.itemDetails || {};
  const wardrobeItems = loadWardrobe();
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
  const wardrobePhotoMatches = buildWardrobePhotoMatches(rowEntries, wardrobeItems);
  const resolvedImageMatches = mergeRecommendationImageMatches(imageMatches, wardrobePhotoMatches);
  const wardrobeSummary = getRecommendationWardrobeSummary(rowEntries, wardrobeItems, resolvedImageMatches);
  saveState({
    latestRecommendation: {
      matchedItemIds: Object.values(wardrobeSummary.directMatches || {}).map((item) => item?.id).filter(Boolean),
      outfit,
      signature: buildLookSignature(outfit),
      updatedAt: new Date().toISOString(),
    },
  });
  const detailsItems = buildRecommendationDetails(data, weather, rowEntries, slotReasons);
  latestRecommendationSnapshot = {
    headline,
    subtitle,
    outfit,
    detailsItems,
    wardrobeSummary,
    missingItems: Array.isArray(data.missingItems) ? data.missingItems : [],
    reasoning: data.reasoning || "",
    outlook: data.outlook || null,
  };
  if (typeof window !== "undefined" && window.__DEBUG_OUTLOOK) {
    console.info("[outlook] received", {
      hasOutlook: !!data.outlook,
      raw: data.outlook,
    });
  }
  renderWeatherExpandedPanel();
  const collageItems = rowEntries.map((entry, index) => {
    const slotKey = String(entry.label || "").toLowerCase();
    const imageMatch = resolvedImageMatches[entry.key] || resolvedImageMatches[slotKey] || null;
    const art = getRecommendationCardArt(entry.label, entry.value, imageMatch);
    return {
      label: entry.label,
      value: entry.value,
      reason: buildRecommendationItemReason(entry.label, entry.value, weather, slotReasons?.[entry.key] || slotReasons?.[slotKey] || ""),
      photo: art.photo,
      icon: art.icon,
      tone: art.tone,
      wardrobeDetails: imageMatch?.source === "wardrobe" ? imageMatch : null,
      aiDetails: itemDetails?.[entry.key] || itemDetails?.[slotKey] || (slotKey.startsWith("accessory") ? itemDetails?.accessory : null),
    };
  });
  els.aiRecContent.innerHTML = `
    <div class="today-rec-body">
      ${rowEntries.length ? renderRecommendationDeck(rowEntries, weather, resolvedImageMatches, slotReasons) : ""}
    </div>
  `;
  els.aiRecContent.dataset.whyItems = JSON.stringify(detailsItems);
  els.aiRecContent.dataset.collageItems = JSON.stringify(collageItems);
  els.aiRecContent.dataset.wardrobeSummary = JSON.stringify(wardrobeSummary);
  els.aiRecContent.dataset.savedLook = JSON.stringify({
    headline,
    subtitle,
    outfit,
    coverage: wardrobeSummary.coverage,
    missingItems: Array.isArray(data.missingItems) ? data.missingItems : [],
    locationName: stateBeforeSave.lastLocation?.name || "",
    signature: buildLookSignature(outfit),
  });
  els.aiRecWarnings.innerHTML = "";
  els.aiRecMissing.innerHTML = "";
  initializeRecommendationDeck();
  animateRecommendationRefreshIn();
  if (!fromCache && options.cacheKey) {
    saveRecommendationCacheEntry(options.cacheKey, data, options.cacheContext || { weather });
  }
  if (fromCache) {
    trackAnalyticsEvent("recommendation_client_cache_rendered", {
      title: "recommendation_client_cache_rendered",
      signature: buildLookSignature(outfit),
    });
    return;
  }
  recordSuccessfulUseDay();
  const analytics = getAnalyticsState(loadState());
  if (!getOnboardingState(stateBeforeSave).firstRecommendationSeen) {
    trackAnalyticsEvent("first_recommendation_generated", {
      title: "first_recommendation_generated",
      coverage: Number(wardrobeSummary.coverage || 0),
      matchedItems: Number(wardrobeSummary.matchedCount || 0),
    });
  }
  if (!analytics.firstWardrobeRecommendationTracked && Number(wardrobeSummary.matchedCount || 0) > 0) {
    trackAnalyticsEvent("first_wardrobe_powered_recommendation", {
      title: "first_wardrobe_powered_recommendation",
      coverage: Number(wardrobeSummary.coverage || 0),
      matchedItems: Number(wardrobeSummary.matchedCount || 0),
    });
    saveState({
      analytics: {
        ...analytics,
        firstWardrobeRecommendationTracked: true,
      },
    });
    if (isLoggedIn() && !hasPremiumAccess()) {
      window.setTimeout(() => openPaywall("starter_ready", { source: "first-wardrobe-powered-recommendation" }), 900);
    }
  }
  markOnboardingRecommendationSeen();
  maybePromptUsageMilestonePaywall();
}

function bindRecommendationControls() {
  const applyRecommendationFeedback = async (feedback, sourceButton = null) => {
    const latestState = loadState();
    const basePrefs = latestState.prefs || {};
    let nextPrefs = { ...basePrefs };
    trackAnalyticsEvent("recommendation_feedback_tapped", {
      title: `recommendation_feedback_tapped:${feedback}`,
      feedback,
    });
    try {
      const savedLook = JSON.parse(els.aiRecContent?.dataset?.savedLook || "null");
      const wardrobeSummary = JSON.parse(els.aiRecContent?.dataset?.wardrobeSummary || "null");
      fetch(`${API_BASE}/api/recommend/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback,
          outfit: savedLook?.outfit || null,
          weather: lastWeatherForAI || null,
          wardrobeUsageCount: Number(wardrobeSummary?.matchedCount || 0),
        }),
      }).catch(() => {});
    } catch {}

    if (feedback === "too_cold") {
      nextPrefs = { ...nextPrefs, cold: true, hot: false };
    } else if (feedback === "too_warm") {
      nextPrefs = { ...nextPrefs, cold: false, hot: true };
    } else if (feedback === "too_formal") {
      nextPrefs = { ...nextPrefs, styleFocus: "casual", formal: false, casual: true };
    } else if (feedback === "too_casual") {
      nextPrefs = { ...nextPrefs, styleFocus: "polished", formal: true, casual: false };
    } else if (feedback === "not_my_style") {
      openTuneLookDialog();
      sourceButton?.classList.add("is-active");
      return;
    } else if (feedback === "use_more_wardrobe") {
      switchTab("tabWardrobe", { direction: 1 });
      showAppToast("Add or review staples so the next look can use more of your closet.", "info");
      sourceButton?.classList.add("is-active");
      return;
    }

    const feedbackHistory = Array.isArray(latestState.recommendationFeedback) ? latestState.recommendationFeedback : [];
    saveState({
      prefs: nextPrefs,
      recommendationFeedback: [
        {
          feedback,
          createdAt: new Date().toISOString(),
          weather: lastWeatherForAI || null,
        },
        ...feedbackHistory,
      ].slice(0, 25),
    });
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
      const notesInput = els.tuneLookDialogBody?.querySelector("[data-rec-notes]");
      const draftPrefs = {
        ...DEFAULT_STATE.prefs,
        ...(pendingRecommendationPrefs || latestState.prefs || {}),
        ...(notesInput ? { fashionNotes: notesInput.value.trim() } : {}),
      };
      const nextPrefs = normalizeRecommendationPrefs(draftPrefs);
      pendingRecommendationPrefs = null;
      if (els.tuneLookDialog?.dataset.mode === "activation") {
        trackAnalyticsEvent("activation_tune_completed", { title: "activation_tune_completed" });
        completeActivationTune();
      }
      saveState({ prefs: nextPrefs });
      syncPreferenceInputs(nextPrefs);
      if (typeof els.tuneLookDialog?.close === "function") els.tuneLookDialog.close();
      if (latestState.lastLocation) {
        await runForLocation(latestState.lastLocation);
      }
      return;
    }

    const resetTuningButton = event.target.closest("[data-rec-action='reset-tuning']");
    if (resetTuningButton) {
      const latestState = loadState();
      const nextPrefs = structuredClone(DEFAULT_STATE.prefs);
      pendingRecommendationPrefs = null;
      saveState({ prefs: nextPrefs });
      syncPreferenceInputs(nextPrefs);
      if (typeof els.tuneLookDialog?.close === "function") els.tuneLookDialog.close();
      if (latestState.lastLocation) {
        await runForLocation(latestState.lastLocation);
      }
      return;
    }

    const skipActivationTuneButton = event.target.closest("[data-rec-action='skip-activation-tune']");
    if (skipActivationTuneButton) {
      pendingRecommendationPrefs = null;
      trackAnalyticsEvent("activation_tune_skipped", { title: "activation_tune_skipped" });
      completeActivationTune();
      skipActivationTuneButton.closest(".today-activation-tune-panel")?.remove();
      if (typeof els.tuneLookDialog?.close === "function") els.tuneLookDialog.close();
      return;
    }

    const activationTuneButton = event.target.closest("[data-rec-action='activation-tune']");
    if (activationTuneButton) {
      trackAnalyticsEvent("activation_tune_started", { title: "activation_tune_started" });
      openTuneLookDialog({ mode: "activation" });
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

    const saveLookButton = event.target.closest("[data-rec-action='save-look']");
    if (saveLookButton) {
      let payload = null;
      try {
        payload = JSON.parse(els.aiRecContent?.dataset?.savedLook || "null");
      } catch {}
    if (payload && saveRecommendationLook(payload)) {
      savedLooksExpanded = true;
      saveLookButton.textContent = "Saved to looks";
      showAppToast("Look saved to this device. Find it again from From your wardrobe.", "success");
      }
      return;
    }

    const openWardrobeButton = event.target.closest("[data-rec-action='open-wardrobe']");
    if (openWardrobeButton) {
      switchTab("tabWardrobe", { direction: 1 });
      return;
    }

    const toggleSavedLooksButton = event.target.closest("[data-rec-action='toggle-saved-looks']");
    if (toggleSavedLooksButton) {
      savedLooksExpanded = !savedLooksExpanded;
      return;
    }

    const addSimilarButton = event.target.closest("[data-rec-action='add-similar']");
    if (addSimilarButton) {
      const presetType = addSimilarButton.dataset.recMissingType || "Other";
      switchTab("tabWardrobe", { direction: 1 });
      window.setTimeout(() => openItemDialog(null, getStarterTypePreset(presetType)), 240);
      return;
    }

    const useOwnedButton = event.target.closest("[data-rec-action='use-owned']");
    if (useOwnedButton) {
      const presetType = getRecommendationCategoryPreset(useOwnedButton.dataset.recMissingItem || "");
      wardrobeFilterState.view = "all";
      wardrobeFilterState.category = getWardrobeCategory({ type: presetType });
      switchTab("tabWardrobe", { direction: 1 });
      await renderWardrobe();
      showAppToast("Showing similar pieces from your wardrobe.", "info");
      return;
    }

    const chipButton = event.target.closest("[data-rec-pref]");
    if (!chipButton) return;

    const key = chipButton.dataset.recPref;
    const value = chipButton.dataset.recValue;
    if (!key || !value) return;

    const basePrefs = {
      ...DEFAULT_STATE.prefs,
      ...(pendingRecommendationPrefs || loadState().prefs || {}),
    };
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
    document.querySelectorAll(`#tuneLookDialogBody .today-control-group`).forEach((group) => {
      const activeButton = group.querySelector(".today-chip-toggle.is-active");
      const currentLabel = group.querySelector(".today-control-current");
      if (activeButton && currentLabel) currentLabel.textContent = activeButton.textContent.trim();
    });
  };

  els.aiRecContent?.addEventListener("click", handleRecommendationControlInteraction);
  els.aiRecAdjustBtn?.addEventListener("click", handleRecommendationControlInteraction);
  els.tuneLookDialogBody?.addEventListener("click", handleRecommendationControlInteraction);
  els.tuneLookDialogBody?.addEventListener("input", (event) => {
    const notesInput = event.target.closest("[data-rec-notes]");
    if (!notesInput) return;
    pendingRecommendationPrefs = {
      ...(pendingRecommendationPrefs || loadState().prefs),
      fashionNotes: notesInput.value,
    };
  });
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

  flushTabDwellMetrics(currentTabId);
  trackTabOpen(tabId);
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
  let swipeFrameId = 0;
  let pendingSwipeDirection = 0;
  let pendingSwipeDeltaX = 0;

  const applySwipeTransforms = () => {
    swipeFrameId = 0;
    if (!currentPage || !adjacentPage || !pendingSwipeDirection) return;
    const width = container.clientWidth;
    const clampedDeltaX = Math.max(-width, Math.min(width, pendingSwipeDeltaX));
    currentPage.style.transform = `translate3d(${clampedDeltaX}px, 0, 0)`;
    adjacentPage.style.transform = `translate3d(${pendingSwipeDirection * width + clampedDeltaX}px, 0, 0)`;
  };

  const scheduleSwipeTransforms = (direction, nextDeltaX) => {
    pendingSwipeDirection = direction;
    pendingSwipeDeltaX = nextDeltaX;
    if (!swipeFrameId) swipeFrameId = window.requestAnimationFrame(applySwipeTransforms);
  };

  const cancelSwipeFrame = () => {
    if (swipeFrameId) window.cancelAnimationFrame(swipeFrameId);
    swipeFrameId = 0;
    pendingSwipeDirection = 0;
    pendingSwipeDeltaX = 0;
  };

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
        ".weather-expanded-timeline",
        ".weather-expanded-hour",
        ".ac-dropdown",
        ".location-input-wrap",
        "#geoBtn",
        "#searchBtn",
        "#userBtn",
        "#todayUserBtn",
        "#addItemBtn",
        "#todayWardrobeCtaBtn",
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
    currentPage.style.transform = "translate3d(0, 0, 0)";
    adjacentPage.style.transform = `translate3d(${direction * container.clientWidth}px, 0, 0)`;
    return true;
  };

  const settleSwipe = (commit, direction) => {
    if (!currentPage) return;
    cancelSwipeFrame();

    const width = container.clientWidth;
    const finalCurrent = commit ? -direction * width : 0;
    const finalAdjacent = commit ? 0 : direction * width;

    [currentPage, adjacentPage].forEach((page) => {
      if (!page) return;
      page.style.transition = "transform 240ms ease";
    });

    currentPage.style.transform = `translate3d(${finalCurrent}px, 0, 0)`;
    if (adjacentPage) {
      adjacentPage.style.transform = `translate3d(${finalAdjacent}px, 0, 0)`;
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
    cancelSwipeFrame();
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
      scheduleSwipeTransforms(direction, deltaX);
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
    trackAnalyticsEvent("wardrobe_prompt_tapped", {
      title: "wardrobe_prompt_tapped:dialog",
      source: "dialog",
    });
    completeWardrobeUpgradePrompt();
    if (els.todayWardrobeDialog?.open) els.todayWardrobeDialog.close();
    switchTab("tabWardrobe", { direction: 1 });
  });
  els.todayWardrobeInlineBtn?.addEventListener("click", () => {
    trackAnalyticsEvent("wardrobe_prompt_tapped", {
      title: "wardrobe_prompt_tapped:inline",
      source: "inline",
    });
    completeWardrobeUpgradePrompt();
    switchTab("tabWardrobe", { direction: 1 });
    window.setTimeout(() => openItemDialog(), 240);
  });
  els.todayWardrobeInlineDismissBtn?.addEventListener("click", () => {
    trackAnalyticsEvent("wardrobe_prompt_dismissed", {
      title: "wardrobe_prompt_dismissed:inline",
      source: "inline",
    });
    dismissWardrobeUpgradePromptForSession();
  });

  els.whyWorksDialogCloseBtn?.addEventListener("click", () => {
    if (els.whyWorksDialog?.open) els.whyWorksDialog.close();
  });
  els.tuneLookDialogCloseBtn?.addEventListener("click", () => {
    if (els.tuneLookDialog?.dataset.mode === "activation") {
      pendingRecommendationPrefs = null;
      trackAnalyticsEvent("activation_tune_skipped", { title: "activation_tune_skipped:close" });
      completeActivationTune();
    }
    if (els.tuneLookDialog?.open) els.tuneLookDialog.close();
  });
  els.todayWardrobeDialogCloseBtn?.addEventListener("click", () => {
    trackAnalyticsEvent("wardrobe_prompt_dismissed", {
      title: "wardrobe_prompt_dismissed",
    });
    completeWardrobeUpgradePrompt();
    if (els.todayWardrobeDialog?.open) els.todayWardrobeDialog.close();
  });
}

function bindOnboardingUI() {
  els.onboardingSkipBtn?.addEventListener("click", () => {
    trackAnalyticsEvent("onboarding_skipped", {
      title: "onboarding_skipped:header",
      step: activeOnboardingSlide + 1,
    });
    completeOnboarding();
  });
  els.onboardingSkipFinalBtn?.addEventListener("click", () => {
    trackAnalyticsEvent("onboarding_skipped", {
      title: "onboarding_skipped:final",
      step: activeOnboardingSlide + 1,
    });
    completeOnboarding();
  });
  els.onboardingPrevBtn?.addEventListener("click", () => {
    setActiveOnboardingSlide(activeOnboardingSlide - 1);
  });
  els.onboardingNextBtn?.addEventListener("click", () => {
    setActiveOnboardingSlide(activeOnboardingSlide + 1);
  });
  // Onboarding gender pills (delegated). Save selection to prefs and move
  // visual selection state across the four pills.
  document.querySelectorAll(".onboarding-pill[data-onboarding-gender]").forEach((pill) => {
    pill.addEventListener("click", () => {
      const value = pill.getAttribute("data-onboarding-gender") || "unspecified";
      const allowed = new Set(["unspecified", "male", "female", "nonbinary"]);
      if (!allowed.has(value)) return;
      saveState({ prefs: { ...loadState().prefs, gender: value } });
      document.querySelectorAll(".onboarding-pill[data-onboarding-gender]").forEach((p) => {
        const isSelf = p === pill;
        p.classList.toggle("is-selected", isSelf);
        p.setAttribute("aria-checked", isSelf ? "true" : "false");
      });
      trackAnalyticsEvent("onboarding_gender_set", {
        title: `onboarding_gender_set:${value}`,
        gender: value,
      });
    });
  });
  els.onboardingUseLocationBtn?.addEventListener("click", () => {
    trackAnalyticsEvent("onboarding_completed", {
      title: "onboarding_completed:use_location",
      action: "use_location",
    });
    completeOnboarding();
    onUseMyLocation("onboarding");
  });
  els.onboardingSearchBtn?.addEventListener("click", () => {
    trackAnalyticsEvent("onboarding_completed", {
      title: "onboarding_completed:manual_search",
      action: "manual_search",
    });
    completeOnboarding();
    els.placeInput?.focus();
    try {
      els.placeInput?.select?.();
    } catch {}
    setStatus("Search for a city to get your first recommendation.");
  });
}

function bindWeatherDetailUI() {
  els.weatherHero?.addEventListener("click", toggleWeatherExpanded);
  els.weatherHero?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleWeatherExpanded();
  });
  els.weatherExpandedPanel?.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  els.weatherExpandToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleWeatherExpanded();
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
      els.placeInput?.blur?.();
      const loc = { name: short, lat: Number(r.lat), lon: Number(r.lon) };
      saveState({ lastQuery: "", lastLocation: loc });
      runForLocation(loc);
    });
    _acList.appendChild(btn);
  }
}

// ─── Auth UI binding ─────────────────────────────────────────
let authIsSignup = false;

function showAuthDialog(source = "generic") {
  trackAnalyticsEvent("auth_dialog_opened", {
    title: `auth_dialog_opened:${source}`,
    source,
    loggedIn: isLoggedIn(),
  });
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
        els.authUserBadge.textContent = `${provider} • ${verified} • ${getPlanSummary()}`;
      }
      if (els.authUpgradeBtn) {
        els.authUpgradeBtn.textContent = hasPremiumAccess() ? "Change Premium plan" : "Upgrade to premium";
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
  els.userBtn?.addEventListener("click", showUserMenu);
  els.todayUserBtn?.addEventListener("click", showUserMenu);
  els.userMenuCloseBtn?.addEventListener("click", () => els.userMenuDialog?.close());
  els.userMenuAccountBtn?.addEventListener("click", () => {
    els.userMenuDialog?.close();
    showAuthDialog("user_menu");
  });
  els.userMenuSettingsBtn?.addEventListener("click", () => {
    els.userMenuDialog?.close();
    switchTab("tabPrefs", { direction: 0 });
  });
  els.wardrobeAuthGateBtn?.addEventListener("click", () => showAuthDialog("wardrobe_gate"));
  els.wardrobeSignInBtn?.addEventListener("click", () => showAuthDialog("wardrobe_sign_in"));
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
      trackAnalyticsEvent("auth_started", {
        title: `auth_started:${authIsSignup ? "signup" : "login"}`,
        method: "email",
        mode: authIsSignup ? "signup" : "login",
      });
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auth failed");
      if (data.requiresVerification) {
        trackAnalyticsEvent("auth_verification_required", {
          title: `auth_verification_required:${authIsSignup ? "signup" : "login"}`,
          method: "email",
          mode: authIsSignup ? "signup" : "login",
        });
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
      trackAnalyticsEvent("auth_failed", {
        title: `auth_failed:${authIsSignup ? "signup" : "login"}`,
        method: "email",
        mode: authIsSignup ? "signup" : "login",
        reason: err?.message || "error",
      });
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
    trackAnalyticsEvent("auth_started", {
      title: "auth_started:google",
      method: "google",
      mode: authIsSignup ? "signup" : "login",
    });
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
    showAppToast("Signed out", "success");
  });
  els.authUpgradeBtn?.addEventListener("click", () => openPaywall("generic", { source: "account" }));
  els.authRestorePurchasesBtn?.addEventListener("click", restorePurchases);

  els.authDeleteBtn?.addEventListener("click", () => {
    if (!authUser) return;
    els.deleteAccountError.style.display = "none";
    els.deleteAccountPassword.value = "";
    els.deleteAccountConfirmText.value = "";
    els.deleteAccountPrompt.textContent = authUser.authProvider === "google"
      ? "Type DELETE to confirm. This permanently removes your account and synced wardrobe from WearCast."
      : "Enter your password to confirm. This permanently removes your account and synced wardrobe from WearCast.";
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
      showAppToast("Account deleted", "success");
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
        showAppToast(`Login failed: ${err.message}`, "error");
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

function bindPaywallUI() {
  document.querySelectorAll("[data-paywall-plan]").forEach((node) => {
    node.addEventListener("click", () => {
      const nextPlan = node.getAttribute("data-paywall-plan") || "annual";
      setActivePaywallPlan(nextPlan);
    });
  });
  els.paywallCloseBtn?.addEventListener("click", closePaywall);
  els.paywallSecondaryBtn?.addEventListener("click", closePaywall);
  els.paywallRestoreBtn?.addEventListener("click", () => {
    if (hasPremiumAccess()) {
      openManageSubscription();
      return;
    }
    restorePurchases();
  });
  els.paywallPrimaryBtn?.addEventListener("click", async () => {
    const trigger = els.paywallDialog?.dataset?.trigger || "generic";
    const selectedPlan = getPaywallPlanLabel(activePaywallPlan);
    trackAnalyticsEvent("paywall_cta_tapped", { title: `paywall_cta_tapped:${trigger}:${selectedPlan}` });
    if (isSelectedCurrentPremiumPlan(activePaywallPlan)) {
      showAppToast("This is your current Premium plan. Use Manage subscription to cancel or review billing.", "info");
      return;
    }
    if (!isLoggedIn()) {
      closePaywall();
      showAuthDialog();
      return;
    }
    await purchaseSelectedPlan();
  });
  els.paywallDialog?.addEventListener("close", () => {
    const trigger = els.paywallDialog?.dataset?.trigger || "generic";
    trackAnalyticsEvent("paywall_dismissed", { title: `paywall_dismissed:${trigger}` });
  });
}

// Handle Google OAuth code in URL (web flow)
window.addEventListener('DOMContentLoaded', async () => {
  await handleGoogleAuthRedirect(window.location.href, { clearBrowserUrl: true });
});

function init() {
  initBrowserSentry();
  configureNativeViewport();
  disableNativeDoubleTapZoom();
  bindClientSafetyReporting();
  bindTabNav();
  bindIOSSwipeTabs();
  bindPullToRefresh();
  setupInstallUI();
  bindConsentUI();
  bindOnboardingUI();
  bindWeatherDetailUI();
  bindPrefs();
  bindSettingsUI();
  bindRecommendationControls();
  bindWardrobeUI();
  bindAuthUI();
  bindPaywallUI();
  bindNativeGoogleAuth();
  updateAuthUI();
  trackTabOpen(getActiveTabId(), { now: Date.now() });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      flushTabDwellMetrics(getActiveTabId(), { now: Date.now() });
    } else {
      activeTabTrackedAt = Date.now();
      resetWardrobePromptSessionDismissal();
    }
  });
  window.addEventListener("beforeunload", () => flushTabDwellMetrics(getActiveTabId(), { now: Date.now() }));

  // Main empty-state CTA opens the normal add flow. Starter chips remain guided.
  els.addItemBtnEmpty?.addEventListener("click", () => openItemDialog(null));

  els.searchBtn.addEventListener("click", () => onSearch());
  els.geoBtn.addEventListener("click", () => onUseMyLocation("today"));
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

  const st = loadState();
  trackAnalyticsEvent("session_started", { title: "session_started" });
  if (!getAnalyticsState(st).firstOpenTracked) {
    trackAnalyticsEvent("first_open", { title: "first_open" });
    saveState({
      analytics: {
        ...getAnalyticsState(st),
        firstOpenTracked: true,
      },
    });
  }
  updateTodayOnboardingUI(st);
  void loadSubscriptionProducts();
  void refreshSubscriptionState({ silent: true });
  if (st.lastLocation) {
    els.placeInput.value = formatCityLevelLocation(st.lastLocation.name);
    runForLocation(st.lastLocation);
  } else if (!shouldShowOnboardingDeck(st) && consent.seen) {
    // No saved location — silently try cached/granted geolocation (no prompt)
    tryAutoGeo();
  }

  registerSW();
}

init();
