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
       console.log('[INFO] Webhook sin bizId, ignorando. Payload data recibido:', JSON.stringify(dodoData, null, 2));
       return res.status(200).send('Ignorado, no es una compra desde la App');
    }

    // Listado de productos trimestrales (3 meses) y anuales (12 meses) de DodoPayments
    const TRIMESTRAL_PRODUCTS = [
      'pdt_0Np1dicwcf5sv9GhFi1D9',
      'pdt_0Np1e0ZrXbqb6UYcxqCxe',
      'pdt_0Np1eJEkxqD6Pv7jK7T62',
      'pdt_0Np1ekgyl0Tv4BDEZrOKG',
      'pdt_0Np1fB17o7XNyV2W1T3EP',
      'pdt_0Np1foghpvqHuJIcF8em9'
    ];

    const ANUAL_PRODUCTS = [
      'pdt_0Np1dmqiOkEo7HTDGz7YG',
      'pdt_0Np1e6Qolec6cNkmqM15y',
      'pdt_0Np1eP3QwBIacsgBAIz8E',
      'pdt_0Np1epdW8tccvMqPPH8MU',
      'pdt_0Np1fLBDDRX1bXoAgE079',
      'pdt_0Np1fv99fInfrUcS4Wr07'
    ];

    // 3A. Lógica Positiva: Compra exitosa, Suscripción Creada o Renovada
    if (eventName === 'subscription.active' || eventName === 'payment.succeeded' || eventName === 'subscription.renewed') {
      
      let expiresAt = null;
      if (dodoData.current_period_end) {
        expiresAt = new Date(dodoData.current_period_end).toISOString().split('T')[0];
      } else {
        const d = new Date();
        const pId = String(productId || dodoData.product_id || '').trim();
        const metaPlan = String(dodoData.metadata?.plan || dodoData.custom_data?.plan || '').toLowerCase();

        if (ANUAL_PRODUCTS.includes(pId) || metaPlan === 'anual' || metaPlan === 'anualidad') {
          d.setFullYear(d.getFullYear() + 1);
        } else if (TRIMESTRAL_PRODUCTS.includes(pId) || metaPlan === 'trimestral' || metaPlan === 'trimestre') {
          d.setMonth(d.getMonth() + 3);
        } else {
          // Mensual por defecto (1 mes)
          d.setMonth(d.getMonth() + 1);
        }
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

    // 3B. Lógica Negativa: Suscripción Expirada, Cancelada, Fallida o en Pausa
    else if (
      eventName === 'subscription.cancelled' ||
      eventName === 'subscription.expired' ||
      eventName === 'subscription.failed' ||
      eventName === 'subscription.on_hold' ||
      eventName === 'subscription.paused' ||
      eventName === 'payment.failed'
    ) {
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

      console.log(`[WARNING] Negocio ${bizId} evento ${eventName} en DodoPayments. Plan marcado como 'expired'.`);
    }

    // 4. Confirmación de éxito a los servidores de DodoPayments
    res.status(200).send('Webhook de Dodo procesado OK');

  } catch (error) {
    console.error('[CRITICAL] Error interno en el Webhook de DodoPayments:', error);
    res.status(500).send('Error interno del servidor');
  }
});

module.exports = router;