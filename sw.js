/* Entreno Alex — Service Worker
   Estrategia cache-first para HTML y assets CDN.
   Permite usar la app sin cobertura (sótano del gym, etc.).
*/
const VERSION = 'entreno-alex-v6';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  'https://cdn.tailwindcss.com?plugins=forms',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(VERSION).then((c) =>
      Promise.all(
        CORE.map((u) =>
          fetch(new Request(u, { cache: 'reload', mode: u.startsWith('http') ? 'cors' : 'same-origin' }))
            .then((res) => { if (res && (res.ok || res.type === 'opaque')) return c.put(u, res.clone()); })
            .catch(() => {})
        )
      )
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Para navegaciones HTML: network-first con fallback al cache (así el usuario coge actualizaciones cuando hay red).
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((m) => m || caches.match('./')))
    );
    return;
  }

  // Para todo lo demás: cache-first, refresca cache en background si hay red.
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
