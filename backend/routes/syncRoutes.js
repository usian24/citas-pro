const express = require('express');
const webpush = require('web-push');
const supabase = require('../db');

const router = express.Router();

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:soporte@citasproonline.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn("VAPID Keys not provided, webpush disabled");
}

// ── Helper: enviar push a un worker ──
async function enviarPushWorker(supabase, worker_id, title, body) {
  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('worker_id', worker_id);

    if (!subs || subs.length === 0) return;

    var payload = JSON.stringify({ title, body });
    for (var sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
      } catch (e) {
        if (e.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('worker_id', worker_id);
        }
      }
    }
  } catch (e) {
    console.error('Error enviando push:', e.message);
  }
}

// ═══════════════════════════════════════
// GET — Cargar notificaciones de un worker
// ═══════════════════════════════════════
router.get('/sync', async (req, res) => {
  const worker_id = req.query.worker_id;
  if (!worker_id) return res.status(400).json({ error: 'worker_id requerido' });

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('worker_id', worker_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════
// POST — Manejar sincronización general
// ═══════════════════════════════════════
router.post('/sync', async (req, res) => {
  try {
    const { type } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, error: 'Falta el campo "type"' });
    }

    // ═══════════════════════════════════════
    // NOTIFICATION — type: "notification"
    // ═══════════════════════════════════════
    if (type === 'notification') {
      const { worker_id, business_id, msg, detail } = req.body;
      const notifType = req.body.type_notif || req.body.notif_type || 'new_booking';

      if (!worker_id || !business_id) {
        return res.status(400).json({ success: false, error: 'Faltan worker_id o business_id' });
      }

      // 🛡️ ESCUDO ANTI-DUPLICADOS: El backend ya crea estas notificaciones automáticamente.
      // Si un frontend desactualizado (caché) intenta crearlas, las ignoramos silenciosamente.
      if (notifType === 'new_booking' || notifType === 'booking_modify' || notifType === 'booking_cancel') {
        return res.status(200).json({ success: true, ignored: true });
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      try {
        await supabase
          .from('notifications')
          .delete()
          .lt('created_at', sevenDaysAgo.toISOString());
      } catch (e) { }

      const { error } = await supabase
        .from('notifications')
        .insert({
          worker_id: worker_id,
          business_id: business_id,
          type: notifType,
          msg: msg || '',
          detail: detail || '',
          read: false
        });

      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    // ═══════════════════════════════════════
    // LIMPIAR TODAS LAS NOTIFICACIONES
    // ═══════════════════════════════════════
    if (type === 'clear_notifications') {
      const { worker_id } = req.body;
      if (!worker_id) {
        return res.status(400).json({ success: false, error: 'Falta worker_id' });
      }
      const { error } = await supabase.from('notifications').delete().eq('worker_id', worker_id);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    // ═══════════════════════════════════════
    // ELIMINAR NOTIFICACIÓN INDIVIDUAL
    // ═══════════════════════════════════════
    if (type === 'delete_notification') {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Falta el ID' });
      }
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    // ═══════════════════════════════════════
    // APPOINTMENTS — type: "appointments"
    // ═══════════════════════════════════════
    if (type === 'appointments') {
      const { business_id, appointments } = req.body;
      if (!business_id || !Array.isArray(appointments)) {
        return res.status(400).json({ success: false, error: 'Datos incompletos' });
      }

      var apptErrors = [];

      for (const appt of appointments) {
        if (appt.status === 'cancelled' && appt.token) {
          const { error } = await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('token', appt.token)
            .eq('business_id', business_id);

          if (error) {
            apptErrors.push({ id: appt.id, msg: error.message });
          }
          continue;
        }

        const { data: enSupabase } = await supabase
          .from('appointments')
          .select('status')
          .eq('id', String(appt.id))
          .single();

        if (enSupabase && enSupabase.status === 'cancelled') {
          continue;
        }

        if (appt.status === 'rescheduled' && appt.token) {
          await supabase
            .from('appointments')
            .delete()
            .eq('token', appt.token)
            .eq('business_id', business_id)
            .neq('id', String(appt.id));
        }

        const esNueva = !enSupabase && appt.status === 'confirmed';
        const esReagendada = appt.status === 'rescheduled' && !!enSupabase;

        // 🛡️ PREVENCIÓN DE DOBLE RESERVA (RACE CONDITION)
        if (appt.status !== 'cancelled') {
          const { data: conflict } = await supabase
            .from('appointments')
            .select('id')
            .eq('business_id', business_id)
            .eq('worker_id', appt.worker_id || '')
            .eq('date', appt.date)
            .eq('time', appt.time)
            .neq('status', 'cancelled')
            .neq('id', String(appt.id))
            .limit(1);

          if (conflict && conflict.length > 0) {
            apptErrors.push({ id: appt.id, msg: 'El horario de las ' + appt.time + ' acaba de ser ocupado por otra persona. Por favor elige otro.' });
            continue; // Saltamos esta cita para no crear un duplicado
          }
        }

        const { error } = await supabase.from('appointments').upsert({
          id: String(appt.id),
          business_id: business_id,
          worker_id: appt.worker_id || '',
          client_id: appt.client_id || '',
          client_name: appt.client_name || '',
          client_phone: appt.client_phone || '',
          client_email: appt.client_email || appt.email || '',
          notes: appt.notes || '',
          token: appt.token || '',
          service_name: appt.service_name || '',
          service_price: parseFloat(appt.service_price) || 0,
          date: appt.date || '',
          time: appt.time || '',
          status: appt.status || 'confirmed'
        }).select();

        if (error) {
          apptErrors.push({ id: appt.id, msg: error.message, hint: error.hint || '', code: error.code || '' });
          continue;
        }

        if (appt.worker_id) {
          if (esNueva) {
            await enviarPushWorker(
              supabase,
              appt.worker_id,
              '📅 Nueva cita',
              (appt.client_name || 'Cliente') + ' · ' + (appt.service_name || '') + ' · ' + (appt.date || '') + ' a las ' + (appt.time || '')
            );
            await supabase.from('notifications').insert({
              worker_id: appt.worker_id,
              business_id: business_id,
              type: 'new_booking',
              msg: 'Nueva cita: ' + (appt.client_name || 'Cliente'),
              detail: (appt.service_name || '') + ' · ' + (appt.date || '') + ' a las ' + (appt.time || ''),
              read: false
            });
          } else if (esReagendada) {
            await enviarPushWorker(
              supabase,
              appt.worker_id,
              '🔄 Cita reagendada',
              (appt.client_name || 'Cliente') + ' cambió a ' + (appt.date || '') + ' a las ' + (appt.time || '')
            );
            await supabase.from('notifications').insert({
              worker_id: appt.worker_id,
              business_id: business_id,
              type: 'booking_modify',
              msg: 'Cita reagendada: ' + (appt.client_name || 'Cliente'),
              detail: (appt.service_name || '') + ' · ' + (appt.date || '') + ' a las ' + (appt.time || ''),
              read: false
            });
          }
        }
      }

      if (apptErrors.length > 0) {
        return res.status(400).json({ success: false, errors: apptErrors });
      }

      return res.status(200).json({ success: true, synced: appointments.length });
    }

    // ═══════════════════════════════════════
    // SERVICES — type: "services"
    // ═══════════════════════════════════════
    if (type === 'services') {
      const { business_id, worker_id, services } = req.body;

      if (!business_id || !Array.isArray(services)) {
        return res.status(400).json({ success: false, error: 'Datos incompletos' });
      }

      for (const svc of services) {
        const finalWorkerId = svc.worker_id || worker_id || '';

        const { error } = await supabase.from('services').upsert({
          id: String(svc.id),
          business_id: business_id,
          worker_id: finalWorkerId,
          name: svc.name || '',
          description: svc.description || '',
          price: parseFloat(svc.price) || 0,
          duration: parseInt(svc.duration) || 30,
          color: svc.color || '',
          image: svc.image || ''
        });

        if (error) {
          return res.status(400).json({ success: false, error: error.message });
        }
      }

      return res.status(200).json({ success: true, synced: services.length });
    }

    // ═══════════════════════════════════════
    // DELETE SERVICE — type: "delete_service"
    // ═══════════════════════════════════════
    if (type === 'delete_service') {
      const { service_id } = req.body;
      if (!service_id) {
        return res.status(400).json({ success: false, error: 'Falta service_id' });
      }

      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', service_id);

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    // ═══════════════════════════════════════
    // CLIENT — type: "client"
    // ═══════════════════════════════════════
    if (type === 'client') {
      const data = req.body;
      if (!data.business_id) {
        return res.status(400).json({ success: false, error: 'Falta business_id' });
      }

      const payload = {
        id: data.id || ('cl_' + Date.now()),
        business_id: data.business_id,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || ''
      };

      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('business_id', data.business_id)
        .eq('phone', data.phone)
        .limit(1);

      if (existing && existing.length > 0) {
        payload.id = existing[0].id;
      }

      const { error } = await supabase.from('clients').upsert(payload);
      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, client_id: payload.id });
    }

    // ═══════════════════════════════════════
    // PRODUCT — type: "product"
    // ═══════════════════════════════════════
    if (type === 'product') {
      const data = req.body;
      if (!data.business_id) {
        return res.status(400).json({ success: false, error: 'Falta business_id' });
      }

      const { error } = await supabase.from('products').upsert({
        id: data.id || ('prod_' + Date.now()),
        business_id: data.business_id,
        name: data.name || '',
        description: data.description || '',
        price: parseFloat(data.price) || 0,
        stock: parseInt(data.stock) || 0,
        image: data.image || '',
        category: data.category || '',
        rating: parseFloat(data.rating) || 0,
        reviews_count: parseInt(data.reviews_count) || 0
      });

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Tipo desconocido: ' + type });

  } catch (err) {
    console.error('Server error sync:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════
// NOTIFICACIONES FCM (MOBILE APP)
// ═══════════════════════════════════════
router.post('/send-notification', async (req, res) => {
  try {
    const { token, title, body, data } = req.body;

    if (!token || !title || !body) {
      return res.status(400).json({ error: 'Faltan campos: token, title, body' });
    }

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
      console.warn("Faltan credenciales de Firebase. Notificación FCM omitida.");
      return res.status(200).json({ success: true, warning: 'Firebase no configurado' });
    }

    const { GoogleAuth } = require('google-auth-library');

    const credentials = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: 'c5e8d89d4f2c8f398d742faaba852207574c2620',
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      token_uri: 'https://oauth2.googleapis.com/token',
    };

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;

    const message = {
      message: {
        token: token,
        notification: { title, body },
        data: data || {},
        android: {
          priority: 'high',
          notification: { sound: 'default', click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        },
      },
    };

    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken.token}`,
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('FCM error:', result);
      return res.status(500).json({ error: 'Error enviando notificación', detail: result });
    }

    return res.status(200).json({ success: true, result });

  } catch (err) {
    console.error('send-notification error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
