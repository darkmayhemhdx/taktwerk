/* Taktwerk – offline nutzbar: erst Netz, sonst Zwischenspeicher */
const CACHE = 'taktwerk-v1794578230';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png',
  'js/data.js', 'js/dsp.js', 'js/engine.js', 'js/presets.js', 'js/seq.js', 'js/ui.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
