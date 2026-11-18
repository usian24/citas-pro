// sw.js — Service Worker Citas Pro
const CACHE = 'citaspro-v3';

const PRECACHE = [
  '/',
  '/index.html',
  '/assets/img/image.png',
  '/assets/img/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE).catch(function () {});
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
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  // No interceptar peticiones que no sean GET (POST, PUT, DELETE)
  if (e.request.method !== 'GET') return;

  // Solo cachear peticiones del mismo origen (ignorar APIs y terceros)
  var url = e.request.url || '';
  if (url.indexOf(self.location.origin) !== 0 || url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var resClone = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(e.request, resClone).catch(function () {});
          });
        }
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