# MuniERP IA — 08 Dependencias que debe resolver el equipo de Codex

YJ Nexo ERP (sistema principal) es mantenido por Codex. MuniERP **no** modifica servicios centrales
por su cuenta: cada punto siguiente requiere decisión o PR revisado por Codex. Estado al 2026-10-26.

Prioridad: **P0** bloquea el primer endpoint municipal real · **P1** bloquea el cierre de Fase 1 ·
**P2** mejora recomendada.

| ID | Prioridad | Dependencia | Por qué la necesita MuniERP | Cambio mínimo propuesto | Archivos del núcleo |
|---|---|---|---|---|---|
| C-01 | P0 | **Montar la API municipal** | Hoy el módulo existe pero no recibe peticiones | Router listo desde F1-04; desde F1-12 se niega a construirse con `NODE_ENV=production` salvo `allowProduction: true`. Montaje propuesto **antes** del 404 global: `app.use('/api/municipal/v1', createMunicipalRouter({ service, store, identity: erpIdentityMiddlewares() }))`, con `store` = repositorio Mongo de F1-05 (hoy solo existe el de memoria) | `apps/backend/src/app.js` |
| C-02 | P0 | **Aprobar el contrato `municipal-v1` draft.1** como propuesta versionada | Evitar que front y back diverjan | Revisión del OpenAPI; política: cambios incompatibles → `v2`; validación del contrato en CI | `docs/munierp/contracts/*`, CI |
| C-03 | P0 | **Línea base verde**: corregir los 3 fallos de `tests/m01.frontend.test.js` en `main` | No mezclar regresiones previas con trabajo nuevo | Integrar la corrección que parece existir sin commit en la copia local del usuario | `apps/frontend/tests/m01.frontend.test.js` (y lo que corresponda) |
| C-04 | P1 | Decidir ramas `codex/deploy-readiness` y `codex/android-emulator-readiness` (no integradas) | Evitar conflictos en Android y despliegue antes de validar MT-91 | Integrar o cerrar | `apps/frontend/android/**`, despliegue |
| C-05 | P0 | **Base QA exclusiva** para MuniERP y variable `MUNICIPAL_QA_DATABASE` | Pruebas R sin tocar datos de otros módulos ni reales | Confirmar nombre de base; mismo patrón que `M03_QA_DATABASE`; replica set (transacciones) | `.env` local (no versionado), `scripts/qa-environment.cjs` (reutilizar) |
| C-06 | P1 | **Alta de cuentas de funcionarios** | MuniERP no crea identidades (ADR-03); la membresía apunta a un `User` existente | Procedimiento: un admin ERP crea el `User` con rol `user` (0 permisos comerciales) y el ADMIN_MUNICIPAL asigna la membresía | Proceso, sin código |
| C-07 | P1 | **Almacenamiento privado de documentos** | RQ05 | Opción A (recomendada para prototipo): GridFS con el driver incluido en Mongoose, sin dependencia nueva. Opción B: objeto externo (S3/R2) → SDK nuevo y credenciales. Multipart (`multer`) solo si se superan 5 MB | Configuración; posible dependencia |
| C-08 | P1 | **Límite de peticiones por IP** (100 / 15 min en `/api/`) | La ventanilla y las oficinas suelen salir a internet por **una sola IP pública** (NAT): varios funcionarios compartirán el cupo y recibirán 429 | Limitar por usuario autenticado en rutas protegidas, o cupo propio para `/api/municipal/v1` | `apps/backend/src/app.js`, `middleware/rateLimiter.js` |
| C-09 | P2 | Versiones y tipado | Alinear con la propuesta académica sin migrar | Fijar Node 24 en `engines` y Render; aprobar `typescript` como devDependency **solo** para `tsc --noEmit` sobre JSDoc; Express 5 queda para una migración propia del núcleo | `package.json` |
| C-10 | P1 | Higiene de secretos: `.gitignore` con `*.env` (`!.env.example`), retirar `android/local.properties` y `.gradle/` del índice | Riesgo de subir credenciales (hay un `atlas-credentials.env` junto al repo local) | PR de una línea + `git rm --cached` | `.gitignore` |
| C-11 | P1 | Entrada de navegación condicionada | Mostrar "MuniERP" solo con membresía vigente | Añadir pantalla a `MainNavigator`/`Sidebar` consultando `/me/memberships` | `apps/frontend/src/app/navigation/MainNavigator.js`, `components/layout/Sidebar.js` |
| C-12 | P1 | Aviso al desactivar usuarios con membresía municipal (riesgo K1) | Un admin comercial puede desactivar a un funcionario | Hook en `users.service` que registre evento o advierta | `modules/users/users.service.js` |
| C-13 | P2 | Endurecer sesión (A4/A6): rotación de refresh token, CSP en web, almacenamiento seguro en Android | Datos personales de ciudadanos | Evaluar sin romper login web/Android | `modules/auth/*`, frontend |
| C-15 | P2 | Respuestas 401/503 del middleware central sin `code` | El contrato municipal exige `code`; hoy se añade con un envoltorio en el router sin tocar el ERP | Opcional: incluir `code` en `authenticateToken` y `requireAccess` | `middleware/authenticate.js`, `middleware/authorize.js` |
| C-16 | P1 | Exponer `resolveAccess` sin cambios | La capa municipal depende de `requireCurrentUser` y de que `req.user.id` sea el id resuelto | Mantener la firma; avisar si cambia. Desde F1-12 también se usa `rbac.resolveAccess(id)` (solo lectura) para validar que el destinatario de una membresía existe y está activo | `middleware/authorize.js`, `security/rbac.js` |
| C-17 | P2 | `ajv` y `js-yaml` en pruebas | La validación de respuestas contra el contrato usa dependencias transitivas de ESLint; si cambian, la suite se omite explícitamente | Declararlas como devDependencies del backend | `apps/backend/package.json` |
| C-18 | P2 | `Card` (componente común) descarta `accessibilityLabel` cuando no es interactiva | Encontrado por Playwright: filas sin nombre accesible. MuniERP lo rodea en su propio componente | Pasar `accessibilityLabel` también a la rama `View` | `apps/frontend/src/components/common/Card.js` |
| C-19 | P2 | `Input` declara `accessibilityRole="search"` en todos los campos | Los lectores de pantalla anuncian cada campo como búsqueda (WCAG 4.1.2) | Usar el rol por defecto o uno configurable | `apps/frontend/src/components/common/Input.js` |
| C-20 | P2 | Herramientas de QA E2E | Playwright solo está disponible con Chromium en la nube; Firefox/WebKit requieren ejecutar en Windows (**2026-11-10 13:25: 93/93 en Windows — Chromium 158, Firefox 158 con `firefox-1569`, WebKit 27.2 con `webkit-2386`, rutas explícitas como el ejecutor de M07**) o declarar `@playwright/test` y navegadores en CI | Decidir dónde corre E2E (CI o equipo) | CI |
| C-21 | P2 | `downloadFile.android.js` solo acepta PDF/XLSX y rotula «Reporte de inventario» | Los documentos municipales también pueden ser PNG/JPEG; en Android fallarían con «Formato de reporte no compatible» (F1-13) | Parámetros opcionales `mimeTypes` y `description` sin cambiar el comportamiento actual | `apps/frontend/src/utils/downloadFile.android.js` |
| C-14 | P2 | CORS | Solo si la interfaz municipal se publica en otro dominio | Ninguno si vive en la misma app de Cloudflare Pages | `config/cors.js` |

