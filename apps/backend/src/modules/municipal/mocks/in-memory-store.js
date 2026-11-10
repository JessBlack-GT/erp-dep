// @ts-check
'use strict';
/**
 * Almacén en memoria con la misma interfaz que tendrá el repositorio Mongo (pendiente).
 * transaction() aplica todo o nada (copia y restauración), para probar rollback de folios (MT-32).
 */
const { matches } = require('./filter-match');

function createMemoryStore(seed = {}) {
  let state = {
    municipalities: [...(seed.municipalities || [])],
    dependencies: [...(seed.dependencies || [])],
    citizens: [...(seed.citizens || [])],
    requests: [],
    documents: [],
    grants: [...(seed.grants || [])],
    memberships: [...(seed.memberships || [])],
    counters: {},
    audit: [],
  };
  let seq = 0x900;
  const newId = () => (seq++).toString(16).padStart(24, '0');
  let failNextInsert = false;

  const store = {
    newId,
    /** Fuerza un fallo en la siguiente inserción de solicitud (solo pruebas de rollback). */
    failNextRequestInsert() { failNextInsert = true; },
    async transaction(fn) {
      const snapshot = structuredClone(state);
      try {
        return await fn();
      } catch (error) {
        state = snapshot;
        throw error;
      }
    },
    municipalityById: (id) => state.municipalities.find((m) => m.id === id) || null,
    municipalityByCode: (code) => state.municipalities.find((m) => m.code === code) || null,
    dependencies: (municipalityId) => state.dependencies.filter((d) => d.municipalityId === municipalityId).map((d) => structuredClone(d)),
    insertDependency(doc) {
      if (state.dependencies.some((d) => d.municipalityId === doc.municipalityId && d.code === doc.code))
        throw Object.assign(new Error('Dependencia duplicada'), { code: 'DUPLICATE_DEPENDENCY' });
      state.dependencies.push(structuredClone(doc));
      return structuredClone(doc);
    },
    updateDependency(id, patch) {
      const i = state.dependencies.findIndex((d) => d.id === id);
      if (i < 0) throw Object.assign(new Error('Dependencia inexistente'), { code: 'NOT_FOUND' });
      state.dependencies[i] = { ...state.dependencies[i], ...structuredClone(patch) };
      return structuredClone(state.dependencies[i]);
    },
    membership: (id) => structuredClone(state.memberships.find((m) => m.id === id) || null),
    insertMembership(doc) {
      if (state.memberships.some((m) => m.userId === doc.userId && m.municipalityId === doc.municipalityId))
        throw Object.assign(new Error('Membresía duplicada'), { code: 'DUPLICATE_MEMBERSHIP' });
      state.memberships.push(structuredClone(doc));
      return structuredClone(doc);
    },
    updateMembership(id, expectedVersion, patch) {
      const i = state.memberships.findIndex((m) => m.id === id && (m.version || 0) === expectedVersion);
      if (i < 0) throw Object.assign(new Error('Versión obsoleta'), { code: 'STALE_VERSION' });
      state.memberships[i] = { ...state.memberships[i], ...structuredClone(patch), version: expectedVersion + 1 };
      return structuredClone(state.memberships[i]);
    },
    citizens: (municipalityId) => state.citizens.filter((c) => c.municipalityId === municipalityId).map((c) => structuredClone(c)),
    insertCitizen(doc) { state.citizens.push(structuredClone(doc)); return structuredClone(doc); },
    membershipsOf: (userId) => state.memberships.filter((m) => m.userId === userId).map((m) => structuredClone(m)),
    membershipsIn: (municipalityId) => state.memberships.filter((m) => m.municipalityId === municipalityId).map((m) => structuredClone(m)),
    citizen: (municipalityId, id) => state.citizens.find((c) => c.id === id && c.municipalityId === municipalityId) || null,
    nextSequence(key) {
      state.counters[key] = (state.counters[key] || 0) + 1;
      return state.counters[key];
    },
    counter: (key) => state.counters[key] || 0,
    /** Solo pruebas: retrocede un contador para simular una colisión de folio. */
    setCounterForTest(key, value) { state.counters[key] = value; },
    insertRequest(doc) {
      if (failNextInsert) { failNextInsert = false; throw new Error('Fallo simulado de escritura'); }
      if (state.requests.some((r) => r.municipalityId === doc.municipalityId && r.folio === doc.folio))
        throw Object.assign(new Error('Folio duplicado'), { code: 'DUPLICATE_FOLIO' });
      if (state.requests.some((r) => r.createdBy === doc.createdBy && r.idempotencyKey === doc.idempotencyKey))
        throw Object.assign(new Error('Clave de idempotencia duplicada'), { code: 'DUPLICATE_IDEMPOTENCY' });
      state.requests.push(structuredClone(doc));
      return structuredClone(doc);
    },
    requestByIdempotency: (createdBy, key) => structuredClone(state.requests.find((r) => r.createdBy === createdBy && r.idempotencyKey === key) || null),
    findRequests: (filter) => state.requests.filter((r) => matches(r, filter)).map((r) => structuredClone(r)),
    /** Busca SIN filtro de alcance; solo para registrar denegaciones (nunca se devuelve al cliente). */
    existsByFolio: (municipalityId, folio) => state.requests.some((r) => r.municipalityId === municipalityId && r.folio === folio),
    updateRequest(id, expectedVersion, patch) {
      const i = state.requests.findIndex((r) => r.id === id && r.version === expectedVersion);
      if (i < 0) throw Object.assign(new Error('Versión obsoleta'), { code: 'STALE_VERSION' });
      state.requests[i] = { ...state.requests[i], ...structuredClone(patch) };
      return structuredClone(state.requests[i]);
    },
    insertDocument(doc) { state.documents.push(structuredClone(doc)); return structuredClone(doc); },
    documentsOf: (requestId) => state.documents.filter((d) => d.requestId === requestId).map((d) => structuredClone(d)),
    addGrant(g) { state.grants.push(structuredClone(g)); },
    grant: (id) => structuredClone(state.grants.find((g) => g.id === id) || null),
    revokeGrant(id, at) { const g = state.grants.find((x) => x.id === id); if (g) g.revokedAt = at; },
    grantsFor: (municipalityId) => state.grants.filter((g) => g.municipalityId === municipalityId).map((g) => structuredClone(g)),
    appendAudit(event) { state.audit.push(Object.freeze(structuredClone(event))); },
    auditEvents: () => state.audit.map((e) => structuredClone(e)),
    allRequests: () => state.requests.map((r) => structuredClone(r)),
  };
  return store;
}

module.exports = { createMemoryStore };
