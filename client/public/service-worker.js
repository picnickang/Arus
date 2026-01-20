/**
 * ARUS Service Worker
 * Provides offline functionality and background sync
 */

const CACHE_NAME = "arus-v1";
const RUNTIME_CACHE = "arus-runtime";
const API_CACHE = "arus-api";

// Resources to cache on install
const PRECACHE_URLS = ["/", "/index.html", "/manifest.json"];

// Install event - cache core resources
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Precaching core resources");
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== API_CACHE
            )
            .map((cacheName) => {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API requests - Network first, fallback to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET requests
          if (request.method === "GET" && response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache for GET requests
          if (request.method === "GET") {
            return caches.match(request);
          }
          // Return error for POST/PUT/DELETE when offline
          return new Response(
            JSON.stringify({ error: "Offline - request will sync when online" }),
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "application/json" },
            }
          );
        })
    );
    return;
  }

  // Static assets - Cache first, fallback to network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // Cache successful responses
        if (response && response.status === 200 && response.type !== "error") {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});

// Background sync for offline data
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync:", event.tag);

  if (event.tag === "sync-telemetry") {
    event.waitUntil(syncTelemetryData());
  }
});

async function syncTelemetryData() {
  console.log("[SW] Syncing telemetry data...");
  // This would sync any offline data to the server
  // For now, just a placeholder
  return Promise.resolve();
}

// Handle push notifications (future feature)
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received");

  const data = event.data ? event.data.json() : {};
  const title = data.title || "ARUS Notification";
  const options = {
    body: data.body || "New alert from ARUS",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "arus-notification",
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked");
  event.notification.close();

  event.waitUntil(clients.openWindow(event.notification.data.url || "/"));
});

console.log("[SW] Service worker loaded");