## Lo que MuniERP ya entrega sin tocar el núcleo

- Código de dominio y aplicación en `apps/backend/src/modules/municipal/` (no montado).
- Interfaz aislada en `apps/frontend/src/features/municipal/` (no registrada en la navegación).
- Pruebas en `apps/backend/tests/municipal/` y `apps/frontend/tests/municipal.frontend.test.js`, que
  entran automáticamente en `npm test` por los globs existentes. **Efecto en CI de Codex:** +117
  pruebas backend (desde F1-12) y +28 frontend (12 F1-12 + 16 F1-13); ninguna requiere red ni base de datos.
- Contrato `municipal-v1` draft.1 y verificación automática de coherencia contrato ↔ dominio.

## Interfaz que MuniERP espera del ERP (sin cambios)

| Servicio central | Uso | Contrato |
|---|---|---|
| `authenticateToken` | Validar JWT | Igual que `/api/v1` |
| `rbac.resolveAccess(userId)` | Usuario activo + `sessionVersion`; de su resultado **solo se usa `id`** | `policy/context.js` |
| `User` | Identidad referenciada por `municipal_memberships.userId` | Sin campos nuevos |
| `shared/services/email` | (Futuro) avisos a funcionarios | Sin cambios |
| `errorHandler`, helmet, CORS, rate limit | Transversales | Ver C-08 |

## Actualización 2026-11-10 (F1-05 pasos 1–2)

- **C-05:** la guardia `persistence/qa-guard.js` exige `munierp_qa` exclusiva y una autorización
  `MUNICIPAL_QA_AUTHORIZED` **propia**; rechaza la reutilizada de M07/Ventas u otra base compartida.
  Sin C-05 el ejecutor Mongo de la suite de contrato queda omitido.
