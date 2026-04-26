# QA Checklist - DEV Stabilization

Objetivo: dejar la rama `dev` funcional y estable antes de iniciar blindaje de datos.

## Alcance de esta fase

- No agregar features nuevas.
- Validar flujos actuales end-to-end.
- Corregir regresiones funcionales.
- Cerrar con baseline estable para pasar a seguridad.

## Entorno DEV (fuente de verdad)

- Backend/API: `api/index.js` + `backend/routes/*`
- Servidor local: `server.js`
- Frontend: `index.html`, `frontend/views/*`, `assets/js/*`
- Base de datos: Supabase DEV
- Integraciones: Resend, IMGBB, Stripe, Web Push (FCM fuera de alcance por ahora)

## Criterio de estado

- `OK`: flujo validado sin errores funcionales.
- `WARN`: flujo funciona parcialmente o con riesgo de regresion.
- `FAIL`: flujo roto o bloqueante para release.
- `N/A`: no aplica en esta ronda.

## Modulo 1 - Auth y sesion

- [ ] Login super admin.
- [ ] Login negocio (owner).
- [ ] Login trabajador.
- [ ] Persistencia de sesion al recargar.
- [ ] Logout visible y funcional en todas las vistas.
- [ ] Sesion expirada maneja error sin romper UI.

## Modulo 2 - Negocio y configuracion

- [ ] Carga de perfil negocio desde API.
- [ ] Guardado de datos generales (nombre, telefono, direccion).
- [ ] Guardado de redes (`instagram`, `facebook`, `x_url`, `tiktok`).
- [ ] Configuracion no cierra sesion accidentalmente.
- [ ] Persistencia de logo/cover.

## Modulo 3 - Trabajadores

- [ ] Alta de trabajador.
- [ ] Edicion de trabajador.
- [ ] Cambio de foto/avatar sin cerrar panel.
- [ ] Eliminacion de trabajador.
- [ ] Persistencia de horario por trabajador.

## Modulo 4 - Servicios y agenda

- [ ] Alta/edicion/eliminacion de servicios.
- [ ] Asignacion de servicios por trabajador.
- [ ] Crear cita desde portal.
- [ ] Reagendar cita.
- [ ] Cancelar cita por token.
- [ ] No duplicar cita por eventos dobles.

## Modulo 5 - Portal cliente y busqueda

- [ ] Listado de negocios publicos (`/api/public-businesses`).
- [ ] Filtro/busqueda en portal.
- [ ] Reserva completa desde cliente.
- [ ] Visualizacion consistente de datos del negocio.

## Modulo 6 - Tienda

- [ ] Listado de productos.
- [ ] Carga de imagenes multiples.
- [ ] Carrusel y modal de producto.
- [ ] Carrito basico (agregar/quitar).
- [ ] Persistencia de cambios en DEV.

## Modulo 7 - Notificaciones e integraciones

- [ ] Web push para nueva cita.
- [ ] Notificacion por cancelacion.
- [ ] Envio de email (Resend) en casos principales.
- [ ] Checkout Stripe responde URL valida en DEV.
- [ ] Manejo de error cuando falta config de terceros.

## Evidencia de ejecucion

Registrar cada prueba en este formato:

- Fecha:
- Modulo:
- Caso:
- Resultado: `OK` | `WARN` | `FAIL`
- Evidencia (archivo/ruta/log):
- Observaciones:
- Accion correctiva aplicada:

## Ronda 1 - Validacion tecnica inicial

- Fecha: 2026-04-26
- Modulo: Plataforma/Backend
- Caso: Carga de modulos API (`require('./api/index.js')`) con entorno DEV.
- Resultado: `OK`
- Evidencia (archivo/ruta/log): salida `API_BOOT_OK`.
- Observaciones: backend carga rutas sin crash.
- Accion correctiva aplicada: ninguna.

- Fecha: 2026-04-26
- Modulo: Plataforma/Backend
- Caso: Sintaxis Node en `server.js`, `api/index.js`, y `backend/routes/*`.
- Resultado: `OK`
- Evidencia (archivo/ruta/log): salida `SYNTAX_OK`.
- Observaciones: no errores de parseo en archivos criticos.
- Accion correctiva aplicada: ninguna.

