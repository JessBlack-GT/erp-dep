# F1-05 paso 3 — adaptador MongoDB preparado, sin conexión

> **Estado exacto (2026-11-10): adaptador IMPLEMENTADO y probado solo con dobles del controlador.**
> No hubo conexión a MongoDB ni a Atlas, no se crearon bases, colecciones, índices ni datos, y no se
> leyeron ni reutilizaron credenciales de M07. La persistencia real **no está aprobada**: los 7 casos
> L3 siguen pendientes. F1-05 no puede declararse terminada hasta cumplir §9.

## 1. Componentes

Todo dentro de `apps/backend/src/modules/municipal/` (sin tocar el núcleo, `app.js` ni dependencias).

| Archivo | Función |
|---|---|
| `persistence/repository-port.js` | **Puerto v2**: toda operación sobre datos municipales recibe `municipalityId` como primer argumento, también las de id; excepciones justificadas en `UNSCOPED_OPERATIONS`; nueva lectura `pendingDocuments` |
| `persistence/scope.js` | Regla común «una consulta de expedientes fija municipio en la raíz o en un `$and`» |
| `persistence/mongo/collections.js` | Colecciones `municipal_*` separadas, 22 índices (8 únicos, con nombre estable), validadores `$jsonSchema`, tabla índice único → código del puerto |
| `persistence/mongo/mongo-store.js` | Adaptador del puerto sobre la API del controlador oficial, **inyectada** (`db`, `runTransaction`). No importa `mongodb` ni `mongoose`. Inventario de escrituras `WRITE_INVENTORY` |
| `persistence/mongo/transaction-runner.js` | `session.withTransaction` con `snapshot` / `majority` / `primary`; devuelve el valor del callback (v5 y v6); cierra la sesión siempre |
| `persistence/mongo/errors.js` | E11000 → `DUPLICATE_*` por nombre de índice; errores transitorios **intactos dentro** de la transacción (el controlador reintenta) y `TRANSIENT_CONFLICT` al salir; red → `PERSISTENCE_UNAVAILABLE`; 121 → `VALIDATION_FAILED`; 13 → `PERSISTENCE_FORBIDDEN` |
| `persistence/mongo/gridfs-storage.js` | Binarios privados en GridFS: clave opaca validada, sin sobrescritura, sin borrado; metadato `kind: municipal-private` |
| `persistence/mongo/setup-plan.js` | `planSetup` (puro), `verifySetup` (solo lectura), `applySetup` (solo crea; exige guardia, confirmación literal y base `munierp_qa`). **No se invocó contra ninguna base** |
| `persistence/mongo/preflight.js` + `preflight-cli.js` | Preflight de solo lectura (§6). Por defecto no se conecta |
| `persistence/mongo/index.js` | `createMongoPersistence({ client, env, bucketFactory })`: compone almacén y GridFS con un cliente ya conectado; solo si la guardia autoriza |

### Cómo cubre cada requisito

| Requisito | Implementación |
|---|---|
| Colecciones separadas | Prefijo obligatorio `municipal_` (rechaza otro); `_id` = hexadecimal de 24 (mismo formato que la API y la memoria) |
| Aislamiento por `municipalityId` | El adaptador valida el municipio **antes** de llamar al controlador y lo pone en cada filtro; `findRequests` rechaza filtros sin municipio en raíz/`$and` |
| Índices | Tabla del doc 12 §3 más idempotencia por municipio y `files.filename` único |
| Folios transaccionales | `counters.findOneAndUpdate({ _id: clave }, { $inc: { seq: 1 } }, { upsert })` en la transacción del alta |
| Revisiones | `findOneAndUpdate({ _id, municipalityId, version })`; sin coincidencia → `STALE_VERSION`. Membresía con versión 0 admite documentos sin campo `version` |
| Historial acumulativo | Se verifica el prefijo y solo se añaden las entradas nuevas con `$push: { $each }`; nunca se reescribe el arreglo |
| Auditoría en la transacción | El servicio escribe cada cambio y su evento con el mismo `tx` (paso 1); el adaptador usa la misma sesión |
| Membresías y revocación | `updateMembership` con versión; `revokeGrant` con filtro `revokedAt: null` (idempotente) |
| Documentos privados / PENDIENTE | Metadato `PENDIENTE` → GridFS → `VIGENTE` + bitácora; `pendingDocuments` solo informa; el servicio verifica `sha256` al descargar (`DOCUMENT_INTEGRITY_FAILED` en bitácora, 500 sin contenido) |
| Concurrencia | Reintento del controlador para errores transitorios; `TRANSIENT_CONFLICT` → 409 donde el contrato tiene 409 |
| Sin limpiezas destructivas | Ninguna operación de borrado en adaptador, almacenamiento ni plan; prueba que lo verifica |

