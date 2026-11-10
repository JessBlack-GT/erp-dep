# MuniERP IA — 06 Casos de prueba

> Revisión 2026-10-26: casos alineados con los requisitos oficiales RQ01–RQ06, nuevos bloques H
> (indicadores), I (documentos privados) y J (inclusión y continuidad), y estado de ejecución por
> caso (§K). Un caso solo cuenta como aprobado con la ejecución indicada; **"H-mock"** significa
> capa de aplicación con almacén en memoria y datos sintéticos: **no sustituye** R ni E.

Niveles adicionales: **H-mock** = `createMunicipalService` + almacén en memoria (sin Express ni Mongo).

Niveles: **U** unitaria (mocha, sin DB) · **H** HTTP con supertest y repositorios simulados ·
**R** integración real contra base QA autorizada (`validate-municipal-real.cjs`) · **E** E2E web y
Android.

## Datos de prueba (sintéticos)

- Municipio `SJH` (San Juan Huactzinco) y municipio ficticio `ZZZ` para aislamiento.
- Dependencias `OBP`, `TES`, `DIF` en SJH; `OBP` en ZZZ (mismo código, otro municipio).
- Usuarios: `u_admin_erp` (rol ERP admin, sin membresía), `u_super_erp` (superadmin, sin membresía),
  `u_reg` (auto-registrado), `u_tit_obp`, `u_op_obp`, `u_op_tes`, `u_vent`, `u_sup`, `u_aud`,
  `u_admin_mun`, `u_zzz_tit_obp`.
- Ciudadanos con nombres generados y marcador `synthetic: true` + `runId` aleatorio.
- Limpieza solo por IDs/marcadores de la ejecución; nunca `dropDatabase` ni borrado de colecciones.

## A. Acceso no autorizado

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-01 | H | Sin `Authorization` en cualquier ruta municipal | 401, sin datos |
| MT-02 | H | JWT con firma inválida / expirado / `kind: refresh` | 401 |
| MT-03 | H | JWT válido de usuario con `sessionVersion` incrementado (logout previo) | 401 `Sesión revocada` |
| MT-04 | H/R | `u_super_erp` y `u_admin_erp` → `GET /municipalities/SJH/requests` | 403 `MUNICIPAL_MEMBERSHIP_REQUIRED` |
| MT-05 | H/R | `u_reg` (creado por `/auth/register`) → cualquier ruta municipal salvo `/me/memberships` | 403; `/me/memberships` → `[]` |
| MT-06 | H | Membresía `INACTIVA` o con `validTo` vencido | 403 |
| MT-07 | H | JWT con claims falsificados `role: superadmin, permissions: [municipal.*]` | Ignorados; mismo resultado que sin claims |
| MT-08 | U | Fallo de lectura de membresía (DB caída) | 503 `AUTHORIZATION_UNAVAILABLE`, nunca 200 |
| MT-09 | H | `u_op_obp` → `POST /dependencies` | 403 |
| MT-10 | H | `u_admin_mun` → crear membresía `ADMIN_MUNICIPAL` o asignarse a sí mismo | 403 |
| MT-11 | H | `u_admin_mun` → `GET /requests/{folio}` | 403 (no lee contenido) |
| MT-12 | H | `u_aud` → `PATCH /requests/{folio}` o transición | 403 |

## B. Aislamiento de datos

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-13 | R | `u_zzz_tit_obp` → `GET /municipalities/SJH/requests` | 403 (sin membresía en SJH) |
| MT-14 | R | `u_tit_obp` (SJH) → `GET /municipalities/SJH/requests/{folio de ZZZ}` | 404 (patrón de folio no coincide / fuera de municipio) |
| MT-15 | R | `u_op_tes` → `GET /requests/{folio OBP}` | 404 + evento `ACCESS_DENIED` en bitácora |
| MT-16 | R | `u_op_tes` → `GET /requests?dependency=OBP` | 200 lista vacía (el filtro del cliente no amplía alcance) |
| MT-17 | R | Listado de `u_tit_obp` contiene solo OBP + turnados a OBP + grants | Conteo exacto vs. datos sembrados |
| MT-18 | H | Body con `municipalityId`, `folio`, `createdBy`, `history` o `status` en creación | 400, nada persistido |
| MT-19 | R | Solicitud `CONFIDENCIAL` en DIF: `u_sup` sin `readConfidential` | 404 en detalle; ausente en listado |
| MT-19b | R | Grant `READ` a `u_op_tes`, luego revocación | 200 mientras vigente; 404 inmediatamente tras revocar |
| MT-19c | R | Ciudadano creado por OBP buscado por `u_op_tes` | No aparece |

