const express = require('express');
const router = express.Router();
const supabase = require('../db');
const DodoPayments = require('dodopayments');

// Instancia global opcional si usas API para crear checkouts,
// pero el webhook depende más de las utilidades de validación o validación manual.
// Para DodoPayments Webhooks, Dodo envía `webhook-signature` y verificamos con la secret.

// Ruta del Webhook de DodoPayments
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['webhook-signature'];
    const webhookId = req.headers['webhook-id'];
    const timestamp = req.headers['webhook-timestamp'];
    
    // Si estás en local o sin variables configuradas aún, pasamos directo 
    // (solo mientras configuras Dodo). En prod, DODO_WEBHOOK_SECRET es obligatoria.
    const secret = process.env.DODO_WEBHOOK_SECRET;

    if (!secret) {
      console.warn('[WARNING] Falta DODO_WEBHOOK_SECRET. No se verificará la firma (solo test).');
    } else {
      // Verificamos la firma usando el SDK de DodoPayments
      try {
        const client = new DodoPayments({ bearerToken: process.env.DODO_API_KEY || 'dummy' });
        // unwrap() verifica el hash usando el rawBody, los headers y el secret.
        client.webhooks.unwrap(req.rawBody.toString(), req.headers, secret);
      } catch (err) {
        console.error('[ERROR] Intento de pago rechazado: Firma de DodoPayments inválida.', err);
        return res.status(401).json({ error: 'Firma invalida' });
      }
    }

    const payload = req.body;
    const eventName = payload.event_type || payload.type; // Ajustar a la doc de Dodo (suele ser event_type o action)

    // Los datos vienen en data
    const dodoData = payload.data || {};
    
    // DodoPayments permite pasar metadata custom en los enlaces de pago
    const bizId = dodoData.metadata?.bizId || dodoData.custom_data?.bizId; 
    
    const customerId = dodoData.customer_id || dodoData.customer;
    const subscriptionId = dodoData.subscription_id || dodoData.id;
    const productId = dodoData.product_id || dodoData.product;

    console.log(`[INFO] Recibido Webhook de DodoPayments: ${eventName} para negocio: ${bizId}`);

    if (!bizId) {
       console.log('[INFO] Webhook sin bizId, ignorando...');
       return res.status(200).send('Ignorado, no es una compra desde la App');
    }

    // 3A. Lógica Positiva: Compra exitosa, Suscripción Creada o Renovada
    if (eventName === 'subscription.active' || eventName === 'payment.succeeded' || eventName === 'subscription.renewed') {
      
      // En Dodo, renueva en 1 mes o 1 año dependiendo del producto
      // Si dodo no envía expiración explícita fácil, podemos setearlo manual o leer dodoData.current_period_end
      let expiresAt = null;
      if (dodoData.current_period_end) {
        expiresAt = new Date(dodoData.current_period_end).toISOString().split('T')[0];
      } else {
        // Fallback: +1 mes por defecto
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        expiresAt = d.toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('businesses')
        .update({
          plan: 'pro',
          expires_at: expiresAt
        })
        .eq('id', bizId);

      if (error) {
        console.error('[CRITICAL] Error guardando DodoPayments en Supabase:', error);
        return res.status(500).json({ error: 'Error actualizando base de datos' });
      }
      
      console.log(`[SUCCESS] Negocio ${bizId} actualizado vía DodoPayments, activo hasta ${expiresAt}.`);
    }

    // 3B. Lógica Negativa: Suscripción Expirada O Cancelada
    else if (eventName === 'subscription.cancelled' || eventName === 'subscription.expired' || eventName === 'payment.failed') {
      
      const { error } = await supabase
        .from('businesses')
        .update({
          plan: 'expired'
        })
        .eq('id', bizId);

      if (error) {
        console.error('[CRITICAL] Error bloqueando negocio en Supabase (Dodo):', error);
        return res.status(500).json({ error: 'Error actualizando base de datos' });
      }

      console.log(`[WARNING] Negocio ${bizId} ha expirado o cancelado en DodoPayments y fue bloqueado.`);
    }

    // 4. Confirmación de éxito a los servidores de DodoPayments
    res.status(200).send('Webhook de Dodo procesado OK');

  } catch (error) {
    console.error('[CRITICAL] Error interno en el Webhook de DodoPayments:', error);
    res.status(500).send('Error interno del servidor');
  }
});

module.exports = router;