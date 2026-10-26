# MuniERP IA — 01 Diagnóstico técnico de YJ Nexo ERP

> Revisión 2026-10-26: se añade C8 (límite por IP compartida). El resto del diagnóstico de Fase 0 se
> mantiene; la comparativa con el stack académico está en [05](05-REQUISITOS-Y-STACK.md#3-comparativa-tecnológica-sistema-real-vs-propuesta-académica).

Base auditada: `main` @ `d5b64b0` (2026-10-07). Auditoría estática del código + ejecución local de
las pruebas existentes (ver §7). No se conectó a ninguna base de datos, no se leyeron secretos y no
se modificó `main`.

## 1. Estado real de la arquitectura

| Aspecto | Estado real verificado en código |
|---|---|
| Estilo | Monolito modular en monorepo npm workspaces (`apps/backend`, `apps/frontend`, `mobile-native/*`). |
| Backend | Node ≥18, Express 4, Mongoose 7, JWT (`jsonwebtoken` 9), bcryptjs, helmet, cors, express-rate-limit. Despliegue documentado en Render. |
| Base de datos | MongoDB Atlas. Usa **transacciones multi-documento** (`mongoose.connection.transaction`) en usuarios, inventario, ventas y recuperación de contraseña → requiere replica set (Atlas lo cumple; un Mongo local *standalone* no). |
| Frontend | React Native 0.72.17 + React Native Web 0.19, empaquetado web con esbuild (`scripts/web.cjs`), despliegue Cloudflare Pages (`erp-dep.pages.dev`). Navegación `@react-navigation` 6, estado local con Context + AsyncStorage. |
| Android | Proyecto nativo RN en `apps/frontend/android` (Java). `mobile-native/android` solo contiene un `MainActivity.kt` de referencia. Validación nativa **pendiente** según README; la rama `codex/android-emulator-readiness` (9 commits) **no está integrada** en `main`. |
| API | Un único prefijo `/api/v1`. `/health` (liveness) y `/ready` (503 sin Mongo). |
| Multi-inquilino | **No existe.** Ningún modelo tiene `organizationId`, `tenantId`, `companyId` o similar. Unicidades globales (`users.email`, `customers.email`, `customers.documentNumber`) y numeración global por tipo de documento. |

### Módulos backend: implementados vs. stub

| Módulo | Estado | Seguridad aplicada |
|---|---|---|
| auth | Implementado (login, refresh, logout, me, cambio y recuperación de contraseña, registro público) | rate limit específico en login (5/15 min) y forgot-password |
| users, roles (M01) | Implementado | `requirePermission('users.*'/'roles.*')` + re-verificación transaccional |
| customers (M03), suppliers (M04), products (M05), inventory (M06), sales (Fase 3), reports | Implementados | `requirePermission` por ruta |
| commercial | Base de documentos comerciales + numeración + adaptador de inventario | vía sales |
| audit | Modelo **append-only** real, pero **restringido** a `module: 'commercial'`; las rutas son un stub vacío | — |
| dashboard, purchases, finance, human-resources, notifications, settings | **Stub**: router montado solo con `authenticateToken`, sin rutas | — |
| ai, integrations | **Stub** y **no montados** (comentados en `routes/index.js`) | — |

> No existe ninguna capacidad de IA implementada. El "IA" de MuniERP IA parte de cero.

## 2. Autenticación (auditoría)

| # | Hallazgo | Severidad | Comentario |
|---|---|---|---|
| A1 | JWT de acceso y refresh firmados con secretos distintos; payload mínimo `{id, sv, kind}`. | ✅ Correcto | Los claims de rol/permisos no son fuente de autoridad. |
| A2 | Revocación por `sessionVersion` persistido; logout, cambio de contraseña, reset y cambios de rol/estado lo incrementan. | ✅ Correcto | Efecto colateral: logout cierra **todas** las sesiones del usuario (web y Android). |
| A3 | `authenticateToken` acepta tokens **sin** `kind` como acceso (compatibilidad) y no valida el esquema `Bearer`. | Baja | Sin riesgo inmediato (refresh usa otro secreto). Endurecer cuando no queden tokens antiguos. |
| A4 | Refresh token de 7 días **sin rotación** ni lista de revocación individual. | Media | Para datos ciudadanos se recomienda rotación o TTL menor del lado municipal. |
| A5 | `POST /auth/register` es **público**, crea cuentas activas con rol `user` (0 permisos) y solo tiene el limitador global (100/15 min). | Media para MuniERP | Cualquiera puede obtener un JWT válido. **Regla obligatoria:** ningún endpoint municipal puede autorizar solo por "usuario autenticado" (`requireCurrentUser`). |
| A6 | Tokens en `AsyncStorage` (en web = `localStorage`; en Android = almacenamiento no cifrado). | Media | Exposición ante XSS / dispositivo comprometido. Mitigación propuesta en el backlog; cambiar de librería requiere justificación. |
| A7 | Recuperación de contraseña: tokens de un uso, hash SHA-256, TTL 15 min, respuesta uniforme, serialización transaccional. | ✅ Correcto | Reutilizable sin cambios. |

## 3. Usuarios, roles y autorización (auditoría)

| # | Hallazgo | Severidad | Impacto en MuniERP |
|---|---|---|---|
| R1 | Autorización centralizada: `requirePermission(p)` → `resolveAccess(userId)` lee `User` + `Role` en **cada** petición; falla cerrado (503). | ✅ Correcto | Patrón a replicar. |
| R2 | **Un único rol global por usuario** (`User.role` string). No hay ámbito (organización, dependencia, expediente). | Alta | El modelo actual **no puede** expresar "funcionario de Obras Públicas de Huactzinco". Se necesita un modelo de pertenencia aparte (ver 03). |
| R3 | `ROLE_PERMISSIONS.admin = PERMISSIONS` y `superadmin` recibe todo el catálogo. | **Crítica si se ignora** | Si se agregan permisos `municipal.*` al catálogo ERP, **todo admin comercial obtendría acceso a expedientes ciudadanos automáticamente**. Decisión: catálogo municipal **separado** (ADR-04). |
| R4 | `GET /users` lista **todos** los usuarios del sistema, y `users.status`/`users.assignRole` permiten a un admin ERP desactivar o cambiar el rol global de cualquiera (salvo superadmin). | Media | Un admin comercial podría desactivar a un funcionario municipal. Riesgo aceptado en Fase 1 con mitigación (ver riesgos). |
| R5 | `authorizeRoles` y `authorizeOwnerOrAdmin` confían en claims del token. | Baja | Verificado: **no se usan** en ninguna ruta. No copiarlos al módulo municipal. |
| R6 | Roles del sistema inmutables, no autoelevación, asignación limitada a subconjunto de permisos propios. | ✅ Correcto | Replicar la regla de "subconjunto" para administradores municipales. |
| R7 | Auditoría: enum limitado a `commercial/CommercialDocument`; sin IP ni requestId. RF-010 (registrar IP) **no cumplido**. | Alta para MuniERP | Se requiere bitácora municipal propia. |

## 4. Conexiones y configuración

| # | Hallazgo | Severidad |
|---|---|---|
| C1 | Una sola conexión Mongoose (pool 10–50) y una sola base (`MONGODB_DB_NAME`). | Info — MuniERP compartirá la conexión; separación por colecciones con prefijo `municipal_`. |
| C2 | Runners QA (`validate-*-real.cjs`) exigen `M03_QA_DATABASE` igual al nombre de base confirmado, rechazan producción y limpian solo IDs propios. | ✅ Patrón excelente; extender a MuniERP con su propia variable de confirmación. |
| C3 | CORS con lista blanca fija que incluye un preview concreto (`https://d0b732ba.erp-dep.pages.dev`) y permite peticiones sin `Origin` (necesario para Android). | Baja |
| C4 | `.gitignore` ignora `.env` exacto pero **no** `*.env` (p. ej. `atlas-credentials.env`). | Media — riesgo de commit accidental de credenciales. |
| C5 | `apps/frontend/android/local.properties` y caches `.gradle/` están versionados (el propio archivo dice que no debe estarlo). | Baja (higiene) |
| C6 | `dotenv.config()` se invoca dos veces (app.js y environment.js); `trust proxy` correctamente acotado. | Info |
| C7 | `expo run:android` en scripts, pero `expo` no es dependencia. | Baja — documentar, no cambiar sin justificación. |
| C8 | Límite global de 100 peticiones / 15 min **por IP** en `/api/`. Oficinas municipales detrás de una sola IP pública compartirán el cupo. | Media para RQ06 (continuidad) — dependencia C-08. |

## 5. Documentación desactualizada

- README afirma que `/api/v1/roles` devuelve 501: **falso**, M01 lo implementó.
- `Customer.country` tiene por defecto `'Peru'` (origen de plantilla). No se toca: es ERP comercial.

## 6. Conclusión

El núcleo de identidad (auth + sesión + RBAC fail-closed + transacciones + runners QA protegidos) es
sólido y **reutilizable**. Lo que **no** existe y MuniERP necesita: ámbito organizacional,
pertenencia por dependencia, permisos por expediente, bitácora con IP y numeración por
año/dependencia. Todo ello puede construirse **al lado** del ERP sin alterar sus modelos.

## 7. Evidencia de pruebas existentes

Ver sección "Ejecución" en [06-CASOS-PRUEBA.md](06-CASOS-PRUEBA.md#ejecución-de-la-línea-base).
