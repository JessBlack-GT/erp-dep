# M01 — Evidencia de validación

Fecha: 2026-09-29. Baseline verificado: `0fb14c6b64d96d41ff85bb01d82876214dd621f5`.
Inicialmente main limpio e igual a origin/main. Trabajo en
`codex/m01-users-security-completion`, sin merge a main.

## Pruebas finales

| Suite | Pasaron | Fallaron | Omitidas/TODO | Exit |
|---|---:|---:|---:|---:|
| Backend global, Mocha (62 suites) | 617 | 0 | 0 | 0 |
| Frontend global, Jest (28 suites) | 222 | 0 | 9 TODO preexistentes | 0 |
| API real M01, HTTP + Atlas | 90 | 0 | 0 | 0 |
| Build web | Éxito | 0 | — | 0 |

Comandos desde raíz, sin watch:

```powershell
npm.cmd test --workspace=apps/backend -- --reporter json --reporter-option output=../../tmp/m01-backend.json
npm.cmd test --workspace=apps/frontend -- --json --outputFile=../../tmp/m01-frontend.json
npm.cmd run build:web --workspace=apps/frontend
node apps/backend/scripts/validate-m01-real.cjs
```

Los JSON/logs completos de ejecución permanecen en tmp ignorado. El resumen
seguro versionado es [M01-results.json](M01-results.json). No se instalaron ni
modificaron dependencias. La configuración Prettier heredada no se pudo cargar;
se formatearon los archivos cambiados con `--no-config --single-quote
--print-width 100`. Esto no reemplaza una auditoría global de lint.

## Cobertura y regresión

Backend: CRUD lógico de usuarios, consulta, búsqueda/filtros/paginación,
duplicados, errores seguros, allowlists, IDs, campos públicos, metadatos,
roles personalizados, diez roles protegidos, autoelevación y elevación de
terceros, ámbito delegado, alias heredado, 401/403, token inválido/expirado,
revocación dinámica, logout, refresh, cambio de contraseña y versión de sesión.
Pruebas de transacción comprueban revalidación del actor y retorno DTO frente a
metadatos de commit del driver. No se afirma una prueba de carga concurrente.

Frontend: pantallas, formulario, validaciones, carga/vacío/errores, filtros,
paginación, permisos, navegación, restauración, logout e invalidación. Se prueba
que respuestas tardías durante logout no restauran contexto autenticado.
Todas las suites anteriores M03–M06 y UI-01–04 se mantienen. Frente al baseline
527 backend / 191 frontend, se agregan 90 backend y 31 frontend; los 9 TODO
preexistentes no se convierten en aprobaciones ni se eliminan.

Regresión real M03–M06 en esta fase: GET customers, suppliers, products e
inventory/balances con 200. Es un smoke de lectura, no una repetición completa
de todos los CRUD reales de esos módulos; sus suites completas aisladas sí pasan.

## MongoDB/API real

Conexión: **exitosa**. Entorno: **QA exclusiva previamente autorizada**.
Se usa el guard existente: NODE_ENV development/test, rechazo de producción,
coincidencia exacta con M03_QA_DATABASE y MONGODB_DB_NAME. La configuración local
no se reproduce ni se modifica. No se accede a datos de producción.

El runner genera contraseña aleatoria por ejecución, identificadores únicos,
rechaza colisiones de roles del sistema y limpia solo IDs/marcadores propios.
Última ejecución API: CREATED 5 usuarios + 2 roles; CLEANED 5 + 2.
E2E: CREATED 4 usuarios + 1 rol; CLEANED 4 + 1. **CREATED = CLEANED**.
No dropDatabase, dropCollection ni deleteMany global.

Hubo intentos anteriores bloqueados por red/lista IP, sin datos creados. Tras
confirmación del usuario se retomó QA. Dos ejecuciones iniciales de aplicación
detectaron que Mongoose devolvía metadatos del commit en lugar del DTO; se
corrigió capturando el resultado del callback y se añadió regresión. Sus cuatro
usuarios y un rol por intento se limpiaron. Las ejecuciones completas posteriores
pasaron 90 checks cada una y limpiaron sus propios fixtures. No se ocultan estos
fallos iniciales ni se contabilizan como pruebas finales aprobadas.

## E2E web autenticado

Ejecutado en navegador contra frontend local, backend real y Atlas QA:

1. Login admin → shell → usuarios; recarga restaura sesión mediante servidor.
2. Crear usuario → detalle → editar apellido → asignar sales → desactivar.
3. Roles → crear rol personalizado con customers.read; sistema sin controles de edición.
4. Logout admin → login; revocación persistida en DB.
5. Login usuario restringido → Usuarios/Roles ausentes → contenido denegado.
6. Logout restringido → login → recarga sigue sin sesión.

Verificación adicional por lectura de MongoDB confirmó edición, rol, estado,
rol personalizado y revocación del admin. El token del usuario restringido
expiró durante una pausa: su logout respondió 401 y limpió correctamente el
estado local. No se afirma revocación remota en ese caso; logout/refresh
revocados están cubiertos por la API real. Una aserción del verificador que
confundía ambos casos se corrigió, sin modificar el resultado del backend.

Revisión visual: desktop 1440×900, tablet 768×1024, mobile 390×844, sin
desbordamiento horizontal en las vistas revisadas. Capturas locales ignoradas:
m01-desktop.png, m01-tablet.png, m01-mobile-denied.png. La captura temprana
m01-mobile.png se descarta por estado de viewport transitorio.
Se cerró la pestaña creada, se restauró el viewport y se detuvieron los servidores QA.
El E2E es un recorrido guiado con evidencia, no una suite Playwright versionada.
Cambio de contraseña validado por API y mocks; no ejecutado mediante formulario real.
Android: **NOT EXECUTED**. iOS: **NOT EXECUTED**.

## Seguridad y dictamen

.env, MongoDB.env, credenciales y tmp ignorados; ninguna credencial QA versionada.
Escaneo de historial y árbol de trabajo sin hallazgos; no se reproducen valores.
JWT/MongoDB usan entorno, respuestas públicas sin hashes/versiones y errores
sanitizados. Revisión `git diff --check` sin problemas. Contraseñas nuevas de
prueba se generan al ejecutar; no se incorporan fixtures con contraseñas fijas.

**M01: APROBADO** para el alcance solicitado. Límites declarados, no bloqueantes:
Android/iOS sin ejecutar; recuperación por correo futura; AsyncStorage sin
cifrado; sin gestión individual de dispositivos; protección conservadora de
superadmin; Dashboard preexistente pendiente; configuración global de formato
heredada pendiente. Push normal de la rama tras validación; main no integrado.
Siguiente módulo funcional M14 — Configuración: **NO INICIADO**.
UI-05 Dashboard: **PAUSADA**. M13/M07/M08 sin iniciar.
