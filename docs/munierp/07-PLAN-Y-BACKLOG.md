# MuniERP IA — 07 Plan y backlog priorizado de Fase 1

> Revisión 2026-10-26: backlog reordenado por los requisitos oficiales RQ01–RQ06. Las 15 historias de
> Fase 0 (MUNI-00…MUNI-14) se conservan y se mapean en la columna "Fase 0". Estados:
> **HECHO-A** = hecho en código aislado con pruebas ejecutadas (sin montar, sin DB) ·
> **PENDIENTE** · **BLOQ (C-xx)** = bloqueado por una dependencia de Codex (08).

Regla de trabajo: una rama `codex/muni-XX-*` por historia, PR hacia `main`, nunca push directo.
Un incremento solo se marca **APROBADO** con evidencia ejecutada (unitarias + HTTP + real QA cuando
aplique) en `docs/qa/MUNI-XX-VALIDATION.md`. "HECHO-A" **no** equivale a aprobado.

## Prerrequisitos

| ID | Tarea | Estado |
|---|---|---|
| PRE-1 | Texto oficial RQ01–RQ06 y stack académico | ✅ Recibido e incorporado (05) |
| PRE-2 | Línea base verde (3 fallos en `m01.frontend.test.js`) | BLOQ (C-03) |
| PRE-3 | Ramas Android/deploy no integradas | BLOQ (C-04) |
| PRE-4 | Base QA exclusiva y `MUNICIPAL_QA_DATABASE` | BLOQ (C-05) |
| PRE-5 | Aprobación de ADR-01…12, matriz 04 y contrato draft.1 | PENDIENTE (C-02) |

## Backlog priorizado

| Prio | ID | Historia | RQ | Fase 0 | Archivos | Criterios de aceptación | Pruebas | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | F1-01 | Política de acceso y catálogo municipal | RQ03, RQ05 | MUNI-02 | `modules/municipal/policy/*` | Matriz 04 congelada; admin/superadmin ERP sin acceso; filtro ≡ regla | MT-04…07, 10…19b, 60 | **HECHO-A** |
| 2 | F1-02 | Frontera del módulo y no regresión | — | MUNI-01 (parte) | `tests/municipal/permissions-structure.test.js` | ERP no importa el módulo; módulo solo importa de sí mismo | MT-60, MT-61 | **HECHO-A** |
| 3 | F1-03 | Folios únicos e idempotencia | RQ01 | MUNI-08 | `domain/folio.js`, servicio | Formato; contador por dep./año; rollback sin huecos; reintento = mismo folio | MT-30…36 | **HECHO-A** (real: BLOQ C-05) |
| 4 | F1-04 | Router HTTP municipal + middleware `requireMunicipal` | RQ03, RQ05 | MUNI-01, MUNI-02 | `modules/municipal/http/*` (nuevo) | Rutas del contrato; 401/403/404/503; compatible Express 4/5; **no montado** hasta C-01 | MT-01…03, 08, MT-H01…H12 | **HECHO-A** (2026-11-09, ver 10) |
| 5 | F1-05 | Repositorio Mongo + modelos `municipal_*` | RQ01–RQ05 | MUNI-03…09 | `modules/municipal/infra/*` (nuevo) | Mismo contrato que el almacén en memoria; índices únicos; transacciones | Suite de contrato L1–L3 contra Mongo | **Pasos 1–2 HECHOS en memoria** (2026-11-10, ver 14); paso 3 (adaptador Mongo) BLOQ (C-05) |
| 6 | F1-06 | Registro de solicitudes y ciudadanos | RQ01, RQ03, RQ06 | MUNI-07, MUNI-09 | servicio, validación | Campos del servidor rechazados; sin CURP; canal obligatorio | MT-18, 19c, 92 | **HECHO-A** (ciudadanos HTTP pendiente) |
| 7 | F1-07 | Asignación, turnado e historial | RQ02 | MUNI-10 | `domain/request-state.js` | Actor, fecha y estado en cada cambio; versión optimista | MT-40…47 | **HECHO-A** (MT-47 BLOQ C-05) |
| 8 | F1-08 | Documentos privados | RQ05 | nuevo | `domain/documents.js`, `storage/*` | Firma binaria; ≤ 5 MB; descarga solo autorizada; bitácora | MT-80…89 | **HECHO-A** en memoria; GridFS BLOQ (C-07) |
| 9 | F1-09 | Indicadores administrativos | RQ04 | nuevo | `domain/indicators.js` | Cifras = oráculo = conteo manual; alcance respetado | MT-70…75 | **HECHO-A** (Mongo MT-74 BLOQ C-05) |
| 10 | F1-10 | Bitácora municipal inmutable | RQ02, RQ05 | MUNI-06 | `infra/audit.model.js` (nuevo) | Append-only; IP/requestId; denegaciones | MT-50…53 | Parcial (eventos en memoria) |
| 11 | F1-11 | Interfaz web municipal adaptable | RQ03, RQ04, RQ06 | MUNI-12 | `features/municipal/*` | Prototipo con mock; entrada en navegación solo con membresía | MT-93…95; MT-90/91/96 E2E | **HECHO-A** prototipo; navegación BLOQ (C-11) |
| 12 | F1-12 | Dependencias y membresías (administración) | RQ05 | MUNI-04, MUNI-05 | servicio + UI admin | Unicidad por municipio; regla de asignación corregida (04 ¹) | MT-09, 10, 20…22, MT-F01…F08 | **HECHO-A** (2026-11-09, ver 11) |
| 13 | F1-13 | Detalle de expediente (historial + documentos) en UI | RQ02, RQ05 | MUNI-12 | `features/municipal/*` | Historial legible; descarga en web y Android (`react-native-blob-util` ya instalado) | 16 Jest + 17 Playwright (Chromium nube y Windows) | **HECHO-A** (2026-11-10, ver 13) |
| 14 | F1-14 | Bootstrap QA y runner real | todos | MUNI-03, MUNI-11 | `scripts/municipal-*.cjs` | Rechaza producción; limpia solo su `runId`; sin datos reales | Todos los R | BLOQ (C-05) |
| 15 | F1-15 | Validación E2E: teclado, celular, ventanilla | RQ06 | nuevo | `apps/frontend/qa/*` | MT-90, 91, 96 con evidencia | E2E | Parcial: MT-90 y MT-94 en Chromium con API simulada; faltan Firefox/WebKit, APK y WCAG completo |
| — | F1-16 | Higiene de secretos del repo | — | MUNI-00 | `.gitignore` | Ver C-10 | — | BLOQ (C-10, núcleo) |
| — | F1-17 | Endurecimiento de sesión | — | MUNI-13 | auth | Ver C-13 | — | BLOQ (C-13, núcleo) |
| — | F1-18 | Diseño de IA opcional (Python + FastAPI) | — | MUNI-14 | `docs/munierp/10-IA.md` | Evaluación de impacto; sin PII externa | Revisión | Fuera de Fase 1 |

