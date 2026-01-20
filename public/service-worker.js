// ARUS Marine PWA Service Worker
// Provides offline capabilities, caching, and background sync

// Force self-destruct in development mode
const isDev = self.location.hostname.includes('replit') || 
              self.location.hostname === 'localhost' || 
              self.location.hostname === '127.0.0.1' ||
              self.location.port === '5000';

if (isDev) {
  console.log('[SW] Development mode detected - clearing all caches and unregistering');
  // Clear all caches to ensure fresh content
  caches.keys().then(cacheNames => {
    cacheNames.forEach(cacheName => {
      caches.delete(cacheName);
      console.log('[SW] Deleted cache:', cacheName);
    });
  });
  // Unregister this service worker
  self.registration.unregister().then(() => {
    console.log('[SW] Service worker unregistered in development mode');
  });
}

const CACHE_NAME = 'arus-marine-v2';
const STATIC_CACHE_NAME = 'arus-static-v2';
const DYNAMIC_CACHE_NAME = 'arus-dynamic-v2';

// Assets to cache immediately on install
// NOTE: DO NOT cache '/' as it causes stale HTML issues during development
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// API endpoints to cache for offline access
const API_CACHE_PATTERNS = [
  '/api/dashboard',
  '/api/equipment/health',
  '/api/fleet/overview',
  '/api/devices',
  '/api/work-orders',
  '/api/alerts'
];

// Maximum cache age in milliseconds (24 hours)
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        const deletePromises = cacheNames
          .filter(cacheName => 
            cacheName !== STATIC_CACHE_NAME && 
            cacheName !== DYNAMIC_CACHE_NAME
          )
          .map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          });
        
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension URLs
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Skip caching in development mode (Replit environment or localhost)
  const isDev = url.hostname.includes('replit') || 
                url.hostname === 'localhost' || 
                url.hostname === '127.0.0.1' ||
                url.port === '5000';
  if (isDev) {
    event.respondWith(fetch(request));
    return;
  }
  
  // Handle different request types
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
  } else if (isAPIRequest(request)) {
    event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE_NAME));
  } else if (isNavigationRequest(request)) {
    event.respondWith(networkFirstWithOfflineFallback(request));
  } else {
    event.respondWith(fetch(request));
  }
});

// Background sync for work orders and alerts
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'workorder-sync') {
    event.waitUntil(syncWorkOrders());
  } else if (event.tag === 'alert-sync') {
    event.waitUntil(syncAlerts());
  }
});

// Push notifications for critical alerts
self.addEventListener('push', event => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.message,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'arus-alert',
      data: data.data,
      actions: [
        {
          action: 'view',
          title: 'View Details',
          icon: '/icon-192x192.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icon-192x192.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'ARUS Marine Alert', options)
    );
  } catch (error) {
    console.error('[SW] Failed to process push notification:', error);
  }
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view') {
    const url = event.notification.data?.url || '/';
    event.waitUntil(
      self.clients.openWindow(url)
    );
  }
});

// Helper functions

function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.includes('/static/') || 
         url.pathname.includes('/assets/') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.png') ||
         url.pathname.endsWith('.ico');
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') &&
         API_CACHE_PATTERNS.some(pattern => url.pathname.startsWith(pattern));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first strategy failed:', error);
    throw error;
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.log('[SW] Network failed for navigation, serving offline page');
    
    const cache = await caches.open(STATIC_CACHE_NAME);
    const offlineResponse = await cache.match('/');
    
    if (offlineResponse) {
      return offlineResponse;
    }
    
    throw error;
  }
}

async function syncWorkOrders() {
  try {
    // TODO: Implement background sync for work orders
    // This function is called when background sync event fires
    // Implementation needed:
    // 1. Get pending work order updates from IndexedDB
    // 2. Send to API server
    // 3. Update local cache on success
    // 4. Remove from pending queue
    console.log('[SW] Background sync for work orders (not yet implemented)');
  } catch (error) {
    console.error('[SW] Work order sync failed:', error);
  }
}

async function syncAlerts() {
  try {
    // TODO: Implement background sync for alerts
    // This function is called when background sync event fires
    // Implementation needed:
    // 1. Get pending alert updates from IndexedDB
    // 2. Send to API server
    // 3. Update local cache on success
    // 4. Remove from pending queue
    console.log('[SW] Background sync for alerts (not yet implemented)');
  } catch (error) {
    console.error('[SW] Alert sync failed:', error);
  }
}