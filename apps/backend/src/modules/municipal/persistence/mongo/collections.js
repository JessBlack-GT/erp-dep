// @ts-check
'use strict';
/**
 * Colecciones, índices y validadores del módulo municipal en MongoDB (docs/munierp/12 §2–§3).
 * SOLO DECLARACIONES: este archivo no crea nada. `setup-plan.js` las convierte en un plan y únicamente
 * las aplicaría con autorización explícita de QA (C-05).
 *
 * Decisión de identificadores: `_id` es la cadena hexadecimal de 24 caracteres que ya usan el dominio,
 * la API (`ObjectId` en draft.3) y el almacén en memoria. Evita conversiones y mantiene la validación
 * de parámetros actual. Las referencias al ERP (`userId`) se guardan con la misma forma.
 */

const BASE = Object.freeze({
  municipalities: 'municipalities',
  dependencies: 'dependencies',
  memberships: 'memberships',
  citizens: 'citizens',
  requests: 'requests',
  documents: 'documents',
  grants: 'grants',
  counters: 'counters',
  audit: 'audit_events',
  files: 'files', // bucket GridFS: <prefijo>files.files y <prefijo>files.chunks
});

/** @param {string} [prefix] */
function collectionNames(prefix = 'municipal_') {
  if (!/^municipal_[a-z0-9_]*$/.test(prefix)) throw new Error('El prefijo de colecciones debe empezar por "municipal_"');
  return Object.freeze(Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, prefix + v])));
}

/**
 * Índices por colección lógica. Los nombres son estables: `errors.js` traduce E11000 por nombre de índice.
 * `partialFilterExpression` usa solo operadores admitidos en índices parciales.
 */
const INDEXES = Object.freeze({
  municipalities: [
    { name: 'uniq_municipality_code', key: { code: 1 }, unique: true },
  ],
  dependencies: [
    { name: 'uniq_dependency_code', key: { municipalityId: 1, code: 1 }, unique: true },
  ],
  memberships: [
    { name: 'uniq_membership_user', key: { userId: 1, municipalityId: 1 }, unique: true },
    { name: 'membership_scope', key: { municipalityId: 1, status: 1, role: 1 } },
    { name: 'membership_dependency', key: { municipalityId: 1, dependencyIds: 1, status: 1 } },
  ],
  citizens: [
    { name: 'uniq_citizen_curp', key: { municipalityId: 1, curpHash: 1 }, unique: true, partialFilterExpression: { curpHash: { $type: 'string' } } },
    { name: 'citizen_name', key: { municipalityId: 1, fullName: 1 } },
  ],
  requests: [
    { name: 'uniq_request_folio', key: { municipalityId: 1, folio: 1 }, unique: true },
    { name: 'uniq_request_idempotency', key: { municipalityId: 1, createdBy: 1, idempotencyKey: 1 }, unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
    { name: 'request_owner', key: { municipalityId: 1, ownerDependencyId: 1, status: 1, createdAt: -1 } },
    { name: 'request_turned', key: { municipalityId: 1, assignedDependencyIds: 1, status: 1 } },
    { name: 'request_assignee', key: { municipalityId: 1, assignedUserId: 1, status: 1 } },
    { name: 'request_status', key: { municipalityId: 1, status: 1, createdAt: -1 } },
    { name: 'request_citizen', key: { municipalityId: 1, citizenId: 1 } },
  ],
  documents: [
    { name: 'uniq_document_storage_key', key: { storageKey: 1 }, unique: true },
    { name: 'document_request', key: { municipalityId: 1, requestId: 1, uploadedAt: 1 } },
    { name: 'document_pending', key: { municipalityId: 1, status: 1, uploadedAt: 1 } },
  ],
  grants: [
    { name: 'grant_grantee', key: { municipalityId: 1, granteeUserId: 1, revokedAt: 1, expiresAt: 1 } },
    { name: 'grant_request', key: { municipalityId: 1, requestId: 1 } },
  ],
  counters: [],
  audit: [
    { name: 'audit_time', key: { municipalityId: 1, at: -1 } },
    { name: 'audit_folio', key: { municipalityId: 1, folio: 1, at: -1 } },
  ],
  files: [
    // Sobre `<prefijo>files.files`: un binario por clave opaca (GridFS no lo garantiza por sí mismo).
    { name: 'uniq_file_storage_key', key: { filename: 1 }, unique: true, on: 'files.files' },
  ],
});

/** Índice único → código de error del puerto. */
const UNIQUE_INDEX_ERRORS = Object.freeze({
  uniq_municipality_code: 'DUPLICATE_MUNICIPALITY',
  uniq_dependency_code: 'DUPLICATE_DEPENDENCY',
  uniq_membership_user: 'DUPLICATE_MEMBERSHIP',
  uniq_citizen_curp: 'DUPLICATE_CITIZEN',
  uniq_request_folio: 'DUPLICATE_FOLIO',
  uniq_request_idempotency: 'DUPLICATE_IDEMPOTENCY',
  uniq_document_storage_key: 'DUPLICATE_STORAGE_KEY',
  uniq_file_storage_key: 'DUPLICATE_STORAGE_KEY',
});

/** Validadores mínimos ($jsonSchema, `validationLevel: strict`): municipio obligatorio y campos clave. */
const req = (...fields) => ({ $jsonSchema: { bsonType: 'object', required: fields, properties: Object.fromEntries(fields.map((f) => [f, f === '_id' ? { bsonType: 'string', pattern: '^[0-9a-f]{24}$' } : {}])) } });
const VALIDATORS = Object.freeze({
  municipalities: req('_id', 'code', 'name'),
  dependencies: req('_id', 'municipalityId', 'code', 'name', 'status'),
  memberships: req('_id', 'userId', 'municipalityId', 'role', 'dependencyIds', 'status'),
  citizens: req('_id', 'municipalityId', 'fullName'),
  requests: req('_id', 'municipalityId', 'folio', 'status', 'version', 'history', 'createdBy', 'createdAt'),
  documents: req('_id', 'municipalityId', 'requestId', 'storageKey', 'status', 'confidentiality'),
  grants: req('_id', 'municipalityId', 'requestId', 'level'),
  counters: { $jsonSchema: { bsonType: 'object', required: ['_id', 'seq'] } },
  audit: req('_id', 'municipalityId', 'action', 'at', 'result'),
});

/** Colecciones con dato municipal (todas salvo el catálogo de municipios y los contadores). */
const MUNICIPAL_SCOPED = Object.freeze(['dependencies', 'memberships', 'citizens', 'requests', 'documents', 'grants', 'audit']);

module.exports = { BASE, collectionNames, INDEXES, UNIQUE_INDEX_ERRORS, VALIDATORS, MUNICIPAL_SCOPED };
