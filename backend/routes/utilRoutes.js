const express = require('express');
const { Resend } = require('resend');
const { optionalAuth } = require('../middlewares/auth');
const router = express.Router();

let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn("RESEND_API_KEY no configurada. Envío de correos deshabilitado.");
}

// Rate limit ligero en memoria por IP para endpoints públicos (anti-spam)
const _rateMap = new Map();
function checkIpLimit(req, bucket, maxReq, windowMs) {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
  const key = bucket + ':' + ip;
  const now = Date.now();
  const arr = (_rateMap.get(key) || []).filter(ts => now - ts < windowMs);
  if (arr.length >= maxReq) return false;
  arr.push(now);
  _rateMap.set(key, arr);
  if (_rateMap.size > 2000) _rateMap.clear();
  return true;
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(url) {
  const s = String(url || '').trim();
  if (/^https?:\/\//i.test(s)) return esc(s);
  return 'https://citasproonline.com';
}

router.post('/send-email', optionalAuth, async (req, res) => {
  const { type, to, data } = req.body || {};

  if (!type || !to) {
    return res.status(400).json({ error: 'Faltan campos: type y to son obligatorios' });
  }

  // Tipos internos: exigen sesión autenticada
  const authOnlyTypes = ['worker_welcome', 'subscription_activated', 'loyalty_reward'];
  if (authOnlyTypes.includes(type) && !req.user) {
    return res.status(401).json({ error: 'Sesión requerida para enviar este tipo de correo', code: 'AUTH_REQUIRED' });
  }

  // Anti-spam por IP para tipos públicos (verificación OTP y confirmaciones de cita)
  if (!req.user && !checkIpLimit(req, 'email', 15, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes de correo. Intenta más tarde.' });
  }

  const d = data && typeof data === 'object' ? data : {};

  const templates = {
    verification: {
      subject: 'Tu código de verificación — Citas Pro',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="text-align:center;margin-bottom:32px">
            <div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#4A7FD4">CITAS PRO</div>
            <div style="font-size:12px;color:#475569;margin-top:4px;letter-spacing:2px">APP PARA RESERVA DE CITAS</div>
          </div>
          <h2 style="font-size:20px;font-weight:800;margin-bottom:8px">Verifica tu correo electrónico</h2>
          <p style="color:#94A3B8;margin-bottom:28px;line-height:1.6">Usa este código de 6 dígitos para completar tu registro en Citas Pro:</p>
          <div style="background:#141824;border:2px solid #4A7FD4;border-radius:16px;padding:28px;text-align:center;margin-bottom:28px">
            <div style="font-size:48px;font-weight:900;letter-spacing:14px;color:#7EB8FF;font-family:monospace">${esc(d.code)}</div>
          </div>
          <p style="color:#475569;font-size:13px;text-align:center;line-height:1.6">
            Este código expira en <strong style="color:#F1F5F9">10 minutos</strong>.<br>
            Si no solicitaste esto, ignora este email.
          </p>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2026 Citas Pro · <a href="https://citasproonline.com" style="color:#4A7FD4;text-decoration:none">citasproonline.com</a>
          </div>
        </div>
      `
    },
    booking_confirmed: {
      subject: `Cita confirmada en ${esc(d.bizName)}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="text-align:center;margin-bottom:32px">
            <h2 style="font-size:22px;font-weight:900;margin:0">¡Cita confirmada!</h2>
            <p style="color:#94A3B8;margin-top:8px">Tu reserva en <strong style="color:#F1F5F9">${esc(d.bizName)}</strong> está lista.</p>
          </div>
          <div style="background:#141824;border-radius:16px;padding:24px;margin-bottom:24px">
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1E2A40">
              <span style="color:#94A3B8;font-size:14px">Negocio</span>
              <strong style="font-size:14px">${esc(d.bizName)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1E2A40">
              <span style="color:#94A3B8;font-size:14px">Servicio</span>
              <strong style="font-size:14px">${esc(d.service)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1E2A40">
              <span style="color:#94A3B8;font-size:14px">Fecha</span>
              <strong style="font-size:14px">${esc(d.date)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1E2A40">
              <span style="color:#94A3B8;font-size:14px">Hora</span>
              <strong style="font-size:14px">${esc(d.time)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:16px 0">
              <strong style="font-size:16px">Total</strong>
              <strong style="font-size:24px;color:#4A7FD4">${esc(d.price)}</strong>
            </div>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center;line-height:1.7">
            ¿Necesitas cancelar o cambiar la cita?<br>
            Contacta directamente con <strong style="color:#F1F5F9">${esc(d.bizName)}</strong>.
          </p>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2026 Citas Pro · <a href="https://citasproonline.com" style="color:#4A7FD4;text-decoration:none">citasproonline.com</a>
          </div>
        </div>
      `
    },
    loyalty_reward: {
      subject: `¡Felicidades! Has ganado una recompensa en ${esc(d.bizName)}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="text-align:center;margin-bottom:32px">
            <h2 style="font-size:22px;font-weight:900;margin:0">¡Completaste tu tarjeta!</h2>
            <p style="color:#94A3B8;margin-top:8px">Hola <strong style="color:#F1F5F9">${esc(d.clientName)}</strong>, gracias por tu lealtad a <strong style="color:#F1F5F9">${esc(d.bizName)}</strong>.</p>
          </div>
          <div style="background:#141824;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;border:1px solid #22C55E">
            <h3 style="color:#22C55E;margin-top:0">¡Tienes un premio listo para canjear!</h3>
            <p style="font-size:14px;color:#94A3B8;line-height:1.6">
              Como agradecimiento por tu preferencia, ya puedes canjear tu recompensa en tu próxima visita.
            </p>
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(34,197,94,.2)">
              <p style="font-size:13px;color:#F1F5F9;margin:0;">Atentamente,</p>
              <p style="font-size:15px;font-weight:bold;color:#22C55E;margin:4px 0 0 0;">El equipo de ${esc(d.bizName)}</p>
            </div>
          </div>
          <a href="https://citasproonline.com" style="display:block;background:linear-gradient(135deg,#22C55E,#16A34A);color:#fff;padding:16px;border-radius:50px;text-align:center;font-weight:800;text-decoration:none;font-size:15px">
            Reservar mi premio
          </a>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2026 Citas Pro · <a href="https://citasproonline.com" style="color:#4A7FD4;text-decoration:none">citasproonline.com</a>
          </div>
        </div>
      `
    },
    new_booking_biz: {
      subject: `Nueva cita de ${esc(d.clientName)}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="margin-bottom:24px">
            <div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#4A7FD4">CITAS PRO</div>
          </div>
          <h2 style="font-size:20px;font-weight:800;margin-bottom:6px">Nueva reserva recibida</h2>
          <p style="color:#94A3B8;margin-bottom:24px">Un cliente ha reservado desde tu portal online.</p>
          <div style="background:#141824;border-radius:16px;padding:24px;margin-bottom:24px">
            <div style="padding:10px 0;border-bottom:1px solid #1E2A40"><span style="color:#94A3B8;font-size:13px">Cliente</span><br><strong style="font-size:16px">${esc(d.clientName)}</strong></div>
            <div style="padding:10px 0;border-bottom:1px solid #1E2A40"><span style="color:#94A3B8;font-size:13px">Teléfono</span><br><strong>${esc(d.clientPhone)}</strong></div>
            <div style="padding:10px 0;border-bottom:1px solid #1E2A40"><span style="color:#94A3B8;font-size:13px">Servicio</span><br><strong>${esc(d.service)}</strong></div>
            <div style="padding:10px 0"><span style="color:#94A3B8;font-size:13px">Fecha y hora</span><br><strong style="font-size:18px;color:#7EB8FF">${esc(d.date)} · ${esc(d.time)}</strong></div>
          </div>
          <a href="https://citasproonline.com" style="display:block;background:linear-gradient(135deg,#4A7FD4,#2855C8);color:#fff;padding:16px;border-radius:50px;text-align:center;font-weight:800;text-decoration:none;font-size:15px">
            Ver en mi panel
          </a>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2026 Citas Pro · <a href="https://citasproonline.com" style="color:#4A7FD4;text-decoration:none">citasproonline.com</a>
          </div>
        </div>
      `
    },
    subscription_activated: {
      subject: '¡Suscripción activada! — Citas Pro',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="text-align:center;margin-bottom:32px">
            <div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#4A7FD4">CITAS PRO</div>
          </div>
          <h2 style="font-size:22px;font-weight:900;margin-bottom:8px">¡Tu suscripción está activa!</h2>
          <p style="color:#94A3B8;margin-bottom:24px;line-height:1.6">
            Hola <strong style="color:#F1F5F9">${esc(d.bizName)}</strong>,<br>
            tu suscripción se ha activado correctamente.
          </p>
          <div style="background:#141824;border:1.5px solid rgba(34,197,94,.3);border-radius:16px;padding:20px;margin-bottom:24px">
            <div style="color:#22C55E;font-weight:700;margin-bottom:8px">Plan Citas Pro activo</div>
            <div style="color:#94A3B8;font-size:13px">Acceso ilimitado a todas las funciones</div>
          </div>
          <a href="https://citasproonline.com" style="display:block;background:linear-gradient(135deg,#22C55E,#16A34A);color:#fff;padding:16px;border-radius:50px;text-align:center;font-weight:800;text-decoration:none;font-size:15px">
            Ir a mi panel
          </a>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2026 Citas Pro · <a href="https://citasproonline.com" style="color:#4A7FD4;text-decoration:none">citasproonline.com</a>
          </div>
        </div>
      `
    },
    booking_cancel: {
      subject: `Cita cancelada: ${esc(d.clientName)}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="margin-bottom:24px">
            <div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#4A7FD4">CITAS PRO</div>
          </div>
          <h2 style="font-size:20px;font-weight:800;color:#EF4444;margin-bottom:6px">Cita cancelada</h2>
          <p style="color:#94A3B8;margin-bottom:24px">El cliente ha cancelado su reserva desde el portal.</p>
          <div style="background:#141824;border-radius:16px;padding:24px;margin-bottom:24px;border-left:4px solid #EF4444">
            <div style="padding:10px 0;border-bottom:1px solid #1E2A40"><span style="color:#94A3B8;font-size:13px">Cliente</span><br><strong style="font-size:16px">${esc(d.clientName)}</strong></div>
            <div style="padding:10px 0;border-bottom:1px solid #1E2A40"><span style="color:#94A3B8;font-size:13px">Servicio cancelado</span><br><strong>${esc(d.service)}</strong></div>
            <div style="padding:10px 0"><span style="color:#94A3B8;font-size:13px">Fecha y hora liberada</span><br><strong style="font-size:18px;color:#EF4444">${esc(d.date)} · ${esc(d.time)}</strong></div>
          </div>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2026 Citas Pro · <a href="https://citasproonline.com" style="color:#4A7FD4;text-decoration:none">citasproonline.com</a>
          </div>
        </div>
      `
    },
    worker_welcome: {
      subject: `Bienvenido a ${esc(d.bizName)} - Tu acceso a Citas Pro`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#07090F;color:#F1F5F9;padding:40px 32px;border-radius:20px">
          <div style="text-align:center;margin-bottom:32px">
            <div style="font-size:28px;font-weight:900;letter-spacing:3px;color:#4A7FD4">CITAS PRO</div>
          </div>
          <h2 style="font-size:22px;font-weight:900;margin-bottom:8px">¡Hola, ${esc(d.workerName)}!</h2>
          <p style="color:#94A3B8;margin-bottom:24px;line-height:1.6">
            <strong style="color:#F1F5F9">${esc(d.bizName)}</strong> te ha añadido a su equipo en Citas Pro. Ahora puedes gestionar tus propios servicios, ver tus citas y tu facturación.
          </p>
          <div style="background:#141824;border:1.5px solid #4A7FD4;border-radius:16px;padding:24px;margin-bottom:24px">
            <div style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Tus credenciales de acceso:</div>
            <div style="margin-bottom:10px">
              <span style="color:#475569;font-size:13px">Email:</span><br>
              <strong style="font-size:15px;color:#F1F5F9">${esc(d.email)}</strong>
            </div>
            <div>
              <span style="color:#475569;font-size:13px">Contraseña provisional:</span><br>
              <strong style="font-size:15px;color:#7EB8FF">${esc(d.pass)}</strong>
            </div>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center;margin-bottom:24px">
            Te recomendamos cambiar esta contraseña desde tu Perfil una vez ingreses.
          </p>
          <a href="${safeHref(d.link)}" style="display:block;background:linear-gradient(135deg,#4A7FD4,#2855C8);color:#fff;padding:16px;border-radius:50px;text-align:center;font-weight:800;text-decoration:none;font-size:15px">
            Iniciar sesión ahora
          </a>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1E2A40;text-align:center;font-size:11px;color:#475569">
            © 2026 Citas Pro · <a href="https://citasproonline.com" style="color:#4A7FD4;text-decoration:none">citasproonline.com</a>
          </div>
        </div>
      `
    }
  };

  const template = templates[type];
  if (!template) {
    return res.status(400).json({ error: `Tipo de email no reconocido: ${type}` });
  }

  if (!resend) {
    return res.status(500).json({ error: 'El servicio de correo no está configurado en el servidor.' });
  }

  try {
    await resend.emails.send({
      from: 'Citas Pro <reservas@citasproonline.com>',
      to: [to],
      subject: template.subject,
      html: template.html
    });

    return res.status(200).json({ ok: true, message: 'Email enviado correctamente' });
  } catch (error) {
    console.error('Error Resend:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/upload-image — Proxy seguro a ImgBB (sin exponer IMGBB_API_KEY al navegador)
// ═══════════════════════════════════════════════════
router.post('/upload-image', optionalAuth, async (req, res) => {
  try {
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'IMGBB_API_KEY no configurada en el servidor' });
    }
    if (!checkIpLimit(req, 'upload', 30, 15 * 60 * 1000)) {
      return res.status(429).json({ success: false, error: 'Demasiadas subidas de imagen. Espera unos minutos.' });
    }

    let raw = String((req.body && req.body.image) || '').trim();
    if (!raw) {
      return res.status(400).json({ success: false, error: 'Falta imagen en base64' });
    }
    const commaIdx = raw.indexOf(',');
    if (raw.startsWith('data:') && commaIdx > 0) {
      raw = raw.slice(commaIdx + 1);
    }
    if (raw.length > 7 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: 'La imagen supera el límite permitido (5MB)' });
    }

    const params = new URLSearchParams();
    params.append('image', raw);

    const imgRes = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const imgData = await imgRes.json();

    if (!imgRes.ok || !imgData || !imgData.success || !imgData.data || !imgData.data.url) {
      return res.status(502).json({ success: false, error: 'No se pudo subir la imagen a ImgBB' });
    }

    return res.status(200).json({ success: true, url: imgData.data.url });
  } catch (err) {
    console.error('[UPLOAD] Error en /api/upload-image:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