## C. Dependencias

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-20 | H | Crear `OBP` dos veces en SJH | 201, luego 409 |
| MT-21 | R | Crear `OBP` en ZZZ con `OBP` existente en SJH | 201 (unicidad por municipio) |
| MT-22 | H | Desactivar dependencia con expedientes abiertos | 409 (decisión: no se desactiva con abiertos) |

## D. Solicitudes y folios

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-30 | U | Formato de folio | Coincide `^[A-Z]{3}-[A-Z]{3}-[A-Z]{3}-\d{4}-\d{6}$` |
| MT-31 | R | 50 creaciones concurrentes en OBP | 50 folios distintos y consecutivos 1..50, sin huecos por fallas |
| MT-32 | R | Creación que falla tras reservar folio (error forzado en la transacción) | Contador no avanza (rollback) |
| MT-33 | H/R | Reintento con misma `Idempotency-Key` y cuerpo | 200 con el mismo folio; un solo documento |
| MT-34 | H | Misma `Idempotency-Key`, cuerpo distinto | 409 |
| MT-35 | R | Cambio de año (reloj inyectado 31-dic → 1-ene) | Secuencia reinicia en 000001 para el nuevo año |
| MT-36 | R | Cancelar solicitud | Folio conservado, estado `CANCELADA`, no reutilizado por la siguiente |

## E. Turnado y estados

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-40 | H | `CERRAR` sin `note` | 400 |
| MT-41 | H | Transición desde `CERRADA` | 409 `INVALID_TRANSITION` |
| MT-42 | R | `TURNAR` OBP→TES por `u_tit_obp` | TES puede leer; history y bitácora registrados |
| MT-43 | H | `TURNAR` por `u_op_obp` | 403 |
| MT-44 | R | Dos actualizaciones con la misma `version` | Primera 200, segunda 409 |
| MT-45 | H | `TURNAR` a dependencia inexistente o de otro municipio | 400 |
| MT-46 | U/H | RQ02: cada entrada de historial tiene `actorId`, `at`, `action`, `fromStatus`, `toStatus`; inmutable; orden cronológico | Pasa |
| MT-47 | R | RQ02: historial persistido coincide con la bitácora (`requestId`) tras 5 acciones | Conteo y orden idénticos |

## F. Bitácora

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-50 | R | Toda escritura exitosa genera exactamente un evento con IP y requestId | Conteo = operaciones |
| MT-51 | U | `updateOne`/`deleteOne`/`save` sobre evento existente | Error de inmutabilidad |
| MT-52 | R | Denegaciones 403/404 de alcance | Evento `ACCESS_DENIED` sin contenido del expediente |
| MT-53 | H | `u_tit_obp` → `GET /audit-events` | 403 |

## H. Indicadores (RQ04)

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-70 | U | Set sintético de 6 registros con conteo manual documentado en la prueba | total 6, abiertas 3, registradas 5, cerradas 2, promedio 3 días, vencidas 1, por estado/dependencia/canal exactos |
| MT-71 | U | Conjunto vacío | Ceros y `avgResolutionDays = null` (sin promedios inventados) |
| MT-72 | U | Periodo invertido o `slaDays` fuera de rango | Error de validación |
| MT-73 | U | Cambio de zona horaria en límites del periodo | Periodos en UTC, documentado en contrato |
| MT-74 | H-mock / R | Servicio vs. oráculo puro sobre los mismos registros visibles; **R:** agregación Mongo vs. oráculo | Idénticos |
| MT-75 | H-mock | Alcance: titular OBP ve 3, titular DIF ve 1, supervisor 6, operador sin permiso 403; ningún conteo de otro municipio | Exacto |

