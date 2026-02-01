// WearCast Service Worker
// Goal: when a newer version is available, update cached assets and reload clients.

const VERSION = "v3";
const CACHE = `wearcast-${VERSION}`;

// Cache-busted asset URLs so clients don't get stuck on old JS/CSS.
const ASSETS = [
  `./index.html?v=${VERSION}`,
  `./styles.css?v=${VERSION}`,
  `./app.js?v=${VERSION}`,
  `./manifest.webmanifest?v=${VERSION}`,
  `./icon.svg?v=${VERSION}`,
  "./.nojekyll"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Force revalidation during install to avoid keeping stale assets.
      await cache.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))));
      await self.clients.claim();

      // Tell open pages to reload so they pick up the new version.
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) client.postMessage({ type: "WEARCAST_UPDATED" });
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== location.origin) return; // never cache API calls

  // Network-first for navigations (HTML) so the shell updates quickly.
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          const cache = await caches.open(CACHE);
          cache.put(`./index.html?v=${VERSION}`, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(`./index.html?v=${VERSION}`);
          return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })()
    );
    return;
  }

  // Stale-while-revalidate for same-origin static assets.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      return cached || (await fetchPromise) || new Response("Offline", { status: 503 });
    })()
  );
});
