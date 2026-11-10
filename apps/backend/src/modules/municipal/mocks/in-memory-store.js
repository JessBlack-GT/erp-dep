// @ts-check
'use strict';
/**
 * Almacén municipal EN MEMORIA que implementa el puerto asíncrono de persistencia
 * (persistence/repository-port.js). F1-05 paso 1: el servicio ya no depende de que el almacén sea
 * síncrono, de modo que el adaptador MongoDB (diseño en docs/munierp/12) podrá sustituirlo sin
 * cambiar la capa de aplicación.
 *
 * Semántica que replica (y que la suite de contrato verifica contra cualquier implementación):
 *  - Todas las operaciones del puerto devuelven promesas; `newId()` es síncrono (como `new ObjectId()`).
 *  - `transaction(fn)` llama a `fn(tx)` con un repositorio ligado a la transacción. Se trabaja sobre una
 *    copia del estado confirmado; al terminar sin error se confirma, con error se descarta (todo o nada).
 *    Las lecturas fuera de la transacción ven solo el estado confirmado.
 *  - Las transacciones y las escrituras sueltas se SERIALIZAN (cola). Esto evita pérdidas de
 *    actualizaciones en memoria, pero NO equivale al aislamiento por instantáneas, a los reintentos de
 *    `TransientTransactionError` ni a los índices únicos de MongoDB: eso solo se certifica contra Mongo.
 *  - Toda operación sobre datos municipales exige el municipio (`MISSING_MUNICIPALITY`), también las
 *    lecturas y escrituras por id (puerto v2, F1-05 paso 3). Excepciones documentadas en el puerto.
 *  - Los objetos devueltos son copias: mutarlos no altera el almacén.
 *
 * `store.testing` (síncrono) es SOLO para pruebas: inspección del estado confirmado e inyección de
 * fallos. No forma parte del puerto y el adaptador Mongo no lo implementará.
 */
const { matches } = require('./filter-match');
const { hasMunicipalityScope } = require('../persistence/scope');

const clone = (v) => (v === undefined ? undefined : structuredClone(v));
const fail = (code, message) => Object.assign(new Error(message), { code });

function requireMunicipalityId(municipalityId) {
  if (typeof municipalityId !== 'string' || !municipalityId) throw fail('MISSING_MUNICIPALITY', 'municipalityId obligatorio');
}


function initialState(seed) {
  return {
    municipalities: clone(seed.municipalities || []),
    dependencies: clone(seed.dependencies || []),
    citizens: clone(seed.citizens || []),
    requests: [],
    documents: [],
    grants: clone(seed.grants || []),
    memberships: clone(seed.memberships || []),
    counters: {},
    audit: [],
  };
}

/**
 * @param {{ municipalities?: any[], dependencies?: any[], citizens?: any[], memberships?: any[], grants?: any[] }} [seed]
 */
