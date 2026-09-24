# M05 — Validación de Productos y servicios

Fecha: 2026-09-24. Dictamen técnico: **M05: APROBADO**. [Modelo, decisiones y API](../modules/PRODUCTS-SERVICES.md) · [Resultados estructurados](M05-results.json).

## Git y alcance

Baseline `main` sincronizado: `65c2ed02be53e87339c0e9e6c21b9245ef9532ea`. Se verificó árbol limpio, fetch, pull --ff-only e igualdad local/remoto antes de crear `codex/m05-products-services`. No se desarrolla sobre main, no se hace merge ni se reescriben commits.

Se reemplazó el scaffolding de products por un catálogo común PRODUCT/SERVICE, con capas model/repository/service/controller/routes, validación, frontend, RBAC y pruebas. Se reutilizaron servicios y navegación existentes. No se añadieron dependencias ni se modificaron package.json/lockfile. Los dominios y pantallas de M03/M04 permanecen sin cambios; solo se extienden catálogo RBAC, navegación y cliente API compartidos. No se desarrolla M06.

SKU obligatorio, normalizado y único; barcode opcional único, exclusivo de PRODUCT. Categoría textual y unidad extensible. Precio/costo opcionales como cadenas exactas de cuatro decimales, con moneda obligatoria cuando existen. SERVICE rechaza campos físicos activos; las transiciones de tipo validan el estado completo persistido. TaxCategory es metadato, sin motor fiscal. No hay stock ni movimientos.

## Pruebas aisladas y regresión

| Suite | Total | Pass | Fail | Omitidas | TODO | Exit |
|---|---:|---:|---:|---:|---:|---:|
| M05 backend funcional/repositorio/modelo | 69 | 69 | 0 | 0 | 0 | 0 |
| M05 RBAC backend | 42 | 42 | 0 | 0 | 0 | 0 |
| M05 frontend UI/dominio/UX | 24 | 24 | 0 | 0 | 0 | 0 |
| M05 frontend servicio Axios | 7 | 7 | 0 | 0 | 0 | 0 |
| M05 frontend navegación | 2 | 2 | 0 | 0 | 0 | 0 |
| M03 backend original | 47 | 47 | 0 | 0 | 0 | 0 |
| M03 frontend, incluyendo fases posteriores | 18 | 18 | 0 | 0 | 0 | 0 |
| M04 backend + RBAC | 89 | 89 | 0 | 0 | 0 | 0 |
| M04 frontend | 30 | 30 | 0 | 0 | 0 | 0 |
| Backend global final | 394 | 394 | 0 | 0 | 0 | 0 |
| Frontend global final | 114 | 104 | 0 | 0 | 10 | 0 |

Build web final: PASS, exit 0. Las suites específicas son subconjuntos de los globales: no sumar como pruebas independientes. Antes de Atlas se ejecutaron M05 aislado y globales con los mismos resultados; se repitieron los globales después del E2E. La regresión global incluye también las suites existentes de autenticación/RBAC M03 y arranque. No se repitieron los runners Atlas de M03/M04; su regresión en esta fase es aislada.

Los 10 TODO legítimos son componentes comunes, dashboard, inventory, sales, purchases, finance, human-resources, reports, notifications y settings. Products deja de ser TODO porque está implementado. El antiguo assert trivial del scaffolding se reemplaza por pruebas reales, no se eliminan pruebas fallidas para lograr verde.

### Comandos

Desde `apps/backend`:

```powershell
node ../../node_modules/mocha/bin/mocha.js "tests/products*.test.js" src/modules/products/products.test.js --reporter json --reporter-option output=../../tmp/m05-isolated-backend.json
node ../../node_modules/mocha/bin/mocha.js "tests/customers*.test.js" src/modules/customers/customers.test.js --reporter json --reporter-option output=../../tmp/m05-m03-backend.json
node ../../node_modules/mocha/bin/mocha.js "tests/suppliers*.test.js" src/modules/suppliers/suppliers.test.js --reporter json --reporter-option output=../../tmp/m05-m04-backend.json
node ../../node_modules/mocha/bin/mocha.js "tests/**/*.test.js" "src/**/*.test.js" --reporter json --reporter-option output=../../tmp/m05-final-backend.json
```

