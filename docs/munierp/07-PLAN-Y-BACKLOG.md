# MuniERP IA — Fase 0 · 07 Plan de implementación y backlog inicial

Regla de trabajo: una rama `codex/muni-XX-*` por historia, PR hacia `main`, nunca push directo.
Un incremento solo se marca **APROBADO** con evidencia ejecutada (unitarias + HTTP + real QA
cuando aplique) en `docs/qa/MUNI-XX-VALIDATION.md`.

## Prerrequisitos (bloquean MUNI-01)

| ID | Tarea | Motivo |
|---|---|---|
| PRE-1 | Recibir texto oficial RQ01–RQ06 y stack académico; actualizar 05 | Trazabilidad real |
| PRE-2 | Línea base verde: integrar la corrección de los 3 fallos de `m01.frontend.test.js` y completar la corrida frontend | No mezclar regresiones con trabajo nuevo |
| PRE-3 | Decidir destino de ramas `codex/deploy-readiness` y `codex/android-emulator-readiness` (no integradas) | Evitar conflictos en `apps/frontend/android` |
| PRE-4 | Confirmar base QA **exclusiva** para MuniERP y nombre para `MUNICIPAL_QA_DATABASE` | Restricción de datos |
| PRE-5 | Aprobar ADR-01…09 y matriz 04 (arquitecto + responsable municipal) | Contratos antes de código |

## Backlog

| ID | Historia | Archivos afectados (nuevos **N** / modificados **M**) | Criterios de aceptación | Pruebas |
|---|---|---|---|---|
| MUNI-00 | Higiene de seguridad del repo | **M** `.gitignore` (`*.env`, `!.env.example`, `android/local.properties`, `android/.gradle/`); retirar del índice esos archivos sin borrarlos del disco | `git ls-files` no lista `local.properties` ni `.gradle/`; ningún cambio funcional | Suite completa sin cambios |
| MUNI-01 | Esqueleto del módulo y frontera | **N** `modules/municipal/{index,routes}.js`, `tests/municipal.structure.test.js`; **M** `app.js` (1 línea `app.use('/api/municipal/v1', …)`) | `/api/municipal/v1/health` 200; prueba de frontera (MT-61) y catálogo ERP fijo (MT-60) pasan; suites ERP sin regresión | MT-60, MT-61, MT-62 |
| MUNI-02 | Catálogo y middleware de autorización municipal | **N** `security/municipal-rbac.js`, `middleware/requireMunicipal.js`, modelos `municipality`, `dependency`, `membership` | Matriz 04 codificada y congelada por prueba; ERP admin/superadmin → 403; fail-closed 503 | MT-01…MT-08 |
| MUNI-03 | Bootstrap QA/ops | **N** `scripts/municipal-bootstrap.cjs` (reusa `qa-environment.cjs`) | Exige `MUNICIPAL_QA_DATABASE`; crea municipio SJH, dependencias sintéticas y primer ADMIN_MUNICIPAL; idempotente; no corre al arrancar | Ejecución doble sin duplicados |
| MUNI-04 | Dependencias | **N** `modules/municipal/dependencies/*` | Contrato `listDependencies/createDependency/updateDependency`; unicidad por municipio | MT-09, MT-20…MT-22 |
| MUNI-05 | Membresías | **N** `modules/municipal/memberships/*` | Regla de subconjunto; no autoasignación; `/me/memberships` | MT-06, MT-10 |
| MUNI-06 | Bitácora municipal | **N** `modules/municipal/audit/*` | Inmutable; IP + requestId; denegaciones registradas | MT-50…MT-53 |
| MUNI-07 | Ciudadanos | **N** `modules/municipal/citizens/*` | Sin campos CURP/INE; búsqueda por alcance; `synthetic` en QA | MT-18, MT-19c |
| MUNI-08 | Folios | **N** `modules/municipal/folios/numbering.js` | Contador por `{mun, dep, tipo, año}` en transacción; sin reutilización | MT-30…MT-32, MT-35, MT-36 |
| MUNI-09 | Solicitudes: crear/listar/detalle | **N** `modules/municipal/requests/*` | Filtro de alcance en la consulta; 404 fuera de alcance; idempotencia | MT-13…MT-19, MT-33, MT-34 |
| MUNI-10 | Transiciones, turnado y grants | **N** `requests/transitions.js`, `grants/*` | Máquina de estados de 04; `version` optimista | MT-19b, MT-40…MT-45 |
| MUNI-11 | Runner real QA | **N** `scripts/validate-municipal-real.cjs` | Rechaza producción; limpia solo IDs del `runId`; emite `MUNICIPAL_RESULT` sin secretos | Todos los R |
| MUNI-12 | Frontend: servicio y navegación | **N** `services/municipalApi.js`, `features/municipal/*`; **M** `MainNavigator.js`, `Sidebar.js` (entrada condicionada) | Menú visible solo con membresía; web build y APK verificados | MT-63, MT-64 |
| MUNI-13 | Endurecimiento de sesión (opcional, requiere aprobación) | **M** `auth.service.js` (rotación refresh), evaluación de almacenamiento seguro en Android | Sin romper login web/Android; justificar cualquier dependencia nueva | Suites auth + E2E |
| MUNI-14 | Diseño IA (RQ06) | **N** `docs/munierp/08-IA.md` | Evaluación de impacto de datos, contrato del adaptador, sin PII externa | Revisión |

## Riesgos

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| K1 | Un admin ERP desactiva o cambia el rol global de un funcionario municipal (`/users`) | Media | Medio | Documentar; en MUNI-05 alertar en bitácora municipal cuando un miembro cambia de estado; a futuro, ámbito en la administración de usuarios. |
| K2 | Fuga entre dependencias por un filtro olvidado en un repositorio | Media | Alto | Repositorio único `findInScope` obligatorio; pruebas R de aislamiento por endpoint; revisión de código con checklist. |
| K3 | Añadir permisos municipales al catálogo ERP por error | Baja | Crítico | MT-60 congela el catálogo; ADR-04. |
| K4 | Uso de datos reales de ciudadanos en QA | Baja | Crítico | Solo `synthetic: true`; runner rechaza bases no confirmadas; sin importadores en Fase 1. |
| K5 | Divergencia con el stack académico | Alta | Medio | Tabla de 05; decidir antes de MUNI-01. |
| K6 | Rendimiento: 3 lecturas por petición (user, role, membership) | Baja | Bajo | Índices; medir en QA; caché corta solo si hace falta. |
| K7 | Conflictos con ramas Android/deploy no integradas | Media | Medio | PRE-3. |
| K8 | Tokens en `localStorage`/AsyncStorage expuestos ante XSS | Media | Alto | CSP estricta en web, sanitización, MUNI-13. |
| K9 | Mongo sin replica set en algún entorno QA | Baja | Alto | Transacciones obligatorias: el runner verifica soporte antes de sembrar. |

## Definición de terminado (por historia)

- Contrato OpenAPI actualizado si cambia la interfaz (versión semántica del draft).
- Pruebas positivas **y** negativas (401/403/404/409) por endpoint.
- Suites ERP sin regresiones (comparadas con la línea base registrada).
- Validación real en base QA autorizada cuando la historia persiste datos.
- Build web y, desde MUNI-12, APK ejecutado.
- Sin secretos, sin datos reales, sin cambios de dependencias no justificados.
