const CACHE_NAME = "macrofinder-cache-v2";
const APP_SHELL = [
  "/",
  "/discover",
  "/manifest.webmanifest",
  "/offline.html",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/pwa-192.png",
  "/pwa-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => null),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const pathname = requestUrl.pathname;
  const isApiRequest =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/items") ||
    pathname.startsWith("/restaurants") ||
    pathname.startsWith("/management") ||
    pathname.startsWith("/owner") ||
    pathname.startsWith("/uploads");

  if (isApiRequest) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
    return;
  }

  const isStyleOrScript =
    request.destination === "style" || request.destination === "script";
  if (isStyleOrScript) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  const cacheableDestinations = ["image", "font"];
  if (cacheableDestinations.includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return networkResponse;
        });
      }),
    );
  }
});
