# modules/municipal — MuniERP IA (Fase 1, preparación)

**Estado: NO MONTADO** (capa HTTP lista desde F1-04). Nada en `app.js` ni en `routes/index.js` importa este módulo (verificado por
`tests/municipal/permissions-structure.test.js`). Montarlo es la dependencia **C-01** de Codex.

| Carpeta | Contenido | RQ |
|---|---|---|
| `policy/permissions.js` | Catálogo `municipal.*` y matriz de 7 roles, independiente de `security/rbac.js` | RQ05 |
| `policy/access.js` | Regla de lectura/escritura por municipio → dependencia → expediente; filtro Mongo equivalente | RQ03, RQ05 |
| `policy/context.js` | Construye el contexto a partir de `resolveAccess` del ERP **ignorando rol y permisos comerciales** | RQ05 |
| `domain/folio.js` | Formato, análisis y clave de contador `{mun}:{dep}:{tipo}:{año}` | RQ01 |
| `domain/request-state.js` | Máquina de estados y entradas de historial inmutables | RQ02 |
| `domain/validation.js` | Validación estricta del contrato; rechaza campos del servidor y CURP/RFC | RQ01, RQ06 |
| `domain/indicators.js` | Indicadores como función pura (oráculo de la agregación Mongo) | RQ04 |
| `domain/documents.js` | Validación de archivos por firma binaria y cabeceras de descarga privada | RQ05 |
| `domain/receipt.js` | Acuse para canal presencial sin datos de contacto | RQ06 |
| `application/municipal.service.js` | Casos de uso independientes de Express/Mongo | todos |
| `application/presenters.js` | DTO del contrato (lista blanca de campos) | todos |
| `http/municipal.router.js` | Router Express: tabla de 24 operaciones, todas implementadas (F1-12); salvaguarda contra producción | todos |
| `http/params.js`, `http/errors.js` | Validación de ruta/consulta/cabeceras; errores `{success,error,code}` | — |
| `http/erp-identity.js` | Única puerta al núcleo: `authenticateToken` + `requireCurrentUser` y `rbac.resolveAccess` (lectura) del ERP | RQ05 |
| `http/isolated-app.js` | App Express aislada para pruebas (no abre puertos) | — |
| `mocks/*`, `storage/memory-storage.js` | Almacén y almacenamiento **en memoria** con datos **sintéticos** | — |

Reglas: solo importa de sí mismo, de módulos nativos de Node, de `express` (solo `http/`) y de la
identidad central del ERP (solo `http/erp-identity.js`); código compatible con Express 4 y 5
(sin rutas `*`, sin `req.param`); `// @ts-check` + JSDoc en lugar de TypeScript compilado.

Pruebas: `tests/municipal/*.test.js` (se incluyen en `npm test` del backend por el glob existente).

Persistencia: el almacén en memoria es el puerto que implementará el repositorio MongoDB de F1-05;
el diseño (modelos, índices, folios concurrentes, transacciones, GridFS, migración y pruebas) está en
`docs/munierp/12-F1-05-DISENO-MONGODB.md`. La interfaz F1-13 (detalle de expediente) ejecuta este
servicio en el navegador para QA mediante `apps/frontend/qa/service-backed-api.js`, sin modificarlo.
