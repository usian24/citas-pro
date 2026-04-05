// /api/cancel-appointment.js
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

// Las citas viven en krbtoepzoorpdedtykug — siempre operar ahí
const SUPABASE_APPOINTMENTS_URL = 'https://krbtoepzoorpdedtykug.supabase.co';
const SUPABASE_APPOINTMENTS_KEY = 'sb_publishable_IXquO0XEbEkFBmZgblzjVg_adtTWCW-';

webpush.setVapidDetails(
  'mailto:soporte@citasproonline.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  const { token, business_id } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: 'Falta token' });
  }

  const supabase = createClient(
    SUPABASE_APPOINTMENTS_URL,
    SUPABASE_APPOINTMENTS_KEY
  );

  // Buscar la cita por token
  const { data: existing, error: findError } = await supabase
    .from('appointments')
    .select('id, token, status, business_id, worker_id, client_name, service_name, date, time')
    .eq('token', token)
    .limit(1);

  if (findError) {
    return res.status(500).json({ success: false, error: findError.message });
  }

  if (!existing || existing.length === 0) {
    return res.status(404).json({ success: false, error: 'Cita no encontrada', already_cancelled: false });
  }

  const appt = existing[0];

  if (appt.status === 'cancelled') {
    return res.status(200).json({ success: true, already_cancelled: true });
  }

  // Cancelar por ID exacto
  const { error: updateError } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appt.id);

  if (updateError) {
    return res.status(500).json({ success: false, error: updateError.message });
  }

  // ✅ Enviar push al trabajador notificando la cancelación
  if (appt.worker_id) {
    try {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('worker_id', appt.worker_id);

      if (subs && subs.length > 0) {
        var payload = JSON.stringify({
          title: '❌ Cita cancelada',
          body: (appt.client_name || 'Cliente') + ' canceló · ' +
                (appt.service_name || '') + ' · ' +
                (appt.date || '') + ' a las ' + (appt.time || '')
        });
        for (var sub of subs) {
          try {
            await webpush.sendNotification(sub.subscription, payload);
          } catch(e) {
            if (e.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('worker_id', appt.worker_id);
            }
          }
        }
      }
    } catch(e) {
      console.error('Error push cancelación:', e.message);
    }
  }

  return res.status(200).json({
    success: true,
    cancelled: true,
    appointment: appt
  });
};