// ══════════════════════════════════════════════
// AGREGAR ESTO AL FINAL DE assets/js/workers.js
// o en un archivo nuevo: assets/js/fcm.js
// ══════════════════════════════════════════════

// Tu VAPID key de Firebase (la que se ve en Certificados push web)
var VAPID_KEY = 'BDx6vMcUbr1y1vt5T2f_uZo3qR7lasoRAgrj_1ceXIYqlemKi_bzUWowkCGuqKWmt-64xwsFvQDPwR79xuYTYh0';

// Registrar token FCM del trabajador actual
async function registerFCMToken() {
  // Solo registrar si hay un trabajador logueado
  if (!DB || !DB.currentWorker) return;

  try {
    // Pedir permiso de notificaciones
    var permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permiso de notificaciones denegado');
      return;
    }

    // Importar Firebase SDK (añadido via CDN en index.html)
    if (typeof firebase === 'undefined') return;

    var messaging = firebase.messaging();

    // Obtener token FCM
    var token = await messaging.getToken({ vapidKey: VAPID_KEY });

    if (!token) return;

    // Guardar token en el trabajador actual
    var bizId    = DB.currentWorker.bizId;
    var workerId = DB.currentWorker.workerId;
    var biz      = DB.businesses.filter(function(b) { return b.id === bizId; })[0];
    if (!biz) return;

    var worker = (biz.workers || []).filter(function(w) { return w.id === workerId; })[0];
    if (!worker) return;

    // Solo actualizar si el token cambió
    if (worker.fcmToken === token) return;

    worker.fcmToken = token;
    saveDB();

    console.log('✅ FCM Token registrado para:', worker.name);

  } catch (err) {
    console.error('Error registrando FCM token:', err);
  }
}

// Llamar al registrar cuando el trabajador inicia sesión
// Esta función se llama desde showWorkerPanel() en workers.js
window.registerFCMToken = registerFCMToken;