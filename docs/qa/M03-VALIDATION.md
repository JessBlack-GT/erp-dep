# M03 — Fase 9: RBAC y cierre definitivo

**Dictamen: APROBADO.** La matriz empresarial aprobada está aplicada y validada con usuarios, roles, JWT, HTTP y MongoDB reales. Las 60 pruebas originales siguen pasando; no hay regresiones en las suites ejecutadas. M04 no se desarrolló.

## Estado y evidencia

- Repositorio: `C:\Users\jessb\OneDrive\Desktop\RP\erp-dep`.
- Rama: `codex/m03-validation`; HEAD inicial `fdc557ef26efff089ea82d35269b5520f37c901b`; árbol inicialmente limpio.
- Evidencia anterior preservada en `history/M03-phase8.md` y `history/M03-phase8-results.json`.
- Arquitectura, matriz y extensión: [RBAC](../security/RBAC.md).
- Detalle de cada comprobación HTTP: [resultados JSON](M03-results.json).

## Implementación

Se reutilizaron User y Role. No existía Permission; los cuatro identificadores granulares se registran en un catálogo central, sin duplicar modelos. User conserva su rol string; Role puede sustituir la matriz central mediante sus permisos y estado persistidos. La base QA tenía las colecciones users/roles/customers, sin usuarios ni roles al iniciar.

`requirePermission` exige autenticación, resuelve usuario activo y rol actuales en backend y diferencia 401/403. Un fallo de autorización por DB responde 503 sin detalles sensibles y no permite la operación. Superadmin activo obtiene todas las acciones registradas desde esta capa, sin evitar autenticación. Se conserva `super_admin` como alias y `viewer` sin permisos predeterminados M03.

Los nuevos JWT contienen únicamente ID y claims temporales. Se ignoran rol/permisos obsoletos del token, permisos enviados por frontend y el antiguo campo User.permissions. Login y `/auth/me` ofrecen los permisos efectivos para UX. Cambios de Role y de estado del usuario tienen efecto con el mismo JWT en el siguiente request.

Se protegieron listado, detalle, búsqueda, estadísticas, creación, edición, estado y DELETE lógico. Se cerraron dos vías de evasión detectadas: autoasignar un rol mediante la API de usuarios y enviar `status: deleted` por PATCH. La administración de usuarios requiere política administrativa central; el perfil propio continúa disponible. El borrado lógico solo se realiza por DELETE con customers.delete. No existe borrado físico nuevo en la API.

Frontend: `usePermissions` centraliza permisos y oculta acciones Crear/Editar/Estado/Eliminar; formularios sin permiso muestran denegación. La API sigue siendo la barrera de seguridad. La instantánea UX puede actualizarse al volver a iniciar sesión; no concede derechos por sí misma.

## Resultados

| Área | Total | Pass | Fail | TODO | Omitidas | Exit code |
|---|---:|---:|---:|---:|---:|---:|
| Backend M03 original | 47 | 47 | 0 | 0 | 0 | 0 |
| Frontend M03 original | 13 | 13 | 0 | 0 | 0 | 0 |
| Backend global | 196 | 196 | 0 | 0 | 0 | 0 |
| Frontend global | 51 | 39 | 0 | 12 | 0 | 0 |
| RBAC backend aislado | 57 | 57 | 0 | 0 | 0 | 0 |
| RBAC frontend aislado | 6 | 6 | 0 | 0 | 0 | 0 |
| API real M03 | 26 | 26 | 0 | 0 | 0 | 0 |
| Autorización real MongoDB/HTTP | 138 | 138 | 0 | 0 | 0 | 0 |

Las filas originales/RBAC aisladas son subconjuntos de las suites globales; no deben sumarse como pruebas independientes. Las cantidades reales cuentan comprobaciones HTTP; también contienen aserciones de respuesta, persistencia y ausencia de modificación al denegar.

Compilación web: PASS, exit 0. Controles UX de permisos: probados con RNTL, contexto y hook reales, API simulada. **No se repitió un recorrido de navegador en esta fase**; el AUTOMATED PASS del recorrido completo con API real pertenece a fase 8 y se conserva como evidencia histórica. No se atribuyen pruebas con mocks a un navegador real. Android/iOS no ejecutados.

No se eliminaron ni debilitaron las aserciones de las 60 pruebas originales. Se adaptaron fixtures: identidad administrativa persistida simulada en las pruebas HTTP y sesión autorizada simulada en componentes; las denegaciones se prueban separadamente con RBAC real. El bootstrap usa una identidad persistida de auditor. Los 12 TODO de módulos futuros permanecen sin cambios.

La primera matriz aislada excedió el límite de 100 peticiones y obtuvo ocho fallos 429. Se configuró un límite 1000 exclusivamente en el setup de pruebas y en el proceso del runner QA; la aplicación conserva su límite predeterminado. Tras la corrección, las suites pasaron sin omitir casos.

## Roles, permisos y pruebas reales

Roles probados real y aisladamente: **superadmin, admin, manager, sales, purchasing, warehouse, finance, hr, auditor, user**. Compatibilidad super_admin/viewer: adicionalmente probada de forma aislada.

Permisos: **customers.read, customers.create, customers.update, customers.delete**.

