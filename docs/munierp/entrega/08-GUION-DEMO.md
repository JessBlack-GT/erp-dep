# 08 · Guion de demostración (≈ 5 minutos)

Preparación: abra `ABRIR-DEMO.cmd` antes de empezar y pulse **Restablecer demostración**. Todo es sintético.

| Min | Perfil | Acción | Mensaje clave |
|---|---|---|---|
| 0:00 | — | Muestre la franja **MODO DEMOSTRACIÓN** y la lista de perfiles | «Es el servicio municipal real ejecutándose en el navegador, con datos ficticios. Aún no está conectado a MongoDB ni montado en el ERP.» |
| 0:20 | **Ventanilla** | *Registrar solicitud* → Obras Públicas → primer ciudadano → canal presencial → asunto «Luminaria fundida en la calle principal» → *Registrar y emitir folio* | RQ01/RQ06: folio único emitido por el servidor y acuse imprimible para el ciudadano |
| 1:00 | Ventanilla | *Abrir expediente* | El historial ya registra quién y cuándo |
| 1:15 | **Titular de Obras Públicas** (*Cambiar de perfil*) | *Solicitudes* → filtro *En espera del ciudadano* → abrir «Fuga de agua» → *Reanudar trámite* → confirmar | RQ02: cada cambio deja actor, fecha y estado en el historial |
| 2:00 | Titular | *Solicitudes* → buscar el folio `SJH-TES-SOL-2026-000001` | RQ03: un expediente de Tesorería no existe para Obras («no encontrado o sin acceso») |
| 2:20 | **Supervisor** | *Panel principal* | RQ04: indicadores del municipio, coherentes con las solicitudes listadas |
| 2:45 | **Administrador municipal** | *Dependencias* → crear «DRL · Desarrollo Rural» → intentar desactivar Obras Públicas | El servidor impide desactivar una dependencia con expedientes abiertos |
| 3:20 | Administrador | *Usuarios centrales de ejemplo* → copiar «Usuario sin membresía» → *Membresías* → asignar como Operador de Obras Públicas | RQ05: solo usuarios existentes de YJ Nexo; no se pueden crear administradores ni modificar la propia membresía |
| 3:50 | **Usuario sin membresía** | Entra y ya ve el panel como operador | Efecto inmediato |
| 4:05 | Administrador | *Membresías* → *Revocar* esa membresía → volver al usuario | El acceso se retira de inmediato |
| 4:25 | **Auditor municipal** | *Auditoría* → ver «Alta de dependencia», «Alta de membresía», «Revocación», «Acceso denegado» | RQ05: bitácora inmutable, solo para el auditor, sin IP ni datos personales |
| 4:45 | — | Reduzca la ventana a ancho de celular y navegue con Tab/Enter | RQ06: celular y teclado |
| 5:00 | — | Cierre: «Siguiente paso: montar en el ERP (Codex) y validar persistencia en MongoDB QA» | Limitaciones honestas (doc 07) |

Plan B si algo falla: *Restablecer demostración* (2 s) o recargar la página. No requiere internet.
