# MuniERP IA — Fase 0 · 05 Contraste RQ01–RQ06 e incompatibilidades de stack

> ⚠️ **Pendiente de insumo.** El texto oficial de RQ01–RQ06 y el stack propuesto académicamente
> no están en el repositorio ni en la carpeta de trabajo entregada. La columna "Enunciado" contiene
> una **hipótesis** derivada del alcance descrito (gestión municipal conectada, dependencias,
> solicitudes, folios, IA). Debe sustituirse por el texto oficial antes de cerrar Fase 0; la
> trazabilidad y los huecos se recalcularán sobre ese texto.

## Trazabilidad de requisitos

| RQ | Enunciado (hipótesis, por confirmar) | Cubre YJ Nexo hoy | Hueco | Entrega propuesta | Prueba |
|---|---|---|---|---|---|
| RQ01 | Acceso seguro de funcionarios con roles y permisos | Parcial: login, JWT, revocación, RBAC global | Sin ámbito municipal/dependencia | `municipal-rbac.js`, membresías, `requireMunicipal` | MT-01…MT-08 |
| RQ02 | Catálogo de dependencias del municipio | No | Todo | `municipal_dependencies` + endpoints | MT-20…MT-22 |
| RQ03 | Registro de solicitudes ciudadanas con folio único | No (numeración comercial global) | Folios por dep./año, ciudadano ≠ cliente | `municipal_requests`, `municipal_counters`, `municipal_citizens` | MT-30…MT-36 |
| RQ04 | Seguimiento y turnado de expedientes entre dependencias | No | Estados, turnado, grants | Transiciones + `municipal_request_grants` | MT-40…MT-45 |
| RQ05 | Trazabilidad / bitácora de acciones | Parcial: audit append-only solo comercial, sin IP | Bitácora municipal con IP y denegaciones | `municipal_audit_events` | MT-50…MT-53 |
| RQ06 | Asistencia con IA (clasificación/turnado sugerido) | No (módulo `ai` es stub no montado) | Todo + privacidad | ADR-09; diseño en Fase 2, sin PII externa | Por definir |

## Incompatibilidades stack existente vs. propuesto académicamente

Stack real (no negociable sin justificación): **Node/Express + MongoDB Atlas (Mongoose) +
React Native / RN Web + Render + Cloudflare Pages**, con Kotlin solo para necesidades nativas.

Como el stack académico no fue entregado, se listan las incompatibilidades **típicas** de
propuestas académicas para sistemas municipales y la resolución recomendada. Marcar las que apliquen.

| Si el documento académico propone… | Incompatibilidad | Resolución recomendada |
|---|---|---|
| PostgreSQL / MySQL y modelo E-R normalizado | Motor distinto; joins y FKs vs. documentos | Mantener MongoDB. Traducir el E-R a colecciones con referencias por `ObjectId` e índices compuestos; integridad garantizada en servicio + transacciones. Documentar el mapeo E-R→colección. |
| Laravel / Django / Spring como backend | Segundo backend y segunda autenticación | Rechazar: contradice "conectado" (ADR-01). La lógica municipal va en Express. |
| Python para IA (scikit-learn, FastAPI) | Runtime adicional | Aceptable **solo** como microservicio opcional detrás de un adaptador con contrato (ADR-09), sin acceso directo a Mongo y sin PII. |
| Angular / Vue / React web separado | Segunda UI; rompe la compatibilidad web+Android única | Rechazar; usar RN Web existente. |
| Flutter / Kotlin nativo / Jetpack Compose | Reescritura móvil | Rechazar (README: no migrar a Compose). |
| Sesiones de servidor / cookies | Diferente a JWT Bearer usado por Android | Mantener JWT + `sessionVersion`. |
| Multi-tenant con una base por municipio | Una sola conexión/base actual | Fase 1: discriminador `municipalityId` en cada documento + filtro obligatorio. Evaluar base separada si el ayuntamiento lo exige normativamente. |
| CURP / INE / firma electrónica | Datos personales sensibles; dependencias nuevas | Fuera de Fase 1. Requiere aviso de privacidad, evaluación de impacto y QA con datos sintéticos. |
| Diagramas UML/casos de uso como entregable | No es incompatibilidad | Generar a partir de los contratos de esta fase. |

## Preguntas abiertas para el ayuntamiento / asesor académico

1. Texto oficial de RQ01–RQ06 y criterios de evaluación.
2. Catálogo real de dependencias y su jerarquía (se usan códigos sintéticos en QA).
3. ¿Qué tipos de trámite/solicitud entran en Fase 1? (se propone uno: `SOL` genérica).
4. ¿Quién puede ver expedientes `CONFIDENCIAL` (p. ej. DIF, Seguridad Pública)?
5. Plazos de respuesta legales por tipo de solicitud (para alertas futuras).
6. ¿Se requiere portal ciudadano (auto-registro)? Hoy **no** se propone: solo funcionarios.
