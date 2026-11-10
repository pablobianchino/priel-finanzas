// Service worker: "network-first". Siempre intenta traer la versión más nueva de la red
// (revalidando contra el servidor) y solo usa la copia guardada si no hay conexión.
// Así una versión nueva llega apenas se publica, sin tener que subir números de caché a mano.
const CACHE_NAME = 'finanzas-priel';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './version.json',
  './js/app.js',
  './js/logica.js',
  './js/firebase.js',
  './vistas/resumen.js',
  './vistas/gastos.js',
  './vistas/ingresos.js',
  './vistas/ahorros.js',
  './vistas/estadisticas.js',
  './vistas/modales.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache.map(u => new Request(u, { cache: 'reload' })))).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Solo GET del mismo origen; Firebase, Google y CDNs no se tocan
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const copia = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