Desde `apps/frontend`:

```powershell
node ../../node_modules/jest/bin/jest.js products --watch=false --runInBand --json --outputFile=../../tmp/m05-isolated-frontend.json
node ../../node_modules/jest/bin/jest.js customers suppliers --watch=false --runInBand --json --outputFile=../../tmp/m05-regression-frontend.json
node ../../node_modules/jest/bin/jest.js --watch=false --runInBand --json --outputFile=../../tmp/m05-final-frontend.json
```

Desde raíz: `node apps/frontend/scripts/web.cjs --build`.

## HTTP real y Atlas QA

Runner: `node apps/backend/scripts/validate-m05-real.cjs`, desde raíz. Utiliza exclusivamente el `.env` local ignorado, el preflight existente y la selección QA previamente autorizada (`MONGODB_DB_NAME` coincidente con `M03_QA_DATABASE`). No modifica credenciales ni imprime URI/JWT.

Resultado final: **SUCCESS, 122/122 checks, exit 0**, divididos en **40 de dominio/errores y 82 de login/autorización**. Se verifican respuestas HTTP y contenido/persistencia en DB, no solo códigos.

| Operación | HTTP | Resultado |
|---|---|---|
| Alta PRODUCT / SERVICE | 201 | PASS |
| Listado y detalle de ambos tipos | 200 | PASS |
| Actualización de ambos tipos | 200 | PASS |
| Búsqueda por nombre, SKU y barcode | 200 | PASS |
| Filtros PRODUCT/SERVICE, categoría, moneda y estado | 200 | PASS |
| Paginación con timestamps iguales y desempate por ID | 200 | PASS |
| Activar/desactivar | 200 | PASS |
| Duplicado SKU normalizado / barcode | 409 | PASS |
| Precio/costo negativo, números JSON, precisión excedida | 400 | PASS |
| Tipo inválido, mass assignment, stock inesperado | 400 | PASS |
| Barcode/inventario en SERVICE | 400 | PASS |
| Cambio a SERVICE conservando campos físicos | 400 | PASS |
| Cambio de tipo con limpieza explícita, y regreso a PRODUCT | 200 | PASS |
| Query o ID inválido | 400 | PASS |
| ID inexistente/eliminado | 404 | PASS |
| Sin token / token inválido | 401 | PASS |
| Sin permiso / autoelevación por API de usuarios | 403 | PASS |
| Borrado mediante endpoint de estado | 400 | PASS |
| Eliminación lógica y exclusión del listado | 200 | PASS |
| Reactivación de eliminado | 404 | PASS |

Dos intentos iniciales fallaron en CONNECT antes de crear registros (exit 1, 0/0). El diagnóstico confirmó DNS/TCP accesibles y categoría MongoDB `NETWORK_OR_IP_ALLOWLIST_UNCONFIRMED`. Se esperó a que el usuario revisara el acceso QA y avisara que estaba listo. El tercer intento completó las 122 comprobaciones. No se relajó TLS, autenticación ni protección de red desde el código.

## Diez roles contra API real

Cada rol inicia sesión y prueba siete endpoints. GET agrupa listado/búsqueda/detalle; PATCH incluye edición y estado. Todas las denegaciones preservaron el documento objetivo.

| Rol | GET | POST | PATCH | DELETE | Resultado |
|---|---:|---:|---:|---:|---|
| superadmin | 200 | 201 | 200 | 200 | PASS |
| admin | 200 | 201 | 200 | 200 | PASS |
| manager | 200 | 201 | 200 | 403 | PASS |
| sales | 200 | 403 | 403 | 403 | PASS |
| purchasing | 200 | 201 | 200 | 403 | PASS |
| warehouse | 200 | 201 | 200 | 403 | PASS |
| finance | 200 | 403 | 403 | 403 | PASS |
| hr | 403 | 403 | 403 | 403 | PASS |
| auditor | 200 | 403 | 403 | 403 | PASS |
| user | 403 | 403 | 403 | 403 | PASS |

Se usa la matriz central predeterminada. No se reescriben documentos Role existentes ni se aceptan permisos del payload. Las suites centrales existentes verifican también resolución de identidad/política persistida y revocación.

## E2E real — AUTOMATED

