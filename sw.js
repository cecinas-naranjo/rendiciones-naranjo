// Service Worker — Rendiciones Naranjo
// Cachea solo el "esqueleto" de la app para que abra rápido. Los datos siempre van a Apps Script en vivo.
// Estrategia NETWORK-FIRST: con internet siempre se usa la versión más nueva subida a GitHub.
// Al cambiar archivos, subir el número de versión de CACHE_NAME.
const CACHE_NAME = 'naranjo-shell-v6';
const APP_SHELL = ['./', './index.html', './style.css', './config.js', './app.js', './manifest.json',
  './logo.png', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const fresh = await fetch(e.request);
      if (fresh && fresh.status === 200) cache.put(e.request, fresh.clone());
      return fresh;
    } catch (err) {
      return (await cache.match(e.request)) || new Response('<h1>Sin conexión</h1><p>Conéctate a internet para usar la app.</p>',
        { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
    }
  })());
});
