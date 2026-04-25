const express = require('express');
const router = express.Router();

let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

router.post('/stripe-checkout', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe no está configurado en este entorno' });
  }
  const { bizId, bizEmail, bizName } = req.body || {};

  if (!bizId || !bizEmail) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Citas Pro — Plan mensual',
            description: 'Gestión completa de citas: agenda, equipo, servicios, finanzas y más.',
            images: ['https://citaspro.app/assets/img/logo-stripe.png']
          },
          unit_amount: 1000,
          recurring: {
            interval: 'month'
          }
        },
        quantity: 1
      }],
      customer_email: bizEmail,
      metadata: {
        bizId: bizId,
        bizName: bizName || 'Sin nombre'
      },
      success_url: `https://citaspro.app/?pago=ok&biz=${bizId}`,
      cancel_url: `https://citaspro.app/?pago=cancelado`,
      locale: 'es',
      allow_promotion_codes: true
    });

    return res.status(200).json({ url: session.url });

  } catch (error) {
    console.error('Error Stripe checkout:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
