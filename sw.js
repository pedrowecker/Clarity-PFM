// ═══════════════════════════════════════════════════════════════════
//  Clarity PWA — Service Worker — build 23Aug2026-9
//  Cache-first para assets locais, network-first para CDN externos.
// ═══════════════════════════════════════════════════════════════════

const CACHE_NAME = 'clarity-v14';

// Ficheiros locais — sempre em cache
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// CDN externos — tentamos cache; se falhar usamos o que temos
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap',
];

// ── Install: pré-cache dos assets locais ─────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Assets locais: obrigatórios
      await cache.addAll(LOCAL_ASSETS);
      // CDN: tenta em background, não bloqueia install
      CDN_ASSETS.forEach(url => {
        fetch(url).then(res => {
          if (res.ok) cache.put(url, res);
        }).catch(() => {});
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: remove caches antigos ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: estratégia por tipo de recurso ────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignora requests não-GET
  if (event.request.method !== 'GET') return;

  // Para assets locais: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Para CDN e fontes: cache-first com fallback a network
  if (
    url.hostname.includes('cloudflare') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // Offline e não temos cache: retorna resposta vazia (a app continua a funcionar sem gráficos de fonte)
          return new Response('', { status: 408, statusText: 'Offline' });
        });
      })
    );
    return;
  }
});
