# Validación M04 — Proveedores

Fecha local: 2026-09-23, America/Mexico_City. Ejecuciones finales: 2026-09-24 UTC. Dictamen: **M04: APROBADO** dentro del alcance probado aquí. [Resultados estructurados](M04-results.json) · [Modelo, API y RBAC](../modules/SUPPLIERS.md).

## Baseline y alcance

Baseline `main`: `ddfd18f6118ddfd428f36ec56e338ba446547acb`. Se comprobó árbol limpio, se ejecutó `git pull --ff-only origin main`, se verificó igualdad local/remoto y se creó `codex/m04-suppliers` desde ese commit. No se hace merge a main ni force push.

La base contenía scaffolding backend vacío de suppliers y exports frontend sin pantallas implementadas. Se reemplazó con dominio funcional, UI real, servicio API reutilizado, permisos centrales y suites de comportamiento. No se modificaron package.json, lockfile ni dependencias. M05 no se desarrolló.

No hay cambios en `apps/backend/src/modules/customers` ni `apps/frontend/src/features/customers`. La extensión del catálogo RBAC requirió que los helpers de validación M03 filtraran explícitamente `customers.*` y usaran `unregistered.read` como permiso desconocido; `suppliers.read` ya es válido. Conservan las mismas aserciones de Clientes. La navegación compartida añade Proveedores y cierre de sesión; no cambia las pantallas ni reglas de Clientes. Se conservaron las evidencias M03 históricas.

## Pruebas aisladas finales

| Suite | Total | Pass | Fail | Omitidas | TODO | Exit |
|---|---:|---:|---:|---:|---:|---:|
| Backend M04 funcional/modelo | 47 | 47 | 0 | 0 | 0 | 0 |
| Backend M04 RBAC | 42 | 42 | 0 | 0 | 0 | 0 |
| Frontend M04 UI/API/navegación | 30 | 30 | 0 | 0 | 0 | 0 |
| Backend M03 original | 47 | 47 | 0 | 0 | 0 | 0 |
| Frontend M03 original | 13 | 13 | 0 | 0 | 0 | 0 |
| Backend global | 284 | 284 | 0 | 0 | 0 | 0 |
| Frontend global | 81 | 70 | 0 | 0 | 11 | 0 |

Las suites específicas son subconjuntos del global: no sumar filas como pruebas independientes. Los 30 tests frontend M04 son 21 de UI/UX/RBAC, 7 de contrato del cliente Axios y 2 de navegación. Las pruebas aisladas usan stubs de persistencia y mocks de servicios frontend; no se presentan como integración Atlas. La suite global incluye las pruebas RBAC M03 y los tests de arranque/navegación existentes.

Se ejecutaron globales equivalentes antes de Atlas, con los mismos resultados finales. Ninguna prueba fallida fue eliminada para obtener verde. El único assert trivial del scaffolding suppliers se reemplazó por tres pruebas reales de esquema e índices. El TODO de suppliers se resolvió mediante implementación; los otros 11 siguen explícitos: componentes comunes, dashboard, products, inventory, sales, purchases, finance, human-resources, reports, notifications, settings.

Comandos desde `apps/backend` (todos terminan, sin watch):

```powershell
node ../../node_modules/mocha/bin/mocha.js tests/suppliers.test.js src/modules/suppliers/suppliers.test.js --reporter json --reporter-option output=../../tmp/m04-backend-final.json
node ../../node_modules/mocha/bin/mocha.js tests/suppliers.rbac.test.js --reporter json --reporter-option output=../../tmp/m04-rbac-final.json
node ../../node_modules/mocha/bin/mocha.js "tests/customers*.test.js" src/modules/customers/customers.test.js --reporter json --reporter-option output=../../tmp/m04-m03-backend-final.json
node ../../node_modules/mocha/bin/mocha.js "tests/**/*.test.js" "src/**/*.test.js" --reporter json --reporter-option output=../../tmp/m04-global-backend-final.json
```

Desde `apps/frontend`:

```powershell
node ../../node_modules/jest/bin/jest.js suppliers --watch=false --runInBand --json --outputFile=../../tmp/m04-frontend-final.json
node ../../node_modules/jest/bin/jest.js --runTestsByPath tests/customers.frontend.test.js tests/customers.api.test.js tests/customers.navigation.test.js --watch=false --runInBand --json --outputFile=../../tmp/m04-m03-frontend-final.json
node ../../node_modules/jest/bin/jest.js --watch=false --runInBand --json --outputFile=../../tmp/m04-global-frontend-final.json
```

