# MuniERP IA — 10 Historia F1-04: capa HTTP municipal (Express aislado)

Fecha: 2026-11-09 · Rama local `codex/munierp-fase0-arquitectura` (commit F1-04 sobre los 4 anteriores)
· Estado: **HECHO-A** (implementado y probado en Express aislado, **sin montar** en el ERP, almacén en
memoria con datos sintéticos). No es una prueba real contra MongoDB.

## 1. Verificación inicial

| Punto | Resultado |
|---|---|
| Rama municipal | 4 commits intactos (`7eca877`, `85e5b1c`, `5f5a2fd`, `5638003`) sobre `main@d5b64b0` |
| Copia principal del usuario | En `codex/m07-stabilization` con 46 cambios sin commit: **no se tocó** |
| `LEEME.md` y contrato draft.1 | Revisados: 18 rutas, 24 operaciones |
| Servicios existentes antes de F1-04 | createRequest, listRequests, getRequest, getHistory, transition, uploadDocument, listDocuments, downloadDocument, indicators, receipt |
| Simulado | Almacén (`mocks/in-memory-store.js`), almacenamiento (`storage/memory-storage.js`), `rbac.resolveAccess` en pruebas (sinon, mismo patrón que el ERP) |

## 2. Diseño

```
Express aislado (http/isolated-app.js)  ──  /api/municipal/v1
  ensureErrorCode → requestMeta (X-Request-Id, IP) → express.json(10mb)
  → authenticateToken (ERP, real) → requireCurrentUser (ERP, real: usuario activo + sessionVersion; 503 si falla)
  → contexto municipal: SOLO req.user.id + membresías/concesiones del almacén (nunca del cliente)
  → tabla de rutas (http/municipal.router.js) → parámetros validados (http/params.js)
  → application/municipal.service.js (permiso por operación, alcance por dependencia y expediente)
  → presentadores (application/presenters.js) → DTO del contrato
  → errores normalizados { success:false, error, code[, fields] } (http/errors.js)
```

Decisiones:
- **Sin autenticación alternativa**: `http/erp-identity.js` reexporta los middlewares centrales sin modificarlos; es el único archivo del módulo que importa del núcleo (verificado por prueba).
- **Tabla única de rutas** usada para registrar Express **y** para comprobar la sincronía con el OpenAPI.
- **No revelación**: folio mal formado, inexistente o fuera de alcance → el mismo 404; municipio inexistente → el mismo 403 que sin membresía.
- **Parámetros desconocidos → 400** (incluido cualquier `userId`/rol enviado por consulta o cuerpo). Las cabeceras no estándar (`X-User-Id`, `X-Role`) simplemente no se leen.
- **Versiones**: `ETag: "<version>"` en lecturas/escrituras de expediente; `If-Match` obligatorio en PATCH (409 si no coincide).
- **Bitácora**: cada escritura y cada denegación de expediente/documento registran `requestId` (de `X-Request-Id` válido o generado) e IP (`trust proxy` del anfitrión).
- **Compatibilidad Express 5**: sin rutas `*`, handlers async envueltos, sin `req.param`.
- Las 401/503 del middleware central no traen `code`; `ensureErrorCode` lo añade **sin modificar el ERP** (dependencia opcional C-15).

## 3. Operaciones (24)

| operationId | Método y ruta | Permiso | Estado |
|---|---|---|---|
| listMyMemberships | GET /me/memberships | identidad | ✅ |
| listDependencies | GET /municipalities/{mun}/dependencies | dependencies.read | ✅ |
| createDependency / updateDependency | POST · PATCH …/dependencies[/{code}] | dependencies.manage | ⏳ 501 (F1-12) |
| listMemberships / createMembership / updateMembership | GET · POST · PATCH …/memberships[/{id}] | memberships.* | ⏳ 501 (F1-12) |
| createCitizen / searchCitizens | POST · GET …/citizens | citizens.create / read | ✅ |
| createRequest / listRequests | POST · GET …/requests | requests.create / read | ✅ |
| getRequest / updateRequest | GET · PATCH …/requests/{folio} | requests.read / update | ✅ |
| transitionRequest | POST …/{folio}/transitions | según acción | ✅ |
| createGrant / revokeGrant | POST · DELETE …/{folio}/grants[/{id}] | requests.grant | ✅ |
| getRequestHistory / getRequestReceipt | GET …/{folio}/history · /receipt | requests.read | ✅ |
| listDocuments / uploadDocument / downloadDocument | GET · POST …/documents · GET …/content | documents.read / upload | ✅ |
| getIndicators | GET …/indicators | indicators.read | ✅ |
| verifyFolio | GET …/folios/{folio} | requests.read | ✅ |
| listAuditEvents | GET …/audit-events | audit.read | ✅ |

19 implementadas, 5 pendientes que responden **501 solo después de autenticar** (sin token: 401).

## 4. Inventario de archivos

