// ── HERRAMIENTA DE CAMPO — Service Worker ──────────
const CACHE_NAME = 'campo-v1';
const MAP_CACHE  = 'campo-tiles-v1';

// Archivos del app que siempre se cachean
const APP_ASSETS = [
  './rutas.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap',
];

// ── INSTALL: cachea los archivos principales ────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpia cachés viejos ──────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== MAP_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia por tipo de recurso ──────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Tiles del mapa (OpenStreetMap / CartoDB) → Cache first, luego red
  if (
    url.hostname.includes('basemaps.cartocdn.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('a.tile') ||
    url.hostname.includes('b.tile') ||
    url.hostname.includes('c.tile')
  ) {
    event.respondWith(
      caches.open(MAP_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request)
            .then(response => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  // App assets (HTML, JS, CSS, fuentes) → Cache first
  if (
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    event.request.url.includes('rutas.html') ||
    event.request.url.includes('manifest.json')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // Todo lo demás → red primero, caché de respaldo
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
