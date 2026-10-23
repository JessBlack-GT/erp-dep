# MuniERP IA — Fase 0 · 03 Propuesta de arquitectura conectada

## Vista general

```
                 ┌──────────────── apps/frontend (RN + RN Web, una sola app) ───────────────┐
                 │  features/* (ERP, sin cambios)     features/municipal/* (nuevo)          │
                 │        │  api.js (/api/v1)                 │ municipalService (/api/municipal/v1)
                 └────────┼───────────────────────────────────┼──────────────────────────────┘
                          │  mismo JWT (Authorization: Bearer) │
┌─────────────────────────┼───────────────────────────────────┼──────────────────────────────┐
│ apps/backend (un solo despliegue Express)                   │                              │
│  helmet · CORS · rate limit · requestLogger · errorHandler (compartidos)                    │
│  /api/v1/*  ── auth, users, roles, customers, sales…  │  /api/municipal/v1/*  ── modules/municipal
│        │                                              │        │                           │
│  security/rbac.js  (catálogo ERP, 30 permisos)        │  security/municipal-rbac.js (catálogo propio)
│        └──────────── resolveAccess(userId) ◄──────────┼────────┘ (identidad, estado, sesión) │
│                                                       │  + membership(userId, municipio)     │
│                                                       │  + regla por expediente              │
└───────────────────────────────┬───────────────────────┴──────────────────────────────────────┘
                                │ misma conexión Mongoose
        users, roles, customers, sales…        municipal_municipalities, municipal_dependencies,
        (sin cambios)                          municipal_memberships, municipal_citizens,
                                               municipal_requests, municipal_request_grants,
                                               municipal_counters, municipal_audit_events
```

## Decisiones arquitectónicas (ADR)

### ADR-01 — MuniERP es un módulo de dominio del ERP, no un segundo ERP
**Decisión:** `apps/backend/src/modules/municipal/` dentro del monolito, con frontera de imports
verificada por prueba. Mismo despliegue (Render), misma base, mismo login.
**Alternativa descartada:** servicio separado con su propia base y auth → duplica identidad,
sesiones y despliegue; contradice "conectado al ERP principal".
**Consecuencia:** se puede extraer a servicio en el futuro porque la frontera es explícita.

### ADR-02 — API municipal versionada de forma independiente: `/api/municipal/v1`
**Decisión:** montar `app.use('/api/municipal/v1', municipalRoutes)` en `app.js` (una línea),
sin tocar `routes/index.js` del ERP. Versionado propio: un cambio incompatible en MuniERP crea
`/api/municipal/v2` sin afectar `/api/v1`.
**Contrato:** OpenAPI 3.1 en `docs/munierp/contracts/municipal-v1.openapi.yaml` (fuente de verdad).

### ADR-03 — Identidad compartida, pertenencia separada
**Decisión:** `User` sigue siendo la identidad única. La relación con el municipio vive en
`municipal_memberships`. **No se añaden campos a `User`.**
Un mismo usuario puede tener rol ERP `user` (0 permisos comerciales) y ser `TITULAR_DEPENDENCIA`
en Obras Públicas.

### ADR-04 — Catálogo de permisos municipal separado del ERP
**Decisión:** `security/municipal-rbac.js` con su propio catálogo y matriz. `admin`/`superadmin`
del ERP **no** heredan permisos municipales. Middleware nuevo `requireMunicipal(permission)`.
**Motivo:** hallazgo R3 (`admin = PERMISSIONS`). Separación de funciones y principio de mínimo
privilegio sobre datos personales en posesión de un sujeto obligado (ayuntamiento).
**Arranque (bootstrap):** la primera membresía `ADMIN_MUNICIPAL` se crea con un script QA/ops
explícito, nunca por API abierta ni automáticamente al arrancar.

### ADR-05 — Autorización en tres capas, filtrada en la consulta
1. **Identidad:** `resolveAccess` (usuario activo + `sessionVersion`) → 401.
2. **Pertenencia + permiso:** membresía activa y vigente en el municipio de la ruta + permiso del
   rol municipal → 403.
3. **Expediente:** la consulta a Mongo incluye el filtro de alcance (municipio + dependencias de
   la membresía + concesiones explícitas). Un expediente fuera de alcance responde **404** (no 403)
   para no revelar su existencia.
Nunca se carga el documento y luego se "comprueba": el filtro va en el `find`.

### ADR-06 — Ciudadano ≠ cliente
`municipal_citizens` es independiente de `customers`; no hay referencia cruzada ni migración.
Datos mínimos (nombre, contacto, localidad). CURP/INE **no** se almacenan en Fase 1; en QA solo
datos sintéticos marcados `synthetic: true`.

