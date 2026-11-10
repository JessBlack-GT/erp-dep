# MuniERP IA — 11 Historia F1-12 (dependencias y membresías) y QA con Playwright

Fecha: 2026-11-09 · Rama local `codex/munierp-fase0-arquitectura` (commit sobre los 5 anteriores) ·
Estado F1-12: **HECHO-A** (Express aislado, almacén en memoria, datos sintéticos; **sin MongoDB**,
**sin montar** en el ERP).

## 1. Verificación inicial

| Punto | Resultado |
|---|---|
| Commits | 5 intactos: `7eca877`, `85e5b1c`, `5f5a2fd`, `5638003`, `cecd3f8` |
| Contrato | `1.0.0-draft.2`, 24 operaciones, 5 con `x-status: pending` = las 5 rutas 501 del código |
| Copia aislada (VM) | `qa/erp2` = `main@d5b64b0` + parches; dependencias del backend copiadas a disco local de la VM |
| Archivos transferidos | `RP\munierp-fase1\f1-04\_transfer.tgz` (F1-04) y `RP\munierp-fase1\f1-12\_transfer\*` (técnicos, se pueden borrar) |
| Copia principal del usuario | En `codex/m07-stabilization` con 47 cambios sin commit: **no se tocó** |

## 2. F1-12 — operaciones implementadas

| operationId | Regla | Respuestas |
|---|---|---|
| createDependency | `dependencies.manage` (solo ADMIN_MUNICIPAL); código único por municipio; superior existente y activa | 201, 400, 401, 403, 409, 503 |
| updateDependency | Código inmutable; no se desactiva con expedientes abiertos ni subordinadas activas | 200, 400, 401, 403, 404, 409, 503 |
| listMemberships | `memberships.read`: ADMIN/SUPERVISOR/AUDITOR todo el municipio; TITULAR solo membresías que comparten su dependencia; filtros `role`, `dependency`, `status`, paginación | 200, 400, 401, 403, 503 |
| createMembership | Solo ADMIN; nunca a sí mismo; nunca ADMIN_MUNICIPAL; roles de dependencia exigen ≥ 1; dependencias activas; usuario **existente y activo en la identidad central** (`rbac.resolveAccess`, sin crear cuentas); una membresía por usuario y municipio | 201, 400, 401, 403, 404, 409, 503 |
| updateMembership | Solo ADMIN; no la propia; no otra ADMIN (bootstrap); revocación = `status: INACTIVA` con efecto en la siguiente petición; `validTo` futuro; otro municipio/inexistente/mal formado → mismo 404 | 200, 400, 401, 403, 404, 409, 503 |

**Estado del contrato:** 24/24 operaciones implementadas; ninguna responde 501.
**Revisión del contrato registrada:** `1.0.0-draft.3` (cambios en la cabecera del OpenAPI):
esquema `Membership`, filtros de listMemberships, 409 en updateDependency/updateMembership,
entidades `Dependency`/`Membership` en la bitácora, sin marcas `pending`.

**Fuera de producción:** el router lanza error si `NODE_ENV=production` y no se pasa
`allowProduction: true` (prueba incluida). La API sigue sin montarse (C-01).

## 3. Pruebas backend (VM del equipo, Node 22.23.4, en memoria)

| Suite | Resultado |
|---|---|
| Municipal (`tests/municipal/*.test.js`) | **117 passing, 0 failing** (101 previas − 1 de 501 + 1 salvaguarda + 16 F1-12) |
| Backend completo sin `phase1.stability` | **1049 passing, 0 failing** (932 ERP + 117) |
| `phase1.stability` completo (incluye ESLint) | **21 passing** — primera ejecución completa desde el 2026-10-23 |
| Mutaciones F1-12 (autoasignación, edición de ADMIN, alcance de TITULAR, aislamiento por municipio) | Detectadas: 4 pruebas fallan con las mutaciones |

Cubren: autenticación (401), superadmin del ERP sin membresía (403), membresías activas, inactivas
y vencidas, dependencias autorizadas, aislamiento entre municipios y dependencias, revocación
inmediata, cambio de dependencias que mueve el alcance del expediente, validación de entradas y
validación de cada respuesta JSON contra el esquema del contrato (ajv).

