# F1-05 — Diseño técnico del repositorio MongoDB (solo diseño)

> **Estado:** diseño. No se conectó a MongoDB Atlas, no se crearon colecciones ni índices y no se
> escribió código de repositorio. Cualquier prueba persistente requiere un entorno QA **exclusivo,
> verificado y autorizado** por escrito (ver §10). Fecha: 2026-11-10.

## 1. Punto de partida

| Pieza actual | Archivo | Qué se conserva |
|---|---|---|
| Almacén en memoria (puerto de repositorio) | `modules/municipal/mocks/in-memory-store.js` | La **interfaz** (`insertRequest`, `updateRequest(id, version, patch)`, `nextSequence`, `transaction`, …) y sus códigos de error (`DUPLICATE_FOLIO`, `DUPLICATE_IDEMPOTENCY`, `DUPLICATE_MEMBERSHIP`, `DUPLICATE_DEPENDENCY`, `STALE_VERSION`) |
| Puerto de documentos | `modules/municipal/storage/memory-storage.js` | `put(key, buffer)` / `get(key)`; sin borrado |
| Servicio de aplicación | `application/municipal.service.js` | Reglas, autorización y auditoría; **no** debe conocer Mongoose |
| Patrón de transacciones del ERP | `modules/sales/sales.setup.js`, `inventory.repository.js`, `auth.service.js` | Verificación de topología (`hello` → `setName`), `mongoose.connection.transaction(...)`, `createCollection` + `createIndexes` explícitos |

**Restricción clave:** el almacén actual es **síncrono** (salvo `transaction`). Mongoose es asíncrono.
La migración exige que el servicio haga `await` en todas las llamadas al puerto (ver §8, paso 1).
Mongoose 7 ya está en el ERP; **no** se añaden dependencias.

## 2. Modelos y relaciones

Prefijo `municipal_` en todas las colecciones para no colisionar con las comerciales. Conexión: la
misma de Mongoose del ERP (`mongoose.connection`); no se crea otra.

```
municipal_municipalities 1 ─< municipal_dependencies
        │                1 ─< municipal_memberships >─ users (ERP, solo por _id)
        │                1 ─< municipal_citizens
        │                1 ─< municipal_requests ─< municipal_documents ── GridFS municipal_files
        │                                         ─< municipal_grants
        │                1 ─< municipal_counters
        └──────────────── 1 ─< municipal_audit_events
```

