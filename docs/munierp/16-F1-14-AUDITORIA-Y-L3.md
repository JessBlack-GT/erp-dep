# F1-14 — Bitácora de auditoría, documentos PENDIENTE y preparación final de L3

> Fecha: 2026-11-10. Base: `e420651`. Sin conexión a MongoDB ni Atlas, sin colecciones ni datos
> reales, sin cambios en el núcleo del ERP ni en OpenAPI draft.3. Las pruebas de interfaz usan **API
> SIMULADA** (servicio municipal real en memoria, sin HTTP, JWT ni MongoDB) y **no acreditan la
> integración HTTP real**.

## 1. Estado de F1-14

| Parte | Estado |
|---|---|
| Interfaz de bitácora sobre `GET /audit-events` | **HECHA-A** (aislada, sin montar) |
| Conciliación de documentos PENDIENTE | **BLOQUEADA**: el contrato no expone el estado vigente (§3); propuesta para Codex (C-22) |
| Casos L3 RC-30, 32, 33, 34, 35 | **Escritos**, ejecutables solo contra `munierp_qa` autorizada; **pendientes** |
| Revisión de integridad de la persistencia | Hecha (§5); dos pruebas nuevas de regresión |

## 2. Interfaz de auditoría (`components/AuditLog.js`)

| Requisito | Implementación |
|---|---|
| Acceso exclusivo a roles autorizados | La entrada «Bitácora de auditoría» solo aparece con `municipal.audit.read`, pero **la interfaz no decide**: la vista siempre consulta y muestra la respuesta del servidor (403 → acceso denegado; sin membresía → 403 de membresía) |
| Política vigente | Matriz congelada (doc 04): **solo `AUDITOR_MUNICIPAL`** tiene `municipal.audit.read`. `ADMIN_MUNICIPAL` **no** la tiene: la vista le muestra acceso denegado. Si se desea que el administrador consulte la bitácora es un cambio de política que debe decidir el responsable con Codex (considerar separación de funciones: el administrador gestiona membresías cuyos cambios quedan en esa bitácora) |
| Filtros del contrato | Folio, identificador del recurso, desde, hasta (inclusivo en la interfaz; el servidor usa `to` exclusivo) y eventos por página (10/20/50). Validación local antes de consultar |
| Orden y paginación | Orden del servidor (más recientes primero) indicado en pantalla; «Página X de Y · N eventos», anterior/siguiente con límites deshabilitados |
| Acciones y recursos | Etiquetas legibles para cada `action` del servidor (desconocidas: «Acción registrada (CÓDIGO)»); recurso con folio o id abreviado |
| Fecha y actor | Fecha en hora de México; actor como «Funcionario ···últimos 6» (X-01 pendiente) |
| Municipio y dependencia | Municipio en el encabezado; dependencia **solo derivada del folio** (formato público), nunca inferida |
| Estados | Carga, vacío, error de red con reintento, acceso denegado |
| Adaptable | 360/800 px apilado; ≥ 1024 px filtros 35 % y eventos 65 % |
| Teclado y accesibilidad | Orden de tabulación natural; encabezados, lista con etiqueta por fila, `radiogroup` para el tamaño de página, alertas para validación y errores, resumen con región viva |
| Datos sensibles | No se muestran IP ni `requestId` (el contrato los entrega); ids abreviados; la bitácora no contiene contenido de expedientes. Prueba Playwright 10 con un evento sembrado con IP y `requestId` sintéticos |

Integración: `MunicipalWorkspaceScreen` (botón con permiso), `municipalApi.listAuditEvents` (cliente HTTP
real, aún sin usar por C-01), mock básico (403, su persona no tiene el permiso) y arnés QA
(`?view=audit`, `&mun=ZZZ` para aislamiento). `Section`/`Field` se extrajeron a `components/Section.js`
para no duplicarlos entre el detalle y la bitácora.

## 3. Documentos PENDIENTE — análisis y propuesta (C-22)

1. **¿El contrato permite obtener el estado vigente?** No. `listDocuments` devuelve solo documentos
   `VIGENTE` (filtrados en el servicio) y `Document`/`DocumentRestricted` no tienen campo de estado.
