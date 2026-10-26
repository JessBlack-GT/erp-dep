// @ts-check
'use strict';
/**
 * Capa de aplicación de MuniERP IA, independiente de Express y de Mongo. Recibe un AccessContext ya
 * resuelto (JWT central + resolveAccess del ERP + membresía + concesiones) y un almacén con la
 * interfaz de mocks/in-memory-store.js. Los errores llevan statusCode/code del contrato OpenAPI.
 *
 * Estado: NO MONTADO. Se usa con el almacén en memoria para pruebas y maquetas (sin datos reales).
 */
const access = require('../policy/access');
const folio = require('../domain/folio');
const { applyTransition, registrationEntry, ACTIONS } = require('../domain/request-state');
const { validateRequestCreate, validateIdempotencyKey } = require('../domain/validation');
const { computeIndicators } = require('../domain/indicators');
const docs = require('../domain/documents');
const { buildReceipt } = require('../domain/receipt');
const crypto = require('crypto');

class MunicipalError extends Error {
  /** @param {number} statusCode @param {string} code @param {string} message */
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
const notFound = () => new MunicipalError(404, 'NOT_FOUND', 'No encontrado');

/**
 * @param {{ store: ReturnType<typeof import('../mocks/in-memory-store').createMemoryStore>,
 *   storage: { put: Function, get: Function }, clock?: () => Date }} deps
 */
function createMunicipalService({ store, storage, clock = () => new Date() }) {
  function municipality(code) {
    const m = store.municipalityByCode(code);
    if (!m) throw new MunicipalError(403, 'MUNICIPAL_MEMBERSHIP_REQUIRED', 'Sin acceso al municipio');
    return m;
  }

  function gate(ctx, permission, munCode) {
    const mun = municipality(munCode);
    const result = access.authorize(ctx, permission, mun.id);
    if (!result.allowed) throw new MunicipalError(403, result.code, 'Sin permisos municipales suficientes');
    return { mun, scope: result.scope };
  }

  function audit(ctx, mun, action, entity, result, extra = {}) {
    store.appendAudit({
      at: clock(), actorId: ctx.userId, membershipId: ctx.membership && ctx.membership.id,
      municipalityId: mun.id, action, entity, result, ip: extra.ip || null, requestId: extra.requestId || null,
      entityId: extra.entityId || null, folio: extra.folio || null,
    });
  }

  function scopedFilter(ctx) {
    return access.buildRequestScopeFilter(ctx, access.activeGrantRequestIds(ctx));
  }

  /** Expediente en alcance o 404 (registrando la denegación si existe fuera de alcance). */
  function loadInScope(ctx, mun, folioValue, meta = {}) {
    const parsed = folio.parseFolio(folioValue);
    if (!parsed || parsed.municipality !== mun.code) throw notFound();
    const filter = scopedFilter(ctx);
    const found = filter ? store.findRequests({ $and: [filter, { folio: folioValue }] })[0] : null;
    if (!found || !access.canReadRequest(ctx, found)) {
      if (store.existsByFolio(mun.id, folioValue)) audit(ctx, mun, 'ACCESS_DENIED', 'Request', 'denied', { ...meta, folio: folioValue });
      throw notFound();
    }
    return found;
  }

  const depById = (mun) => new Map(store.dependencies(mun.id).map((d) => [d.id, d]));
  const depByCode = (mun) => new Map(store.dependencies(mun.id).map((d) => [d.code, d]));

  /** DTO público: códigos de dependencia en lugar de IDs internos. */
  function toDto(ctx, mun, r) {
    const deps = depById(mun);
    const code = (id) => (deps.get(id) || {}).code || null;
    const dto = { ...r, ownerDependency: code(r.ownerDependencyId), assignedDependencies: (r.assignedDependencyIds || []).map(code) };
    return access.projectRequest(ctx, dto);
  }

  return {
    MunicipalError,

    async createRequest(ctx, munCode, body, idempotencyKey, meta = {}) {
      const { mun, scope } = gate(ctx, 'municipal.requests.create', munCode);
      const key = validateIdempotencyKey(idempotencyKey);
      const input = validateRequestCreate(body);
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const previous = store.requestByIdempotency(ctx.userId, key);
      if (previous) {
        if (previous.payloadHash !== payloadHash) throw new MunicipalError(409, 'CONFLICT', 'Idempotency-Key usada con otro contenido');
        return { status: 200, data: toDto(ctx, mun, previous) };
      }
      const dep = depByCode(mun).get(input.ownerDependency);
      if (!dep || dep.status !== 'ACTIVA') throw new MunicipalError(400, 'VALIDATION_ERROR', 'Dependencia inválida');
      if (scope === 'D' && !ctx.membership.dependencyIds.includes(dep.id))
        throw new MunicipalError(403, 'FORBIDDEN', 'Solo puede registrar en sus dependencias');
      if (!store.citizen(mun.id, input.citizenId)) throw new MunicipalError(400, 'VALIDATION_ERROR', 'Ciudadano inexistente');

      const now = clock();
      const created = await store.transaction(async () => {
        const parts = { municipality: mun.code, dependency: dep.code, type: input.type, year: folio.yearInMexico(now) };
        const sequence = store.nextSequence(folio.counterKey(parts));
        const doc = {
          id: store.newId(), municipalityId: mun.id, folio: folio.formatFolio({ ...parts, sequence }),
          type: input.type, subject: input.subject, description: input.description || '', citizenId: input.citizenId,
          ownerDependencyId: dep.id, assignedDependencyIds: [], assignedUserId: null,
          confidentiality: input.confidentiality, channel: input.channel, status: 'REGISTRADA', version: 0,
          history: [registrationEntry(ctx.userId, now)], createdBy: ctx.userId, createdAt: now, updatedAt: now,
          idempotencyKey: key, payloadHash,
        };
        const saved = store.insertRequest(doc);
        audit(ctx, mun, 'REQUEST_CREATED', 'Request', 'success', { ...meta, entityId: saved.id, folio: saved.folio });
        return saved;
      });
      return { status: 201, data: toDto(ctx, mun, created) };
    },

    listRequests(ctx, munCode, query = {}) {
      const { mun } = gate(ctx, 'municipal.requests.read', munCode);
      const filter = scopedFilter(ctx);
      if (!filter) return { items: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
      const narrow = [filter];
      if (query.status) narrow.push({ status: query.status });
      if (query.dependency) {
        const dep = depByCode(mun).get(query.dependency);
        narrow.push({ ownerDependencyId: dep ? dep.id : '__ninguna__' });
      }
      if (query.assignedToMe) narrow.push({ assignedUserId: ctx.userId });
      const rows = store.findRequests({ $and: narrow }).filter((r) => access.canReadRequest(ctx, r));
      rows.sort((a, b) => b.createdAt - a.createdAt || (a.folio < b.folio ? 1 : -1));
      const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
      const page = Math.max(Number(query.page) || 1, 1);
      return {
        items: rows.slice((page - 1) * limit, page * limit).map((r) => toDto(ctx, mun, r)),
        pagination: { page, limit, total: rows.length, pages: Math.ceil(rows.length / limit) },
      };
    },

    getRequest(ctx, munCode, folioValue, meta) {
      const { mun } = gate(ctx, 'municipal.requests.read', munCode);
      return toDto(ctx, mun, loadInScope(ctx, mun, folioValue, meta));
    },

    getHistory(ctx, munCode, folioValue) {
      const { mun, scope } = gate(ctx, 'municipal.requests.read', munCode);
      if (scope === 'META') throw new MunicipalError(403, 'FORBIDDEN', 'Solo metadatos');
      return loadInScope(ctx, mun, folioValue).history;
    },

    async transition(ctx, munCode, folioValue, body, meta = {}) {
      const rule = ACTIONS[body && body.action];
      if (!rule) throw new MunicipalError(400, 'VALIDATION_ERROR', 'Acción no reconocida');
      const { mun } = gate(ctx, rule.permission, munCode);
      const current = loadInScope(ctx, mun, folioValue, meta);
      if (!access.canWriteRequest(ctx, current, rule.permission)) {
        if (access.TERMINAL.includes(current.status)) throw new MunicipalError(409, 'INVALID_TRANSITION', 'Expediente concluido');
        throw new MunicipalError(403, 'FORBIDDEN', 'Sin permiso sobre este expediente');
      }
      const codes = depByCode(mun);
      const toDependencies = body.toDependencies && body.toDependencies.map((c) => (codes.get(c) || {}).id || '__invalida__');
      let next;
      try {
        next = applyTransition(current, { ...body, toDependencies }, {
          actorId: ctx.userId, at: clock(), validDependencyIds: [...codes.values()].filter((d) => d.status === 'ACTIVA').map((d) => d.id),
        });
      } catch (e) {
        throw new MunicipalError(e.statusCode || 400, e.code || 'VALIDATION_ERROR', e.message);
      }
      const saved = await store.transaction(async () => {
        const updated = store.updateRequest(current.id, current.version, {
          status: next.status, version: next.version, assignedDependencyIds: next.assignedDependencyIds,
          assignedUserId: next.assignedUserId, history: next.history, updatedAt: next.entry.at,
        });
        audit(ctx, mun, 'REQUEST_' + body.action, 'Request', 'success', { ...meta, entityId: current.id, folio: current.folio });
        return updated;
      }).catch((e) => {
        if (e.code === 'STALE_VERSION') throw new MunicipalError(409, 'CONFLICT', 'La solicitud cambió; recargue');
        throw e;
      });
      return toDto(ctx, mun, saved);
    },

    async uploadDocument(ctx, munCode, folioValue, body, meta = {}) {
      const { mun } = gate(ctx, 'municipal.documents.upload', munCode);
      const request = loadInScope(ctx, mun, folioValue, meta);
      if (access.TERMINAL.includes(request.status)) throw new MunicipalError(409, 'INVALID_TRANSITION', 'Expediente concluido');
      if (!access.canWriteRequest(ctx, request, 'municipal.documents.upload'))
        throw new MunicipalError(403, 'FORBIDDEN', 'Sin permiso para adjuntar');
      let file;
      try { file = docs.validateUpload(body); } catch (e) { throw new MunicipalError(e.statusCode, e.code, e.message); }
      const storageKey = docs.newStorageKey();
      await storage.put(storageKey, file.buffer);
      const doc = store.insertDocument({
        id: store.newId(), municipalityId: mun.id, requestId: request.id, folio: request.folio,
        filename: file.filename, mimeType: file.mimeType, size: file.size, sha256: file.sha256,
        storageKey, confidentiality: access.effectiveConfidentiality(request.confidentiality, file.confidentiality),
        status: 'VIGENTE', uploadedBy: ctx.userId, uploadedAt: clock(),
      });
      audit(ctx, mun, 'DOCUMENT_UPLOADED', 'Document', 'success', { ...meta, entityId: doc.id, folio: request.folio });
      const { storageKey: _k, ...publicDoc } = doc; // eslint-disable-line no-unused-vars
      return publicDoc;
    },

    listDocuments(ctx, munCode, folioValue) {
      const { mun } = gate(ctx, 'municipal.documents.read', munCode);
      const request = loadInScope(ctx, mun, folioValue);
      return store.documentsOf(request.id)
        .filter((d) => d.status === 'VIGENTE')
        .map((d) => {
          const { storageKey, ...rest } = d; // eslint-disable-line no-unused-vars
          return access.canReadDocument(ctx, request, d) ? rest : { id: d.id, confidentiality: d.confidentiality, restricted: true };
        });
    },

    async downloadDocument(ctx, munCode, folioValue, documentId, meta = {}) {
      const { mun } = gate(ctx, 'municipal.documents.read', munCode);
      const request = loadInScope(ctx, mun, folioValue, meta);
      const doc = store.documentsOf(request.id).find((d) => d.id === documentId);
      if (!doc || !access.canReadDocument(ctx, request, doc)) {
        if (doc) audit(ctx, mun, 'ACCESS_DENIED', 'Document', 'denied', { ...meta, entityId: doc.id, folio: request.folio });
        throw notFound();
      }
      const buffer = await storage.get(doc.storageKey);
      audit(ctx, mun, 'DOCUMENT_DOWNLOADED', 'Document', 'success', { ...meta, entityId: doc.id, folio: request.folio });
      return { headers: docs.downloadHeaders(doc), buffer };
    },

    indicators(ctx, munCode, query) {
      const { mun } = gate(ctx, 'municipal.indicators.read', munCode);
      const filter = scopedFilter(ctx);
      const narrow = [filter || { municipalityId: '__ninguno__' }];
      if (query.dependency) {
        const dep = depByCode(mun).get(query.dependency);
        narrow.push({ ownerDependencyId: dep ? dep.id : '__ninguna__' });
      }
      const rows = store.findRequests({ $and: narrow }).filter((r) => access.canReadRequest(ctx, r));
      const result = computeIndicators(rows, { from: query.from, to: query.to, now: clock(), slaDays: query.slaDays });
      const deps = depById(mun);
      result.byDependency = Object.fromEntries(Object.entries(result.byDependency).map(([id, n]) => [(deps.get(id) || {}).code || id, n]));
      return result;
    },

    receipt(ctx, munCode, folioValue) {
      const { mun } = gate(ctx, 'municipal.requests.read', munCode);
      const r = loadInScope(ctx, mun, folioValue);
      const dep = depById(mun).get(r.ownerDependencyId);
      return buildReceipt(r, { municipalityName: mun.name, dependencyName: dep ? dep.name : '' });
    },
  };
}

module.exports = { createMunicipalService, MunicipalError };
