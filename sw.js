// Service Worker — Rendiciones Naranjo
// Guarda el "esqueleto" de la app en el teléfono para que abra al instante, sin esperar a internet.
// Al subir una versión nueva a GitHub, se descarga por detrás y queda activa la siguiente vez que se abre la app.
// Al cambiar archivos, subir el número de versión de CACHE_NAME.
const CACHE_NAME = 'naranjo-shell-v20';
const APP_SHELL = ['./', './index.html', './style.css', './config.js', './app.js', './manifest.json',
  './logo-96.png', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  // La app abre al instante desde el teléfono y por detrás se baja la versión nueva (queda lista para la próxima vez).
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const guardada = await cache.match(e.request, { ignoreSearch: true });
    const nueva = fetch(e.request).then(r => { if (r && r.status === 200) cache.put(e.request, r.clone()); return r; }).catch(() => null);
    if (guardada) { e.waitUntil(nueva); return guardada; }
    return (await nueva) || new Response('<h1>Sin conexión</h1><p>Conéctate a internet para usar la app.</p>',
      { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
  })());
});
