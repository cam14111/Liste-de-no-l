const CACHE_NAME = "xmas-gifts-cache-v5";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./charts.js",
  "./manifest.json",
  "./vendor/chart.umd.min.js",
  "./vendor/space-grotesk-latin.woff2",
  "./vendor/space-grotesk-latin-ext.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event.request));
  } else {
    event.respondWith(networkWithCache(event.request));
  }
});

/**
 * Réponse immédiate depuis le cache (rapidité + hors-ligne), mise à jour en
 * arrière-plan depuis le réseau : les nouvelles versions de l'app sont
 * récupérées automatiquement et servies au chargement suivant.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  const response = await network;
  if (response) return response;
  // Navigation hors-ligne vers une URL non précachée : sert l'app.
  if (request.mode === "navigate") {
    const fallback = await cache.match("./index.html");
    if (fallback) return fallback;
  }
  return Response.error();
}

async function networkWithCache(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}
