const prefix = 'jh3-orcamentos-';
const cacheName = prefix + 'v1';
const files = ['./', './style.css', './app.mjs', './calc.mjs', './manifest.webmanifest', './logo.webp', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => name.startsWith(prefix) && name !== cacheName).map(name => caches.delete(name))
  )));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(cacheName).then(async cache => {
    const request = event.request;
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
      } catch {}
      return (await cache.match('./')) || Response.error();
    }
    return (await cache.match(request)) || fetch(request);
  }));
});
