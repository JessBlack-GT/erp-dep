# 04 · Arquitectura del sistema

MuniERP IA es un **módulo de dominio dentro del monolito de YJ Nexo ERP**: misma aplicación React Native
(web y Android), mismo backend Express, misma identidad (usuario y sesión) y misma base MongoDB, pero con API,
permisos y colecciones propias. El núcleo del ERP no se modifica.

```
┌──────────── apps/frontend (React Native + RN Web) ────────────┐
│  features/* del ERP (sin cambios)   features/municipal/*       │
│        apiClient (/api/v1)          municipalApi (/api/municipal/v1, mismo token)
└───────────────┬───────────────────────────────┬────────────────┘
┌───────────────┴───────────── apps/backend (Express) ───────────┴───────────────┐
│ /api/v1/* (ERP)                    │ /api/municipal/v1/* (modules/municipal)    │
│ rbac del ERP                       │ policy municipal: identidad central →       │
│        └──── resolveAccess(userId) ┼──► membresía (municipio, rol, dependencias) │
│                                    │   → regla por expediente → 404 fuera de alcance
└──────────────────────┬─────────────┴──────────────────────────────────────────────┘
          MongoDB: colecciones del ERP │ municipal_* (solicitudes, membresías, contadores,
                                       │ documentos/GridFS, bitácora)
```

## Decisiones principales

| ADR | Decisión |
|---|---|
| 01–02 | Módulo en el monolito; API propia versionada `/api/municipal/v1` (contrato OpenAPI draft.3) |
| 03 | Identidad central del ERP; membresías municipales en colección aparte, por municipio |
| 04 | Catálogo de permisos `municipal.*` separado: los administradores del ERP **no** ven expedientes |
| 05 | Autorización identidad → membresía → expediente, con filtro en la consulta y 404 sin datos |
| 06 | Ciudadano ≠ cliente comercial; datos mínimos, sin CURP |
| 07 | Folio por municipio, dependencia, tipo y año, emitido en la misma transacción |
| 08 | Historial y bitácora inmutables (actor, fecha, estado; IP solo en bitácora) |
| 10 | Documentos privados: sin URL pública, descarga por endpoint autorizado, sha256 |
| 11 | Indicadores calculados sobre el mismo alcance del usuario |
| 12 | Canal presencial con acuse; reintentos idempotentes |

## Modos de ejecución

| Modo | Qué corre | Estado |
|---|---|---|
| **Demostración** (esta entrega) | Interfaz + **servicio municipal real** en el navegador, almacén en memoria, datos sintéticos | Funcional y probado (Playwright 3 navegadores) |
| Pruebas de backend | Router HTTP real con supertest + almacén en memoria | 279 pruebas aprobadas |
| HTTP real en el ERP | `MunicipalApp` montada en la navegación del ERP con `createMunicipalApi` | **Pendiente** del anfitrión local de Codex (C-01, C-11) |
| Persistencia real | Adaptador MongoDB contra `munierp_qa` | **Preparado, no validado** (C-05; pruebas L3 escritas sin ejecutar) |

Detalle técnico: `docs/munierp/03-ARQUITECTURA-CONECTADA.md`, `12`, `14`, `15` (persistencia) y el contrato
`docs/munierp/contracts/municipal-v1.openapi.yaml`.
