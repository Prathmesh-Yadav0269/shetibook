// ShetiBook Service Worker (PWA Shell Caching)
// Cache Versioning: Increment on static asset changes
const CACHE_NAME = 'shetibook-shell-v1';

// Static Shell Assets to Cache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
];

// Install: Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Strategy
// 1. API Requests (/api/v1/): NETWORK ONLY (Never cache sensitive financial/auth data in SW cache)
// 2. Static Assets (JS, CSS, Images, HTML): Stale-While-Revalidate / Cache First with fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // STRICT SECURITY RULE: Never intercept or cache API requests in Service Worker cache.
  // API requests use HTTP-only session cookies and anti-CSRF headers; cached by IndexedDB instead.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Non-GET requests (POST, PUT, DELETE) pass straight to network
  if (event.request.method !== 'GET') {
    return;
  }

  // App Shell Navigation & Static Assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and requesting navigation, return cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