## I. Documentos privados (RQ05)

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-80 | U | PDF/PNG válidos, nombre con ruta y acentos | Aceptados; nombre saneado; sha256 |
| MT-81 | U | Contenido que no coincide con el MIME / MIME no permitido | 400 |
| MT-82 | U | > 5 MB o campos extra (`storageKey`) | 413 / 400 |
| MT-83 | H-mock | Subida en expediente concluido | 409 |
| MT-84 | U | Cabeceras de descarga | `attachment`, `no-store`, `nosniff` |
| MT-85 | H-mock | Descarga autorizada | Bytes idénticos; sin `storageKey` en respuestas |
| MT-86 | H-mock | Descarga por otra dependencia, admin ERP, ADMIN_MUNICIPAL o con folio de otro expediente | 404/403; evento `ACCESS_DENIED`; contenido nunca en bitácora |
| MT-87 | H-mock | Documento CONFIDENCIAL en expediente público consultado por CONSULTA | Listado como `restricted`, descarga 404; titular sí descarga |
| MT-88 | H-mock | Documento declarado PUBLICA en expediente CONFIDENCIAL | Confidencialidad efectiva CONFIDENCIAL |
| MT-89 | R | Adaptador GridFS: el bucket no es accesible sin pasar por la API; sin URL pública | Pendiente C-07 |

## J. Inclusión y continuidad (RQ06)

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-90 | E (web) | Flujo de ventanilla completo **solo con teclado** (Tab/Shift+Tab/Enter/Espacio): dependencia → ciudadano → canal → asunto → enviar → imprimir acuse | Completo sin ratón; foco visible; orden lógico |
| MT-91 | E (Android) | Mismo flujo en APK y en navegador de celular (360 px) | Completo; objetivos ≥ 44 px; sin desplazamiento horizontal |
| MT-92 | H-mock | Registro con `channel: PRESENCIAL` y acuse | Acuse con folio y dependencia, sin contacto ni descripción |
| MT-93 | U (jest) | Reintento tras fallo de red | Misma `Idempotency-Key`; un solo folio |
| MT-94 | U (jest) | Cuadrícula de indicadores 360/800/1280 px | 1/2/4 columnas |
| MT-95 | U (jest) | Usuario sin membresía | Espacio de trabajo oculto con mensaje |
| MT-96 | E | Auditoría WCAG 2.1 AA (contraste, etiquetas, lector de pantalla NVDA/TalkBack) | Sin bloqueantes |

## G. No regresión del ERP

| ID | Nivel | Caso | Esperado |
|---|---|---|---|
| MT-60 | U | `rbac.PERMISSIONS` del ERP | Igual al catálogo de `d5b64b0` (30 entradas, mismo orden) |
| MT-61 | U | Prueba de frontera de imports (ERP ↛ municipal; municipal → solo security/shared/middleware/config) | Pasa |
| MT-62 | — | Suite backend y frontend completas | Sin fallos nuevos respecto a la línea base |
| MT-63 | E | Login, Clientes, Ventas, Inventario en web y APK con usuario sin membresía | Idénticos; el menú no muestra MuniERP |
| MT-64 | E | Usuario con membresía en web **y** Android | Menú MuniERP visible; 404 de alcance mostrado como "No encontrado" |

## K. Estado de ejecución por caso (2026-10-26)

