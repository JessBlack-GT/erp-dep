# MuniERP IA — Documentación (Fase 0 actualizada y preparación de Fase 1)

MuniERP IA es la solución especializada para la gestión municipal de **San Juan Huactzinco,
Tlaxcala**, **conectada** a YJ Nexo ERP (sistema principal). No es un segundo ERP.

Estado (2026-11-10): **Fase 1 en curso — F1-04, F1-12 y F1-13 hechas (aisladas, sin montar); F1-05 pasos 1–2 hechos en memoria y paso 3 (adaptador MongoDB) preparado y probado con dobles; sin conexión a MongoDB.**
Dominio, API HTTP y prototipo de interfaz **aislados y sin montar**, con pruebas ejecutadas en memoria
y datos sintéticos. Base auditada `main@d5b64b0`; nada en `main` cambia.

| # | Entregable | Archivo |
|---|---|---|
| 1 | Diagnóstico técnico (arquitectura, auth, RBAC, conexiones) | [01-DIAGNOSTICO.md](01-DIAGNOSTICO.md) |
| 2 | Matriz de reutilización e integración | [02-MATRIZ-REUTILIZACION.md](02-MATRIZ-REUTILIZACION.md) |
| 3 | Arquitectura conectada, ADR-01…12 y modelo de datos | [03-ARQUITECTURA-CONECTADA.md](03-ARQUITECTURA-CONECTADA.md) |
| 4 | Matriz de roles y permisos por expediente | [04-ROLES-PERMISOS.md](04-ROLES-PERMISOS.md) |
| 5 | Requisitos oficiales RQ01–RQ06, **matriz de trazabilidad** y comparativa de stack | [05-REQUISITOS-Y-STACK.md](05-REQUISITOS-Y-STACK.md) |
| 6 | Contrato de API versionado (OpenAPI 3.1, draft.3) | [contracts/municipal-v1.openapi.yaml](contracts/municipal-v1.openapi.yaml) |
| 7 | Casos de prueba, estado por caso y resultados ejecutados | [06-CASOS-PRUEBA.md](06-CASOS-PRUEBA.md) |
| 8 | Backlog priorizado de Fase 1, riesgos y criterios de aceptación | [07-PLAN-Y-BACKLOG.md](07-PLAN-Y-BACKLOG.md) |
| 9 | Dependencias que debe resolver Codex | [08-DEPENDENCIAS-CODEX.md](08-DEPENDENCIAS-CODEX.md) |
| 10 | Diseño de interfaces y módulos | [09-DISENO-INTERFACES.md](09-DISENO-INTERFACES.md) |
| 11 | Historia F1-04: capa HTTP, inventario, evidencia y riesgos | [10-F1-04-CAPA-HTTP.md](10-F1-04-CAPA-HTTP.md) |
| 12 | Historia F1-12 y QA con Playwright | [11-F1-12-Y-QA-PLAYWRIGHT.md](11-F1-12-Y-QA-PLAYWRIGHT.md) |
| 13 | Diseño técnico F1-05 (repositorio MongoDB, sin conexión) | [12-F1-05-DISENO-MONGODB.md](12-F1-05-DISENO-MONGODB.md) |
| 14 | Historia F1-13: detalle de expediente y QA Playwright (nube y Windows) | [13-F1-13-DETALLE-Y-QA.md](13-F1-13-DETALLE-Y-QA.md) |
| 15 | F1-05 pasos 1–2: puerto asíncrono, suite de contrato, Playwright 3 navegadores, C-18/C-19 | [14-F1-05-PUERTO-Y-CONTRATO.md](14-F1-05-PUERTO-Y-CONTRATO.md) |
| 16 | Propuestas de contrato X-01…X-04 (draft.4 no publicada) | [contracts/PROPUESTAS-DRAFT4.md](contracts/PROPUESTAS-DRAFT4.md) |
| 17 | F1-05 paso 3: adaptador MongoDB, preflight de `munierp_qa`, C-21 lector privado | [15-F1-05-ADAPTADOR-MONGODB.md](15-F1-05-ADAPTADOR-MONGODB.md) |
| 18 | F1-14: bitácora de auditoría, documentos PENDIENTE (C-22), casos L3, integridad, Playwright 96/96 | [16-F1-14-AUDITORIA-Y-L3.md](16-F1-14-AUDITORIA-Y-L3.md) |
| — | Código de dominio (no montado) | [`apps/backend/src/modules/municipal/`](../../apps/backend/src/modules/municipal/README.md) |

## Decisiones clave

1. Módulo de dominio dentro del monolito, API propia `/api/municipal/v1` (ADR-01/02).
2. Mismo login y `User`; pertenencia municipal en colección aparte (ADR-03).
3. **Catálogo de permisos municipal separado**: los admin/superadmin del ERP no ven expedientes (ADR-04).
4. Autorización identidad → membresía → expediente, con filtro en la consulta y 404 fuera de alcance (ADR-05).
5. Ciudadano ≠ cliente (ADR-06). Folios por municipio/dependencia/tipo/año (ADR-07). Bitácora inmutable con IP (ADR-08). IA opcional y desacoplada (ADR-09).
6. Documentos privados con descarga solo autorizada (ADR-10), indicadores sobre el alcance del usuario (ADR-11), canal presencial y acuse (ADR-12).
7. No se migra el núcleo: Express 4 se mantiene, el módulo es compatible con Express 5 y usa JSDoc/`@ts-check` en lugar de TypeScript compilado.
