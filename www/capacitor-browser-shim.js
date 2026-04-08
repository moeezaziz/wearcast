// Capacitor Browser plugin shim for web/Capacitor environments
export async function openInAppBrowser(url) {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
    // Capacitor native
    await window.Capacitor.Plugins.Browser.open({ url });
  } else {
    // Fallback for web
    window.open(url, "_blank");
  }
}