## 4. Pruebas frontend

| Suite | Resultado |
|---|---|
| `jest tests/municipal.frontend.test.js` | **12 passed** (11 previas + 1 de estado seleccionado). 1 aviso `act(...)` no bloqueante originado en `Button` del ERP tras un envío asíncrono |
| Resto de suites del frontend | No re-ejecutadas: F1-12 no cambia código del ERP (última ejecución completa: 2026-10-26, con 3 fallos preexistentes en `m01.frontend`) |

## 5. Playwright

| Aspecto | Resultado |
|---|---|
| Instalación global de Windows | No accesible desde los entornos de ejecución (la VM Linux no puede usar programas de Windows) |
| VM del equipo | Sin Playwright ni navegadores; sin red para instalarlos |
| Nube | Playwright 1.63.0 + **Chromium**; Firefox y WebKit no instalados y descarga bloqueada |
| Interfaz probada | Arnés `apps/frontend/qa/municipal-harness.web.jsx` → `MunicipalWorkspaceScreen` con **API SIMULADA** (identificado en pantalla y en evidencias) |
| Escenarios | 14: carga, validación, bloqueo de CURP, registro con ratón, **flujo solo con teclado**, foco visible, continuidad con reintento idempotente, error de carga, sin membresía, roles/estado ARIA, 3 anchos (360/800/1280 px), impresión del acuse |
| Resultado final (Chromium) | **14/14 aprobadas** (`run-04-final`) |
| Evidencias | 1 captura por prueba y por ejecución (4 ejecuciones, 56 capturas); en fallos además captura, video y traza; registro JSONL con navegador, fecha, escenario y resultado; reporte HTML |

**Defectos reales encontrados por Playwright y corregidos en código municipal:**
1. Opciones `role=radio` sin `aria-checked` en web (RN Web 0.19 no traduce `accessibilityState`).
2. La tecla **Espacio** no seleccionaba una opción (solo Enter).
3. Filas de la lista no interactiva sin `aria-label`: `Card` del ERP descarta `accessibilityLabel`
   cuando no tiene `onPress` → etiqueta en un elemento interno; defecto de `Card` reportado (C-18).
4. Incoherencia del mock en indicadores (no de la API).

Observación adicional (no corregida, núcleo): `Input` del ERP usa `accessibilityRole="search"` en
todos los campos, por lo que un lector de pantalla anuncia cada campo como «búsqueda» (C-19).

## 6. Inventario de archivos

**Creados:** `apps/backend/tests/municipal/http-f112.test.js`; `apps/frontend/qa/README.md`,
`.gitignore`, `municipal-harness.web.jsx`, `build-municipal-harness.cjs`,
`e2e/municipal.e2e.spec.cjs`, `e2e/playwright.config.cjs`, `e2e/static-server.cjs`;
`docs/munierp/11-F1-12-Y-QA-PLAYWRIGHT.md`.

**Modificados (módulo municipal):** `application/municipal.service.js`, `application/presenters.js`,
`domain/validation.js`, `mocks/in-memory-store.js`, `http/municipal.router.js`, `http/params.js`,
`http/erp-identity.js`, `http/isolated-app.js`, `README.md`; pruebas `http-helpers.js`,
`http.test.js`, `permissions-structure.test.js`; frontend `features/municipal/components/OptionGroup.js`,
`components/RequestList.js`, `mockApi.js`, `tests/municipal.frontend.test.js`; contrato
`municipal-v1.openapi.yaml` (draft.3); docs `06`, `07`, `08`, `10`, `README.md`.

**No modificados:** `app.js`, autenticación central, `security/rbac.js` (solo se **lee**
`resolveAccess`), rutas comerciales, Ventas, Inventario, componentes comunes del ERP, `package.json`,
lockfiles, `main`.

## 7. Siguiente historia recomendada

**F1-05 — repositorio MongoDB** con la misma interfaz del almacén en memoria, para re-ejecutar las
117 pruebas contra la base QA municipal en cuanto Codex resuelva **C-05**. Mientras tanto, sin tocar
el núcleo: **F1-13** (detalle de expediente con historial y documentos en la interfaz) con su
cobertura Playwright.