React Native Web local → backend real → Atlas QA. Automatización de navegador mediante controles accesibles, sin simular respuestas API y sin atribuir pasos a ejecución manual.

1. `node apps/backend/scripts/m05-ui-fixture.cjs setup`: crea un usuario temporal y 21 elementos semilla, con tipos alternados. Manifiesto privado solo en tmp ignorado.
2. Arrancar backend y web, iniciar sesión y abrir Catálogo. Primera página y segunda página (un elemento restante), retorno a primera.
3. Crear PRODUCT con SKU, barcode, categoría QA UI, unidad kg, precio 0.10, costo 0.05 y moneda USD. Detalle muestra PRODUCT y valores canónicos 0.1000/0.0500.
4. Editar nombre a marcador PRODUCT EDITED y precio a 0.1234; volver a detalle.
5. Crear SERVICE: al seleccionarlo desaparecen barcode/seguimiento de inventario. Nombre, SKU, categoría QA UI, unidad hour, precio 120, costo 30, moneda USD. Detalle muestra SERVICE y 120.0000/30.0000.
6. Editar nombre a marcador SERVICE EDITED y precio 125.1234. Buscar marcador, filtrar categoría y SERVICE: un resultado.
7. Desactivar servicio. El helper `verify` confirma ambos nombres editados, precio PRODUCT=0.1234, precio SERVICE=125.1234, unidades kg/hour y servicio inactivo directamente en MongoDB.
8. Reactivar servicio; abrir eliminación, cancelar, volver a confirmar. Listado SERVICE filtrado queda vacío. Cambiar filtro a PRODUCT encuentra el producto editado.
9. Desactivar y eliminar lógicamente PRODUCT. Limpiar filtros devuelve las 21 semillas. Cerrar sesión y pestaña.
10. `verify` comprueba ambos documentos todavía existentes con estado deleted y precios exactos. `cleanup` elimina únicamente esos fixtures y el usuario temporal: **24/24**; elimina también el manifiesto. Ambos servidores temporales se detienen.

Los errores de red, validaciones exhaustivas y combinaciones UX de permisos se probaron con mocks; la matriz de seguridad fue adicionalmente comprobada por HTTP real. No se afirma que cada combinación UX se haya ejecutado en navegador. E2E fue automatización del agente, no una suite autónoma de CI. El primer envío de login del navegador tuvo campos incompletos; al rellenarlos explícitamente se autenticó, sin cambios en el código de autenticación.

## Limpieza y seguridad

| Ejecución | QA created | QA cleaned |
|---|---:|---:|
| Intentos iniciales sin conexión | 0 | 0 |
| API/RBAC final | 17 | 17 |
| E2E | 24 | 24 |
| **Total M05** | **41** | **41** |

No se usó drop/dropDatabase ni limpieza global. API usa borrado lógico; la limpieza física solo ocurre en runners QA y se limita por IDs/marcadores/actor propios.

Escaneo de 349 blobs del historial y archivos actuales: cero coincidencias con secretos locales conocidos y cero candidatos de patrones de claves privadas, tokens o URI con credenciales. `.env`, MongoDB.env y credenciales temporales no versionados. El manifiesto E2E fue eliminado. Se revisan nuevamente los archivos antes de publicar; el escaneo no garantiza reconocer todos los formatos posibles.

Mass assignment, campos inesperados, elevación, IDs, 401/403, negativos, precisión y duplicados comprobados. Errores de repositorio inesperados devuelven 500 genérico sin detalles; carreras de índices únicos devuelven 409, comprobado aisladamente. Los importes permanecen cadenas exactas en UI/API/DB. `git diff --check` pasa y no hay cambios de dependencias.

## Alcance del dictamen

M03 y M04 permanecen aprobados sin regresión aislada. Android/iOS nativo no se ejecutó; se conservan componentes compatibles. Quedan fuera de alcance stock, movimientos, almacenes, lotes, series, motor fiscal completo, conversiones de unidades y listas avanzadas de precios. No se certificó rendimiento bajo carga. Los diez TODO globales son ajenos a M05. No se migran automáticamente permisos de Role explícitos.

**M05: APROBADO.** Publicación prevista exclusivamente en `codex/m05-products-services`, sin merge a main.
