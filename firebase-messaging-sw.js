importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDgZrfTP-6W0gZNUrqa8woorpxxqJ-tNcs",
  authDomain: "citas-pro-36cb7.firebaseapp.com",
  projectId: "citas-pro-36cb7",
  storageBucket: "citas-pro-36cb7.firebasestorage.app",
  messagingSenderId: "879441672967",
  appId: "1:879441672967:web:c62100a23801f3033d63a2"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/assets/img/icon-192.png',
    tag: payload.data?.tag || 'citaspro'
  });
});