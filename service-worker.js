// service-worker.js — network-first with an offline app-shell cache.
// Bump CACHE_VERSION on ANY change to a shipped file.

const CACHE_VERSION = "v34";
const CACHE_NAME = `invincible-player-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png",
  "./icon-maskable-512.png",
  "./data.js",
  "./data-npcs.js",
  "./data-monsters.js",
  "./data-pregens.js",
  "./data-solo.js",
  "./data-tutorial.js",
  "./firebase-config.js",
  "./src/main.js",
  "./src/core.js",
  "./src/ui.js",
  "./src/rules.js",
  "./src/derived.js",
  "./src/settings.js",
  "./src/store.js",
  "./src/sync.js",
  "./src/wizard.js",
  "./src/roller.js",
  "./src/sheet.js",
  "./src/combat.js",
  "./src/power-automation.js",
  "./src/solo.js",
  "./src/learn.js",
  "./src/gm.js",
  "./src/screens.js",
  "./src/router.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never cache Firebase or CDN traffic

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("./index.html"))));
});