Build web desde raíz: `node apps/frontend/scripts/web.cjs --build`, exit 0. Backend y frontend arrancaron realmente durante E2E. Los procesos QA y el navegador temporal finalizaron después de la validación.

## API y MongoDB reales

Entorno: base **QA exclusiva previamente autorizada**, seleccionada con `MONGODB_DB_NAME` y confirmada por `M03_QA_DATABASE`; se reutiliza el preflight existente. Conexión **SUCCESS**. No se imprime URI, usuario, contraseña ni JWT. Las credenciales locales permanecen ignoradas.

Desde raíz:

```powershell
node apps/backend/scripts/validate-m04-real.cjs
node apps/backend/scripts/validate-m03-real.cjs
node apps/backend/scripts/validate-rbac-real.cjs
```

| Ejecución final | Checks | Pass | Fail | Exit | Creados | Limpiados |
|---|---:|---:|---:|---:|---:|---:|
| M04 HTTP dominio + RBAC | 109 | 109 | 0 | 0 | 17 | 17 |
| Regresión M03 HTTP | 26 | 26 | 0 | 0 | 3 | 3 |
| Regresión M03 RBAC | 138 | 138 | 0 | 0 | 26 | 26 |

M04 comprende 27 checks de dominio/errores y 82 de login/autorización. Comprueba respuestas y persistencia, incluido que las denegaciones no modifiquen documentos.

| Operación real M04 | HTTP | Resultado |
|---|---|---|
| Login de los diez roles | 200 | PASS |
| Alta completa y alta con solo nombre | 201 | PASS |
| Listado, detalle, búsqueda, filtros combinados | 200 | PASS |
| Dos páginas con timestamps iguales y desempate por ID | 200 | PASS |
| Actualización y cambio de estado | 200 | PASS |
| Duplicado de email / clave fiscal | 409 | PASS |
| Misma referencia fiscal en país distinto | 201 | PASS |
| Payload/nombre/email/query/ID inválidos | 400 | PASS |
| ID inexistente | 404 | PASS |
| Sin token / token inválido | 401 | PASS |
| Sin permiso | 403 | PASS |
| Elevación vía administración de usuarios | 403 | PASS |
| Mass assignment / borrar mediante PATCH de estado | 400 | PASS |
| Eliminación lógica | 200 | PASS |
| Detalle eliminado / intento de reactivación | 404 | PASS |
| Listado posterior excluye eliminado | 200 | PASS |

Una primera ejecución del runner encontró un defecto **en su fixture**: el identificador fiscal sintético contenía `_`, que el validador correctamente rechaza. Se corrigió el generador para respetar el formato fiscal sin relajar la validación. Ese intento tuvo exit 1, 10 logins aprobados y **10/10 usuarios limpiados**. La repetición completa pasó 109/109. Se registra como intento fallido histórico, no se oculta ni se cuenta como suite final aprobada.

## Autorización real de diez roles

Cada rol probó siete endpoints: listado, búsqueda, detalle, crear, editar, estado y eliminar. La siguiente tabla condensa los códigos; GET agrupa tres rutas y PATCH incluye edición/estado.

| Rol | GET | POST | PATCH | DELETE | Resultado |
|---|---:|---:|---:|---:|---|
| superadmin | 200 | 201 | 200 | 200 | PASS |
| admin | 200 | 201 | 200 | 200 | PASS |
| manager | 200 | 201 | 200 | 403 | PASS |
| sales | 200 | 403 | 403 | 403 | PASS |
| purchasing | 200 | 201 | 200 | 403 | PASS |
| warehouse | 200 | 403 | 403 | 403 | PASS |
| finance | 200 | 403 | 403 | 403 | PASS |
| hr | 403 | 403 | 403 | 403 | PASS |
| auditor | 200 | 403 | 403 | 403 | PASS |
| user | 403 | 403 | 403 | 403 | PASS |