- Fecha: 2026-04-26
- Modulo: Integraciones externas
- Caso: Carga sin llaves inyectadas en proceso local (VAPID/Resend).
- Resultado: `WARN`
- Evidencia (archivo/ruta/log): warnings de arranque para Web Push y Resend.
- Observaciones: hay fallback correcto; no bloquea arranque.
- Accion correctiva aplicada: ninguna (esperado en entorno sin variables completas).

## Ronda 2 - Diagnostico funcional (sin cambios de codigo)

- Fecha: 2026-04-26
- Modulo: API publica
- Caso: `GET /api/public-businesses`.
- Resultado: `OK`
- Evidencia (archivo/ruta/log): respuesta `array:2`.
- Observaciones: endpoint publico operativo contra Supabase DEV.
- Accion correctiva aplicada: ninguna.

- Fecha: 2026-04-26
- Modulo: API negocio
- Caso: `GET /api/get-biz?id=<primer_negocio>`.
- Resultado: `OK`
- Evidencia (archivo/ruta/log): respuesta `biz:barber-shop-mnutuhvt`.
- Observaciones: carga de negocio funcional usando id real.
- Accion correctiva aplicada: ninguna.

- Fecha: 2026-04-26
- Modulo: Validaciones API
- Caso: `POST /api/login` sin body.
- Resultado: `OK`
- Evidencia (archivo/ruta/log): `expected-400`.
- Observaciones: validacion de campos requeridos activa.
- Accion correctiva aplicada: ninguna.

- Fecha: 2026-04-26
- Modulo: Validaciones API
- Caso: `POST /api/admin-login` con credenciales invalidas.
- Resultado: `OK`
- Evidencia (archivo/ruta/log): `expected-401`.
- Observaciones: rechazo correcto de credenciales invalidas.
- Accion correctiva aplicada: ninguna.

- Fecha: 2026-04-26
- Modulo: Validaciones API
- Caso: `GET /api/get-appointment-by-token` sin token.
- Resultado: `OK`
- Evidencia (archivo/ruta/log): `expected-400`.
- Observaciones: validacion correcta.
- Accion correctiva aplicada: ninguna.

- Fecha: 2026-04-26
- Modulo: Validaciones API
- Caso: `GET /api/sync` sin `worker_id`.
- Resultado: `OK`
- Evidencia (archivo/ruta/log): `expected-400`.
- Observaciones: validacion correcta.
- Accion correctiva aplicada: ninguna.

- Fecha: 2026-04-26
- Modulo: Seguridad API
- Caso: `GET /api/get-db` sin token.
- Resultado: `OK`
- Evidencia (archivo/ruta/log): HTTP `403`.
- Observaciones: el endpoint protegido rechaza acceso sin auth.
- Accion correctiva aplicada: ninguna.

- Fecha: 2026-04-26
- Modulo: Plataforma local (servido frontend)
- Caso: `GET /`, `GET /index.html`, `GET /assets/js/app.js`, `GET /frontend/views/client.html`.
- Resultado: `FAIL`
- Evidencia (archivo/ruta/log): HTTP `404` en todas esas rutas.
- Observaciones: en servidor local actual solo API responde; archivos estaticos no se estan sirviendo.
- Accion correctiva aplicada: ninguna (pendiente decision para fix minimo).

- Fecha: 2026-04-26
- Modulo: Integracion pagos
- Caso: `POST /api/stripe-checkout` sin payload minimo.
- Resultado: `OK`
- Evidencia (archivo/ruta/log): `expected-500`.
- Observaciones: endpoint responde controlado en ausencia de configuracion/parametros.
- Accion correctiva aplicada: ninguna.

## Definicion de "Listo para blindaje"

- Sin `FAIL` en modulos 1 al 6.
- Integraciones externas sin bloqueantes (`WARN` permitidos con fallback).
- Sin regresiones visuales graves reportadas.
- Baseline validada y documentada en este archivo.
