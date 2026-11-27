// Service worker. Bump CACHE with VERSION in app.js on every release.
const CACHE = "cooking-app-v1";
const SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./search.js",
  "./data/recipes.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // cache: 'reload' so the new cache never fills from a stale browser/CDN copy.
      cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" })))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // Keep the recipe data fresh: update its cached copy when online.
        if (req.url.includes("/data/recipes.json") && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
    })
  );
});
