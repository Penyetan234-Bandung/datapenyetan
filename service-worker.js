// Service worker Penyetan 234 — cache aset aplikasi agar bisa dipakai offline.
// Naikkan VERSION setiap kali ada perubahan berkas agar pengguna mendapat pembaruan.
const VERSION = 'v1.3.0';
const CACHE = `penyetan234-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/calc.js',
  './js/util.js',
  './js/charts.js',
  './js/pages/home.js',
  './js/pages/orders.js',
  './js/pages/menu.js',
  './js/pages/customers.js',
  './js/pages/summary.js',
  './js/pages/more.js',
  './js/pages/expenses.js',
  './js/pages/overtime.js',
  './js/pages/reservations.js',
  './js/pages/settings.js',
  './js/pages/backup.js',
  './js/pages/info.js',
  './icons/logo-320.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('penyetan234-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
