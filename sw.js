const CACHE_NAME = 'finanzas-priel-v3'; // Cuando hagas un cambio MUY grande, cambias a v3, v4, etc.
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instala el Service Worker y fuerza la actualización inmediata
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Activa y limpia cachés de versiones anteriores
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: Network First (Red primero, fallback a caché si falla)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si hay conexión, actualiza la caché silenciosamente con la versión más reciente
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        // Si no hay conexión (offline), usa la versión guardada en caché
        return caches.match(event.request);
      })
  );
});