| Estado | Casos |
|---|---|
| **Ejecutado y aprobado — HTTP aislado (F1-04, 2026-11-09)** | MT-01, MT-02, MT-03, MT-08, MT-09 (lectura), MT-19c, MT-53, MT-H01…MT-H12 (§L). Identidad central real del ERP; `resolveAccess` simulado; almacén en memoria |
| **Ejecutado y aprobado** (U / H-mock / jest) | MT-04, MT-05, MT-06, MT-07, MT-10, MT-11, MT-12, MT-13, MT-14, MT-15, MT-16, MT-17, MT-18, MT-19, MT-19b, MT-30, MT-32*, MT-33, MT-34, MT-35, MT-36, MT-40, MT-41, MT-42, MT-43, MT-44, MT-45, MT-46, MT-50*, MT-52, MT-60, MT-61, MT-70, MT-71, MT-72, MT-74*, MT-75, MT-80…MT-88, MT-92, MT-93, MT-94, MT-95 |
| **Ejecutado parcial** | MT-31 (50 creaciones concurrentes en memoria; falta concurrencia real en Atlas), MT-62 (ver §Ejecución) |
| **Ejecutado y aprobado — F1-12 HTTP aislado (2026-11-09)** | MT-09, MT-10 (HTTP), MT-20, MT-21 (unicidad por municipio, ver nota), MT-22, MT-F01…MT-F08 (§N) |
| **Pendiente: montaje en el ERP (C-01)** | Repetición de §L dentro de `app.js` (limitador global, CORS, helmet) |
| **Pendiente: requiere base QA autorizada (C-05)** | MT-31 real, MT-32 real, MT-47, MT-50 real, MT-51, MT-74 (Mongo), MT-89 |
| **Ejecutado y aprobado — Playwright Chromium, API SIMULADA (2026-11-09)** | MT-90 (teclado), MT-94 (adaptable 360/800/1280), MT-93 y MT-95 en navegador (§O) |
| **Pendiente: E2E** | MT-63, MT-64, MT-91 (APK Android), MT-96 (auditoría WCAG completa); MT-90 en Firefox/WebKit |
| Diseñado sin prueba aún | MT-73 |

\* En memoria: demuestran la regla, no la garantía transaccional de Mongo.

## L. Capa HTTP (F1-04) — `tests/municipal/http.test.js` y `http-contract.test.js`

| ID | Caso | Esperado | Resultado 2026-11-09 |
|---|---|---|---|
| MT-H01 | Sin token / JWT inválido / expirado / `kind: refresh` | 401 `UNAUTHORIZED` | ✅ |
| MT-H02 | Usuario inactivo en el ERP con membresía activa | 401 | ✅ |
| MT-H03 | Sesión revocada (`sessionVersion`) | 401 | ✅ |
| MT-H04 | Base de autorización caída | 503 `AUTHORIZATION_UNAVAILABLE`, sin detalles | ✅ |
| MT-H05 | Claims falsificados; `X-User-Id`/`X-Role` en cabeceras; `userId` en consulta; `createdBy` en cuerpo | 403 / ignorado / 400 / 400 | ✅ |
| MT-H06 | Superadmin/admin ERP, membresía vencida, municipio inexistente | 403 `MUNICIPAL_MEMBERSHIP_REQUIRED` | ✅ |
| MT-H07 | Alta 201 + ETag + DTO sin campos internos; Idempotency-Key ausente 400; reintento 200; otro cuerpo 409; JSON mal formado 400 | Según contrato | ✅ |
| MT-H08 | 25 altas concurrentes **simuladas**; colisión de folio forzada | Folios únicos consecutivos; 409 con rollback del contador | ✅ (memoria) |
| MT-H09 | Otra dependencia, folio inexistente y mal formado | 404 idéntico; denegación con IP y `requestId` | ✅ |
| MT-H10 | PATCH sin If-Match 400 / obsoleto 409 / correcto 200 + `EDITAR`; cambio de confidencialidad sin permiso 403; transiciones 200/400/403/409 | Según contrato | ✅ |
| MT-H11 | Documentos: 201, MIME falso 400, > 5 MB 413, concluido 409, descarga con cabeceras privadas, no autorizada 403/404 | Según contrato | ✅ |
| MT-H12 | Cada respuesta JSON validada contra el esquema del contrato (ajv); 24 rutas = 24 operaciones; pendientes ↔ 501 | Sin desviaciones | ✅ |

## N. Dependencias y membresías (F1-12) — `tests/municipal/http-f112.test.js`

| ID | Caso | Resultado |
|---|---|---|
| MT-F01 | Las 5 operaciones: 401 sin token, 403 para superadmin del ERP | ✅ |
| MT-F02 | Solo ADMIN_MUNICIPAL administra; TITULAR/SUPERVISOR/AUDITOR 403; OPERADOR no lista | ✅ |
| MT-F03 | Dependencia: 201, duplicada 409, validaciones 400, código inmutable, inexistente/mal formado 404 | ✅ |
| MT-F04 | Desactivar con expedientes abiertos o subordinadas activas → 409; inactiva no admite solicitudes ni membresías | ✅ |
| MT-F05 | Listado: ADMIN todo SJH (nunca ZZZ), TITULAR solo su dependencia, filtros y consulta inválida 400 | ✅ |
| MT-F06 | Alta: acceso solo a sus dependencias; a sí mismo 403; ADMIN 400; sin dependencias 400; duplicada 409; usuario inexistente/inactivo 404; identidad caída 503 | ✅ |
| MT-F07 | Revocación inmediata (403 en la siguiente petición), reactivación, cambio de dependencias que mueve el alcance, vencimiento por `validTo` | ✅ |
| MT-F08 | Propia 403; otra ADMIN 403; otro municipio/inexistente/mal formado 404 idéntico; validaciones 400 | ✅ |

