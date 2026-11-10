'use strict';
/**
 * DOBLE del controlador de MongoDB para probar el adaptador SIN base de datos. Imita la API que usa
 * persistence/mongo (findOne, find().sort().limit().toArray(), insertOne, updateOne, findOneAndUpdate,
 * countDocuments, sesiones con withTransaction, GridFSBucket) y aplica los índices únicos declarados en
 * persistence/mongo/collections.js.
 *
 * NO es MongoDB: las transacciones son instantáneas en memoria con detección de conflictos al confirmar
 * (error con etiqueta TransientTransactionError y reintento, como hace el controlador), no hay
 * readConcern/writeConcern, validadores, réplica ni GridFS real. Sirve para verificar la LÓGICA del
 * adaptador (filtros, actualizaciones, traducción de errores), nunca para certificar MongoDB.
 */
const { Readable, Writable } = require('stream');
const { collectionNames, INDEXES } = require('../../../src/modules/municipal/persistence/mongo/collections');

const clone = (v) => (v === undefined ? undefined : structuredClone(v));
const cmp = (a, b) => (a instanceof Date ? a.getTime() : a) - (b instanceof Date ? b.getTime() : b);
const eq = (a, b) => (a instanceof Date || b instanceof Date ? a instanceof Date && b instanceof Date && a.getTime() === b.getTime() : a === b);

function valueMatches(actual, cond) {
  if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
    return Object.entries(cond).every(([op, v]) => {
      switch (op) {
        case '$in': return Array.isArray(actual) ? actual.some((a) => v.some((x) => eq(a, x))) : v.some((x) => eq(actual === undefined ? null : actual, x));
        case '$ne': return Array.isArray(actual) ? !actual.some((a) => eq(a, v)) : !eq(actual === undefined ? null : actual, v);
        case '$exists': return v ? actual !== undefined : actual === undefined;
        case '$lt': return actual !== undefined && actual !== null && cmp(actual, v) < 0;
        case '$lte': return actual !== undefined && actual !== null && cmp(actual, v) <= 0;
        case '$gt': return actual !== undefined && actual !== null && cmp(actual, v) > 0;
        case '$gte': return actual !== undefined && actual !== null && cmp(actual, v) >= 0;
        case '$type': if (v === 'string') return typeof actual === 'string'; throw new Error('$type no soportado: ' + v);
        default: throw new Error('Operador no soportado por el doble: ' + op);
      }
    });
  }
  if (cond === null) return actual === null || actual === undefined;
  if (Array.isArray(actual)) return actual.some((a) => eq(a, cond));
  return eq(actual, cond);
}
function matches(doc, filter) {
  return Object.entries(filter || {}).every(([k, c]) => {
    if (k === '$and') return c.every((f) => matches(doc, f));
    if (k === '$or') return c.some((f) => matches(doc, f));
    if (k.startsWith('$')) throw new Error('Operador no soportado por el doble: ' + k);
    return valueMatches(doc[k], c);
  });
}
function applyUpdate(doc, update) {
  for (const [op, fields] of Object.entries(update)) {
    for (const [k, v] of Object.entries(fields)) {
      if (op === '$set') doc[k] = clone(v);
      else if (op === '$inc') doc[k] = (doc[k] || 0) + v;
      else if (op === '$push') doc[k] = [...(doc[k] || []), ...(v && v.$each ? clone(v.$each) : [clone(v)])];
      else throw new Error('Operador de actualización no soportado por el doble: ' + op);
    }
  }
  return doc;
}
const labelled = (message, labels, code) => {
  const e = Object.assign(new Error(message), { name: 'MongoServerError', code, errorLabels: labels });
  e.hasErrorLabel = (l) => labels.includes(l);
  return e;
};

/**
 * @param {{ prefix?: string, resultShape?: 'v5'|'v6', maxRetries?: number, databaseName?: string }} [options]
 */