- **C-18/C-19:** revisado el diff de Codex (sin integrarlo). Ajustes municipales hechos para que no se
  dupliquen etiquetas con el Card corregido (`RequestList` estático, `ReceiptView`); probados con el
  Card actual y con una réplica de prueba del corregido. Pendiente la verificación conjunta con el
  núcleo real en la integración (doc 14 §5).
- **C-21:** se adopta la indicación de Codex: no usar el exportador de reportes Android para documentos
  municipales privados; F1-13 sigue usando `downloadFile` solo en web. El lector privado Android queda
  como historia propia.
- **Contrato:** X-02 y X-04 retiradas, X-01 propuesta aditiva, X-03 diferida
  ([contracts/PROPUESTAS-DRAFT4.md](contracts/PROPUESTAS-DRAFT4.md)); draft.3 sigue vigente.
- Dependencias vigentes: C-01, C-05, C-08, C-15, C-16, C-17, C-18, C-19, C-20, C-21.

## Actualización 2026-11-10 (F1-05 paso 3)

- **C-05 (bloqueante):** se necesita `munierp_qa` en un clúster de QA con réplica, dos usuarios
  (app: find/insert/update/listCollections/listIndexes; instalación: createCollection/createIndex), ambos
  limitados a `munierp_qa` y sin `remove`/`drop*`, y una autorización propia distinta de la de M07. El
  preflight de solo lectura (doc 15 §6) comprueba todo esto antes de cualquier escritura.
- **C-01:** para producción, la composición debería reutilizar el cliente de mongoose del ERP
  (`mongoose.connection.getClient()`); `createMongoPersistence` ya acepta un cliente inyectado.
- **C-21:** documentos privados por `features/municipal/privateDocument.js` (web verificado; Android/iOS
  no disponible hasta el lector nativo). El exportador comercial no se usa ni se modifica.
- **Puerto v2:** idempotencia por municipio (corrige un cruce posible entre municipios) y operaciones por
  id con municipio. Sin cambios en draft.3.
- Dependencias vigentes: C-01, C-05, C-08, C-15, C-16, C-17, C-18, C-19, C-20, C-21.


## Actualización 2026-11-10 (F1-14)

| ID | Prio | Hallazgo | Impacto | Propuesta | Archivos |
|---|---|---|---|---|---|
| C-22 | P2 | draft.3 no expone documentos `PENDIENTE` ni su estado; la bitácora no registra su creación | La conciliación de documentos no puede construirse sin inferir estado | `GET …/documents/pending` y `POST …/documents/{id}/reconciliation` (CONFIRMAR con sha256 / DESCARTAR sin borrar), permiso `municipal.documents.reconcile` (doc 16 §3) | OpenAPI draft.4, router, matriz de permisos |
| C-23 | P3 (política) | `ADMIN_MUNICIPAL` no tiene `municipal.audit.read` | El administrador ve «acceso denegado» en la bitácora | Mantener (separación de funciones) o conceder lectura; decisión del responsable | `policy/permissions` (no modificado) |

- **Bundle probado por Codex `8a18610` → actual:** diferencias de integración en doc 16 §6 (idempotencia por
  municipio, 409 transitorio, integridad sha256, lector privado alineado con `privateDocumentPolicy`).
- **C-19:** el `Input` de esta rama sigue con `role="search"`; las pruebas F1-14 aceptan `search` o ninguno
  para no depender de la corrección pendiente.
- Encabezados web: todos exponen nivel 1 en RN Web; reportar junto con C-18/C-19.
- Dependencias vigentes: C-01, C-05, C-08, C-15, C-16, C-17, C-18, C-19, C-20, C-21, C-22, C-23.

## Actualización 2026-11-10 (F1-15a y entrega)

- **C-01 / C-11 (para la demostración integrada):** montar `MunicipalApp` (ya acepta `createMunicipalApi`)
  en la navegación del ERP, con entrada visible solo con membresía municipal. Sin esto, la entrega se
  demuestra con API simulada.
- **Núcleo (nuevo, P3):** `EmptyState` y `StatCard` usan variantes de encabezado sin `aria-level`; en RN Web
  todo encabezado sin nivel es `<h1>`. Propuesta: prop opcional `headingLevel` o rol de texto para el valor.
  Las pantallas municipales ya no los usan.
- **Núcleo (informativo):** `m01.frontend.test.js` tiene 3 fallas (detalle de usuario, roles protegidos, roles de solo lectura) que se reproducen idénticas en `cae3e38`, sin cambios municipales.
- C-18/C-19, C-05, C-22 y C-23 sin cambios. No se amplió la bitácora al administrador.
