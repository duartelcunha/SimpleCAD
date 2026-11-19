/* SimpleCAD Offline-First Service Worker (Zero external dependencies) */
const CACHE_NAME = 'simplecad-offline-v37';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css?v=37',
  './default-room.js?v=37',
  './project-data.js?v=37',
  './app.js?v=37',
  './icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: false }).then((cached) =>
          cached || caches.match(req, { ignoreSearch: true }) || caches.match('./index.html')
        )
      )
  );
});