**Creados**
- `apps/backend/src/modules/municipal/http/municipal.router.js` — router y tabla de rutas.
- `apps/backend/src/modules/municipal/http/params.js` — validación de ruta, consulta y cabeceras.
- `apps/backend/src/modules/municipal/http/errors.js` — errores del contrato y normalización.
- `apps/backend/src/modules/municipal/http/erp-identity.js` — puerta única a la identidad central.
- `apps/backend/src/modules/municipal/http/isolated-app.js` — app Express aislada.
- `apps/backend/src/modules/municipal/application/presenters.js` — DTO del contrato (lista blanca).
- `apps/backend/tests/municipal/http-helpers.js` — escenario HTTP, JWT real, validador de contrato (ajv + js-yaml).
- `apps/backend/tests/municipal/http.test.js` — 36 pruebas HTTP.
- `apps/backend/tests/municipal/http-contract.test.js` — 3 pruebas de sincronía rutas ↔ OpenAPI.
- `docs/munierp/10-F1-04-CAPA-HTTP.md` — este documento.

**Modificados (solo dentro del módulo municipal y su documentación)**
- `application/municipal.service.js` — nuevas operaciones (myMemberships, listDependencies, createCitizen, searchCitizens, updateRequest, createGrant, revokeGrant, verifyFolio, listAuditEvents), DTO por presentadores, colisión de folio → 409.
- `domain/validation.js` — validateRequestUpdate, validateTransitionInput, validateGrantCreate.
- `domain/request-state.js` — entrada de historial `EDITAR`.
- `mocks/in-memory-store.js` — membresías, alta de ciudadanos, consulta de concesión, contador de prueba.
- `tests/municipal/helpers.js`, `tests/municipal/permissions-structure.test.js` — membresías en el almacén; frontera que admite `express` en `http/` y la puerta de identidad.
- `docs/munierp/contracts/municipal-v1.openapi.yaml` → **draft.2**; `docs/munierp/05`, `06`, `07`, `08`, `README.md`; `modules/municipal/README.md`.

**No modificados**: `app.js`, `routes/`, autenticación central, `security/rbac.js`, rutas comerciales,
Ventas, Inventario, `package.json` y lockfiles, `main`.

## 5. Evidencia de pruebas (2026-11-09, VM Linux del equipo del usuario, Node 22.23.4)

| Suite | Resultado |
|---|---|
| Municipal backend (`mocha tests/municipal/*.test.js`) | **101 passing, 0 failing** (62 previas + 36 HTTP + 3 sincronía) |
| Backend completo sin `phase1.stability` | **1033 passing, 0 failing** (932 ERP + 101 municipales) |
| Validador de contrato (control negativo) | Rechaza cuerpo sin campos obligatorios y error sin `code`; acepta el válido |
| Mutaciones HTTP | 4/4 detectadas: quitar `requireCurrentUser` (3 fallos), folio inválido → 400 y aceptar parámetros desconocidos (3 fallos), quitar normalización de `code` (6 fallos) |
| Pruebas puras en la nube (shim `node:test`) | 62/62 (las HTTP requieren express/supertest, solo disponibles en el equipo) |
| `phase1.stability` y frontend (11 municipales) | Ver §6 |

Errores encontrados y corregidos durante la historia:
1. `validateTransitionInput` rechazaba `version` y `assignedUserId` por reutilizar la lista de campos del servidor → validación propia de transición.
2. La carga de módulos desde la carpeta montada tardaba hasta 97 s (E/S de OneDrive) → copia local del cierre de dependencias del backend en la VM (no versionada); 3 módulos transitivos faltantes añadidos por iteración.

## 6. Pendiente de ejecutar en esta historia

- `phase1.stability` (incluye la prueba de configuración de ESLint): la ejecución se interrumpió al desconectarse el equipo; no lee código municipal.
- Frontend: las 11 pruebas municipales no cambiaron en F1-04 (no se tocó `apps/frontend`); su última ejecución aprobada es del 2026-10-26.
- No ejecutado: MongoDB real, montaje en el ERP, E2E web/Android.

## 7. Riesgos de integración

| # | Riesgo | Mitigación |
|---|---|---|
| R-I1 | El almacén en memoria no reproduce índices únicos ni transacciones de Mongo | F1-05: repositorio Mongo con la misma interfaz y re-ejecución de las 101 pruebas contra base QA |
| R-I2 | Al montar en el ERP, `express.json` y el limitador global corren antes del router | Comportamiento compatible (el router omite el parseo si ya existe); revisar C-08 (cupo por IP) |
| R-I3 | El 404 global del ERP (`app.use('*')`) captura rutas si el montaje queda después | Montar **antes** del 404 global (C-01) |
| R-I4 | Pruebas dependen de `ajv` y `js-yaml` como dependencias transitivas de ESLint | Declararlas como devDependencies (C-17) o aceptar la omisión explícita (`describe.skip`) |
| R-I5 | Subida en base64 dentro de JSON ocupa ~33 % más | Límite 5 MB; multipart solo con aprobación (C-07) |
| R-I6 | `resolveAccess` + membresía + concesiones = 3 lecturas por petición | Medir con F1-05; índices `{userId, municipalityId}` |

## 8. Siguiente historia recomendada

**F1-12 (dependencias y membresías)**: completa las 5 operaciones en 501 sin tocar el núcleo y deja
la API municipal entera lista para revisión. Después, al resolverse C-05, **F1-05** (repositorio
Mongo) para convertir las pruebas en memoria en pruebas reales contra la base QA.
