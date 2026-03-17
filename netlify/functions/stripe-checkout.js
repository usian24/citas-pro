// ══════════════════════════════════════
//   netlify/functions/stripe-checkout.js
//   Crea una sesión de pago en Stripe
//   Instalar: npm install stripe
// ══════════════════════════════════════

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'JSON inválido' };
  }

  const { bizId, bizEmail, bizName } = payload;

  if (!bizId || !bizEmail) {
    return { statusCode: 400, body: 'Faltan campos obligatorios' };
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
          unit_amount: 1000,  // 10€ en céntimos
          recurring: {
            interval: 'month'
          }
        },
        quantity: 1
      }],

      customer_email: bizEmail,

      // Guardamos el bizId para identificarlo en el webhook
      metadata: {
        bizId: bizId,
        bizName: bizName || 'Sin nombre'
      },

      // Página de éxito y cancelación
      success_url: `https://citaspro.app/?pago=ok&biz=${bizId}`,
      cancel_url: `https://citaspro.app/?pago=cancelado`,

      // Idioma español
      locale: 'es',

      // Permite código de descuento
      allow_promotion_codes: true
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url })
    };

  } catch (error) {
    console.error('Error Stripe checkout:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};