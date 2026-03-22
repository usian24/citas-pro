// ══════════════════════════════════════
//   netlify/functions/send-email.js
//   Envía emails reales con Resend
//   Instalar: npm install resend
// ══════════════════════════════════════

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  // Solo POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'JSON inválido' };
  }

  const { type, to, data } = payload;

  if (!type || !to) {
    return { statusCode: 400, body: 'Faltan campos: type y to son obligatorios' };
  }

  // ── Plantillas de email ──────────────────────────────
  const templates = {

    // 1. Código de verificación al registrarse
    verification: {
      subject: '🔐 Tu código de verificación — Citas Pro',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="text-align:center;margin-bottom:32px">
            <div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#4A7FD4">CITAS PRO</div>
            <div style="font-size:12px;color:#475569;margin-top:4px;letter-spacing:2px">APP PARA BARBERÍAS Y PELUQUERÍAS</div>
          </div>
          <h2 style="font-size:20px;font-weight:800;margin-bottom:8px">Verifica tu correo electrónico ✉️</h2>
          <p style="color:#94A3B8;margin-bottom:28px;line-height:1.6">Usa este código de 6 dígitos para completar tu registro en Citas Pro:</p>
          <div style="background:#141824;border:2px solid #4A7FD4;border-radius:16px;padding:28px;text-align:center;margin-bottom:28px">
            <div style="font-size:48px;font-weight:900;letter-spacing:14px;color:#7EB8FF;font-family:monospace">${data.code}</div>
          </div>
          <p style="color:#475569;font-size:13px;text-align:center;line-height:1.6">
            Este código expira en <strong style="color:#F1F5F9">10 minutos</strong>.<br>
            Si no solicitaste esto, ignora este email.
          </p>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2025 Citas Pro · <a href="https://citaspro.app" style="color:#4A7FD4;text-decoration:none">citaspro.app</a>
          </div>
        </div>
      `
    },

    // 2. Confirmación de cita al cliente
    booking_confirmed: {
      subject: `✅ Cita confirmada en ${data.bizName}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="text-align:center;margin-bottom:32px">
            <div style="font-size:56px;margin-bottom:12px">✅</div>
            <h2 style="font-size:22px;font-weight:900;margin:0">¡Cita confirmada!</h2>
            <p style="color:#94A3B8;margin-top:8px">Tu reserva en <strong style="color:#F1F5F9">${data.bizName}</strong> está lista.</p>
          </div>
          <div style="background:#141824;border-radius:16px;padding:24px;margin-bottom:24px">
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1E2A40">
              <span style="color:#94A3B8;font-size:14px">🏪 Negocio</span>
              <strong style="font-size:14px">${data.bizName}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1E2A40">
              <span style="color:#94A3B8;font-size:14px">✂️ Servicio</span>
              <strong style="font-size:14px">${data.service}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1E2A40">
              <span style="color:#94A3B8;font-size:14px">📅 Fecha</span>
              <strong style="font-size:14px">${data.date}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1E2A40">
              <span style="color:#94A3B8;font-size:14px">⏰ Hora</span>
              <strong style="font-size:14px">${data.time}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:16px 0">
              <strong style="font-size:16px">💰 Total</strong>
              <strong style="font-size:24px;color:#4A7FD4">${data.price}</strong>
            </div>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center;line-height:1.7">
            ¿Necesitas cancelar o cambiar la cita?<br>
            Contacta directamente con <strong style="color:#F1F5F9">${data.bizName}</strong>.
          </p>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2025 Citas Pro · <a href="https://citaspro.app" style="color:#4A7FD4;text-decoration:none">citaspro.app</a>
          </div>
        </div>
      `
    },

    // 3. Aviso al negocio de nueva cita
    new_booking_biz: {
      subject: `📅 Nueva cita de ${data.clientName}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="margin-bottom:24px">
            <div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#4A7FD4">CITAS PRO</div>
          </div>
          <h2 style="font-size:20px;font-weight:800;margin-bottom:6px">Nueva reserva recibida 🎉</h2>
          <p style="color:#94A3B8;margin-bottom:24px">Un cliente ha reservado desde tu portal online.</p>
          <div style="background:#141824;border-radius:16px;padding:24px;margin-bottom:24px">
            <div style="padding:10px 0;border-bottom:1px solid #1E2A40"><span style="color:#94A3B8;font-size:13px">👤 Cliente</span><br><strong style="font-size:16px">${data.clientName}</strong></div>
            <div style="padding:10px 0;border-bottom:1px solid #1E2A40"><span style="color:#94A3B8;font-size:13px">📱 Teléfono</span><br><strong>${data.clientPhone}</strong></div>
            <div style="padding:10px 0;border-bottom:1px solid #1E2A40"><span style="color:#94A3B8;font-size:13px">✂️ Servicio</span><br><strong>${data.service}</strong></div>
            <div style="padding:10px 0"><span style="color:#94A3B8;font-size:13px">📅 Fecha y hora</span><br><strong style="font-size:18px;color:#7EB8FF">${data.date} · ${data.time}</strong></div>
          </div>
          <a href="https://citaspro.app" style="display:block;background:linear-gradient(135deg,#4A7FD4,#2855C8);color:#fff;padding:16px;border-radius:50px;text-align:center;font-weight:800;text-decoration:none;font-size:15px">
            Ver en mi panel →
          </a>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2025 Citas Pro · <a href="https://citaspro.app" style="color:#4A7FD4;text-decoration:none">citaspro.app</a>
          </div>
        </div>
      `
    },
    // 6. Aviso de cita cancelada por el cliente
    booking_cancel: {
      subject: `Cita cancelada: ${data.clientName}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="margin-bottom:24px">
            <div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#4A7FD4">CITAS PRO</div>
          </div>
          <h2 style="font-size:20px;font-weight:800;color:#EF4444;margin-bottom:6px">Cita cancelada ❌</h2>
          <p style="color:#94A3B8;margin-bottom:24px">El cliente ha cancelado su reserva desde el portal.</p>
          <div style="background:#141824;border-radius:16px;padding:24px;margin-bottom:24px;border-left:4px solid #EF4444">
            <div style="padding:10px 0;border-bottom:1px solid #1E2A40"><span style="color:#94A3B8;font-size:13px">👤 Cliente</span><br><strong style="font-size:16px">${data.clientName}</strong></div>
            <div style="padding:10px 0;border-bottom:1px solid #1E2A40"><span style="color:#94A3B8;font-size:13px">✂️ Servicio cancelado</span><br><strong>${data.service}</strong></div>
            <div style="padding:10px 0"><span style="color:#94A3B8;font-size:13px">📅 Fecha y hora liberada</span><br><strong style="font-size:18px;color:#EF4444">${data.date} · ${data.time}</strong></div>
          </div>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2026 Citas Pro · <a href="https://citaspro.app" style="color:#4A7FD4;text-decoration:none">citaspro.app</a>
          </div>
        </div>
      `
    },

    // 4. Recuperación de contraseña
    password_reset: {
      subject: '🔑 Tu contraseña — Citas Pro',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="margin-bottom:24px"><div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#4A7FD4">CITAS PRO</div></div>
          <h2 style="font-size:20px;font-weight:800;margin-bottom:8px">Recuperación de contraseña 🔑</h2>
          <p style="color:#94A3B8;margin-bottom:24px">Tu contraseña actual es:</p>
          <div style="background:#141824;border:1.5px solid #4A7FD4;border-radius:16px;padding:24px;text-align:center;font-size:22px;font-weight:900;color:#7EB8FF;margin-bottom:24px;letter-spacing:3px;font-family:monospace">
            ${data.password}
          </div>
          <p style="color:#475569;font-size:13px;line-height:1.7">
            Por seguridad, te recomendamos cambiarla desde tu panel una vez que accedas.<br>
            Ve a <strong style="color:#F1F5F9">Perfil → Contraseña</strong>.
          </p>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2025 Citas Pro · <a href="https://citaspro.app" style="color:#4A7FD4;text-decoration:none">citaspro.app</a>
          </div>
        </div>
      `
    },

    // 5. Aviso de suscripción activada
    subscription_activated: {
      subject: '🎉 ¡Suscripción activada! — Citas Pro',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="text-align:center;margin-bottom:32px">
            <div style="font-size:56px;margin-bottom:12px">🎉</div>
            <div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#4A7FD4">CITAS PRO</div>
          </div>
          <h2 style="font-size:22px;font-weight:900;margin-bottom:8px">¡Tu suscripción está activa!</h2>
          <p style="color:#94A3B8;margin-bottom:24px;line-height:1.6">
            Hola <strong style="color:#F1F5F9">${data.bizName}</strong>,<br>
            tu pago de <strong style="color:#22C55E">10€/mes</strong> se ha procesado correctamente.
          </p>
          <div style="background:#141824;border:1.5px solid rgba(34,197,94,.3);border-radius:16px;padding:20px;margin-bottom:24px">
            <div style="color:#22C55E;font-weight:700;margin-bottom:8px">✅ Plan Citas Pro activo</div>
            <div style="color:#94A3B8;font-size:13px">Acceso ilimitado a todas las funciones</div>
          </div>
          <a href="https://citaspro.app" style="display:block;background:linear-gradient(135deg,#22C55E,#16A34A);color:#fff;padding:16px;border-radius:50px;text-align:center;font-weight:800;text-decoration:none;font-size:15px">
            Ir a mi panel →
          </a>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2025 Citas Pro · <a href="https://citaspro.app" style="color:#4A7FD4;text-decoration:none">citaspro.app</a>
          </div>
        </div>
      `
    }
  };

  const template = templates[type];
  if (!template) {
    return { statusCode: 400, body: `Tipo de email no reconocido: ${type}` };
  }

  try {
    await resend.emails.send({
      from: 'Citas Pro <reservas@citasproonline.com>',
      to: [to],
      subject: template.subject,
      html: template.html
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, message: 'Email enviado correctamente' })
    };

  } catch (error) {
    console.error('Error Resend:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};