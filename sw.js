/* ENJAZ service worker. Bump VERSION on each release. */
const VERSION = 'enjaz-v3';
const SHELL = VERSION + '-shell', RUNTIME = VERSION + '-rt';
const PRECACHE = ['./', './index.html', './offline.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const CDN = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']; // public static assets only

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function swr(req, cacheName) {
  return caches.open(cacheName).then(c => c.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                    // never touch POSTs (the Apps Script API / user data)
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === 'navigate') {                     // network-first: new releases are never stuck behind the cache
      e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(SHELL).then(c => c.put('./index.html', r.clone())); return r; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./offline.html'))));
      return;
    }
    e.respondWith(swr(req, SHELL)); return;
  }
  if (CDN.includes(url.hostname)) { e.respondWith(swr(req, RUNTIME)); return; }
  // everything else (script.google.com, googleusercontent, ...) goes straight to the network, uncached
});
