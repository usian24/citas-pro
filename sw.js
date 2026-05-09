// sw.js — Service Worker Citas Pro
const CACHE = 'citaspro-v2';

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
  '/assets/js/fcm.js',
  '/assets/js/app.js',
  '/assets/img/image.png',
  '/assets/img/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  // No interceptar peticiones que no sean GET (POST, PUT, DELETE)
  if (e.request.method !== 'GET') return;

  // Ignorar APIs externas, telemetría de Google y herramientas de Vercel
  if (e.request.url.includes('supabase.co') ||
    e.request.url.includes('api.imgbb.com') ||
    e.request.url.includes('api.qrserver.com') ||
    e.request.url.includes('gstatic.com') ||
    e.request.url.includes('googleapis.com') ||
    e.request.url.includes('country.is') ||
    e.request.url.includes('google.com') ||
    e.request.url.includes('translate') ||
    e.request.url.includes('vercel.live') ||
    e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        var resClone = res.clone();
        caches.open(CACHE).then(function (cache) {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(function () {
        return caches.match(e.request).then(function (cachedResponse) {
          return cachedResponse || Response.error();
        });
      })
  );
});

self.addEventListener('push', function (e) {
  var data = e.data ? e.data.json() : {};
  var title = data.title || 'Citas Pro';
  var options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: '/assets/img/image.png',
    badge: '/assets/img/image.png',
    vibrate: [200, 100, 200],
    data: data
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});