M04 ejercita la matriz central predeterminada sin alterar documentos Role. La regresión RBAC real M03 ejerce además roles persistidos, revocación, usuarios inactivos/eliminados y claims JWT obsoletos. La autorización compartida consulta identidad/política vigente; el frontend no es la barrera de seguridad.

## E2E — AUTOMATED

Navegador real sobre React Native Web local, backend real y Atlas QA. Automatización mediante controles accesibles del navegador; **ningún paso se atribuye a validación manual**.

1. Cerrar una sesión antigua e iniciar sesión con la cuenta temporal QA.
2. Navegar a Proveedores: 21 semillas, página 1 con 20 filas; Siguiente muestra página 2 con la fila restante; Anterior vuelve a página 1.
3. Crear proveedor con nombre marcado, email sintético, país US, categoría QA UI, condiciones Net 30 y moneda USD; navegar al detalle cargado por API.
4. Editar nombre, guardar, regresar al detalle y verificar el valor actualizado.
5. Buscar nombre editado y filtrar categoría, país, estado activo y tipo Empresa: un resultado. Cambiar país a CA: cero resultados y mensaje vacío. Restaurar US: reaparece.
6. Desactivar y comprobar `inactive` directamente en MongoDB con el helper; el nombre editado, país y categoría también quedaron persistidos. Reactivar desde UI y observar Activo.
7. Abrir eliminación y cancelar sin perder el registro; repetir y confirmar. La lista filtrada queda vacía.
8. Consultar MongoDB mediante helper: el documento sigue presente con `status: deleted`, nombre editado y demás valores correctos. Limpiar filtros devuelve las 21 semillas.
9. Cerrar sesión, cerrar pestaña y limpiar fixtures por IDs/actor/marcador: **23 creados / 23 limpiados**. Manifiesto de credenciales temporales eliminado.

Las pruebas de error de red, validación, reintento, loading y controles UX por permiso se verificaron con mocks; la matriz de permisos fue además validada por HTTP real. No se simula que todos esos errores se provocaron desde el navegador.

## Limpieza

| Grupo M04 | QA created | QA cleaned |
|---|---:|---:|
| Primer intento (fixture corregido) | 10 | 10 |
| HTTP/RBAC final | 17 | 17 |
| E2E real | 23 | 23 |
| **Total M04** | **50** | **50** |

La regresión M03 creó/limpió otros 29/29 registros. Total de estas ejecuciones reales: **79/79**. No se usó `drop`, `dropDatabase` ni limpieza global. Solo se borraron registros sintéticos propiedad de cada ejecución. La eliminación física se restringe a los helpers de limpieza QA, no a la API del módulo.

## Seguridad y revisión final

- `.env`, `.env.local`, `MongoDB.env`, variantes locales y manifiestos de credenciales están ignorados. Ningún archivo de entorno real está versionado.
- Escaneo de los 317 blobs del historial baseline y archivos actuales: sin coincidencias con los secretos locales conocidos ni candidatos de patrones de URI con credenciales, tokens o claves privadas. Se revisa nuevamente el índice antes de publicar; ningún escaneo garantiza detectar formatos desconocidos.
- Payload con `createdBy`, permisos, rol, estado arbitrario u operadores no puede modificar campos protegidos. La identidad de auditoría procede de backend.
- IDs/queries inválidos devuelven 400; inexistentes/eliminados 404. Búsqueda escapa metacaracteres regex.
- Repositorio con excepción inesperada devuelve 500 genérico sin detalles de DB ni stack, probado aisladamente; carreras de índice único devuelven 409.
- Permisos por rol comprobados con mocks y API real; purchasing no elimina ni evade el permiso enviando `deleted` mediante PATCH.
- `git diff --check` y revisión de archivos sin logs, temporales ni secretos. Sin cambios de dependencias ni alteración del dominio M03.

## Límites del dictamen

La aprobación cubre las funcionalidades implementadas y el E2E web descrito, no certifica rendimiento a gran escala ni despliegue productivo. Android/iOS no se ejecutaron; se conservaron componentes React Native compatibles. No hay validación ante autoridades fiscales, catálogo ISO exhaustivo, restauración de eliminados, migración automática de roles explícitos ni prueba concurrente de carga. Estos alcances no fueron requisitos del módulo. Los 11 TODO globales corresponden a funcionalidad futura ajena a M04.

**M03 permanece APROBADO. M04: APROBADO.**
