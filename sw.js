// sw.js — Service Worker Citas Pro
const CACHE = 'citaspro-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/assets/css/styles.css',
  '/assets/js/db.js',
  '/assets/js/auth.js',
  '/assets/js/biz.js',
  '/assets/js/workers.js',
  '/assets/js/notifications.js',
  '/assets/js/finanzas-realdata.js',
  '/assets/js/realtime.js',
  '/assets/js/client-portal.js',
  '/assets/js/app.js',
  '/assets/img/icon-192.png',
  '/assets/img/icon-512.png'
];

// Instalar y cachear archivos principales
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE);
    })
  );
  self.skipWaiting();
});

// Activar y limpiar caches viejos
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: Network first, cache fallback
self.addEventListener('fetch', function(e) {
  // No interceptar llamadas a Supabase ni APIs externas
  if (e.request.url.includes('supabase.co') ||
      e.request.url.includes('api.imgbb.com') ||
      e.request.url.includes('api.qrserver.com') ||
      e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(function(res) {
        // Guardar respuesta en cache
        var resClone = res.clone();
        caches.open(CACHE).then(function(cache) {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(function() {
        // Sin internet → usar cache
        return caches.match(e.request);
      })
  );
});

// Notificaciones push
self.addEventListener('push', function(e) {
  var data = e.data ? e.data.json() : {};
  var title = data.title || 'Citas Pro';
  var options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: '/assets/img/icon-192.png',
    badge: '/assets/img/icon-192.png',
    vibrate: [200, 100, 200],
    data: data
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Click en notificación → abrir app
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.openWindow('/')
  );
});