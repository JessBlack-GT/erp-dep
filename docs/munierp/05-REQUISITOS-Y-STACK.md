# MuniERP IA — 05 Requisitos oficiales, trazabilidad y compatibilidad de stack

Fuente de requisitos: documento académico *"Reporte de arquitectura tecnológica y Estado del Arte
de MuniERP IA"* (RQ01–RQ06 y criterios de verificación, recibidos el 2026-10-26).
Este documento **sustituye** las hipótesis "por confirmar" de la versión de Fase 0 (`7eca877`).

## 1. Requisitos oficiales

| RQ | Requisito | Criterio de verificación oficial | Interpretación operativa (cómo se demuestra) |
|---|---|---|---|
| RQ01 | Registrar solicitudes con folio único | Dos solicitudes distintas no comparten folio | Folio emitido por el servidor en la misma transacción que la solicitud; índice único `{municipalityId, folio}`; concurrencia, rollback e idempotencia probados. |
| RQ02 | Asignación e historial de seguimiento | Cada cambio conserva actor, fecha y estado | Toda transición o asignación agrega una entrada inmutable con `actorId`, `at`, `fromStatus`, `toStatus`, `action` (+ asignado/nota); duplicada en la bitácora. |
| RQ03 | Consultar expedientes autorizados | Un usuario no obtiene datos de otro expediente | Filtro de alcance en la consulta (municipio → dependencia → expediente/concesión); fuera de alcance = 404 sin datos. |
| RQ04 | Indicadores administrativos | Cifras del tablero coinciden con registros de prueba | Indicadores calculados sobre el **mismo** alcance del usuario; prueba de oráculo: función pura vs. agregación de Mongo vs. conteo manual del set sintético. |
| RQ05 | Acceso por roles y documentos privados | La API deniega consultas y descargas no autorizadas | Permisos `municipal.*` por rol y alcance; documentos sin URL pública, descarga solo por endpoint autorizado; denegaciones registradas. |
| RQ06 | Inclusión y continuidad de atención | Tareas con teclado, celular y canal presencial | Flujos operables solo con teclado (web), en Android/celular y registrados desde ventanilla (`channel: PRESENCIAL`) con acuse imprimible; tolerancia a reintentos por mala conexión. |

> Cambio relevante respecto a Fase 0: la hipótesis de "RQ06 = IA" era incorrecta. La IA queda
> como **opcional** según el propio stack académico (Python + FastAPI) y fuera del alcance de los
> requisitos verificables. RQ02 (dependencias) y RQ05 (bitácora) de la hipótesis se reubican: el
> catálogo de dependencias es soporte de RQ03/RQ05 y la bitácora es soporte de RQ02/RQ05.

## 2. Matriz de trazabilidad RQ01–RQ06

Estados: **D** diseñado · **DA** implementado en dominio aislado con pruebas **ejecutadas**
(desde 2026-11-09 también vía HTTP sobre Express aislado; sin montar, sin DB; ver 06 §K y §L) · **PC** pendiente de coordinación con Codex · **PE** pendiente de ejecución (R/E).

| RQ | Diseño (doc) | Contrato (operationId) | Permisos | Código de dominio aislado | Casos de prueba | Backlog | Estado |
|---|---|---|---|---|---|---|---|
| RQ01 | 03 ADR-07; 04 ciclo | `createRequest`, `verifyFolio` | `requests.create`, `requests.read` | `domain/folio.js`, `application/municipal.service.js#createRequest` | MT-30…MT-36 | F1-03, F1-06 | DA (formato, unicidad en memoria, idempotencia) · PE (concurrencia real MT-31/32/35) |
| RQ02 | 03 ADR-08; 04 ciclo de vida | `transitionRequest`, `getRequestHistory` | `requests.assign`, `requests.assignUser`, `requests.update`, `requests.close`, `requests.cancel` | `domain/request-state.js` | MT-40…MT-47 | F1-07, F1-10 | DA · PE (persistencia R) |
| RQ03 | 03 ADR-05; 04 regla de expediente | `listRequests`, `getRequest`, `searchCitizens` | `requests.read`, `requests.readConfidential` | `policy/access.js` (`canReadRequest`, `buildRequestScopeFilter`) | MT-01…MT-19c | F1-01, F1-04, F1-06 | DA · PE (aislamiento R contra Atlas QA) |
| RQ04 | 03 ADR-11 | `getIndicators` | `indicators.read` | `domain/indicators.js`; UI `IndicatorsPanel` | MT-70…MT-75 | F1-09 | DA (función pura vs. oráculo) · PE (agregación Mongo MT-74) |
| RQ05 | 03 ADR-04/05/10; 04 | `uploadDocument`, `listDocuments`, `downloadDocument` + todas | `documents.*`, catálogo completo | `policy/permissions.js`, `domain/documents.js` | MT-01…MT-12, MT-80…MT-89 | F1-01, F1-08, F1-12 | DA (validación de archivo, autorización de descarga) · PC (almacenamiento privado C-07) |
| RQ06 | 09 (interfaces) ; 03 ADR-12 | `createRequest` (`channel`), `getRequestReceipt` | `requests.create` | `domain/validation.js` (`channel`), `domain/receipt.js`; UI `features/municipal/*` | MT-90…MT-96 | F1-11, F1-15 | DA (canal, acuse, reintento idempotente y cuadrícula adaptable en jest) · PE (E2E teclado, Android, ventanilla, WCAG) |

