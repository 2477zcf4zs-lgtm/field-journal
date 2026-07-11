/* Field Journal — Service Worker (Phase 0)
 *
 * Responsibilities:
 *  - Precache the full app shell on install so the app opens instantly offline.
 *  - Delete stale caches on activate (cache-version constant below).
 *  - Serve the shell cache-first; fall back to the network.
 *  - Support the in-app "update available" banner via a SKIP_WAITING message.
 *
 * UPDATE FLOW / TESTING:
 *  Bump CACHE_VERSION (and APP_VERSION in index.html to match) and redeploy.
 *  The new worker installs but WAITS; index.html detects it and shows the
 *  "A new version is available" banner. Tapping it posts SKIP_WAITING here,
 *  which activates the new worker; index.html then reloads on controllerchange.
 */

const CACHE_VERSION = 'field-journal-v0.7.1';
const CACHE_NAME = CACHE_VERSION;

// Everything needed to boot the app shell fully offline.
// Keep this list in sync with the files that actually exist.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  // Do NOT skipWaiting here — we wait for the user to tap the update banner.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // { cache: 'reload' } bypasses the browser HTTP cache so a freshly
      // installing worker never precaches a stale (still-cached) app shell.
      cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' })))
    ).catch((err) => {
      // addAll is atomic: one 404 kills the whole install silently. Surface it.
      console.error('[sw] precache failed — update will not proceed:', err);
      throw err;
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GET requests. Everything else (POST, cross-origin
  // tiles/weather/geocoding in later phases) goes straight to the network.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // All lookups are scoped to the CURRENT cache. The global caches.match()
  // searches every cache oldest-first, so during the brief window between
  // controllerchange (reload) and the activate handler finishing its old-cache
  // cleanup, it could serve the previous version. Scoping avoids that race.

  // App-shell navigations: serve index.html from the current cache so the app
  // launches offline; fall back to the network, then to the cached root.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then((c) =>
        c.match('./index.html').then(
          (cached) => cached || fetch(req).catch(() => c.match('./'))
        )
      )
    );
    return;
  }

  // Static assets: current-cache-first, then network.
  event.respondWith(
    caches.open(CACHE_NAME).then((c) =>
      c.match(req).then((cached) => cached || fetch(req))
    )
  );
});