function createFakeMongo({ prefix = 'municipal_', resultShape = 'v6', maxRetries = 500, databaseName = 'munierp_qa' } = {}) {
  const names = collectionNames(prefix);
  const logicalOf = Object.fromEntries(Object.entries(names).map(([k, v]) => [v, k]));
  /** colección → Map(_id → { doc, rev }) */
  let committed = {};
  let rev = 0;
  const calls = [];
  const faults = [];
  const stats = { transactions: 0, retries: 0, conflicts: 0 };

  const coll = (state, name) => (state[name] = state[name] || new Map());
  const uniqueIndexes = (name) => (INDEXES[logicalOf[name]] || []).filter((i) => i.unique && !i.on);
  function checkUnique(state, name, candidate) {
    const map = coll(state, name);
    for (const ix of uniqueIndexes(name)) {
      if (ix.partialFilterExpression && !matches(candidate, ix.partialFilterExpression)) continue;
      const fields = Object.keys(ix.key);
      const key = JSON.stringify(fields.map((f) => (candidate[f] === undefined ? null : candidate[f])));
      for (const [id, entry] of map) {
        if (id === candidate._id) continue;
        if (ix.partialFilterExpression && !matches(entry.doc, ix.partialFilterExpression)) continue;
        if (JSON.stringify(fields.map((f) => (entry.doc[f] === undefined ? null : entry.doc[f]))) === key) throw dup(name, ix.name, ix.key);
      }
    }
  }
  const dup = (name, index, keyPattern) => Object.assign(new Error(`E11000 duplicate key error collection: ${databaseName}.${name} index: ${index} dup key`), { name: 'MongoServerError', code: 11000, keyPattern });

  function takeFault(op, collection) {
    const i = faults.findIndex((f) => f.op === op && (!f.collection || f.collection === collection));
    if (i < 0) return;
    const f = faults[i];
    if (--f.times <= 0) faults.splice(i, 1);
    throw typeof f.error === 'function' ? f.error() : f.error;
  }

  function collection(name) {
    const view = (session) => (session && session.__tx ? session.__tx.state : committed);
    const touch = (session, id) => {
      if (session && session.__tx && !session.__tx.touched.has(name + '\u0000' + id)) {
        const base = coll(committed, name).get(id);
        session.__tx.touched.set(name + '\u0000' + id, { name, id, rev: base ? base.rev : null });
      }
    };
    const write = (session, id, doc) => {
      const state = view(session);
      const map = coll(state, name);
      const next = { doc, rev: ++rev };
      touch(session, id);
      const prev = map.get(id);
      map.set(id, next);
      try { checkUnique(state, name, doc); } catch (e) { if (prev) map.set(id, prev); else map.delete(id); throw e; }
    };
    const record = (op, args) => calls.push({ op, collection: name, ...args });
    const findIn = (session, filter) => [...coll(view(session), name).values()].map((e) => e.doc).filter((d) => matches(d, filter));

    return {
      collectionName: name,
      async findOne(filter, opts = {}) {
        record('findOne', { filter, session: !!opts.session });
        takeFault('findOne', name);
        const d = findIn(opts.session, filter)[0];
        return d ? clone(d) : null;
      },
      find(filter, opts = {}) {
        record('find', { filter, session: !!opts.session });
        let sortSpec = null;
        let lim = 0;
        const cursor = {
          sort(spec) { sortSpec = spec; return cursor; },
          limit(n) { lim = n; return cursor; },
          async toArray() {
            takeFault('find', name);
            let rows = findIn(opts.session, filter).map(clone);
            if (sortSpec) rows.sort((a, b) => { for (const [k, dir] of Object.entries(sortSpec)) { const c = cmp(a[k] ?? 0, b[k] ?? 0) || String(a[k]).localeCompare(String(b[k])); if (c) return c * dir; } return 0; });
            return lim ? rows.slice(0, lim) : rows;
          },
        };
        return cursor;
      },
      async countDocuments(filter, opts = {}) {
        record('countDocuments', { filter, session: !!opts.session });
        takeFault('countDocuments', name);
        const n = findIn(opts.session, filter).length;
        return opts.limit ? Math.min(n, opts.limit) : n;
      },
      async insertOne(doc, opts = {}) {
        record('insertOne', { doc: clone(doc), session: !!opts.session });
        takeFault('insertOne', name);
        if (coll(view(opts.session), name).has(doc._id)) throw dup(name, '_id_', { _id: 1 });
        write(opts.session, doc._id, clone(doc));
        return { acknowledged: true, insertedId: doc._id };
      },
      async updateOne(filter, update, opts = {}) {
        record('updateOne', { filter, update: clone(update), session: !!opts.session });
        takeFault('updateOne', name);
        const d = findIn(opts.session, filter)[0];
        if (!d) return { matchedCount: 0, modifiedCount: 0 };
        write(opts.session, d._id, applyUpdate(clone(d), update));
        return { matchedCount: 1, modifiedCount: 1 };
      },
      async findOneAndUpdate(filter, update, opts = {}) {
        record('findOneAndUpdate', { filter, update: clone(update), session: !!opts.session, upsert: !!opts.upsert });
        takeFault('findOneAndUpdate', name);
        let d = findIn(opts.session, filter)[0];
        let before = d ? clone(d) : null;
        if (!d) {
          if (!opts.upsert) return resultShape === 'v5' ? { value: null, ok: 1 } : null;
          d = Object.fromEntries(Object.entries(filter).filter(([, v]) => v === null || typeof v !== 'object'));
          before = null;
        }
        const after = applyUpdate(clone(d), update);
        write(opts.session, after._id, after);
        const out = opts.returnDocument === 'after' ? clone(after) : before;
        return resultShape === 'v5' ? { value: out, ok: 1, lastErrorObject: {} } : out;
      },
    };
  }

  function commit(tx) {
    for (const t of tx.touched.values()) {
      const current = coll(committed, t.name).get(t.id);
      if ((current ? current.rev : null) !== t.rev) {
        stats.conflicts += 1;
        throw labelled('WriteConflict (doble)', ['TransientTransactionError'], 112);
      }
    }
    const next = { ...committed };
    for (const t of tx.touched.values()) {
      next[t.name] = new Map(next[t.name] || []);
      const v = tx.state[t.name] && tx.state[t.name].get(t.id);
      if (v) next[t.name].set(t.id, v); else next[t.name].delete(t.id);
    }
    for (const t of tx.touched.values()) { const v = next[t.name].get(t.id); if (v) checkUnique(next, t.name, v.doc); }
    committed = next;
  }

  const client = {
    db: (name) => (name === databaseName ? db : { ...db, databaseName: name }),
    startSession() {
      const session = {
        __tx: null,
        ended: false,
        async withTransaction(cb, options) {
          session.lastOptions = options;
          stats.transactions += 1;
          for (let attempt = 0; ; attempt += 1) {
            const state = Object.fromEntries(Object.entries(committed).map(([k, m]) => [k, new Map(m)]));
            session.__tx = { state, touched: new Map() };
            try {
              await cb(session);
              takeFault('commitTransaction');
              commit(session.__tx);
              session.__tx = null;
              return { ok: 1 };
            } catch (e) {
              session.__tx = null;
              const transient = e && typeof e.hasErrorLabel === 'function' && (e.hasErrorLabel('TransientTransactionError') || e.hasErrorLabel('UnknownTransactionCommitResult'));
              if (transient && attempt < maxRetries) { stats.retries += 1; await new Promise((r) => setImmediate(r)); continue; }
              throw e;
            }
          }
        },
        async endSession() { session.ended = true; },
      };
      sessions.push(session);
      return session;
    },
  };
  const sessions = [];

  const db = {
    databaseName,
    collection: (name) => collection(name),
    listCollections: () => ({ toArray: async () => Object.keys(committed).map((name) => ({ name })) }),
  };

  const files = new Map();
  let fileSeq = 0;
  const bucket = {
    find(filter) {
      let lim = 0;
      const c = { limit(n) { lim = n; return c; }, async toArray() { takeFault('bucket.find'); const rows = [...files.values()].filter((f) => f.filename === filter.filename).map(({ data, ...meta }) => ({ ...meta })); return lim ? rows.slice(0, lim) : rows; } };
      return c;
    },
    openUploadStream(filename, options) {
      const chunks = [];
      const w = new Writable({
        write(chunk, enc, cb) { chunks.push(Buffer.from(chunk)); cb(); },
        final(cb) {
          try { takeFault('bucket.upload'); } catch (e) { return cb(e); }
          if ([...files.values()].some((f) => f.filename === filename)) return cb(dup(`${prefix}files.files`, 'uniq_file_storage_key', { filename: 1 }));
          const _id = `file${++fileSeq}`;
          files.set(_id, { _id, filename, metadata: options && options.metadata, length: Buffer.concat(chunks).length, data: Buffer.concat(chunks) });
          cb();
        },
      });
      return w;
    },
    openDownloadStream(id) { const f = files.get(id); return Readable.from(f ? [f.data] : []); },
  };

  return {
    client, db, bucket, calls, stats, sessions,
    /** Siembra directa (sin pasar por el adaptador) con `_id` = id. */
    seed(logical, docs) { const m = coll(committed, names[logical]); for (const d of docs) { const { id, ...rest } = d; m.set(id, { doc: { _id: id, ...clone(rest) }, rev: ++rev }); } },
    /** Siguiente llamada `op` (sobre `collection` si se indica) lanza `error`, `times` veces. */
    failNext(op, error, { collection: c, times = 1 } = {}) { faults.push({ op, error, collection: c ? names[c] || c : null, times }); },
    raw: (logical) => [...coll(committed, names[logical]).values()].map((e) => clone(e.doc)),
    files,
    labelled,
  };
}

module.exports = { createFakeMongo, labelled };
