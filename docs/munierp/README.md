# MuniERP IA — Fase 0 (auditoría y decisiones arquitectónicas)

MuniERP IA es la solución especializada para la gestión municipal de **San Juan Huactzinco,
Tlaxcala**, **conectada** a YJ Nexo ERP (sistema principal). No es un segundo ERP.

Estado: **Fase 0 — diseño. No hay código municipal implementado.** Base auditada `main@d5b64b0`.

| # | Entregable | Archivo |
|---|---|---|
| 1 | Diagnóstico técnico (arquitectura, auth, RBAC, conexiones) | [01-DIAGNOSTICO.md](01-DIAGNOSTICO.md) |
| 2 | Matriz de reutilización e integración | [02-MATRIZ-REUTILIZACION.md](02-MATRIZ-REUTILIZACION.md) |
| 3 | Arquitectura conectada, ADR-01…09 y modelo de datos | [03-ARQUITECTURA-CONECTADA.md](03-ARQUITECTURA-CONECTADA.md) |
| 4 | Matriz de roles y permisos por expediente | [04-ROLES-PERMISOS.md](04-ROLES-PERMISOS.md) |
| 5 | Contraste RQ01–RQ06 e incompatibilidades de stack (**pendiente de insumo**) | [05-REQUISITOS-Y-STACK.md](05-REQUISITOS-Y-STACK.md) |
| 6 | Contratos iniciales de API (OpenAPI 3.1) | [contracts/municipal-v1.openapi.yaml](contracts/municipal-v1.openapi.yaml) |
| 7 | Casos de prueba y ejecución de la línea base | [06-CASOS-PRUEBA.md](06-CASOS-PRUEBA.md) |
| 8 | Plan, backlog, riesgos y criterios de aceptación | [07-PLAN-Y-BACKLOG.md](07-PLAN-Y-BACKLOG.md) |

## Decisiones clave

1. Módulo de dominio dentro del monolito, API propia `/api/municipal/v1` (ADR-01/02).
2. Mismo login y `User`; pertenencia municipal en colección aparte (ADR-03).
3. **Catálogo de permisos municipal separado**: los admin/superadmin del ERP no ven expedientes (ADR-04).
4. Autorización identidad → membresía → expediente, con filtro en la consulta y 404 fuera de alcance (ADR-05).
5. Ciudadano ≠ cliente (ADR-06). Folios por municipio/dependencia/tipo/año (ADR-07). Bitácora inmutable con IP (ADR-08). IA desacoplada y posterior (ADR-09).
