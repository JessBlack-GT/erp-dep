// @ts-check
'use strict';
/**
 * Adaptador MongoDB del puerto de persistencia municipal (F1-05 paso 3) — PREPARADO, SIN CONEXIÓN.
 *
 * Recibe por inyección:
 *  - `db`: objeto con `collection(nombre)` y la API del controlador oficial (`findOne`, `find().toArray()`,
 *    `insertOne`, `updateOne`, `findOneAndUpdate`, `countDocuments`). Puede ser `client.db('munierp_qa')`
 *    o un doble de pruebas.
 *  - `runTransaction(fn)`: ejecuta `fn(session)` en una transacción (`transaction-runner.js`).
 * No importa `mongodb` ni `mongoose`: no puede conectarse por sí mismo.
 *
 * Garantías que implementa (verificadas con dobles; en MongoDB real quedan como casos L3):
 *  - toda operación municipal filtra por `municipalityId` (puerto v2); sin municipio → MISSING_MUNICIPALITY
 *    ANTES de llamar al controlador;
 *  - escrituras con versión por filtro `{ _id, municipalityId, version }` (compara y sustituye);
 *  - historial solo con `$push` de las entradas nuevas, tras verificar que el prefijo no cambió;
 *  - folios con `$inc` atómico en `counters` dentro de la transacción del alta;
 *  - E11000 → código del puerto por nombre de índice; errores transitorios intactos dentro de la
 *    transacción para que el controlador reintente;
 *  - sin operaciones de borrado.
 */
const crypto = require('crypto');
const { collectionNames } = require('./collections');
const { mapMongoError } = require('./errors');
const { hasMunicipalityScope } = require('../scope');

const fail = (code, message) => Object.assign(new Error(message), { code });
const requireMunicipalityId = (municipalityId) => {
  if (typeof municipalityId !== 'string' || !municipalityId) throw fail('MISSING_MUNICIPALITY', 'municipalityId obligatorio');
};

/** Campos que un patch nunca puede cambiar. */
const IDENTITY = ['id', '_id', 'municipalityId', 'folio', 'userId', 'createdAt', 'createdBy'];
const withoutIdentity = (patch) => Object.fromEntries(Object.entries(patch || {}).filter(([k]) => !IDENTITY.includes(k)));

const toDb = (doc) => {
  const { id, ...rest } = doc;
  return { _id: id, ...rest };
};
const fromDb = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
};
/** Eventos de bitácora: el `_id` técnico no forma parte del dominio. */
const auditFromDb = (doc) => {
  const { _id, ...rest } = doc;
  return rest;
};
/** Compatibilidad: controlador v5 devuelve `{ value }`; v6 devuelve el documento. */
const unwrap = (r) => (r && typeof r === 'object' && 'value' in r && ('ok' in r || 'lastErrorObject' in r) ? r.value : r);

/** Inventario de escrituras (docs/munierp/15): operación → colección, método y si va en transacción. */
const WRITE_INVENTORY = Object.freeze([
  { op: 'insertDependency', collection: 'dependencies', method: 'insertOne', transaction: 'sí (con bitácora)' },
  { op: 'updateDependency', collection: 'dependencies', method: 'findOneAndUpdate $set', transaction: 'sí (con bitácora)' },
  { op: 'insertMembership', collection: 'memberships', method: 'insertOne', transaction: 'sí (con bitácora)' },
  { op: 'updateMembership', collection: 'memberships', method: 'findOneAndUpdate $set + versión', transaction: 'sí (con bitácora); incluye revocación' },
  { op: 'insertCitizen', collection: 'citizens', method: 'insertOne', transaction: 'sí (con bitácora)' },
  { op: 'nextSequence', collection: 'counters', method: 'findOneAndUpdate $inc upsert', transaction: 'sí (alta de expediente)' },
  { op: 'insertRequest', collection: 'requests', method: 'insertOne', transaction: 'sí (folio + bitácora)' },
  { op: 'updateRequest', collection: 'requests', method: 'findOneAndUpdate $set + $push historial + versión', transaction: 'sí (con bitácora)' },
  { op: 'insertDocument', collection: 'documents', method: 'insertOne (PENDIENTE)', transaction: 'no (antes del binario)' },
  { op: 'updateDocumentStatus', collection: 'documents', method: 'findOneAndUpdate $set status', transaction: 'sí (VIGENTE + bitácora)' },
  { op: 'addGrant', collection: 'grants', method: 'insertOne', transaction: 'sí (con bitácora)' },
  { op: 'revokeGrant', collection: 'grants', method: 'updateOne $set revokedAt (si null)', transaction: 'sí (con bitácora)' },
  { op: 'appendAudit', collection: 'audit_events', method: 'insertOne', transaction: 'en la transacción de la escritura auditada; suelta para ACCESS_DENIED y descargas' },
  { op: 'storage.put', collection: 'files.files / files.chunks', method: 'GridFS openUploadStream', transaction: 'no (GridFS fuera de transacciones)' },
]);