2. **¿`GET /audit-events` basta?** No. El metadato `PENDIENTE` se crea sin evento; solo hay
   `DOCUMENT_UPLOADED` cuando pasa a `VIGENTE`. La ausencia de un evento no prueba que un documento
   siga pendiente, y no se infiere el estado desde el historial.
3. **Decisión:** la sección queda **bloqueada**; no se añadieron rutas ni se modificó OpenAPI.

Propuesta para coordinar con Codex (no implementada):

| Elemento | Propuesta |
|---|---|
| Permiso | Nuevo `municipal.documents.reconcile`, solo `ADMIN_MUNICIPAL` o un rol de operación designado (decisión de política) |
| `GET /municipalities/{mun}/documents/pending?before=&page=&limit=` | Lee `pendingDocuments` (ya en el puerto, solo lectura). Respuesta: `id`, `folio`, `uploadedAt`, `uploadedBy` (abreviado en UI), `mimeType`, `size`, `confidentiality`, `binaryPresent` (comprobación de existencia en GridFS, sin leer contenido). **Sin** nombre de archivo ni contenido |
| `POST …/documents/{id}/reconciliation` con `If-Match` | Acciones: `CONFIRMAR` (solo si el binario existe y su sha256 coincide → `VIGENTE` + bitácora) o `DESCARTAR` (estado `DESCARTADO`, **sin borrar** metadato ni binario, con motivo ≥ 10 caracteres y bitácora). Sin recuperación ficticia |
| Respuestas | 200 / 400 / 403 / 404 (sin divulgación) / 409 (versión o binario ausente para CONFIRMAR) |
| Bitácora | `DOCUMENT_RECONCILED` con `result` en el `enum` vigente |
| Pendiente adicional | Evento opcional `DOCUMENT_UPLOAD_STARTED` al crear el PENDIENTE (trazabilidad, no fuente de estado) |

## 4. Casos L3 preparados

Todos se ejecutan **solo** con `kind: 'mongo'` (guardia de QA + confirmación). En memoria y sobre el
doble quedan **pendientes**; `decideCase` lo garantiza y una prueba lo verifica (incluido que un L3 sin
implementación seguiría pendiente y que `mongo-env.js`, el único que crea `MongoClient`, no se carga).

| Caso | Qué verifica contra MongoDB real |
|---|---|
| RC-29 | `verifySetup`: índices y validadores del plan (ya preparado en el paso 3) |
| **RC-30** | (a) dos transacciones abiertas sobre el mismo contador: el **servidor** marca la segunda con `TransientTransactionError`; solo cuenta la confirmada. (b) 20 altas simultáneas con el ejecutor (reintentos reales) → 20 folios únicos y consecutivos, contador en 21 |
| RC-31 | `hello.setName` y base efectiva `munierp_qa` (ya preparado) |
| **RC-32** | Metadato PENDIENTE + subida GridFS **abortada** → `get` = NOT_FOUND, `pendingDocuments` lo informa, nada se borra; reintento correcto con sha256 verificado; el índice único de `files.filename` rechaza un segundo binario (11000) |
| **RC-33** | **Solo lectura**: privilegios efectivos (`connectionStatus`) sobre `municipal_audit_events` → `find`+`insert`, sin `update`, `remove`, `dropCollection`, `collMod`, `anyAction`. Se cambió la verificación original (intentar `updateOne`/`deleteOne`) para no ejecutar operaciones destructivas ni siquiera en QA. Usa el nombre canónico porque los roles de Atlas son por colección |
| **RC-34** | 25 rondas con 5 escritores concurrentes y la misma versión: exactamente un ganador por ronda; historial final de 26 entradas sin pérdidas; tamaño BSON medido con `$bsonSize` y registrado en `l3-mediciones.json` |
| **RC-35** | Revocación confirmada en una sesión y leída **desde otra conexión** (`readPreference: primary`) de inmediato: `INACTIVA`, versión 1 |

## 5. Revisión de integridad de la persistencia