Nota MT-21: la unicidad por municipio se garantiza en el almacén (`{municipalityId, code}`); la
creación en otro municipio no se probó vía HTTP porque el set sintético no tiene ADMIN en ZZZ.

## O. Playwright (API SIMULADA) — `apps/frontend/qa/e2e/municipal.e2e.spec.cjs`

14 escenarios en Chromium: **14/14 aprobados** en la ejecución final, tras corregir 3 defectos de
accesibilidad detectados en las ejecuciones previas (ver doc 11 y evidencias). Firefox y WebKit no
ejecutados (no disponibles en el entorno).

## Ejecución 2026-11-09 (F1-12)

| Suite | Resultado |
|---|---|
| Municipal backend | **117 passing, 0 failing** |
| Backend completo sin `phase1.stability` | **1049 passing, 0 failing** |
| `phase1.stability` | **21 passing** (completo, incluida la configuración de ESLint) |
| Frontend municipal (jest) | **12 passed** |
| Playwright Chromium | **14 passed** (final) |

## Ejecución 2026-11-09 (F1-04)

| Suite | Resultado |
|---|---|
| Municipal backend | **101 passing, 0 failing** |
| Backend completo sin `phase1.stability` | **1033 passing, 0 failing** |
| Mutaciones de la capa HTTP | 4/4 detectadas |
| `phase1.stability` | No concluyó: el equipo se desconectó durante la ejecución |
| Frontend municipal (11) | Sin cambios en F1-04; última ejecución aprobada 2026-10-26 |

## Ejecución 2026-10-26 (rama local `codex/munierp-fase0-arquitectura`)

Entorno: VM Linux del equipo del usuario, Node v22.23.4, `node_modules` local existente, copia limpia
`main@d5b64b0` + parches de esta rama. Sin base de datos, sin red, sin datos reales.

| Suite | Resultado |
|---|---|
| Backend municipal (`mocha tests/municipal/*.test.js`) | **62 passing, 0 failing** (incluye contrato OpenAPI ↔ dominio con `js-yaml`) |
| Backend completo sin `phase1.stability` | **994 passing, 0 failing** = 932 de la línea base (953 − 21 del archivo excluido) + 62 municipales |
| `phase1.stability` sin la prueba de ESLint | **20 passing** |
| `Phase 1 ESLint configuration` | **No concluyó** en 175 s por E/S del disco montado (pasó el 2026-10-23 en 44 s; no lee código municipal) |
| Frontend municipal (`jest tests/municipal.frontend.test.js`) | **11 passed** |
| Frontend: las 12 suites pendientes del 2026-10-23 + `features` + `m01.frontend` | 13 PASS; `m01.frontend` **3 failing** (los mismos 3 fallos preexistentes de `main`) |
| ESLint (semi/quotes) sobre archivos nuevos | 0 errores |
| Pruebas de mutación de `policy/access.js` (4 mutaciones) | 4/4 detectadas |

Con esto, **las 32 suites frontend de la línea base ya se ejecutaron al menos una vez**: 31 PASS y
`m01.frontend` con 3 fallos preexistentes. No ejecutado: build web, APK, Atlas QA, E2E.

## Ejecución de la línea base (2026-10-23)

Ejecutado el 2026-10-23 sobre una **copia limpia** de `main@d5b64b0` (`git archive`), en la VM
Linux del equipo del usuario (Node v22.23.2), reutilizando el `node_modules` local ya instalado.
No se usó base de datos real. El entorno en la nube no pudo instalar dependencias (registro npm
bloqueado por política de red).

