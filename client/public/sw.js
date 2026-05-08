// Minimal service worker — satisfies PWA installability requirements.
// No caching: LiveStudio requires a live server connection to function.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Pass all fetches straight to the network.
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