| Política | Resultado |
|---|---|
| superadmin/admin: todas las operaciones M03 | PASS |
| manager/sales: leer, crear, actualizar; DELETE denegado | PASS |
| purchasing/warehouse/finance/auditor: solo lectura | PASS |
| hr/user: sin acceso M03 | PASS |
| Cada permiso individual persistido en Role, sin privilegios adicionales | PASS |
| Sin token y token inválido | PASS, 401 |
| Usuario autenticado sin permiso | PASS, 403 |
| Revocar permisos con el mismo token | PASS, 403 |
| Usuario inactivo o eliminado con token válido | PASS, 401 |
| Claims antiguos privilegiados firmados no elevan al usuario | PASS, 403 |
| Autoelevación vía PATCH de usuario | PASS, 403 y rol conservado |
| Bypass de DELETE mediante status en PATCH | PASS, 400 y sin borrado |
| DELETE autorizado | PASS, estado deleted persistido |

El runner usa documentos Role reales y la matriz esperada independiente. También verifica que los JWT nuevos no contengan email/rol/permisos y que login entregue la matriz efectiva. No sobrescribe roles existentes: aborta ante colisión. Los rechazos se comprueban antes de ejecutar escrituras de clientes.

Las 26 comprobaciones M03 preservadas validan login, CRUD, búsqueda, filtros, paginación normal y fechas empatadas, estado, eliminación lógica, datos inválidos, duplicados, IDs inválidos/inexistentes y tokens ausentes/inválidos/expirados. Se usa ahora un usuario QA admin autorizado, en lugar del anterior user con permisos individuales.

## MongoDB y limpieza

- Preflight: PASS; conexión: SUCCESS; entorno: **QA exclusivo ya autorizado**.
- Runner RBAC: **26 registros creados / 26 limpiados** (10 roles, 10 usuarios y 6 clientes).
- Runner API M03: **3 creados / 3 limpiados**.
- Total de esta fase: **29 creados / 29 limpiados**. No se suma la ejecución histórica de fase 8.
- Limpieza por IDs y marcadores propios, sin drop ni eliminación global. La eliminación física está limitada a fixtures QA durante limpieza; la API de clientes solo borra lógicamente.
- No se mostraron URI, credenciales, contraseñas ni tokens. No se modificó producción.

## Reproducción

Desde `apps/backend`:

```powershell
node ../../node_modules/mocha/bin/mocha.js "tests/customers*.test.js" "src/modules/customers/*.test.js" --reporter json --reporter-option output=../../tmp/phase9-backend-original.json
node ../../node_modules/mocha/bin/mocha.js "tests/**/*.test.js" "src/**/*.test.js" --reporter json --reporter-option output=../../tmp/phase9-backend-global.json
node ../../node_modules/mocha/bin/mocha.js tests/rbac.test.js --reporter json --reporter-option output=../../tmp/phase9-rbac-isolated.json
```

Desde `apps/frontend`:

```powershell
node ../../node_modules/jest/bin/jest.js --runTestsByPath tests/customers.frontend.test.js tests/customers.api.test.js tests/customers.navigation.test.js --watch=false --runInBand --json --outputFile=../../tmp/phase9-frontend-original.json
node ../../node_modules/jest/bin/jest.js --watch=false --runInBand --json --outputFile=../../tmp/phase9-frontend-global.json
```

Desde raíz, con `.env` ignorado y base QA confirmada:

```powershell
node apps/backend/scripts/validate-rbac-real.cjs
node apps/backend/scripts/validate-m03-real.cjs
node apps/frontend/scripts/web.cjs --build
```

Los runners reales y esbuild se ejecutaron con autorización fuera de la restricción de red/lectura del sandbox. No se alteraron las credenciales ni controles de autenticación para conseguir resultados.

## Seguridad, archivos y Git

`.env` y MongoDB.env siguen ignorados y fuera del índice Git. Escaneo antes de commits: **292 blobs**, 0 coincidencias con secretos locales conocidos, 0 candidatos de los patrones revisados y 0 coincidencias en archivos pendientes. Es un escaneo acotado, no una garantía sobre todos los posibles formatos de secretos.

Archivos principales:

- Backend: `src/security/rbac.js`, `middleware/authorize.js`, constantes de roles, rutas de auth/clientes/usuarios, servicio de auth/clientes.
- Pruebas backend: `tests/rbac.test.js`, fixtures de bootstrap/HTTP y setup; `scripts/validate-rbac-real.cjs`, fixture del runner M03.
- Frontend: `hooks/usePermissions.js`, listado/formulario/detalle de Clientes; `tests/rbac.test.js` y fixtures de las pruebas de componentes.
- Documentación: `docs/security/RBAC.md`, informe y JSON actuales, copias históricas de fase 8. El JSON contiene la lista exacta de archivos de código.
- Dependencias modificadas: ninguna.

Commits de implementación:

- `08e6fbb` — autorización vigente, rutas M03 y protección contra elevación.
- `83b0fe3` — validación HTTP/MongoDB de la matriz aprobada.
- `9ec41df` — permisos centralizados de UX y pruebas frontend.

Documentación guardada en un commit posterior. Sin push ni merge. No se inició M04.

## Dictamen

**APROBADO** para el alcance M03 y la matriz indicada. Los 12 TODO futuros, gestión administrativa de roles aún 501 y ejecución móvil no forman parte de este cierre. Los controles autorizables de M03 están implementados y probados; la autorización deja de figurar como pendiente empresarial.
