# CITAS PRO

App SaaS de gestión de citas para barberías, peluquerías y salones.
Modelo de negocio: **10€/mes por negocio** · 1 mes gratis al registrarse.

---

##  Credenciales de acceso

| Panel | Email | Contraseña |
|-------|-------|------------|
| Super Admin | virche70021261@gmail.com | Versa70021261*# |
| Demo negocio | versa@la40.com | la40 |

>  Cambia la contraseña del Super Admin antes de lanzar en producción.

---

##  Estructura del proyecto
```
citas_pro/
├── index.html                        ← App completa (4 pantallas + 11 modales)
├── assets/
│   ├── css/
│   │   └── styles.css                ← Todos los estilos
│   ├── img/
│   │   ├── favicon.ico
│   │   └── logo.svg
│   └── js/
│       ├── db.js                     ← Base de datos, variables globales, helpers
│       ├── admin.js                  ← Panel super admin (solo Versa)
│       ├── biz.js                    ← Panel del negocio (dueños de barbería)
│       ├── booking.js                ← Flujo de reservas del cliente
│       └── app.js                    ← Arranque, eventos, QR, hash routing
├── netlify/
│   └── functions/
│       ├── send-email.js             ← Emails con Resend (verificación, citas)
│       ├── stripe-checkout.js        ← Sesión de pago 10€/mes
│       └── stripe-webhook.js         ← Activa/cancela planes automáticamente
├── netlify.toml                      ← Configuración de Netlify
├── package.json                      ← Dependencias (resend, stripe)
├── .env.example                      ← Plantilla de variables de entorno
├── .gitignore                        ← Archivos excluidos de Git
└── README.md                         ← Este archivo
```

---

##  Deploy en Netlify

### Paso 1 — Subir a GitHub
```bash
git init
git add .
git commit -m "Primera versión Citas Pro"
```

Luego en github.com → New repository → `citaspro` → copiar y pegar los comandos que te da GitHub.

### Paso 2 — Conectar con Netlify

1. netlify.com → Add new site → Import from Git
2. Selecciona el repositorio `citaspro`
3. Build command: dejar vacío
4. Publish directory: `.`
5. Deploy site

### Paso 3 — Variables de entorno en Netlify

En Site settings → Environment variables → añadir:

| Variable | Descripción |
|----------|-------------|
| `RESEND_API_KEY` | Clave de resend.com para emails reales |
| `STRIPE_SECRET_KEY` | Clave secreta de stripe.com |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook de Stripe |

---

##  Costes estimados

| Servicio | Plan | Coste |
|----------|------|-------|
| Netlify | Free | 0€/mes |
| Resend | Free (3.000 emails/mes) | 0€/mes |
| Stripe | Por transacción | ~0,39€ por cada 10€ cobrado |
| Dominio | — | ~1€/mes |
| **Total fijo** | | **~1€/mes** |

Con 3 negocios activos ya cubres todos los costes.

---

## 📧 Integración de emails (Resend)

Los emails están preparados pero en modo `console.log` hasta que configures Resend.
Plantillas disponibles en `send-email.js`:

- Verificación de email al registrarse
- Confirmación de cita al cliente
- Aviso de nueva cita al negocio
- Recuperación de contraseña
- Suscripción activada

---

##  Integración de pagos (Stripe)

Flujo preparado en las funciones de Netlify:

1. El negocio pulsa "Activar suscripción" → llama a `stripe-checkout.js`
2. Stripe procesa el pago de 10€/mes
3. El webhook en `stripe-webhook.js` activa el plan automáticamente
4. Si cancela, el webhook lo desactiva

**Tarjetas de prueba Stripe:**
-  Pago exitoso: `4242 4242 4242 4242`
-  Pago fallido: `4000 0000 0000 0002`

---

##  Hoja de ruta

-  App funcional con localStorage
-  Super Admin con dashboard
- [x] Panel completo del negocio
- [x] Portal de reservas para clientes
- [x] Sistema QR y link de reservas
- [ ] Emails reales con Resend
- [ ] Pagos con Stripe
- [ ] Base de datos real con Supabase
- [ ] Dominio propio citaspro.app
- [ ] App móvil (PWA)
