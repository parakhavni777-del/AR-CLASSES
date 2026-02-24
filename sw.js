const CACHE_NAME = 'ar-classes-v3-20260224';
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './faculty.html',
  './student.html',
  './parent.html',
  './manifest.webmanifest',
  './logo.jpg.jpeg',
  './assets/css/index.css',
  './assets/css/admin.css',
  './assets/css/faculty.css',
  './assets/css/student.css',
  './assets/css/parent.css',
  './assets/css/ui.css',
  './assets/js/ui.js',
  './assets/js/index.js',
  './assets/js/admin.js',
  './assets/js/faculty.js',
  './assets/js/student.js',
  './assets/js/parent.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const reqUrl = new URL(req.url);

  // Never cache cross-origin/API traffic (e.g. Supabase). Always go network.
  if (reqUrl.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

  const isAppShellRequest =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    req.destination === 'script' ||
    req.destination === 'style';

  if (isAppShellRequest) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('Offline resource unavailable', { status: 503 });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return resp;
        })
        .catch(() => new Response('Offline resource unavailable', { status: 503 }));
    })
  );
});