| Punto | Diseño | Comprobado con dobles / memoria | Pendiente en MongoDB real |
|---|---|---|---|
| Aislamiento por municipio | Puerto v2: municipio en toda operación con ámbito; excepciones justificadas | Contrato L1 (RC-04/05/06/36) en memoria y adaptador v5/v6; unitarias (cada llamada lleva el municipio; sin ámbito → sin llamada al controlador) | Ejecutar L1 contra `munierp_qa` |
| Idempotencia municipio + usuario + clave | **Filtro** `requestByIdempotency(mun, user, key)` **e índice único** `uniq_request_idempotency {municipalityId, createdBy, idempotencyKey}` parcial | Unitaria (filtro e índice exactos), RC-09, servicio y **HTTP nuevo** (dos municipios → dos expedientes; reintento → 200 mismo folio) | RC-29 (índice creado) y L1 |
| Usuarios centrales ↔ referencias municipales | `userId` = id de la identidad central (cadena hex); alta de membresía verificada con `resolveAccess`; ERP admin/superadmin sin acceso | F1-04/F1-12 HTTP (usuario inactivo → 401, sesión revocada, claims falsificados) | Coexistencia en host aislado (Codex) |
| Conflictos de revisión | `findOneAndUpdate({_id, municipalityId, version})` | RC-12/13/22/27, unitarias (filtro exacto, escritura perdida) | RC-30, RC-34 |
| Historial inmutable | Prefijo verificado + `$push $each` | RC-14, unitarias (sin escritura si se altera) | RC-34 |
| Auditoría coherente | Escritura + evento en la misma transacción | RC-19/20/22, persistence (fallo de bitácora → nada escrito) | RC-30; RC-33 (rol) |
| PENDIENTE | Metadato → GridFS → VIGENTE; solo informe | RC-37, unitarias con GridFS caído | RC-32 |
| Documentos y huellas | sha256 al subir y al descargar; GridFS sin sobrescritura | Unitaria de integridad (500 + `DOCUMENT_INTEGRITY_FAILED`), carrera de subida | RC-32 |
| Errores sin exposición | Traducción de errores; HTTP 500 genérico | **HTTP nuevo**: E11000, errores mapeados y de red → `{ success:false, error:'Error interno', code:'INTERNAL_ERROR' }` sin mensaje, índice ni valores | — |

## 6. Coordinación con Codex: de `8a18610` a la versión actual

Codex probó el router con el bundle `8a18610` (99 pruebas de `http.test.js` + `sales.http.test.js`).
Diferencias que afectan a la integración:

| Cambio | Desde | Efecto |
|---|---|---|
| Puerto v2 (municipio en operaciones por id) | `e420651` | Interno; cualquier código que llame al almacén directamente debe pasar el municipio |
| Idempotencia por municipio | `e420651` | Antes, misma clave en otro municipio devolvía 200 con el expediente ajeno; ahora 201 |
| `TRANSIENT_CONFLICT` → 409 | `e420651` | Solo con el adaptador Mongo |
| Verificación sha256 al descargar | `e420651` | 500 genérico y evento `DOCUMENT_INTEGRITY_FAILED` si el binario no coincide |
| Adaptador `persistence/mongo/*` + preflight | `e420651` | No se carga salvo inyección explícita; la prueba de frontera admite `mongoose` solo en el CLI del preflight |
| Lector privado municipal (C-21) | `e420651`; alineado aquí con `privateDocumentPolicy` de Codex | Web verificado, HTTP 200, tope 5 MiB, nombre **generado** (nunca el del usuario); Android sin descarga |
| Bitácora F1-14 | este paso | Nueva vista; usa la ruta existente de draft.3 |

Inventario de regresión para la integración (script propuesto `integracion/test-isolated-municipal.ps1`,
misma técnica que el de Codex, con revisión y bundles como parámetros):

1. `tests/municipal/*.test.js` completo (279 pruebas, 22 pendientes) contra el núcleo actual.
2. En particular: `http.test.js` (F1-04), `http-f112.test.js` (F1-12), `http-f114.test.js` (F1-14 e integridad), `permissions-structure.test.js` (frontera y matriz).
3. `sales.http.test.js` del ERP (regresión comercial, como hizo Codex).
4. Jest municipal (67) y los de Codex `privateDocumentPolicy`, `components` y `shared-accessibility`.
5. Playwright F1-12/F1-13/F1-14 en Windows con el `Card`/`Input` corregidos, cuando Codex los integre.

