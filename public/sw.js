// Light PWA service worker — enables install, no aggressive caching.
// The app always loads fresh from Vercel on each visit.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