### ADR-07 — Folios por municipio/dependencia/tipo/año
Formato: `{MUN}-{DEP}-{TIPO}-{AAAA}-{NNNNNN}`, p. ej. `SJH-OBP-SOL-2026-000042`.
Contador en `municipal_counters` con `_id` compuesto, incremento atómico dentro de la misma
transacción que crea el documento. Un folio emitido nunca se reutiliza; la cancelación conserva
el folio con estado `CANCELADA`.

### ADR-08 — Bitácora municipal inmutable
`municipal_audit_events` append-only (mismos ganchos de inmutabilidad del módulo audit actual):
`actorId, membershipId, municipalityId, dependencyId, action, entity, entityId, folio, result,
ip, requestId, at`. Se escribe en la misma transacción que la operación. Las **denegaciones**
(403/404 por alcance) también se registran (sin transacción, best-effort).

### ADR-09 — IA desacoplada y posterior
La IA (clasificación/turnado sugerido de solicitudes) se diseña como adaptador
`modules/municipal/ai/` con contrato propio, **sin** enviar datos personales a proveedores
externos hasta contar con evaluación de impacto y consentimiento/aviso de privacidad. No forma
parte de Fase 1.

## Modelo de datos inicial (colecciones nuevas)

| Colección | Campos clave | Índices |
|---|---|---|
| `municipal_municipalities` | `code` (p. ej. `SJH`), `name`, `state`, `inegiCode` *(por verificar)*, `status` | `code` único |
| `municipal_dependencies` | `municipalityId`, `code` (`OBP`, `TES`…), `name`, `parentId?`, `status` | `{municipalityId, code}` único |
| `municipal_memberships` | `userId`, `municipalityId`, `role` (catálogo municipal), `dependencyIds[]`, `status`, `validFrom`, `validTo?`, `createdBy` | `{userId, municipalityId}` único; `{municipalityId, dependencyIds}` |
| `municipal_citizens` | `municipalityId`, `fullName`, `contact{email?,phone?}`, `locality?`, `synthetic`, `createdBy` | `{municipalityId, fullName}` |
| `municipal_requests` (solicitudes/expedientes) | `municipalityId`, `folio`, `type`, `subject`, `description`, `citizenId`, `ownerDependencyId`, `assignedDependencyIds[]`, `assignedUserId?`, `status`, `confidentiality` (`PUBLICA`/`RESERVADA`/`CONFIDENCIAL`), `history[]`, `createdBy`, `idempotencyKey` | `{municipalityId, folio}` único; `{municipalityId, ownerDependencyId, status}`; `{createdBy, idempotencyKey}` único |
| `municipal_request_grants` | `requestId`, `municipalityId`, `granteeUserId?` \| `granteeDependencyId?`, `level` (`READ`/`CONTRIBUTE`), `expiresAt?`, `grantedBy` | `{requestId, granteeUserId}`; TTL opcional |
| `municipal_counters` | `_id: "{mun}:{dep}:{tipo}:{año}"`, `value` | `_id` |
| `municipal_audit_events` | ver ADR-08 | `{municipalityId, at}`, `{entityId, at}` |

Dependencias de ejemplo para QA (sintéticas, a confirmar con el ayuntamiento): Presidencia (`PRE`),
Secretaría del Ayuntamiento (`SEC`), Tesorería (`TES`), Obras Públicas (`OBP`), Registro Civil
(`RCI`), DIF (`DIF`), Agua Potable (`AGP`), Seguridad Pública (`SEG`).

## Flujo de una petición municipal

```
GET /api/municipal/v1/municipalities/SJH/requests/SJH-OBP-SOL-2026-000042
 → authenticateToken                      (JWT válido)               ✗ 401
 → requireMunicipal('requests.read')
     → resolveAccess(user)                (activo, sessionVersion)   ✗ 401 / 503
     → membership(user, SJH)              (activa, vigente)          ✗ 403
     → permiso del rol municipal                                     ✗ 403
 → repository.findInScope(folio, scope)   (filtro en la consulta)    ✗ 404 (+ evento de denegación)
 → 200 DTO (sin campos internos)
```

## Compatibilidad web y Android

- Sin dependencias nuevas en Fase 1 (Express, Mongoose, RN, RN Web, axios ya presentes).
- `municipalService` usa el mismo `apiClient`; la URL base se deriva de `BASE_URL` reemplazando
  `/api/v1` por `/api/municipal/v1` (o variable `PUBLIC_MUNICIPAL_API_BASE_URL`).
- Pantallas con componentes existentes (`components/common`, `WebAppShell`); se validan en build
  web **y** en APK antes de declararlas aprobadas.
- Las respuestas 404 de alcance deben mostrarse como "No encontrado" en ambas plataformas, sin
  distinguir "no existe" de "no autorizado".