Se conservan: `/api/municipal/v1`, draft.3, identidad central revocable, membresías independientes,
control por municipio y expediente, documentos privados separados y las correcciones de accesibilidad.
Pendiente de decisión: unificar el lector municipal con `utils/privateDocumentPolicy` cuando se integre.

## 7. Playwright

Ver §7.1. La primera ejecución (`windows_2026-11-10_1728`) se conserva: **87 de 96** pasaron; los 9
fallos (escenarios 05, 08 y 09 en los tres navegadores) se debieron a que la prueba buscaba los campos
por rol `textbox`, y el `Input` común de esta rama todavía declara `role="search"` (C-19, corregido por
Codex en su copia). Se corrigió la prueba para localizar los campos por su nombre accesible y comprobar
que el rol es el del núcleo (`search` hoy, ninguno con el núcleo corregido); la interfaz no cambió.

### 7.1 Resultados de la ejecución final

Ejecución `windows_2026-11-10_1736` (Windows 11, Node 24.21, Playwright 1.65.0 global, sin reinstalar;
`evidence-local/` del kit y copia en `f1-14/evidencias/`). Especificaciones `municipal-audit` (14) y
`municipal-detail` (18, regresión F1-13).

| Navegador | Versión | Pasaron | Fallaron | Capturas | JSONL |
|---|---|---|---|---|---|
| Chromium | 158.0.8127.18 | 32 | 0 | 32 | `registro-chromium.jsonl` |
| Firefox | 158.0 | 32 | 0 | 32 | `registro-firefox.jsonl` |
| WebKit | 27.2 | 32 | 0 | 32 | `registro-webkit.jsonl` |

**96 de 96** en 2,0 min. Escenarios F1-14 (×3 navegadores): 01 auditor, 02 administrador municipal
denegado, 03 titular/operador/sin membresía/admin del ERP denegados, 04 aislamiento (sin eventos `ZZZ-`;
`ZZZ` denegado), 05 filtros, 06 paginación, 07 carga y error con reintento, 08 teclado, 09 accesibilidad,
10 sin datos sensibles, 11 entrada solo con permiso, 12 adaptable 360/800/1280. Trazas: sin fallos en la
ejecución final; las del primer intento (9 fallos de selector) están en `windows_2026-11-10_1728/artifacts`.
Se revisaron visualmente las capturas 01 (WebKit, escritorio) y 12 (Chromium, 360 px).

**Alcance:** API SIMULADA (servicio municipal real en memoria). No acredita la integración HTTP real: esa
la cubren `http-f114.test.js` (supertest contra el router, sin MongoDB) y, en el ERP, el montaje de C-01.

## 8. Riesgos y siguiente historia

| Riesgo | Mitigación |
|---|---|
| Política: el administrador municipal no ve la bitácora | Decisión explícita pendiente (C-23) |
| Conciliación bloqueada | C-22 |
| Encabezados web sin nivel (todos como nivel 1 en el árbol accesible de RN Web) | Afecta a todo el ERP; reportar a Codex junto con C-18/C-19 |
| L3 sin ejecutar | C-05 |
| Botones «Aplicar filtros»/«Limpiar» y de paginación sin separación horizontal (estilo del `Button` común) | Menor; ajustar con el espaciado del núcleo cuando Codex integre C-18/C-19 |
| Pruebas con API simulada | La integración HTTP real depende del montaje (C-01) y del script de regresión |

**Siguiente historia recomendada sin Atlas:** **F1-15 — vista de membresías y dependencias para el
administrador municipal** (RQ05): las cinco operaciones F1-12 ya existen en draft.3 y en el servidor, y la
interfaz aún no las ofrece; permite al ADMIN_MUNICIPAL gestionar accesos (incluida la revocación) con las
mismas pruebas de accesibilidad y Playwright.
