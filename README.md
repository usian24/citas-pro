# 💈 Citas Pro - Plataforma SaaS de Gestión Empresarial

![Version](https://img.shields.io/badge/Versi%C3%B3n-2.0.0-blue)
![Status](https://img.shields.io/badge/Estado-Producci%C3%B3n-success)
![Tech Stack](https://img.shields.io/badge/Stack-Vanilla_JS_%7C_Express_%7C_Supabase-black)

**Citas Pro** es una plataforma SaaS (Software as a Service) B2B2C diseñada para la gestión integral de barberías, peluquerías, salones de belleza y spas. 

A diferencia de una agenda convencional, este sistema ofrece un ecosistema completo que conecta a dueños de negocios, trabajadores independientes y clientes finales en una interfaz fluida, modular y reactiva.

---

## 🚀 Características Principales

El sistema está dividido lógicamente en 4 "Universos" o roles de usuario, cada uno con interfaces y permisos aislados:

### 👑 1. Panel Super Administrador (Master)
- **Dashboard Global:** Visualización en tiempo real del MRR (Ingresos Recurrentes Mensuales), ARR y crecimiento.
- **Inteligencia Regional:** Tabla de análisis por países (soportando ES, CO, MX, AR, PE, US, etc.) mostrando la moneda local, tiendas activas y MRR por región.
- **Gestión de Suscripciones:** Activación, suspensión y extensión de días de prueba para los negocios de forma manual.
- **Auditoría de Negocios:** Acceso al detalle de cada barbería, sus ingresos generados y visualización del equipo de trabajo en formato "acordeón".

### 🏬 2. Panel del Dueño del Negocio (Owner)
- **Métricas Financieras:** Gráficos de ingresos mensuales y semanales basados en datos reales de citas completadas.
- **Gestión del Equipo:** Alta, baja y edición de trabajadores, asignación de horarios independientes y cálculo de comisiones/ingresos por empleado.
- **Tienda Online (E-Commerce):** Catálogo de productos interactivo. Capacidad de subir hasta 3 fotos por producto, gestión de stock, descuentos por porcentaje y organización automática por categorías.
- **Fidelización (Loyalty):** Sistema de "Racha de Asistencias" que premia a los clientes frecuentes con servicios gratuitos.

### ✂️ 3. Panel del Trabajador (Worker)
- **Agenda Privada:** Cada trabajador ve únicamente sus propias citas.
- **Catálogo de Servicios:** Creación de servicios personalizados con duración, precio y fotografía descriptiva.
- **Horarios Flexibles:** Configuración de jornada laboral con opciones de descansos o turnos divididos.
- **Notificaciones Web Push:** Alertas en tiempo real (con sonido y banner) cada vez que un cliente reserva, reagenda o cancela.

### 👤 4. Portal del Cliente (B2C)
- **Smart Search:** Buscador global de barberías.
- **Flujo de Reserva sin fricción:** Selección de profesional, servicio, fecha y hora (calculada inteligentemente según descansos y citas previas).
- **Tienda Premium:** Carrusel automático CSS de productos, carrito de compras y pedidos directos a través de WhatsApp.
- **Auto-Timezone y Precios:** El sistema detecta el país para adaptar la moneda y el formato de los precios de forma nativa.

---

## 🏗️ Arquitectura del Sistema

El proyecto fue migrado de un monolito básico a una arquitectura **Serverless Modular de Alto Rendimiento**.

### Frontend (Client-Side)
- **Vanilla JS Avanzado (SPA):** No utiliza frameworks pesados como React o Vue. El sistema inyecta las vistas HTML dinámicamente (`loader.js`) para lograr tiempos de carga instantáneos.
- **PWA Ready:** Configurado con `manifest.json` y `sw.js` (Service Worker) para instalarse nativamente en dispositivos móviles.
- **Modularidad:** Separación limpia de vistas en `/frontend/views/` (`admin.html`, `biz.html`, `worker.html`, `client.html`).

### Backend (Serverless en Vercel)
- **Express.js Unificado:** Para evitar el límite estricto de funciones serverless gratuitas, toda la API se enruta a través de un único "Cerebro" en `api/index.js`.
- **Microservicios Internos:** La lógica reside en `backend/routes/` (`authRoutes.js`, `bizRoutes.js`, `syncRoutes.js`, etc.).
- **Seguridad Criptográfica (JWT):** Las rutas sensibles están protegidas por un Middleware "Cadenero" (`auth.js`) que valida tokens JWT. *Las contraseñas de los usuarios jamás viajan de la base de datos al frontend.*

---

## 💾 Base de Datos (Supabase)

El sistema utiliza **Supabase (PostgreSQL)** alojado en la nube. Las tablas principales incluyen:

- `super_admins`: Credenciales de acceso maestro.
- `businesses`: Perfil de las barberías, dueños, suscripciones y configuración local.
- `workers`: Profesionales que laboran en una barbería.
- `services` & `products`: Catálogo de la empresa.
- `appointments`: Citas agendadas.
- `clients`: Registro histórico de consumidores.
- `notifications` & `push_subscriptions`: Sistema de mensajería y persistencia de suscripciones VAPID.

---

## 🔌 Integraciones de Terceros

1. **Supabase Realtime (WebSockets):** Mantiene las agendas actualizadas sin recargar la página.
2. **Web Push API Nativo (VAPID):** Reemplazo completo de Firebase para el envío de notificaciones push ultraligeras a navegadores y móviles.
3. **Resend (Emailing):** Envío transaccional de correos (Códigos de verificación, recuperación de contraseñas, confirmaciones de citas).
4. **Stripe (Pagos):** Integración con Checkout Sessions para el cobro del modelo de suscripción mensual SaaS (MRR).
5. **ImgBB API:** Carga de imágenes directamente desde el cliente (Frontend) para ahorrar ancho de banda y memoria en el servidor.

---

## 📁 Estructura del Proyecto

```text
citas_pro/
├── api/
│   └── index.js                 # Entry point del servidor Express (Vercel Serverless Function)
├── backend/                     # Lógica interna del servidor (Ignorada por Vercel Functions)
│   ├── middlewares/
│   │   └── auth.js              # Validación JWT
│   ├── routes/                  # Controladores de la API
│   │   ├── appointmentRoutes.js
│   │   ├── authRoutes.js
│   │   ├── bizRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── syncRoutes.js
│   │   ├── utilRoutes.js
│   │   └── workerRoutes.js
│   └── db.js                    # Conexión a Supabase
├── frontend/                    # Componentes modulares inyectados dinámicamente
│   ├── components/
│   │   └── modals.html          # Ventanas flotantes, alertas y popups
│   └── views/
│       ├── admin.html
│       ├── barber-portal.html
│       ├── biz.html
│       ├── client.html
│       └── worker.html
├── assets/                      # Recursos estáticos y lógica del navegador
│   ├── css/
│   ├── img/
│   └── js/
│       ├── admin.js             # Lógica del Super Admin
│       ├── app.js               # Lógica global, Auth y Event Listeners
│       ├── biz.js               # Lógica del Owner
│       ├── client-portal.js     # Flujo de reservas
│       ├── config-pais.js       # Precios e Inteligencia Regional
│       ├── db.js                # Helpers de Base de datos Local / Nube
│       ├── finanzas-realdata.js # Cálculos matemáticos y gráficos
│       ├── loader.js            # Inyector de HTML asíncrono
│       ├── realtime.js          # Supabase WebSockets
│       ├── script-tienda.js     # E-Commerce Admin
│       ├── cliente-tienda.js    # E-Commerce Cliente
│       └── workers.js           # Lógica del Trabajador
├── index.html                   # Shell principal de la Aplicación
├── tienda.html                  # Shell de la Tienda de Productos
├── sw.js                        # Service Worker (Caché y Web Push Notifications)
├── server.js                    # Servidor de Desarrollo Local
└── vercel.json                  # Reglas de enrutamiento para Producción
```

---

## ⚙️ Configuración y Despliegue

### Variables de Entorno Requeridas (`.env`)

Para que el sistema funcione en local o producción, se requieren las siguientes variables en Vercel o en un archivo `.env`:

```env
SUPABASE_URL=https://[TU-PROYECTO].supabase.co
SUPABASE_ANON_KEY=[TU-ANON-KEY]
JWT_SECRET=[TU-SECRETO-PARA-TOKENS]
RESEND_API_KEY=[TU-KEY-DE-RESEND]
STRIPE_SECRET_KEY=[TU-KEY-DE-STRIPE]
VAPID_PUBLIC_KEY=[KEY-PUBLICA-WEB-PUSH]
VAPID_PRIVATE_KEY=[KEY-PRIVADA-WEB-PUSH]
```

### Ejecución Local

1. Clonar el repositorio.
2. Instalar dependencias del servidor:
   ```bash
   npm install
   ```
3. Levantar el entorno de desarrollo (con Vercel CLI o Node nativo):
   ```bash
   vercel dev
   # O si usas el script local:
   node server.js
   ```
4. Abrir en el navegador `http://localhost:3000`

### Despliegue en Producción (Vercel)

El proyecto está optimizado para Vercel.
Al hacer push a la rama `main`, Vercel leerá automáticamente el archivo `vercel.json`, el cual redirigirá todas las peticiones que empiecen con `/api/*` hacia el monolito de Express en `api/index.js`.

---

## 🛡️ Notas de Seguridad

- **Cero Exposición de Contraseñas:** El backend NUNCA devuelve la columna de contraseñas de los usuarios a través de las peticiones `GET /api/get-biz` o `GET /api/get-db`.
- **Entornos Separados:** Se recomienda estrictamente mantener un entorno `DEV` y un entorno `PROD` de Supabase separados para evitar mezclar datos de prueba con facturación real.

---

*Desarrollado con ❤️ para escalar negocios de cuidado personal al siguiente nivel.*