## 3. Comparativa tecnológica: sistema real vs. propuesta académica

Sistema real verificado en `main@d5b64b0`. Columna "Compatibilidad": ✅ compatible · 🟡
compatible con adaptación · ❌ incompatible sin migración.

| Capa | Propuesta académica | YJ Nexo real | Compat. | Propuesta de adaptación (sin migrar el núcleo) |
|---|---|---|---|---|
| Frontend web | React + TypeScript | React 18.2 vía React Native Web 0.19, JavaScript, empaquetado con esbuild | 🟡 | RN Web **es** React; los componentes municipales se escriben en React (RN primitives). Tipado inmediato con **JSDoc + tipos derivados del OpenAPI** (sin dependencias). Adoptar `.tsx` solo para código municipal nuevo requiere agregar `typescript` como devDependency solo para `tsc --noEmit` → decisión **C-09** de Codex. esbuild y el preset Babel de RN 0.72 ya transpilan TS, por lo que no hay cambio de runtime. |
| Cliente móvil | React Native (opcional) | React Native 0.72.17 con proyecto Android | ✅ | Una sola base de código web + Android. La validación nativa sigue pendiente (rama `codex/android-emulator-readiness` sin integrar, C-04). |
| Runtime | Node.js 24 LTS | `engines: >=18`; verificado en Node 24.19 (Windows) y 22.x (esta auditoría) | ✅ | Código municipal compatible con 22 y 24. Fijar Node 24 en `engines`/Render es decisión de Codex (C-09). |
| Framework HTTP | Express 5 | Express 4.18 | ❌ (migración) | **No migrar.** Express 5 rompe `app.use('*', …)` del 404 global (sintaxis de comodines de path-to-regexp 8) y cambia el manejo de errores async. El módulo municipal se escribe **"listo para Express 5"**: handlers async envueltos, sin rutas con `*`, sin APIs retiradas (`req.param`, `res.send(status)`), rutas con parámetros con nombre. La migración del núcleo queda como decisión futura de Codex. |
| Lenguaje backend | TypeScript | JavaScript CommonJS | 🟡 | `// @ts-check` + JSDoc en `modules/municipal`; tipos compartidos documentados desde el OpenAPI. Sin compilación ni cambio de arranque. |
| Base de datos | MongoDB Atlas (prototipo) | MongoDB Atlas + Mongoose 7 con transacciones | ✅ | Colecciones `municipal_*` en la misma base; base QA exclusiva confirmada por variable (C-05). |
| Arquitectura | Aplicación web modular con API | Monolito modular, API REST `/api/v1` | ✅ | Módulo de dominio con frontera verificada y API propia versionada `/api/municipal/v1` (ADR-01/02). |
| IA (opcional) | Python + FastAPI | No existe (módulo `ai` vacío y no montado) | 🟡 | Servicio externo opcional detrás de un adaptador con contrato; nunca acceso directo a Mongo ni datos personales sin evaluación de impacto. Fuera de Fase 1 (ADR-09). |
| Adjuntos | Almacenamiento privado con descargas autorizadas | No existe | 🟡 | Puerto `DocumentStorage` con dos adaptadores: **memoria** (prototipo/pruebas) y **GridFS** (driver `mongodb` ya incluido en Mongoose → sin dependencia nueva). Objeto externo (S3/R2) solo si Codex lo decide (C-07). Descarga siempre vía API autorizada; nunca URL pública. |
| Autenticación | (no especificada) | JWT central de YJ Nexo + `sessionVersion` | ✅ | Se reutiliza; no hay identidad municipal independiente (ADR-03). |

**Conclusión:** la propuesta académica es compatible con el sistema real salvo Express 5, que se
resuelve escribiendo el módulo de forma compatible con ambas versiones y dejando la actualización
del núcleo a Codex. TypeScript se adopta de forma gradual sin dependencias nuevas (JSDoc) y,
si Codex aprueba, con `tsc --noEmit` como verificación sin cambio de runtime.

## 4. Preguntas abiertas

1. Catálogo real de dependencias del ayuntamiento (QA usa códigos sintéticos).
2. Tipos de trámite iniciales y plazos legales de respuesta (para el indicador de vencidos; QA usa 15 días naturales como parámetro configurable, **no** como dato normativo).
3. Quién puede ver expedientes `CONFIDENCIAL` (DIF, Seguridad Pública).
4. Límite de tamaño y formatos de documentos aceptados (QA: PDF, JPEG, PNG, ≤ 5 MB).
5. ¿Se requiere portal ciudadano? No forma parte de RQ01–RQ06; Fase 1 solo funcionarios + ventanilla.