/**
 * @param {{ db: { collection: (name: string) => any }, runTransaction: (fn: (session: any) => Promise<any>) => Promise<any>,
 *   prefix?: string, newId?: () => string, clock?: () => Date }} deps
 */
function createMongoStore({ db, runTransaction, prefix = 'municipal_', newId = () => crypto.randomBytes(12).toString('hex'), clock = () => new Date() }) {
  if (!db || typeof db.collection !== 'function') throw new TypeError('Se requiere un db con collection()');
  if (typeof runTransaction !== 'function') throw new TypeError('Se requiere runTransaction(fn)');
  const names = collectionNames(prefix);
  const col = (logical) => db.collection(names[logical]);

  function bind(session) {
    const inTransaction = !!session;
    const opt = (extra = {}) => (session ? { ...extra, session } : extra);
    /** Valida antes de tocar el controlador; traduce errores después. */
    const run = async (fn) => {
      try {
        return await fn();
      } catch (e) {
        throw mapMongoError(e, { inTransaction });
      }
    };
    const findMany = (logical, filter, sort) => {
      const cursor = col(logical).find(filter, opt());
      return (sort ? cursor.sort(sort) : cursor).toArray();
    };

    const repo = {
      newId,
      transaction: inTransaction ? (fn) => fn(repo) : undefined,

      municipalityById: (id) => run(async () => fromDb(await col('municipalities').findOne({ _id: id }, opt()))),
      municipalityByCode: (code) => run(async () => fromDb(await col('municipalities').findOne({ code }, opt()))),

      dependencies: (municipalityId) => run(async () => {
        requireMunicipalityId(municipalityId);
        return (await findMany('dependencies', { municipalityId })).map(fromDb);
      }),
      insertDependency: (doc) => run(async () => {
        requireMunicipalityId(doc && doc.municipalityId);
        await col('dependencies').insertOne(toDb(doc), opt());
        return structuredClone(doc);
      }),
      updateDependency: (municipalityId, id, patch) => run(async () => {
        requireMunicipalityId(municipalityId);
        const r = unwrap(await col('dependencies').findOneAndUpdate({ _id: id, municipalityId }, { $set: withoutIdentity(patch) }, opt({ returnDocument: 'after' })));
        if (!r) throw fail('NOT_FOUND', 'Dependencia inexistente');
        return fromDb(r);
      }),

      membership: (municipalityId, id) => run(async () => {
        requireMunicipalityId(municipalityId);
        return fromDb(await col('memberships').findOne({ _id: id, municipalityId }, opt()));
      }),
      membershipsOf: (userId) => run(async () => (await findMany('memberships', { userId })).map(fromDb)),
      membershipsIn: (municipalityId) => run(async () => {
        requireMunicipalityId(municipalityId);
        return (await findMany('memberships', { municipalityId })).map(fromDb);
      }),
      insertMembership: (doc) => run(async () => {
        requireMunicipalityId(doc && doc.municipalityId);
        await col('memberships').insertOne(toDb(doc), opt());
        return structuredClone(doc);
      }),
      updateMembership: (municipalityId, id, expectedVersion, patch) => run(async () => {
        requireMunicipalityId(municipalityId);
        const version = expectedVersion === 0 ? { $or: [{ version: 0 }, { version: { $exists: false } }] } : { version: expectedVersion };
        const r = unwrap(await col('memberships').findOneAndUpdate(
          { _id: id, municipalityId, ...version },
          { $set: { ...withoutIdentity(patch), version: expectedVersion + 1 } },
          opt({ returnDocument: 'after' }),
        ));
        if (!r) throw fail('STALE_VERSION', 'Versión obsoleta');
        return fromDb(r);
      }),

      citizens: (municipalityId) => run(async () => {
        requireMunicipalityId(municipalityId);
        return (await findMany('citizens', { municipalityId })).map(fromDb);
      }),
      citizen: (municipalityId, id) => run(async () => {
        requireMunicipalityId(municipalityId);
        return fromDb(await col('citizens').findOne({ _id: id, municipalityId }, opt()));
      }),
      insertCitizen: (doc) => run(async () => {
        requireMunicipalityId(doc && doc.municipalityId);
        await col('citizens').insertOne(toDb(doc), opt());
        return structuredClone(doc);
      }),

      nextSequence: (key) => run(async () => {
        if (!/^[A-Z0-9]{2,10}:[A-Z0-9]{2,10}:[A-Z0-9]{2,10}:\d{4}$/.test(String(key))) throw fail('INVALID_COUNTER_KEY', 'Clave de contador inválida');
        const r = unwrap(await col('counters').findOneAndUpdate(
          { _id: key },
          { $inc: { seq: 1 }, $set: { updatedAt: clock() } },
          opt({ upsert: true, returnDocument: 'after' }),
        ));
        return r.seq;
      }),

      insertRequest: (doc) => run(async () => {
        requireMunicipalityId(doc && doc.municipalityId);
        await col('requests').insertOne(toDb(doc), opt());
        return structuredClone(doc);
      }),
      requestByIdempotency: (municipalityId, createdBy, key) => run(async () => {
        requireMunicipalityId(municipalityId);
        return fromDb(await col('requests').findOne({ municipalityId, createdBy, idempotencyKey: key }, opt()));
      }),
      findRequests: (filter) => run(async () => {
        if (!hasMunicipalityScope(filter)) throw fail('MISSING_MUNICIPALITY', 'Consulta de expedientes sin municipio');
        return (await findMany('requests', filter)).map(fromDb);
      }),
      existsByFolio: (municipalityId, folio) => run(async () => {
        requireMunicipalityId(municipalityId);
        return (await col('requests').countDocuments({ municipalityId, folio }, opt({ limit: 1 }))) > 0;
      }),
      /**
       * Compara y sustituye por versión. El servicio envía el historial completo; aquí se verifica que el
       * prefijo coincide con lo guardado y solo se añaden (`$push`) las entradas nuevas.
       */
      updateRequest: (municipalityId, id, expectedVersion, patch) => run(async () => {
        requireMunicipalityId(municipalityId);
        const filter = { _id: id, municipalityId, version: expectedVersion };
        const current = await col('requests').findOne(filter, opt());
        if (!current) throw fail('STALE_VERSION', 'Versión obsoleta');
        const old = current.history || [];
        const next = patch && patch.history;
        if (!Array.isArray(next) || next.length < old.length || JSON.stringify(next.slice(0, old.length)) !== JSON.stringify(old))
          throw fail('HISTORY_REWRITE', 'El historial solo admite añadir entradas');
        const { history, ...rest } = withoutIdentity(patch);
        const update = { $set: rest };
        const added = next.slice(old.length);
        if (added.length) update.$push = { history: { $each: added } };
        const r = unwrap(await col('requests').findOneAndUpdate(filter, update, opt({ returnDocument: 'after' })));
        if (!r) throw fail('STALE_VERSION', 'Versión obsoleta');
        return fromDb(r);
      }),

      insertDocument: (doc) => run(async () => {
        requireMunicipalityId(doc && doc.municipalityId);
        await col('documents').insertOne(toDb(doc), opt());
        return structuredClone(doc);
      }),
      updateDocumentStatus: (municipalityId, id, status) => run(async () => {
        requireMunicipalityId(municipalityId);
        const r = unwrap(await col('documents').findOneAndUpdate({ _id: id, municipalityId }, { $set: { status } }, opt({ returnDocument: 'after' })));
        if (!r) throw fail('NOT_FOUND', 'Documento inexistente');
        return fromDb(r);
      }),
      documentsOf: (municipalityId, requestId) => run(async () => {
        requireMunicipalityId(municipalityId);
        return (await findMany('documents', { municipalityId, requestId }, { uploadedAt: 1 })).map(fromDb);
      }),
      /** Solo lectura: documentos PENDIENTE anteriores a `before`, para conciliación manual (sin borrado). */
      pendingDocuments: (municipalityId, before) => run(async () => {
        requireMunicipalityId(municipalityId);
        return (await findMany('documents', { municipalityId, status: 'PENDIENTE', uploadedAt: { $lt: before } }, { uploadedAt: 1 })).map(fromDb);
      }),

      addGrant: (g) => run(async () => {
        requireMunicipalityId(g && g.municipalityId);
        await col('grants').insertOne(toDb(g), opt());
        return structuredClone(g);
      }),
      grant: (municipalityId, id) => run(async () => {
        requireMunicipalityId(municipalityId);
        return fromDb(await col('grants').findOne({ _id: id, municipalityId }, opt()));
      }),
      revokeGrant: (municipalityId, id, at) => run(async () => {
        requireMunicipalityId(municipalityId);
        const r = await col('grants').updateOne({ _id: id, municipalityId, revokedAt: null }, { $set: { revokedAt: at } }, opt());
        return r.modifiedCount === 1;
      }),
      grantsFor: (municipalityId) => run(async () => {
        requireMunicipalityId(municipalityId);
        return (await findMany('grants', { municipalityId })).map(fromDb);
      }),

      appendAudit: (event) => run(async () => {
        requireMunicipalityId(event && event.municipalityId);
        await col('audit').insertOne({ _id: newId(), ...event }, opt());
      }),
      auditEvents: (municipalityId) => run(async () => {
        requireMunicipalityId(municipalityId);
        return (await findMany('audit', { municipalityId }, { at: 1, _id: 1 })).map(auditFromDb);
      }),
    };
    return repo;
  }

  const store = bind(null);
  store.transaction = async (fn) => {
    try {
      return await runTransaction((session) => fn(bind(session)));
    } catch (e) {
      throw mapMongoError(e, { inTransaction: false });
    }
  };
  return store;
}

module.exports = { createMongoStore, WRITE_INVENTORY, toDb, fromDb };
