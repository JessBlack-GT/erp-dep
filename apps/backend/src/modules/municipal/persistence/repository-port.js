// @ts-check
'use strict';
/**
 * Puerto de persistencia municipal (F1-05 paso 1). Lo implementan:
 *  - `mocks/in-memory-store.js` (hoy, pruebas y maquetas, datos sintéticos);
 *  - el adaptador MongoDB de F1-05 paso 3 (pendiente; diseño en docs/munierp/12, sin conexión todavía).
 *
 * Reglas del puerto (la suite tests/municipal/repository-contract/ las verifica):
 *  1. Toda operación devuelve una promesa, salvo `newId()` (síncrono, como `new ObjectId()`).
 *  2. `transaction(fn)` invoca `fn(tx)`; dentro solo se usa `tx`. Todo o nada: si `fn` lanza, ninguna
 *     escritura de `tx` queda confirmada (incluidos contadores de folio y bitácora).
 *  3. Las colecciones por municipio exigen `municipalityId` (`MISSING_MUNICIPALITY`); `findRequests`
 *     exige un filtro con municipio en la raíz o en un `$and` de primer nivel.
 *  4. Escrituras con versión (`updateRequest`, `updateMembership`) comparan y sustituyen: si la versión
 *     esperada no coincide lanzan `STALE_VERSION` sin modificar nada.
 *  5. El historial de un expediente solo crece (`HISTORY_REWRITE`); la bitácora es de solo inserción.
 *  6. Unicidad: folio por municipio (`DUPLICATE_FOLIO`), idempotencia por usuario
 *     (`DUPLICATE_IDEMPOTENCY`), membresía por usuario y municipio (`DUPLICATE_MEMBERSHIP`),
 *     dependencia por municipio (`DUPLICATE_DEPENDENCY`), clave de almacenamiento (`DUPLICATE_STORAGE_KEY`).
 *  7. Los objetos devueltos son copias desacopladas del almacén.
 *  8. Los campos de identidad (`id`, `municipalityId`, `folio`, `userId`, `createdAt`, `createdBy`)
 *     no cambian por un `patch`.
 */

/** Operaciones asíncronas del puerto, agrupadas por agregado. */
const PORT_OPERATIONS = Object.freeze({
  transacciones: ['transaction'],
  municipios: ['municipalityById', 'municipalityByCode'],
  dependencias: ['dependencies', 'insertDependency', 'updateDependency'],
  membresias: ['membership', 'membershipsOf', 'membershipsIn', 'insertMembership', 'updateMembership'],
  ciudadanos: ['citizens', 'citizen', 'insertCitizen'],
  folios: ['nextSequence'],
  expedientes: ['insertRequest', 'requestByIdempotency', 'findRequests', 'existsByFolio', 'updateRequest'],
  documentos: ['insertDocument', 'updateDocumentStatus', 'documentsOf'],
  concesiones: ['addGrant', 'grant', 'revokeGrant', 'grantsFor'],
  auditoria: ['appendAudit', 'auditEvents'],
});

const SYNC_OPERATIONS = Object.freeze(['newId']);

/** Códigos de error que el servicio traduce a respuestas HTTP (no cambian con la implementación). */
const PORT_ERROR_CODES = Object.freeze([
  'DUPLICATE_FOLIO', 'DUPLICATE_IDEMPOTENCY', 'DUPLICATE_MEMBERSHIP', 'DUPLICATE_DEPENDENCY',
  'DUPLICATE_STORAGE_KEY', 'STALE_VERSION', 'HISTORY_REWRITE', 'MISSING_MUNICIPALITY', 'NOT_FOUND',
]);

const allOperations = () => [...SYNC_OPERATIONS, ...Object.values(PORT_OPERATIONS).flat()];

/**
 * Verifica que un objeto implementa el puerto (forma, no comportamiento). Lanza con la lista de faltantes.
 * @param {any} impl
 */
function assertRepositoryPort(impl) {
  const missing = allOperations().filter((op) => !impl || typeof impl[op] !== 'function');
  if (missing.length) throw new TypeError('El almacén no implementa el puerto municipal: ' + missing.join(', '));
  return impl;
}

module.exports = { PORT_OPERATIONS, SYNC_OPERATIONS, PORT_ERROR_CODES, assertRepositoryPort, allOperations };
