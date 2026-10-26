# MuniERP IA — 02 Matriz de reutilización e integración

> Revisión 2026-10-26: filas de documentos privados, indicadores e interfaz; catálogo municipal
> ubicado en `modules/municipal/policy/` mientras Codex no revise `src/security/`.

Leyenda: **R** = reutilizar tal cual · **E** = extender sin modificar el comportamiento ERP ·
**P** = reutilizar el *patrón* (código nuevo, mismo diseño) · **N** = no reutilizar.

| Componente YJ Nexo | Archivo(s) | Decisión | Justificación / condición para no afectar el ERP |
|---|---|---|---|
| Login, refresh, logout, `/auth/me` | `modules/auth/*` | **R** | Un solo inicio de sesión para funcionarios. MuniERP no emite tokens propios. |
| Recuperación de contraseña + Resend | `auth.service.js`, `shared/services/email.js` | **R** | Plantilla de correo puede parametrizarse por producto más adelante (no en Fase 1). |
| `sessionVersion` / revocación | `users.model.js`, `middleware/authorize.js` | **R** | La desactivación de un usuario corta también su acceso municipal en la siguiente petición. |
| Modelo `User` (identidad) | `users.model.js` | **R (sin campos nuevos)** | La pertenencia municipal vive en otra colección; `User` y su índice no cambian. |
| `User.role` + catálogo `rbac.PERMISSIONS` | `security/rbac.js` | **N para permisos municipales** | Ver hallazgo R3: `admin` recibe todo el catálogo. Los permisos municipales van en `modules/municipal/policy/permissions.js` (implementado). |
| `resolveAccess` + fail-closed 503 | `security/rbac.js`, `middleware/authorize.js` | **P** | Nuevo `resolveMunicipalAccess(userId, municipalityId)` que primero llama a `resolveAccess` (estado/usuario/sesión) y luego a la membresía. |
| Re-verificación transaccional del actor | `security/administration.js#transaction` | **P** | Misma técnica para escrituras municipales (lock de actor + membresía dentro de la transacción). |
| Regla "solo asignar subconjunto de permisos propios" | `administration.js#subset/assignable` | **P** | Aplicada a administradores municipales y por dependencia. |
| Roles/Usuarios UI | `features/users`, `features/roles` | **N** | La gestión de membresías municipales tendrá su pantalla propia. |
| Middleware global (helmet, CORS, JSON, rate limit, requestLogger) | `app.js`, `config/cors.js` | **R** | El limitador global aplica a `/api/` y cubre `/api/municipal/v1`. |
| Manejo de errores (`AppError`, `errorHandler`) | `middleware/errorHandler.js`, `shared/errors` | **R** | Códigos 400/401/403/404/409/503 coherentes. |
| Validadores | `shared/validators`, `inventory.validation` (`object`, `id`, `text`) | **P** | Validación estricta de payload (rechazo de campos desconocidos). |
| Idempotencia de escrituras | `inventory.service/repository` | **P** | `Idempotency-Key` en `POST /solicitudes` (evita folios duplicados por reintentos móviles). |
| Numeración | `commercial/numbering.js` | **P (no reutilizar la colección)** | La función valida tipos comerciales y usa clave global; los folios municipales necesitan clave `{municipio, dependencia, tipo, año}` y colección `municipal_counters`. |
| Auditoría append-only | `modules/audit/audit.model.js` | **P** | Ganchos de inmutabilidad reutilizables como patrón; nueva colección `municipal_audit_events` con IP y requestId. El enum comercial no se toca. |
| Reportes PDF/Excel | `pdfkit`, `exceljs` (ya instalados) | **R (librerías)** | Acuses/constancias en fase posterior, sin dependencias nuevas. |
| Mongoose / driver `mongodb` (GridFS) | ya instalado | **R** | Almacenamiento privado de documentos sin dependencia nueva (ADR-10, C-07). |
| `express.json({ limit: '10mb' })` | `app.js` | **R** | Permite subir documentos ≤ 5 MB en base64 sin `multer`. |
| Dashboard | stub | **N** | Indicadores municipales propios calculados sobre el alcance (ADR-11); el stub del ERP no se toca. |
| `react-native-blob-util` + `utils/downloadFile*` | frontend | **R** | Descarga autorizada de documentos en Android/web (F1-13). |
| `StatCard`, `Badge`, `Card`, `Input`, `TextArea`, `Button`, `EmptyState` | `components/common` | **R** | Usados por el prototipo `features/municipal`. |
| Clientes (`customers`) | `modules/customers` | **N** | Un ciudadano **no** es un cliente. Colección y modelo propios (`municipal_citizens`). Sin referencias cruzadas. |
| Ventas, inventario, productos, proveedores | `modules/sales`, `inventory`, `products`, `suppliers` | **N (Fase 1)** | Posible integración futura (p. ej. almacén municipal) solo mediante contrato/adaptador explícito, como `commercial/inventory.contract.js`. |
| Finanzas | stub | **N** | Cobro de derechos municipales queda fuera de Fase 1. |
| Runners QA protegidos | `scripts/qa-environment.cjs`, `validate-*-real.cjs` | **E** | Nuevo `validate-municipal-real.cjs` con variable de confirmación propia `MUNICIPAL_QA_DATABASE`. |
| Frontend: `AuthContext`, `api.js`, `usePermissions`, shell web, theme, componentes | `apps/frontend/src/*` | **R / E** | Se añade `municipalService` y `features/municipal/*`; navegación condicionada a membresías. Ninguna pantalla ERP cambia. |
| Android RN | `apps/frontend/android` | **R** | Sin dependencias nativas nuevas en Fase 1. |

## Fronteras de integración (reglas verificables)

1. `modules/municipal/**` solo puede importar de `security/`, `shared/`, `middleware/`, `config/` y de sí mismo.
2. Ningún módulo ERP puede importar de `modules/municipal/**`.
3. Colecciones municipales con prefijo `municipal_`. Ningún módulo ERP las consulta.
4. El catálogo `rbac.PERMISSIONS` del ERP **no cambia** (30 permisos en `d5b64b0`; `docs/security/RBAC.md` aún dice 25 porque no cuenta `commercial.*`). Una prueba lo fija.
5. Las reglas 1–4 se automatizan como prueba de estructura (como ya hace `tests/structure.test.js`).
