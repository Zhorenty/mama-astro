/* Мамина Астролябия — service worker: offline shell, fresh HTML when online */
const VERSION = 'astro-74398c150b';
const SCOPE = self.registration.scope;
const CORE = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-48.png'];
const CDN = ['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js'];
const NETWORK_ONLY = /supabase\.co|open-meteo\.com/;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    await Promise.all(CDN.map(u => fetch(u, { mode: 'no-cors' }).then(r => c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || NETWORK_ONLY.test(req.url)) return;

  // Pages: always try the network first so updates arrive at once; fall back to the cached copy offline.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const fresh = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
        if (fresh.ok) c.put(SCOPE, fresh.clone());
        return fresh;
      } catch (err) {
        return (await c.match(SCOPE)) || (await c.match(req, { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }

  // Scripts, fonts, icons: serve from cache instantly, refresh in the background.
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req, { ignoreSearch: req.url.startsWith(SCOPE) });
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  })());
});