| Colección | Campos (tipos) | Notas |
|---|---|---|
| `municipal_municipalities` | `code` (String, `^[A-Z]{3}$`), `name`, `status` (`ACTIVO`/`INACTIVO`), `timezone` (`America/Mexico_City`), `createdAt` | Catálogo; altas solo por migración |
| `municipal_dependencies` | `municipalityId` (ObjectId), `code`, `name`, `parentCode` (String\|null), `status` (`ACTIVA`/`INACTIVA`), `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | Jerarquía por `parentCode` dentro del municipio |
| `municipal_memberships` | `userId` (ObjectId → `users` del ERP), `municipalityId`, `role` (7 roles municipales), `dependencyIds` (ObjectId[]), `status` (`ACTIVA`/`INACTIVA`/`REVOCADA`), `validFrom`, `validTo` (Date\|null), `version` (Number), `revokedAt`, `revokedBy`, `revocationReason`, `createdBy`, `createdAt` | **No** referencia roles comerciales; el `userId` es la única unión con el ERP |
| `municipal_citizens` | `municipalityId`, `fullName`, `curp` (cifrado opcional, ver §6), `phone`, `email`, `address`, `createdBy`, `createdAt` | Datos sintéticos hasta autorización; **distinto** de clientes comerciales |
| `municipal_requests` | `municipalityId`, `folio`, `type`, `subject`, `description`, `citizenId`, `ownerDependencyId`, `assignedDependencyIds`, `assignedUserId`, `confidentiality`, `channel`, `status`, `version`, `history[]`, `createdBy`, `createdAt`, `updatedAt`, `idempotencyKey`, `payloadHash` | `history[]` incrustado (ver §5) |
| `municipal_documents` | `municipalityId`, `requestId`, `folio`, `filename`, `mimeType`, `size`, `sha256`, `storageKey`, `confidentiality`, `status` (`PENDIENTE`/`VIGENTE`), `uploadedBy`, `uploadedAt` | Solo metadatos; el binario va a GridFS |
| `municipal_grants` | `municipalityId`, `requestId`, `granteeUserId` \| `granteeDependencyId`, `level`, `expiresAt`, `revokedAt`, `grantedBy`, `createdAt` | Accesos excepcionales a un expediente |
| `municipal_counters` | `_id` = `counterKey` (`SJH:OBP:SOL:2026`), `municipalityId`, `seq` (Number), `updatedAt` | Un documento por municipio/dependencia/tipo/año |
| `municipal_audit_events` | `at`, `actorId`, `membershipId`, `municipalityId`, `action`, `entity`, `entityId`, `folio`, `result`, `ip`, `requestId` | Solo inserción (ver §5) |

Esquemas Mongoose con `strict: 'throw'`, `timestamps: false` (las fechas vienen del `clock()` del
servicio para que las pruebas sean deterministas) y `versionKey: false` (la versión optimista es el
campo `version` del dominio, no `__v`).

## 3. Índices

| Colección | Índice | Tipo | Propósito |
|---|---|---|---|
| municipalities | `{ code: 1 }` | **único** | Resolución por código de URL |
| dependencies | `{ municipalityId: 1, code: 1 }` | **único** | `DUPLICATE_DEPENDENCY` |
| memberships | `{ userId: 1, municipalityId: 1 }` | **único** | Una membresía por usuario y municipio (`DUPLICATE_MEMBERSHIP`) |
| memberships | `{ municipalityId: 1, status: 1, role: 1 }` | compuesto | Listado y asignables por dependencia |
| memberships | `{ municipalityId: 1, dependencyIds: 1, status: 1 }` | compuesto multikey | `listMemberships({dependency, status})` (ASIGNAR) |
| citizens | `{ municipalityId: 1, curpHash: 1 }` | único **parcial** (`curpHash` existe) | Evita duplicar ciudadanos sin exponer la CURP |
| citizens | `{ municipalityId: 1, fullNameNormalized: 1 }` | compuesto | Búsqueda por nombre |
| requests | `{ municipalityId: 1, folio: 1 }` | **único** | Folio único por municipio (`DUPLICATE_FOLIO`, RQ01) |
| requests | `{ createdBy: 1, idempotencyKey: 1 }` | **único parcial** (`idempotencyKey` string) | Idempotencia (`DUPLICATE_IDEMPOTENCY`) |
| requests | `{ municipalityId: 1, ownerDependencyId: 1, status: 1, createdAt: -1 }` | compuesto | Bandeja por dependencia (alcance D) |
| requests | `{ municipalityId: 1, assignedDependencyIds: 1, status: 1 }` | compuesto multikey | Turnados (alcance D) |
| requests | `{ municipalityId: 1, assignedUserId: 1, status: 1 }` | compuesto | Alcance A (asignadas a mí) |
| requests | `{ municipalityId: 1, status: 1, createdAt: -1 }` | compuesto | Alcance M e indicadores |
| requests | `{ municipalityId: 1, citizenId: 1 }` | compuesto | Historial del ciudadano |
| documents | `{ requestId: 1, uploadedAt: 1 }` | compuesto | Lista de documentos del expediente |
| documents | `{ storageKey: 1 }` | **único** | Un binario por metadato |
| grants | `{ municipalityId: 1, granteeUserId: 1, revokedAt: 1, expiresAt: 1 }` | compuesto | `activeGrantRequestIds` |
| grants | `{ requestId: 1 }` | simple | Concesiones por expediente |
| audit_events | `{ municipalityId: 1, at: -1 }` | compuesto | Consulta de auditoría |
| audit_events | `{ municipalityId: 1, folio: 1, at: -1 }` | compuesto | Auditoría por expediente |

Los índices se crean de forma **explícita** en un `municipal.setup.js` (`createCollection` +
`createIndexes`, igual que `sales.setup.js`) y **nunca** con `autoIndex` en producción.

## 4. Folios concurrentes

1. Dentro de la transacción de alta:
   `counters.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 }, $setOnInsert: { municipalityId }, $set: { updatedAt } }, { upsert: true, new: true, session })`.
   `$inc` sobre un documento es atómico; dos altas simultáneas obtienen secuencias distintas.
2. Se inserta la solicitud con el folio formateado (`formatFolio`) **en la misma sesión**.
3. Si la inserción falla, la transacción aborta y el contador **también** retrocede: no quedan huecos
   por fallos de escritura (comportamiento ya probado en memoria, MT-32). Un folio emitido no se
   reutiliza jamás.
4. Red de seguridad: el índice único `{municipalityId, folio}` convierte cualquier colisión (p. ej.
   contador restaurado por error) en `DUPLICATE_FOLIO` → 409 `CONFLICT` "reintente con la misma
   Idempotency-Key" (ya implementado en el servicio).
5. Errores transitorios de transacción (`TransientTransactionError`,
   `UnknownTransactionCommitResult`) se reintentan con `connection.transaction()` de Mongoose, que ya
   los reintenta; la idempotencia evita duplicados si el cliente reintenta.
6. El año del folio sale de `yearInMexico(now)` (zona `America/Mexico_City`), no de UTC.

## 5. Aislamiento por municipio e historial persistente

- **Todas** las consultas del repositorio reciben `municipalityId` como primer filtro obligatorio; el
  repositorio rechaza (`Error('municipalityId obligatorio')`) cualquier `find`/`update` sin él. Es la
  defensa en profundidad bajo `buildRequestScopeFilter` del servicio.
- Las búsquedas por folio usan `{ municipalityId, folio }` + el filtro de alcance; un folio de otro
  municipio responde igual que uno inexistente (404 sin divulgación), como hoy.
- **Historial:** `history[]` incrustado en la solicitud, solo con `$push` dentro del mismo
  `updateOne({ _id, municipalityId, version: v }, { $set: {...}, $push: { history: entry }, $inc: { version: 1 } })`.
  Si `matchedCount === 0` → `STALE_VERSION` → 409 (ETag/If-Match). Nunca se reescribe el arreglo
  completo (hoy el servicio envía `history: next.history`; el adaptador lo traducirá a `$push` del
  último elemento y validará que el prefijo no cambió).
  - Límite: 16 MB por documento. Con ~300 B por entrada caben >50 000 movimientos; si un tipo de
    trámite lo amenaza, se moverá a `municipal_request_events` (decisión diferida, medida en QA).
- **Auditoría:** colección de solo inserción. El usuario de la aplicación tendrá rol de Atlas con
  `insert`/`find` sobre `municipal_audit_events` y **sin** `update`/`remove` (petición a Codex/infra).
  Se escribe en la misma transacción que el cambio que audita (como hoy en memoria).

## 6. Revocación de membresías

- Revocar = `updateOne({ _id, municipalityId, version }, { $set: { status: 'REVOCADA', revokedAt, revokedBy, revocationReason }, $inc: { version: 1 } })`. No se borra (trazabilidad).
- La membresía se **lee en cada petición** (no se guarda en el JWT ni en caché de sesión): un token
  válido no basta. La revocación surte efecto en la siguiente petición; F1-13 ya lo prueba en la UI
  (escenario 10: la siguiente carga muestra «sin membresía»).
- Si más adelante se cachea, el TTL máximo será de 60 s y se invalidará al revocar (decisión a
  documentar con Codex; hoy no hay caché).
- Revocar **no** reasigna automáticamente expedientes: las solicitudes con `assignedUserId` del
  usuario revocado aparecen en un indicador «asignadas a usuario sin membresía» para el titular.
- Las concesiones (`grants`) del usuario revocado dejan de aplicarse porque
  `activeGrantRequestIds` exige membresía vigente; además se marcan `revokedAt` en la misma transacción.

## 7. Almacenamiento privado de documentos

- **GridFS** bucket `municipal_files` en la misma base (ADR-10), sin URL pública. Las descargas pasan
  siempre por el endpoint autorizado (`GET …/documents/{id}/content`), que comprueba alcance y
  confidencialidad **antes** de abrir el flujo; respuesta con `Cache-Control: no-store`.
- `storageKey` aleatorio (`docs.newStorageKey()`), sin folio ni nombre de archivo; `sha256` se
  verifica al leer.
- **Orden de escritura (corrección necesaria):** hoy el servicio hace `storage.put` y después
  `insertDocument` fuera de transacción; un fallo intermedio deja un binario huérfano. En Mongo:
  1. Insertar metadatos `status: 'PENDIENTE'` (transacción con la auditoría).
  2. Subir a GridFS (GridFS no participa de transacciones multi-documento).
  3. Marcar `VIGENTE`. Los documentos `PENDIENTE` de más de 24 h los reporta una tarea de conciliación
     (sin borrado automático; la purga requiere aprobación, regla «sin operaciones destructivas»).
  Las consultas de documentos solo devuelven `VIGENTE`.
- Límite de tamaño y tipos permitidos: los de `domain/documents.js` (ya validados).
- Cifrado en reposo: el de Atlas (a confirmar con infraestructura). CURP: se guarda `curpHash`
  (HMAC-SHA256 con secreto de entorno) para unicidad y, si se requiere mostrarla, el valor cifrado con
  CSFLE o cifrado de aplicación (decisión pendiente, C-08).

## 8. Transacciones

| Operación | Documentos en la transacción |
|---|---|
| Alta de solicitud | counters ($inc) + requests (insert) + audit (insert) |
| Transición (turnar, asignar, concluir, cancelar…) | requests (update con versión y `$push`) + audit |
| Conceder / revocar acceso | grants + audit |
| Alta/edición/revocación de membresía | memberships (versión) + grants del usuario (al revocar) + audit |
| Alta/edición de dependencia | dependencies + audit (la validación de solicitudes abiertas se hace con lecturas en la misma sesión) |
| Documento | metadatos + audit (GridFS fuera, ver §7) |

- Requisito: topología con transacciones (réplica o Atlas). `municipal.setup.js` replica la verificación
  de `sales.setup.js` y **falla al arrancar** si no hay `setName`.
- `readConcern: 'snapshot'`, `writeConcern: { w: 'majority' }` en las transacciones; lecturas de
  listado con `readPreference: 'primary'` para no ver datos atrasados tras una transición.
- El puerto `store.transaction(fn)` pasa a `connection.transaction(session => fn(session))`; el
  repositorio guarda la sesión en `AsyncLocalStorage` para no cambiar la firma de cada método.

## 9. Migración desde los servicios en memoria

1. **Puerto asíncrono (sin Mongo).** Convertir todas las llamadas `store.*` del servicio a `await`
   (el almacén en memoria devuelve promesas). Las 117 pruebas municipales y las 16 de F1-13 deben
   seguir pasando sin cambios de comportamiento. Es el único cambio al servicio.
2. **Prueba de contrato del puerto.** Una suite común (`repository.contract.test.js`) que se ejecuta
   contra el almacén en memoria **y** contra el adaptador Mongo: unicidad, versión obsoleta, rollback
   de folio, idempotencia, aislamiento por municipio, historial solo por `$push`.
3. **Adaptador Mongo** `infrastructure/mongo-store.js` + modelos en `infrastructure/models/` y adaptador
   GridFS `storage/gridfs-storage.js`, todos dentro del módulo municipal.
4. **`municipal.setup.js`**: verificación de topología, `createCollection`, `createIndexes`, carga de
   catálogo base (municipio SJH y dependencias) **solo** con bandera `MUNICIPAL_SEED=qa`.
5. **Selección por configuración** en `isolated-app.js`: `MUNICIPAL_STORE=memory|mongo` (por defecto
   `memory`); el guardia de producción (`allowProduction:true`) sigue vigente.
6. **Montaje** en `app.js` del ERP: lo hace Codex (C-01). F1-05 no toca `app.js`.
7. Sin migración de datos: no hay datos persistentes previos; el prototipo solo usa datos sintéticos.

## 10. Estrategia de pruebas de integración

| Nivel | Dónde | Datos | Cuándo |
|---|---|---|---|
| Contrato del puerto (memoria) | Jest/mocha local | Sintéticos | Siempre (CI) |
| Contrato del puerto (Mongo efímero) | `mongodb-memory-server` en modo **réplica** (`MongoMemoryReplSet`) | Sintéticos | CI; requiere aprobar la devDependency (C-17 ampliada) o usar un Docker local con `--replSet` |
| Concurrencia de folios | Mongo efímero, 50 altas en paralelo `Promise.all` | Sintéticos | CI: 50 folios distintos y consecutivos, sin huecos |
| Revocación | Mongo efímero: revocar y repetir la petición | Sintéticos | CI |
| Rollback | Mongo efímero: forzar fallo tras `$inc` | Sintéticos | CI: contador sin avance |
| GridFS | Mongo efímero: subir, descargar, verificar sha256; fallo entre pasos → `PENDIENTE` | Sintéticos | CI |
| Entorno QA persistente | Atlas QA **exclusivo** | Sintéticos | Solo con autorización escrita |

**Precondiciones para cualquier prueba persistente (Atlas QA):**
1. Proyecto/cluster de Atlas exclusivo de QA, distinto del de producción y del de desarrollo del ERP.
2. Cadena de conexión entregada por variable de entorno (nunca en el repositorio ni en los paquetes);
   usuario con permisos solo sobre la base `munierp_qa`.
3. El arranque verifica `dbName === 'munierp_qa'` y una bandera `MUNICIPAL_QA_AUTHORIZED=<fecha>`; sin
   ambas, se niega a conectar.
4. Autorización explícita del responsable del proyecto registrada en `08-DEPENDENCIAS-CODEX.md`.
5. Sin operaciones destructivas: las pruebas usan un prefijo de ejecución y no borran colecciones.

Hasta cumplirlas, F1-05 solo puede avanzar con los pasos 1–2 de §9 (sin base de datos).

## 11. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-M1 | El puerto síncrono obliga a tocar todas las llamadas del servicio | Paso 1 aislado, con la suite completa como red de seguridad |
| R-M2 | Atlas sin réplica (M0 compartido sí soporta transacciones; un Mongo local *standalone* no) | Verificación de topología al arrancar |
| R-M3 | Binarios huérfanos en GridFS | Estado `PENDIENTE` + conciliación (§7) |
| R-M4 | Crecimiento de `history[]` | Medición en QA; plan de colección de eventos |
| R-M5 | Credenciales en el repositorio (existe `atlas-credentials.env` en la carpeta de trabajo, fuera del repo) | No leerlo ni empaquetarlo; `.gitignore`; variables de entorno |
| R-M6 | Índices creados con `autoIndex` en producción | `autoIndex: false` y `municipal.setup.js` explícito |
