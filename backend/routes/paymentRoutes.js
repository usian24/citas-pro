const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../db');

// Ruta del Webhook
router.post('/webhook', async (req, res) => {
  try {
    // 1. Verificación de Seguridad usando la copia exacta (rawBody) de la vacuna
    const secret = process.env.LEMON_WEBHOOK_SECRET; 
    const hmac = crypto.createHmac('sha256', secret);
    
    const digest = Buffer.from(hmac.update(req.rawBody || '').digest('hex'), 'utf8');
    const signature = Buffer.from(req.headers['x-signature'] || '', 'utf8');

    // Validación extra: Si las longitudes no coinciden, fallamos rápido para evitar que el servidor crashee
    if (digest.length !== signature.length || !crypto.timingSafeEqual(digest, signature)) {
      console.log('[ERROR] Intento de pago rechazado: Firma de seguridad invalida.');
      return res.status(401).json({ error: 'Firma invalida' });
    }

    // 2. Extraer los datos (Gracias a la vacuna, req.body ya viene como JSON listo para usar)
    const payload = req.body;
    const eventName = payload.meta.event_name;
    
    // Datos identificadores
    const bizId = payload.meta.custom_data.bizId; 
    const customerId = payload.data.attributes.customer_id;
    const variantId = payload.data.attributes.variant_id;
    const subscriptionId = payload.data.id;

    // Extraemos la fecha inteligente de Lemon Squeezy
    const renewsAt = payload.data.attributes.renews_at;
    const endsAt = payload.data.attributes.ends_at;
    const rawDate = endsAt || renewsAt; 
    
    // Lo formateamos a YYYY-MM-DD
    const expiresAt = rawDate ? rawDate.split('T')[0] : null;

    console.log(`[INFO] Recibido Webhook de Lemon Squeezy: ${eventName} para negocio: ${bizId}`);

    // 3A. Lógica Positiva: Compra o Renovación automática
    if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
      
      const { error } = await supabase
        .from('businesses')
        .update({
          plan: 'active',
          subscription_status: 'active',
          expires_at: expiresAt, 
          lemon_customer_id: customerId.toString(),
          lemon_subscription_id: subscriptionId.toString(),
          lemon_variant_id: variantId.toString()
        })
        .eq('id', bizId);

      if (error) {
        console.error('[CRITICAL] Error guardando en Supabase:', error);
        return res.status(500).json({ error: 'Error actualizando base de datos' });
      }
      
      console.log(`[SUCCESS] Negocio ${bizId} actualizado, plan activo hasta ${expiresAt}.`);
    }

    // 3B. Lógica Negativa: Suscripción Expirada O Cancelada
    else if (eventName === 'subscription_expired' || eventName === 'subscription_cancelled') {
      
      const { error } = await supabase
        .from('businesses')
        .update({
          plan: 'expired',
          subscription_status: 'inactive'
        })
        .eq('id', bizId);

      if (error) {
        console.error('[CRITICAL] Error bloqueando negocio en Supabase:', error);
        return res.status(500).json({ error: 'Error actualizando base de datos' });
      }

      console.log(`[WARNING] Negocio ${bizId} ha expirado o cancelado y fue bloqueado.`);
    }

    // 4. Confirmación de éxito a los servidores de Lemon Squeezy
    res.status(200).send('Webhook procesado OK');

  } catch (error) {
    console.error('[CRITICAL] Error interno en el Webhook:', error);
    res.status(500).send('Error interno del servidor');
  }
});

module.exports = router;