## 2. Cambios del paso 3 fuera del adaptador

- **Corrección de aislamiento encontrada al diseñar los filtros:** `requestByIdempotency` buscaba solo por
  usuario y clave. Un usuario con membresía en dos municipios que repitiera una `Idempotency-Key` habría
  recibido (200) el expediente **del otro municipio**. Ahora la idempotencia es por municipio + usuario
  + clave (índice `uniq_request_idempotency`), coherente con el contrato.
- Lecturas y escrituras por id (`membership`, `grant`, `documentsOf`, `updateRequest`,
  `updateMembership`, `updateDependency`, `updateDocumentStatus`, `revokeGrant`) reciben el municipio:
  un id de otro municipio se comporta como inexistente. El servicio ya no compara el municipio después
  de leer.
- `municipalApi.downloadDocument` y el arnés usan el **lector privado** (§5), no el exportador comercial.

## 3. Pruebas ejecutadas (VM Linux, Node 22, mongoose 7.8.12 / controlador 5.9.2 instalados, sin conexión)

| Suite | Resultado |
|---|---|
| Backend municipal completo | **271 pasan, 0 fallan, 22 pendientes** |
| Backend completo del ERP (4 lotes, incluye municipal) | **1 224 pasan, 0 fallan, 22 pendientes** (ESLint de Fase 1 en lote propio con límite amplio) |
| Jest municipal (detalle 16, lector privado 11, prototipo 12, compatibilidad C-18/C-19 8) | **47/47** |
| · contrato en memoria | 30 pasan (27 L1 + 3 L2), 7 L3 pendientes |
| · contrato sobre el **adaptador + doble del controlador v6** | 30 pasan, 7 L3 pendientes |
| · contrato sobre el **adaptador + doble del controlador v5** (`{ value }`) | 30 pasan, 7 L3 pendientes |
| · ejecutor contra MongoDB real | 1 pendiente: omitido por la guardia (sin autorización ni confirmación) |
| · unitarias del adaptador con dobles controlados | **34 pasan** |
| · preflight con dobles | **12 pasan** |
| Sensibilidad de la suite sobre el adaptador | Mutante «sin `version` en filtros» → 5 fallos (RC-03/12/13/22/27); mutante «sin `municipalityId` en filtros» → 5 fallos (RC-05/06/09/36/37). Script y registro en `RP\munierp-fase1\f1-05-paso3\evidencias\` |

Unitarias con dobles (pedidas): errores de transacción (reintento transitorio sin consumir otro folio,
transitorio persistente → `TRANSIENT_CONFLICT` sin escrituras, `UnknownTransactionCommitResult`, error de
negocio sin reintento), colisiones de índices (cada índice único y el desconocido), conflictos de
revisión (filtro exacto, escritura que pierde la carrera, historial alterado sin escritura), fallos de
lectura/escritura (red, validador, privilegios), membresías revocadas (incluido el servicio sobre el
adaptador: 403 en la siguiente petición), aislamiento (cada llamada lleva el municipio; excepción
`membershipsOf`), documentos pendientes (GridFS caído → PENDIENTE invisible y conciliable; carrera de
subida; integridad), operaciones sin ámbito (todas las operaciones con ámbito fallan sin tocar el
controlador) y composición con cliente inyectado.

**Lo que estas pruebas NO prueban:** que MongoDB aplique los índices, las transacciones multi-documento,
`snapshot`/`majority`, los reintentos reales, el aislamiento persistente o GridFS. El doble serializa
de hecho las transacciones concurrentes (49 conflictos y 49 reintentos en 50 altas simultáneas), lo que
no equivale al comportamiento del servidor.

## 4. Estado L1 / L2 / L3

| Nivel | Memoria | Adaptador + doble | MongoDB real |
|---|---|---|---|
| L1 (27 casos) | 27/27 | 27/27 (v5 y v6) | **No ejecutado** |
| L2 (3 casos) | 3/3, aproximación | 3/3, aproximación | **No ejecutado** |
| L3 (7 casos) | Pendientes | Pendientes | **Pendientes**; RC-29 (índices con `verifySetup`) y RC-31 (topología y base) ya tienen ejecución preparada; RC-30, 32, 33, 34 y 35 necesitan instrumentación adicional, que se escribirá con el entorno disponible |

Casos nuevos en este paso: RC-36 (ids de otro municipio = inexistentes) y RC-37 (PENDIENTE solo informados, sin borrado).

## 5. OpenAPI draft.3 y C-21

- **draft.3 sin cambios.** Las 24 operaciones conservan rutas, códigos y cuerpos; las pruebas HTTP de F1-04/F1-12 pasan sin modificar asertos.
- Diferencias de comportamiento compatibles con el contrato: idempotencia por municipio (antes podía
  cruzar municipios); `TRANSIENT_CONFLICT` → 409 `CONFLICT` en operaciones que ya documentan 409; fallo
  de integridad → 500 `INTERNAL_ERROR` (respuesta genérica del contrato) y evento de bitácora con
  `result: denied` (dentro del `enum`).
- X-01 sigue a la espera de decisión; X-02 y X-04 retiradas; X-03 diferida. No se generó draft.4.
- **C-21:** documentos privados por `features/municipal/privateDocument.js`, separado del exportador
  comercial (`utils/downloadFile`, que no se modificó ni se usa en el módulo municipal; una prueba lo
  verifica). Web: endpoint autorizado por documento, MIME permitido (PDF/PNG/JPEG) y coincidente, firma,
  tamaño y nombre saneado; enlace `blob:` revocado. Android/iOS: **no disponible** y se informa sin pedir
  el contenido, hasta el lector privado nativo que pide Codex.

## 6. Preflight seguro para `munierp_qa` (propuesta, no ejecutado)

**Nunca se conecta por defecto.** `node src/modules/municipal/persistence/mongo/preflight-cli.js` solo
planifica. Con `--connect` exige, además de la guardia, `MUNICIPAL_QA_PREFLIGHT_CONFIRM=solo-lectura:munierp_qa`.

| Comprobación | Cómo (solo lectura) | Aprueba si |
|---|---|---|
| Autorización explícita | `qa-guard` antes de conectar | `MUNICIPAL_QA_AUTHORIZED=AAAA-MM-DD\|responsable\|munierp_qa`, propia (no la de M07), no futura; `NODE_ENV≠production` |
| Nombre efectivo de la base | URI + `db.databaseName` | `munierp_qa`, distinta de `erp_sales_test` y de cualquier otra `*_QA_DATABASE` |
| Topología transaccional | `hello` | `setName` (réplica) o `mongos` |
| Versión | `buildInfo` | ≥ 5.0 |
| Privilegios mínimos | `connectionStatus { showPrivileges }` | `find`, `insert`, `update`, `listCollections`, `listIndexes` sobre `munierp_qa` |
| Sin privilegios destructivos | ídem | sin `remove`, `drop*`, `collMod`, `anyAction`… |
| Exclusividad | ídem + `listCollections(nameOnly)` | sin privilegios sobre otras bases ni de clúster; solo colecciones `municipal_*` |

Recomendación de usuarios para C-05: **app** (find/insert/update/list*) y **instalación** separado
(createCollection/createIndex), ambos limitados a `munierp_qa`; ninguno con `remove`.

### Inventario de escrituras (todas las que puede emitir el módulo)

| Operación | Colección | Método | Transacción |
|---|---|---|---|
| insertDependency / updateDependency | dependencies | insertOne / findOneAndUpdate `$set` | sí, con bitácora |
| insertMembership / updateMembership (revocación) | memberships | insertOne / findOneAndUpdate `$set` + versión | sí, con bitácora |
| insertCitizen | citizens | insertOne | sí, con bitácora |
| nextSequence | counters | findOneAndUpdate `$inc` upsert | sí (alta) |
| insertRequest / updateRequest | requests | insertOne / findOneAndUpdate `$set` + `$push` + versión | sí, con bitácora |
| insertDocument / updateDocumentStatus | documents | insertOne PENDIENTE / `$set` VIGENTE | no / sí con bitácora |
| addGrant / revokeGrant | grants | insertOne / updateOne `$set revokedAt` | sí, con bitácora |
| appendAudit | audit_events | insertOne | en la transacción auditada; suelta para ACCESS_DENIED y descargas |
| storage.put | files.files / files.chunks | GridFS upload | no (GridFS no es transaccional) |
| applySetup (solo instalación) | todas | createCollection / createIndex | no; solo con confirmación literal |

Ninguna operación borra, renombra ni modifica índices o validadores.

### Procedimiento seguro de ejecución (cuando C-05 esté cerrada)

1. Codex/infra crea `munierp_qa` en un clúster de QA con réplica, los dos usuarios y registra la
   autorización en `08-DEPENDENCIAS-CODEX.md` (independiente de la de M07/`erp_sales_test`).
2. El responsable exporta las variables (`MUNICIPAL_STORE`, `MUNICIPAL_QA_DATABASE`, `MUNICIPAL_QA_URI`,
   `MUNICIPAL_QA_AUTHORIZED`) en su sesión; **nunca** en archivos del repositorio ni en paquetes.
3. `preflight-cli.js` (plan) → revisar; `--connect --out preflight.json` → debe salir `ok: true`.
4. Con el usuario de instalación: `applySetup` (confirmación `municipal_qa_aplicar=munierp_qa`) o
   ejecutar la suite, que crea colecciones con prefijo por caso `municipal_c<ejecución>_<n>_`.
5. `MUNICIPAL_QA_APPLY_CONFIRM=municipal_qa_aplicar=munierp_qa npx mocha tests/municipal/repository-contract.mongo.test.js` (por áreas con `--grep` si el clúster limita colecciones).
6. Conservar evidencia; las colecciones de prueba se retiran **manualmente** por el responsable, no por el código.

### Evidencia necesaria para aceptar L3

- `preflight.json` con `ok: true` (sin URI ni usuarios).
- Salida de mocha del ejecutor real: L1 27/27 y L2 3/3 contra `munierp_qa`, y los 7 L3 ejecutados (no pendientes).
- RC-29: salida de `verifySetup` sin problemas; RC-31: `setName` registrado.
- RC-30: conflicto de escritura entre dos sesiones reintentado sin folios duplicados.
- RC-32: corte de GridFS tras el metadato → PENDIENTE informado por `pendingDocuments`; sha256 verificado.
- RC-33: `updateOne`/`deleteOne` sobre la bitácora con el usuario app → error de autorización del servidor.
- RC-34: transiciones concurrentes con `$push` y tamaño BSON medido; RC-35: revocación visible desde otra conexión.
- Fecha, versión del servidor, versión de mongoose/controlador y commit probado.

## 7. Playwright

El paso 3 cambió el flujo de descarga (lector privado) y añadió un escenario. Se ejecutó **solo la suite
F1-13** (los 14 escenarios F1-12 no cambiaron y no se repitieron). Resultados en §7.1. Las 93
ejecuciones anteriores no se atribuyen a esta corrida.

### 7.1 Resultados (Windows, 2026-11-10 16:56 hora de México, `windows_2026-11-10_1656`)

| Navegador | Ejecutable | Versión | F1-13 (17 + escenario 16 nuevo) | Capturas |
|---|---|---|---|---|
| Chromium | revisión de Playwright 1.65.0 | 158.0.8127.18 | **18/18** | 18 |
| Firefox | `firefox-1569` | 158.0 | **18/18** | 18 |
| WebKit | `webkit-2386` | 27.2 | **18/18** | 18 |

54 pasan, 0 fallan, 78 s, API SIMULADA (servicio municipal real en memoria). El escenario 16 («documento
alterado en el transporte») verifica que el lector privado no guarda el archivo y muestra «El documento
recibido no superó la verificación…»; el 04 sigue descargando el PDF real con el lector nuevo. Sin fallos,
no hay trazas (solo se conservan en fallo). Ruta del usuario sustituida en `results.json`. No se
reinstaló Playwright ni se descargaron navegadores.

## 8. Incompatibilidades y decisiones que requieren rediseño o acuerdo

| Tema | Situación |
|---|---|
| GridFS no participa en transacciones | Resuelto con el patrón PENDIENTE → VIGENTE; los huérfanos solo se informan |
| Forma del resultado de `findOneAndUpdate` (v5 `{ value }` / v6 documento) | El adaptador admite ambas; mongoose 7.8 trae el controlador 5.9.2 |
| `_id` como cadena | Los `userId` municipales se guardan como cadena; el ERP usa `ObjectId` en `users`. Sin consultas cruzadas: la identidad se resuelve con `resolveAccess`. Si Codex prefiere `ObjectId`, el cambio se concentra en `toDb`/`fromDb` |
| Conexión en producción | `createMongoPersistence` acepta el cliente; reutilizar `mongoose.connection.getClient()` del ERP requiere montaje (C-01) |
| Callbacks de transacción repetibles | El controlador puede repetirlos; el servicio solo escribe en la base dentro de ellos (ninguna llamada externa) |
| Bitácora fuera de transacción | ACCESS_DENIED y DOCUMENT_DOWNLOADED se registran sueltos, por diseño |
| Colecciones por caso en QA | Atlas compartido limita el número de colecciones: ejecutar por áreas o en clúster dedicado |
| Instrumentación de RC-30/32/33/34/35 | Pendiente de escribir con el entorno real; no se simula |

## 9. Qué falta para declarar F1-05 terminada

1. **C-05:** `munierp_qa` exclusiva, usuarios app/instalación con privilegios mínimos y autorización propia.
2. Preflight `--connect` con `ok: true`.
3. Instalación con `applySetup` y `verifySetup` sin problemas.
4. Suite de contrato real: L1 27/27, L2 3/3 y los 7 L3 ejecutados y aprobados (escribiendo RC-30, 32, 33, 34, 35).
5. Decisión de montaje y conexión (C-01): `MUNICIPAL_STORE=mongo` en la composición del servicio.