function createMemoryStore(seed = {}) {
  let committed = initialState(seed);
  let seq = 0x900;
  const newId = () => (seq++).toString(16).padStart(24, '0');
  /** Fallos inyectados por nombre de operación (solo pruebas). */
  const faults = new Map();
  let queue = Promise.resolve();

  /** Ejecuta `fn` en exclusiva respecto a otras transacciones y escrituras sueltas. */
  function exclusive(fn) {
    const run = queue.then(fn, fn);
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  function injected(op) {
    const f = faults.get(op);
    if (!f) return;
    faults.delete(op);
    throw f;
  }

  /**
   * Operaciones del puerto sobre un estado. `write(fn)` decide cómo se aplica una escritura:
   * dentro de una transacción, directamente; fuera, en exclusiva sobre el estado confirmado.
   */
  function bind(getState, write, transaction) {
    const read = async (fn) => fn(getState());
    return {
      newId,
      transaction,

      municipalityById: (id) => read((s) => clone(s.municipalities.find((m) => m.id === id) || null)),
      municipalityByCode: (code) => read((s) => clone(s.municipalities.find((m) => m.code === code) || null)),

      dependencies: (municipalityId) => read((s) => {
        requireMunicipalityId(municipalityId);
        return s.dependencies.filter((d) => d.municipalityId === municipalityId).map(clone);
      }),
      insertDependency: (doc) => write((s) => {
        injected('insertDependency');
        requireMunicipalityId(doc.municipalityId);
        if (s.dependencies.some((d) => d.municipalityId === doc.municipalityId && d.code === doc.code))
          throw fail('DUPLICATE_DEPENDENCY', 'Dependencia duplicada');
        s.dependencies.push(clone(doc));
        return clone(doc);
      }),
      updateDependency: (municipalityId, id, patch) => write((s) => {
        injected('updateDependency');
        requireMunicipalityId(municipalityId);
        const i = s.dependencies.findIndex((d) => d.id === id && d.municipalityId === municipalityId);
        if (i < 0) throw fail('NOT_FOUND', 'Dependencia inexistente');
        s.dependencies[i] = { ...s.dependencies[i], ...clone(patch), id: s.dependencies[i].id, municipalityId: s.dependencies[i].municipalityId };
        return clone(s.dependencies[i]);
      }),

      membership: (municipalityId, id) => read((s) => {
        requireMunicipalityId(municipalityId);
        return clone(s.memberships.find((m) => m.id === id && m.municipalityId === municipalityId) || null);
      }),
      membershipsOf: (userId) => read((s) => s.memberships.filter((m) => m.userId === userId).map(clone)),
      membershipsIn: (municipalityId) => read((s) => {
        requireMunicipalityId(municipalityId);
        return s.memberships.filter((m) => m.municipalityId === municipalityId).map(clone);
      }),
      insertMembership: (doc) => write((s) => {
        injected('insertMembership');
        requireMunicipalityId(doc.municipalityId);
        if (s.memberships.some((m) => m.userId === doc.userId && m.municipalityId === doc.municipalityId))
          throw fail('DUPLICATE_MEMBERSHIP', 'Membresía duplicada');
        s.memberships.push(clone(doc));
        return clone(doc);
      }),
      updateMembership: (municipalityId, id, expectedVersion, patch) => write((s) => {
        injected('updateMembership');
        requireMunicipalityId(municipalityId);
        const i = s.memberships.findIndex((m) => m.id === id && m.municipalityId === municipalityId && (m.version || 0) === expectedVersion);
        if (i < 0) throw fail('STALE_VERSION', 'Versión obsoleta');
        const prev = s.memberships[i];
        s.memberships[i] = { ...prev, ...clone(patch), id: prev.id, userId: prev.userId, municipalityId: prev.municipalityId, version: expectedVersion + 1 };
        return clone(s.memberships[i]);
      }),

      citizens: (municipalityId) => read((s) => {
        requireMunicipalityId(municipalityId);
        return s.citizens.filter((c) => c.municipalityId === municipalityId).map(clone);
      }),
      citizen: (municipalityId, id) => read((s) => {
        requireMunicipalityId(municipalityId);
        return clone(s.citizens.find((c) => c.id === id && c.municipalityId === municipalityId) || null);
      }),
      insertCitizen: (doc) => write((s) => {
        injected('insertCitizen');
        requireMunicipalityId(doc.municipalityId);
        s.citizens.push(clone(doc));
        return clone(doc);
      }),

      nextSequence: (key) => write((s) => {
        injected('nextSequence');
        s.counters[key] = (s.counters[key] || 0) + 1;
        return s.counters[key];
      }),

      insertRequest: (doc) => write((s) => {
        injected('insertRequest');
        requireMunicipalityId(doc.municipalityId);
        if (s.requests.some((r) => r.municipalityId === doc.municipalityId && r.folio === doc.folio))
          throw fail('DUPLICATE_FOLIO', 'Folio duplicado');
        if (doc.idempotencyKey && s.requests.some((r) => r.municipalityId === doc.municipalityId && r.createdBy === doc.createdBy && r.idempotencyKey === doc.idempotencyKey))
          throw fail('DUPLICATE_IDEMPOTENCY', 'Clave de idempotencia duplicada');
        s.requests.push(clone(doc));
        return clone(doc);
      }),
      /** Idempotencia por municipio y usuario (la misma clave en otro municipio es otra solicitud). */
      requestByIdempotency: (municipalityId, createdBy, key) => read((s) => {
        requireMunicipalityId(municipalityId);
        return clone(s.requests.find((r) => r.municipalityId === municipalityId && r.createdBy === createdBy && r.idempotencyKey === key) || null);
      }),
      findRequests: (filter) => read((s) => {
        if (!hasMunicipalityScope(filter)) throw fail('MISSING_MUNICIPALITY', 'Consulta de expedientes sin municipio');
        return s.requests.filter((r) => matches(r, filter)).map(clone);
      }),
      /** Busca SIN filtro de alcance; solo para registrar denegaciones (nunca se devuelve al cliente). */
      existsByFolio: (municipalityId, folio) => read((s) => {
        requireMunicipalityId(municipalityId);
        return s.requests.some((r) => r.municipalityId === municipalityId && r.folio === folio);
      }),
      /** Compara y sustituye por versión. El `patch` trae la versión nueva y el historial completo. */
      updateRequest: (municipalityId, id, expectedVersion, patch) => write((s) => {
        injected('updateRequest');
        requireMunicipalityId(municipalityId);
        const i = s.requests.findIndex((r) => r.id === id && r.municipalityId === municipalityId && r.version === expectedVersion);
        if (i < 0) throw fail('STALE_VERSION', 'Versión obsoleta');
        const prev = s.requests[i];
        const next = { ...prev, ...clone(patch), id: prev.id, municipalityId: prev.municipalityId, folio: prev.folio, createdAt: prev.createdAt, createdBy: prev.createdBy };
        const oldHistory = prev.history || [];
        if (!Array.isArray(next.history) || next.history.length < oldHistory.length ||
            JSON.stringify(next.history.slice(0, oldHistory.length)) !== JSON.stringify(oldHistory))
          throw fail('HISTORY_REWRITE', 'El historial solo admite añadir entradas');
        s.requests[i] = next;
        return clone(next);
      }),

      insertDocument: (doc) => write((s) => {
        injected('insertDocument');
        requireMunicipalityId(doc.municipalityId);
        if (s.documents.some((d) => d.storageKey === doc.storageKey)) throw fail('DUPLICATE_STORAGE_KEY', 'Clave de almacenamiento duplicada');
        s.documents.push(clone(doc));
        return clone(doc);
      }),
      updateDocumentStatus: (municipalityId, id, status) => write((s) => {
        injected('updateDocumentStatus');
        requireMunicipalityId(municipalityId);
        const d = s.documents.find((x) => x.id === id && x.municipalityId === municipalityId);
        if (!d) throw fail('NOT_FOUND', 'Documento inexistente');
        d.status = status;
        return clone(d);
      }),
      /** Solo lectura: documentos PENDIENTE anteriores a `before`, para conciliación manual (sin borrado). */
      pendingDocuments: (municipalityId, before) => read((s) => {
        requireMunicipalityId(municipalityId);
        return s.documents.filter((d) => d.municipalityId === municipalityId && d.status === 'PENDIENTE' && d.uploadedAt < before).map(clone);
      }),
      documentsOf: (municipalityId, requestId) => read((s) => {
        requireMunicipalityId(municipalityId);
        return s.documents.filter((d) => d.municipalityId === municipalityId && d.requestId === requestId).map(clone);
      }),

      addGrant: (g) => write((s) => {
        injected('addGrant');
        requireMunicipalityId(g.municipalityId);
        s.grants.push(clone(g));
        return clone(g);
      }),
      grant: (municipalityId, id) => read((s) => {
        requireMunicipalityId(municipalityId);
        return clone(s.grants.find((g) => g.id === id && g.municipalityId === municipalityId) || null);
      }),
      revokeGrant: (municipalityId, id, at) => write((s) => {
        injected('revokeGrant');
        requireMunicipalityId(municipalityId);
        const g = s.grants.find((x) => x.id === id && x.municipalityId === municipalityId);
        if (!g || g.revokedAt) return false;
        g.revokedAt = clone(at);
        return true;
      }),
      grantsFor: (municipalityId) => read((s) => {
        requireMunicipalityId(municipalityId);
        return s.grants.filter((g) => g.municipalityId === municipalityId).map(clone);
      }),

      /** Bitácora de solo inserción. */
      appendAudit: (event) => write((s) => {
        injected('appendAudit');
        requireMunicipalityId(event.municipalityId);
        s.audit.push(Object.freeze(clone(event)));
      }),
      auditEvents: (municipalityId) => read((s) => {
        requireMunicipalityId(municipalityId);
        return s.audit.filter((e) => e.municipalityId === municipalityId).map(clone);
      }),
    };
  }

  async function transaction(fn) {
    return exclusive(async () => {
      const draft = { state: clone(committed) };
      /** @type {any} */
      let tx;
      tx = bind(() => draft.state, async (op) => op(draft.state), (inner) => inner(tx));
      const result = await fn(tx);
      committed = draft.state;
      return result;
    });
  }

  const store = bind(() => committed, (op) => exclusive(async () => op(committed)), transaction);

  /** SOLO PRUEBAS (síncrono, estado confirmado). No es parte del puerto. */
  store.testing = {
    allRequests: () => committed.requests.map(clone),
    auditEvents: () => committed.audit.map(clone),
    counter: (key) => committed.counters[key] || 0,
    grantsFor: (municipalityId) => committed.grants.filter((g) => g.municipalityId === municipalityId).map(clone),
    memberships: () => committed.memberships.map(clone),
    documents: () => committed.documents.map(clone),
    /** Retrocede un contador para simular una colisión de folio. */
    setCounterForTest(key, value) { committed.counters[key] = value; },
    /** Hace fallar la siguiente llamada a `op` (p. ej. 'insertRequest', 'appendAudit'). */
    failNext(op, error = new Error('Fallo simulado de escritura')) { faults.set(op, error); },
    failNextRequestInsert() { faults.set('insertRequest', new Error('Fallo simulado de escritura')); },
    addGrant(g) { committed.grants.push(clone(g)); },
    revokeGrant(id, at) { const g = committed.grants.find((x) => x.id === id); if (g) g.revokedAt = clone(at); },
    insertMembership(doc) { committed.memberships.push(clone(doc)); },
  };
  return store;
}

module.exports = { createMemoryStore, hasMunicipalityScope };
