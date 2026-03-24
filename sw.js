const CACHE_NAME = 'devbrain-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/theme.css',
  './js/concepts.js',
  './js/db.js',
  './js/adaptive.js',
  './js/router.js',
  './js/app.js',
  './views/home.js',
  './views/concept-map.js',
  './views/learn.js',
  './views/quiz.js',
  './views/results.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