| Suite | Resultado | Nota |
|---|---|---|
| Backend (mocha, `tests/**` + `src/**`) | **953 passing, 0 failing** | 952 en la corrida completa + 1 (`Phase 1 ESLint configuration`) que excedió el timeout de 20 s por E/S del disco montado; re-ejecutado con 150 s: pasa (44 s). |
| Frontend (jest) — **parcial** | **20 de 32 suites ejecutadas: 19 PASS, 1 FAIL.** Pruebas: ≥161 passing, **3 failing**, 9 todo | La corrida se hizo por lotes (límite de 180 s por comando en la VM) y se interrumpió al desconectarse el equipo. |

**Fallos reales en `main` (no introducidos por esta fase)** — `tests/m01.frontend.test.js`:
1. `detail confirms status before sending` — no encuentra el texto `Estado: inactive`.
2. `roles distinguish protected system and editable custom roles`.
3. `roles read only hides create/edit`.

La copia local de trabajo del usuario tiene cambios **sin commit** en ese archivo de prueba (y en
otros 9), por lo que es probable que la corrección ya exista localmente; debe integrarse por rama
y PR antes de iniciar MuniERP para tener una línea base verde.

**Suites no ejecutadas aún (12):** `inventory`, `components`, `customers.phase7`,
`inventory.navigation`, `products.navigation`, `inventory.api`, `m01.sessions`, `products.api`,
`auth-experience`, `suppliers.navigation`, `suppliers`, `shell`. **No se declaran aprobadas.**

Ejecutadas y aprobadas: `frontend`, `suppliers.api`, `navigation`, `customers.navigation`, `api`,
`products`, `auth-navigation`, `m01.navigation`, `sales`, `customers.frontend`,
`sales.navigation`, `theme`, `customers.api`, `features`, `password-recovery`,
`customers.web-actions`, `sales.api`, `login`, `rbac`.

No se ejecutaron: build web, APK Android, integración real contra Atlas QA (no autorizado en esta
fase) ni E2E.

## Resultados F1-13 (2026-11-10) — API SIMULADA (servicio real en memoria, datos sintéticos)

| Suite | Entorno | Resultado |
|---|---|---|
| `tests/municipal.detail.test.js` | Jest, VM Linux, Node 22 | **16/16** |
| `tests/municipal.frontend.test.js` | Jest, VM Linux, Node 22 | **12/12** |
| `qa/e2e/municipal-detail.e2e.spec.cjs` | Playwright, nube Linux, Chromium 153 | **17/17** |
| `qa/e2e/municipal.e2e.spec.cjs` (regresión F1-12) | Playwright, nube Linux, Chromium 153 | **14/14** |
| Ambas suites E2E | Playwright, **Windows**, Chromium 158 | **31/31** |
| Ambas suites E2E | Windows, Firefox y WebKit | **No ejecutadas** (faltan binarios del navegador; no es fallo de la interfaz) |

Detalle y evidencias: [13-F1-13-DETALLE-Y-QA.md](13-F1-13-DETALLE-Y-QA.md). Ninguna prueba usó HTTP real,
JWT, MongoDB ni Atlas.

## Resultados F1-05 pasos 1–2 (2026-11-10) — en memoria y API SIMULADA

| Suite | Entorno | Resultado |
|---|---|---|
| Backend municipal (incluye contrato del repositorio y guardia QA) | VM Linux, Node 22 | **163 pasan, 8 pendientes** (7 casos L3 que requieren MongoDB real + ejecutor Mongo omitido) |
| Backend completo | VM Linux, Node 22, 3 lotes | **1 116 pasan, 0 fallan** (ESLint de Fase 1 re-ejecutada con límite amplio) |
| Jest municipal (detalle 16, prototipo 12, compatibilidad C-18/C-19 8) | VM Linux | **36/36** |
| Playwright F1-12 (14) + F1-13 (17) | **Windows: Chromium 158, Firefox 158, WebKit 27.2** | **93/93** |

La suite de contrato en memoria NO certifica MongoDB: L2 es aproximación y L3 queda pendiente. Detalle:
[14-F1-05-PUERTO-Y-CONTRATO.md](14-F1-05-PUERTO-Y-CONTRATO.md).