**Siguiente paso recomendado (2026-11-10, tras F1-05 pasos 1–2):** F1-05 paso 3 — adaptador MongoDB y
ejecución de la suite de contrato L1–L3 contra `munierp_qa`, en cuanto C-05 entregue la base exclusiva con
autorización propia (independiente de M07). Mientras tanto: integración coordinada de C-18/C-19 con Codex.

## Riesgos

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| K1 | Un admin ERP desactiva o cambia el rol global de un funcionario municipal | Media | Medio | C-12; bitácora municipal |
| K2 | Fuga entre dependencias por un filtro olvidado | Media | Alto | `buildRequestScopeFilter` único + prueba de equivalencia + mutaciones |
| K3 | Permisos municipales añadidos al catálogo ERP | Baja | Crítico | MT-60 congela el catálogo (hash) |
| K4 | Datos reales de ciudadanos en QA | Baja | Crítico | Solo `synthetic`; validación anti-CURP/RFC; runner con confirmación |
| K5 | Divergencia con el stack académico | Media | Medio | Comparativa 05; JSDoc/`@ts-check`; Express 5-ready |
| K6 | 3 lecturas por petición (user, role, membership) | Baja | Bajo | Índices; medir |
| K7 | Conflictos con ramas Android/deploy | Media | Medio | C-04 |
| K8 | Tokens en almacenamiento no cifrado | Media | Alto | C-13 |
| K9 | Mongo sin replica set en QA | Baja | Alto | Runner verifica transacciones |
| K10 | **429 en ventanilla** por cupo de peticiones por IP compartida | Alta | Medio | C-08 |
| K11 | Archivos maliciosos subidos como documentos | Media | Alto | Firma binaria, lista blanca, `attachment` + `nosniff`, sin vista previa inline |
| K12 | Indicadores que revelan conteos fuera de alcance | Baja | Alto | Mismo filtro que la lista; MT-75 |

## Definición de terminado (por historia)

- Contrato OpenAPI actualizado si cambia la interfaz; prueba de coherencia contrato ↔ dominio verde.
- Pruebas positivas **y** negativas (401/403/404/409/413) por endpoint.
- Suites ERP sin regresiones nuevas respecto a la línea base registrada.
- Validación real en base QA autorizada cuando la historia persiste datos.
- Build web y APK ejecutados desde F1-11 en adelante.
- Sin secretos, sin datos reales, sin cambios de dependencias no aprobados por Codex.
