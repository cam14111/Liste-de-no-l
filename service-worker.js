const CACHE_NAME = "xmas-gifts-cache-v6";
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
    event.respondWith(cacheFirst(event.request));
  } else {
    event.respondWith(networkWithCache(event.request));
  }
});

/**
 * Cache-first pour les assets de l'app (rapide, zéro réseau hors-ligne). Les
 * mises à jour arrivent via le changement de CACHE_NAME : le nouveau service
 * worker pré-cache tous les assets à l'installation puis prend le contrôle
 * (skipWaiting + clients.claim), servant la version à jour au chargement
 * suivant — sans re-télécharger la coquille à chaque ouverture ni risquer de
 * mélanger d'anciens et de nouveaux fichiers.
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Navigation hors-ligne vers une URL non précachée (ex: lien de partage
    // #s=…) : on sert la coquille de l'app.
    if (request.mode === "navigate") {
      const fallback = await cache.match("./index.html");
      if (fallback) return fallback;
    }
    throw err;
  }
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
