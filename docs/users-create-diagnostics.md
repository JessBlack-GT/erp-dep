# Diagnóstico de POST /api/v1/users

## Evidencia y límite del diagnóstico

El código local no genera 502 en este flujo. Los errores de creación se convierten
en 400/401/403/409/500 por `auth/security-errors.js`; los fallos al resolver permisos
devuelven 503. No se dispone de logs de Render ni de una reproducción autenticada
del incidente. No se puede atribuir el 502 a una función concreta ni afirmar que se
ha corregido su causa en producción. No se modificó ni desplegó el entorno remoto.

## Flujo revisado

- Frontend: `src/services/api.js`, `userService.create`, POST `/users`, base URL
  `PUBLIC_API_BASE_URL`, timeout de cliente de 15 segundos.
- Backend: `app.js` → `routes/index.js` → `users.routes.js`.
- Autenticación JWT: `authenticateToken`; acceso vigente y RBAC:
  `requirePermission('users.create')` → `rbac.resolveAccess`.
- Controller `users.controller.create` → `users.service.create`.
- Validación `users.validation.payload`: campos permitidos, email normalizado,
  contraseña de 12 caracteres a 72 bytes y rol válido.
- `administration.transaction`: transacción Mongoose, consulta/bloqueo del actor
  y su rol, nueva comprobación de permisos y sesión; `assignable` comprueba el rol
  del nuevo usuario. Se conserva esta protección frente a cambios concurrentes.
- Instancia de `users.model`, validación Mongoose, hook previo a save con bcrypt
  (salt coste 12), inserción MongoDB e índice único de email. Los duplicados se
  resuelven mediante el índice, sin introducir una consulta vulnerable a carreras.
- Se espera el commit de la transacción, se prepara el mensaje y se llama al
  transporte existente `email.sendEmail`, con `EMAIL_FROM` del servidor.
- El DTO público conserva sus campos y la respuesta `{ success: true, data }`, 201.
  `users.repository.create` y `auth.service.register` NO intervienen en esta ruta.

Antes de este cambio, la ruta administrativa no llamaba al servicio de correo.
Por tanto, ese envío no explica por sí mismo el 502 observado en esta versión.
Los cambios locales previos en register y sus pruebas se conservaron.

## Lectura en Render

Buscar `users.create stage_started`, `stage_completed`, `stage_failed` y `response`.
Etapas: request_received, authentication, validation, authorization,
database_lookup, database_transaction, password_hash, user_create, user_save,
database_commit, welcome_email_prepare, welcome_email_send, response.
Cada error contiene únicamente los siete campos técnicos solicitados, además
del timestamp/nivel/mensaje fijo del logger. No se imprimen excepciones completas.
Nombres/códigos de texto son listas permitidas; códigos MongoDB numéricos se
conservan. El texto del proveedor se sustituye por un resumen fijo seguro: no se
confía en expresiones regulares para eliminar secretos arbitrarios.

Al reproducir después del despliegue, correlacionar la hora de Network con los
logs de aplicación y eventos de Render. Un inicio sin finalización identifica
la operación pendiente; revisar también reinicios, memoria y eventos del proxy.
Si no aparece request_received, la petición no alcanzó el router instrumentado
(revisar middleware anterior, proxy, URL y disponibilidad). Si aparece response
201 pero el navegador recibe 502, investigar el trayecto de respuesta/proxy.
No deducir la causa únicamente de la última etapa cuando hay peticiones concurrentes.

El envío está fuera del callback reintentable: un solo intento por creación
confirmada, ninguno en duplicados, save fallido o commit fallido. Un error de
Resend/red/timeout se registra y sigue el 201 sin eliminar el usuario. No hay
reintentos de correo. No se garantiza entrega si el proceso muere entre commit
y envío; resolver esa garantía requeriría un outbox persistente. El transporte
mantiene su timeout existente de 10 segundos; no se alteró forgot-password.
