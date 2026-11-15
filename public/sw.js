// Service worker: gør portalen installérbar og lader app-skallen åbne uden net.
// API-kald går altid til serveren (ingen gamle data fra cachen).
const CACHE = 'marnav-portal-v3';
const SHELL = ['/', '/index.html', '/styles.css', '/shared/formula.js', '/shared/diff.js', '/icons.js', '/markdown.js', '/formulas.js', '/books.js', '/legal.js', '/assistant.js', '/admin.js', '/studio.js', '/dashboard.js', '/app.js', '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // Netværk først (så lærernes opdateringer af appen slår igennem), cache som reserve.
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html'))));
});
