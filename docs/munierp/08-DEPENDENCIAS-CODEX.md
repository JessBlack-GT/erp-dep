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
| C-20 | P2 | Herramientas de QA E2E | Playwright solo está disponible con Chromium en la nube; Firefox/WebKit requieren ejecutar en Windows o declarar `@playwright/test` y navegadores en CI | Decidir dónde corre E2E (CI o equipo) | CI |
| C-14 | P2 | CORS | Solo si la interfaz municipal se publica en otro dominio | Ninguno si vive en la misma app de Cloudflare Pages | `config/cors.js` |

## Lo que MuniERP ya entrega sin tocar el núcleo

- Código de dominio y aplicación en `apps/backend/src/modules/municipal/` (no montado).
- Interfaz aislada en `apps/frontend/src/features/municipal/` (no registrada en la navegación).
- Pruebas en `apps/backend/tests/municipal/` y `apps/frontend/tests/municipal.frontend.test.js`, que
  entran automáticamente en `npm test` por los globs existentes. **Efecto en CI de Codex:** +117
  pruebas backend (desde F1-12) y +11 frontend; ninguna requiere red ni base de datos.
- Contrato `municipal-v1` draft.1 y verificación automática de coherencia contrato ↔ dominio.

## Interfaz que MuniERP espera del ERP (sin cambios)

| Servicio central | Uso | Contrato |
|---|---|---|
| `authenticateToken` | Validar JWT | Igual que `/api/v1` |
| `rbac.resolveAccess(userId)` | Usuario activo + `sessionVersion`; de su resultado **solo se usa `id`** | `policy/context.js` |
| `User` | Identidad referenciada por `municipal_memberships.userId` | Sin campos nuevos |
| `shared/services/email` | (Futuro) avisos a funcionarios | Sin cambios |
| `errorHandler`, helmet, CORS, rate limit | Transversales | Ver C-08 |
