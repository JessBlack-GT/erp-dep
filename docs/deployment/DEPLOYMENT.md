# Correo y recuperación de contraseña

### Transporte de correo Resend

El backend dispone de `apps/backend/src/shared/services/email.js`, que exporta
`sendEmail({ to, subject, text, html })`. Envía mediante `POST https://api.resend.com/emails`
con `fetch` nativo de Node 18+, sin dependencia npm adicional ni SMTP.
Referencia: https://resend.com/docs/api-reference/emails/send-email

En el servicio backend de Render, agregar como variables de entorno:

```text
RESEND_API_KEY=<secreto de Render>
EMAIL_FROM=<remitente>
FRONTEND_APP_URL=https://erp-dep.pages.dev
PASSWORD_RESET_TOKEN_TTL_MINUTES=15
```

Usar una API key con permiso de envío y un remitente de un dominio verificado
en Resend, por ejemplo el formato `Nombre <correo@dominio-verificado>`.
Guardar los valores reales exclusivamente en Render; reiniciar/redesplegar
el backend para cargar la configuración. No configurar estas variables en el frontend.
Localmente, definirlas en `apps/backend/.env`, que carga el backend fuera de producción.
La plantilla `.env.example` las deja vacías. No se añade ninguna clave real al repositorio.

Uso desde código de backend (ruta relativa desde un módulo en `src/modules`):

```js
const { sendEmail } = require('../../shared/services/email');
const { id } = await sendEmail({
  to: recipientEmail,
  subject: 'Notificación',
  text: 'Contenido del mensaje',
});
```

`id` confirma aceptación por Resend, no entrega al buzón. El servicio permite
texto, HTML o ambos y hasta 50 destinatarios. El remitente siempre procede de
EMAIL_FROM. No registra claves, destinatarios ni contenido. Interrumpe la espera
a los 10 segundos y no reintenta automáticamente, para evitar duplicados cuando
el resultado de un envío es incierto. Un fallo HTTP, de red o de respuesta genera
un error saneado; no se propaga el cuerpo del proveedor.

Sin ambas variables el servidor puede arrancar y la autenticación sigue funcionando;
intentar enviar produce `EMAIL_NOT_CONFIGURED`, nunca un éxito simulado. Otros códigos:
`EMAIL_INVALID_MESSAGE`, `EMAIL_PROVIDER_ERROR`, `EMAIL_TIMEOUT`, `EMAIL_SEND_FAILED`.

### Recuperación de contraseña

`POST /api/v1/auth/forgot-password` recibe `{email}` y devuelve siempre el mismo
mensaje para correos válidos existentes, inexistentes o inactivos; tampoco expone
fallos de Resend. Solo los usuarios activos reciben correo. Un fallo de envío
invalida el token recién creado y genera un aviso sin datos personales. El límite
es de 5 solicitudes por IP cada 15 minutos, además del limitador global. El almacén
del limitador es local al proceso: varias instancias necesitarían un almacén compartido.

`POST /api/v1/auth/reset-password` recibe `{token,password}`. El token se genera
con 32 bytes aleatorios y solo se guarda su SHA-256 en `passwordresettokens`.
Un índice TTL sobre expiresAt elimina registros caducados; la validación también
comprueba expiresAt explícitamente, sin depender de la puntualidad del borrado TTL.
La emisión invalida tokens anteriores y serializa solicitudes sobre el usuario.
El reset consume el token, aplica bcrypt coste 12, incrementa sessionVersion e
invalida otros tokens pendientes dentro de una transacción. MongoDB debe admitir
transacciones (Atlas/replica set, igual que los módulos administrativos actuales).
No se emiten JWT ni se inicia sesión automáticamente. `/api/v1/auth/password`
conserva su comportamiento autenticado anterior.

El frontend incluye Login → Recuperar contraseña → mensaje genérico, y
`/reset-password?token=...` → nueva contraseña y confirmación → volver al Login.
FRONTEND_APP_URL debe ser un origen HTTPS sin credenciales, query ni fragmento;
solo en desarrollo se permite HTTP localhost. Si falta, se usa
https://erp-dep.pages.dev. El TTL predeterminado es 15 minutos, configurable de 1 a 60.
El correo muestra la duración configurada. El HTML web usa no-referrer para evitar
enviar la URL de recuperación como Referer; el token se elimina de los parámetros
de navegación al completar el reset. No añadir registros de cuerpos de solicitudes.

Cloudflare Pages sirve index.html para rutas SPA al no existir un 404.html en la
raíz del artefacto actual; no hace falta otro archivo de redirecciones.
Referencia: https://developers.cloudflare.com/pages/configuration/serving-pages/

Comprobación manual después de desplegar backend y frontend:
1. Configurar las cuatro variables anteriores y el remitente realmente permitido.
2. Abrir https://erp-dep.pages.dev, pulsar «¿Olvidaste tu contraseña?» y solicitar
   recuperación para una cuenta activa propia. Probar también un correo inexistente:
   el mensaje público debe ser idéntico.
3. Verificar recepción y abrir el enlace directamente, también tras recargar la página.
4. Confirmar que una contraseña corta o una confirmación distinta no se envían.
5. Guardar una contraseña válida; iniciar sesión con ella y verificar que la anterior
   falla y las sesiones previas ya no pueden acceder a endpoints protegidos.
6. Reutilizar el enlace, usar uno expirado y solicitar dos enlaces consecutivos:
   los usados/expirados y el primero de los dos deben ser rechazados.
7. Revisar que el índice TTL esté creado en la nueva colección y que no contenga
   el token original. No utilizar datos ni scripts QA para modificar producción.

No se verificó la cuenta Resend del propietario. EMAIL_FROM no tiene un remitente
inventado por defecto. El dominio de prueba resend.dev solo envía al email asociado
a la cuenta Resend; enviar a otros usuarios exige un dominio propio verificado.
Referencia: https://resend.com/docs/knowledge-base/403-error-resend-dev-domain

Verificación: las pruebas `apps/backend/tests/email.test.js` simulan la red.
La comprobación real de entrega requiere configurar Render y ejecutar una llamada
controlada a `sendEmail` para un destinatario autorizado, verificando el ID en Resend
y la recepción. No se enviaron correos reales como parte de esta implementación.
