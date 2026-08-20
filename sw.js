const CACHE_NAME = 'finanzas-priel-v2.0.1'; // Versión actualizada
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/js/app.js',
  '/js/logica.js',
  '/js/firebase.js',
  '/vistas/resumen.js',
  '/vistas/gastos.js',
  '/vistas/ingresos.js',
  '/vistas/ahorros.js',
  '/vistas/estadisticas.js',
  '/vistas/modales.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

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

self.addEventListener('fetch', event => {
  // SOLUCIÓN: Solo guardar en caché peticiones GET (Firebase usa POST y tira error si intentamos cachearlo)
  if (event.request.method !== 'GET') return;

  // Ignorar extensiones del navegador y peticiones externas raras
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
