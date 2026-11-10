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
const { applyTransition, registrationEntry, editEntry, ACTIONS } = require('../domain/request-state');
const V = require('../domain/validation');
const { validateRequestCreate, validateIdempotencyKey } = V;
const present = require('./presenters');
const { scopeFor, canAssignRole } = require('../policy/permissions');
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
 * `userLookup(id)` (F1-12): consulta a la identidad central si un usuario existe y está ACTIVO
 * (en producción: rbac.resolveAccess del ERP vía http/erp-identity.js). Nunca crea cuentas.
 * @param {{ store: ReturnType<typeof import('../mocks/in-memory-store').createMemoryStore>,
 *   storage: { put: Function, get: Function }, clock?: () => Date }} deps
 */
function createMunicipalService({ store, storage, clock = () => new Date(), userLookup = null }) {
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
  /** Códigos → IDs; todos deben existir y estar activos en el municipio. */
  function resolveDependencyIds(mun, codes) {
    const map = depByCode(mun);
    const bad = codes.filter((c) => !map.has(c) || map.get(c).status !== 'ACTIVA');
    if (bad.length) throw new MunicipalError(400, 'VALIDATION_ERROR', 'Dependencias inexistentes o inactivas: ' + bad.join(', '));
    return codes.map((c) => map.get(c).id);
  }

  const codeOf = (mun) => {
    const deps = depById(mun);
    return (id) => (deps.get(id) || {}).code || null;
  };
  const isMeta = (ctx) => !!ctx.membership && scopeFor(ctx.membership.role, 'municipal.requests.read') === 'META';

  /** DTO del contrato: RequestSummary para alcance META (auditor), Request completo en otro caso. */
  function toDto(ctx, mun, r) {
    const code = codeOf(mun);
    if (isMeta(ctx)) return present.requestSummary(r, code);
    return present.requestFull(r, code, store.citizen(mun.id, r.citizenId));
  }
  /** Elemento de lista: resumen + asunto (el asunto se omite en alcance META). */
  function toListItem(ctx, mun, r) {
    const item = present.requestSummary(r, codeOf(mun));
    return isMeta(ctx) ? item : { ...item, subject: r.subject };
  }
  const page = (rows, query) => {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const p = Math.max(Number(query.page) || 1, 1);
    return { slice: rows.slice((p - 1) * limit, p * limit), pagination: { page: p, limit, total: rows.length, pages: Math.ceil(rows.length / limit) } };
  };

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
      }).catch((e) => {
        if (e.code === 'DUPLICATE_IDEMPOTENCY') return null;
        if (e.code === 'DUPLICATE_FOLIO') throw new MunicipalError(409, 'CONFLICT', 'Colisión de folio; reintente con la misma Idempotency-Key');
        throw e;
      });
      if (!created) {
        const raced = store.requestByIdempotency(ctx.userId, key);
        if (!raced || raced.payloadHash !== payloadHash) throw new MunicipalError(409, 'CONFLICT', 'Idempotency-Key usada con otro contenido');
        return { status: 200, data: toDto(ctx, mun, raced) };
      }
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
      const { slice, pagination } = page(rows, query);
      return { items: slice.map((r) => toListItem(ctx, mun, r)), pagination };
    },

    getRequest(ctx, munCode, folioValue, meta) {
      const { mun } = gate(ctx, 'municipal.requests.read', munCode);
      return toDto(ctx, mun, loadInScope(ctx, mun, folioValue, meta));
    },

    getHistory(ctx, munCode, folioValue) {
      const { mun, scope } = gate(ctx, 'municipal.requests.read', munCode);
      if (scope === 'META') throw new MunicipalError(403, 'FORBIDDEN', 'Solo metadatos');
      return (loadInScope(ctx, mun, folioValue).history || []).map((h) => present.historyEntry(h, codeOf(mun)));
    },

    async transition(ctx, munCode, folioValue, body, meta = {}) {
      const rule = ACTIONS[body && body.action];
      if (!rule) throw new MunicipalError(400, 'VALIDATION_ERROR', 'Acción no reconocida');
      V.validateTransitionInput(body);
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
      return present.document(doc);
    },

    listDocuments(ctx, munCode, folioValue) {
      const { mun } = gate(ctx, 'municipal.documents.read', munCode);
      const request = loadInScope(ctx, mun, folioValue);
      return store.documentsOf(request.id)
        .filter((d) => d.status === 'VIGENTE')
        .map((d) => (access.canReadDocument(ctx, request, d) ? present.document(d) : { id: d.id, confidentiality: d.confidentiality, restricted: true }));
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

    /** Membresías vigentes del usuario autenticado (solo requiere identidad central). */
    myMemberships(userId) {
      const now = clock();
      return store.membershipsOf(userId)
        .filter((m) => access.isMembershipActive(m, now))
        .map((m) => {
          const municipality = store.municipalityById(m.municipalityId);
          if (!municipality) return null;
          const deps = depById(municipality);
          return present.myMembership(m, municipality, m.dependencyIds.map((id) => (deps.get(id) || {}).code).filter(Boolean));
        })
        .filter(Boolean);
    },

    listDependencies(ctx, munCode, query = {}) {
      const { mun } = gate(ctx, 'municipal.dependencies.read', munCode);
      const all = store.dependencies(mun.id);
      const byId = new Map(all.map((d) => [d.id, d]));
      return all
        .filter((d) => !query.status || d.status === query.status)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((d) => present.dependency(d, d.parentCode || (d.parentId && byId.get(d.parentId) ? byId.get(d.parentId).code : null)));
    },

    /* ----------------------------- F1-12: dependencias ----------------------------- */

    createDependency(ctx, munCode, body, meta = {}) {
      const { mun } = gate(ctx, 'municipal.dependencies.manage', munCode);
      const input = V.validateDependencyCreate(body);
      if (input.parentCode) {
        const parent = depByCode(mun).get(input.parentCode);
        if (!parent || parent.status !== 'ACTIVA') throw new MunicipalError(400, 'VALIDATION_ERROR', 'Dependencia superior inexistente o inactiva');
      }
      let doc;
      try {
        doc = store.insertDependency({ id: store.newId(), municipalityId: mun.id, code: input.code, name: input.name, parentCode: input.parentCode, status: 'ACTIVA', createdBy: ctx.userId, createdAt: clock() });
      } catch (e) {
        if (e.code === 'DUPLICATE_DEPENDENCY') throw new MunicipalError(409, 'CONFLICT', 'Ya existe una dependencia con ese código en el municipio');
        throw e;
      }
      audit(ctx, mun, 'DEPENDENCY_CREATED', 'Dependency', 'success', { ...meta, entityId: doc.id });
      return present.dependency(doc, doc.parentCode);
    },

    updateDependency(ctx, munCode, code, body, meta = {}) {
      const { mun } = gate(ctx, 'municipal.dependencies.manage', munCode);
      const input = V.validateDependencyUpdate(body);
      const dep = depByCode(mun).get(code);
      if (!dep) throw notFound();
      if (input.status === 'INACTIVA' && dep.status === 'ACTIVA') {
        const open = store.findRequests({ municipalityId: mun.id })
          .filter((r) => !access.TERMINAL.includes(r.status))
          .filter((r) => r.ownerDependencyId === dep.id || (r.assignedDependencyIds || []).includes(dep.id));
        if (open.length) throw new MunicipalError(409, 'CONFLICT', `La dependencia tiene ${open.length} expediente(s) abierto(s); concluya o turne antes de desactivar`);
        const children = store.dependencies(mun.id).filter((d) => d.parentCode === dep.code && d.status === 'ACTIVA');
        if (children.length) throw new MunicipalError(409, 'CONFLICT', 'La dependencia tiene dependencias subordinadas activas');
      }
      const saved = store.updateDependency(dep.id, { ...input, updatedAt: clock(), updatedBy: ctx.userId });
      audit(ctx, mun, 'DEPENDENCY_UPDATED', 'Dependency', 'success', { ...meta, entityId: dep.id });
      return present.dependency(saved, saved.parentCode);
    },

    /* ----------------------------- F1-12: membresías ------------------------------ */

    listMemberships(ctx, munCode, query = {}) {
      const { mun, scope } = gate(ctx, 'municipal.memberships.read', munCode);
      const now = clock();
      const codes = codeOf(mun);
      let rows = store.membershipsIn(mun.id);
      if (scope === 'D') rows = rows.filter((m) => m.dependencyIds.some((d) => ctx.membership.dependencyIds.includes(d)));
      if (query.role) rows = rows.filter((m) => m.role === query.role);
      if (query.status) rows = rows.filter((m) => m.status === query.status);
      if (query.dependency) {
        const dep = depByCode(mun).get(query.dependency);
        rows = rows.filter((m) => !!dep && m.dependencyIds.includes(dep.id));
      }
      rows.sort((a, b) => (a.role + a.id).localeCompare(b.role + b.id));
      const { slice, pagination } = page(rows, query);
      return { items: slice.map((m) => present.membership(m, m.dependencyIds.map(codes).filter(Boolean), access.isMembershipActive(m, now))), pagination };
    },

    async createMembership(ctx, munCode, body, meta = {}) {
      const { mun } = gate(ctx, 'municipal.memberships.manage', munCode);
      const now = clock();
      const input = V.validateMembershipCreate(body, now);
      if (input.userId === ctx.userId) throw new MunicipalError(403, 'FORBIDDEN', 'No puede asignarse una membresía a sí mismo');
      if (!canAssignRole(ctx.membership.role, input.role))
        throw new MunicipalError(403, 'FORBIDDEN', 'Rol no asignable por el actor');
      const depIds = resolveDependencyIds(mun, input.dependencies);
      if (typeof userLookup !== 'function') throw new MunicipalError(503, 'AUTHORIZATION_UNAVAILABLE', 'Identidad central no disponible');
      let central;
      try { central = await userLookup(input.userId); } catch (_) { throw new MunicipalError(503, 'AUTHORIZATION_UNAVAILABLE', 'Identidad central no disponible'); }
      if (!central || central.id !== input.userId) throw new MunicipalError(404, 'NOT_FOUND', 'Usuario no encontrado o inactivo en la identidad central');
      let doc;
      try {
        doc = store.insertMembership({
          id: store.newId(), userId: input.userId, municipalityId: mun.id, role: input.role, dependencyIds: depIds,
          status: 'ACTIVA', validFrom: input.validFrom, validTo: input.validTo, version: 0, createdBy: ctx.userId, createdAt: now,
        });
      } catch (e) {
        if (e.code === 'DUPLICATE_MEMBERSHIP') throw new MunicipalError(409, 'CONFLICT', 'El usuario ya tiene una membresía en este municipio');
        throw e;
      }
      audit(ctx, mun, 'MEMBERSHIP_CREATED', 'Membership', 'success', { ...meta, entityId: doc.id });
      return present.membership(doc, input.dependencies, access.isMembershipActive(doc, now));
    },

    updateMembership(ctx, munCode, membershipId, body, meta = {}) {
      const { mun } = gate(ctx, 'municipal.memberships.manage', munCode);
      const now = clock();
      const input = V.validateMembershipUpdate(body, now);
      const current = store.membership(membershipId);
      // Otro municipio o inexistente: mismo 404.
      if (!current || current.municipalityId !== mun.id) throw notFound();
      if (current.userId === ctx.userId) throw new MunicipalError(403, 'FORBIDDEN', 'No puede modificar su propia membresía');
      if (current.role === 'ADMIN_MUNICIPAL') throw new MunicipalError(403, 'FORBIDDEN', 'Las membresías ADMIN_MUNICIPAL solo se gestionan por bootstrap/ops');
      if (input.role && !canAssignRole(ctx.membership.role, input.role))
        throw new MunicipalError(403, 'FORBIDDEN', 'Rol no asignable por el actor');
      const patch = { updatedAt: now, updatedBy: ctx.userId };
      if (input.role) patch.role = input.role;
      if (input.status) patch.status = input.status;
      if (input.validTo !== undefined) patch.validTo = input.validTo;
      if (input.dependencies) patch.dependencyIds = resolveDependencyIds(mun, input.dependencies);
      const role = patch.role || current.role;
      const deps = patch.dependencyIds || current.dependencyIds;
      if (V.DEPENDENCY_SCOPED_ROLES.includes(role) && deps.length === 0)
        throw new MunicipalError(400, 'VALIDATION_ERROR', 'El rol requiere al menos una dependencia');
      let saved;
      try { saved = store.updateMembership(current.id, current.version || 0, patch); } catch (e) {
        if (e.code === 'STALE_VERSION') throw new MunicipalError(409, 'CONFLICT', 'La membresía cambió; recargue');
        throw e;
      }
      const revoked = current.status === 'ACTIVA' && saved.status === 'INACTIVA';
      audit(ctx, mun, revoked ? 'MEMBERSHIP_REVOKED' : 'MEMBERSHIP_UPDATED', 'Membership', 'success', { ...meta, entityId: current.id });
      const codes = codeOf(mun);
      return present.membership(saved, saved.dependencyIds.map(codes).filter(Boolean), access.isMembershipActive(saved, now));
    },

    createCitizen(ctx, munCode, body, meta = {}) {
      const { mun } = gate(ctx, 'municipal.citizens.create', munCode);
      const input = V.validateCitizenCreate(body);
      const doc = store.insertCitizen({ id: store.newId(), municipalityId: mun.id, ...input, createdBy: ctx.userId, createdAt: clock() });
      audit(ctx, mun, 'CITIZEN_CREATED', 'Citizen', 'success', { ...meta, entityId: doc.id });
      return present.citizen(doc);
    },

    /** Ciudadanos visibles: todos (M) o los vinculados a expedientes en alcance y los creados por el actor. */
    searchCitizens(ctx, munCode, query = {}) {
      const { mun, scope } = gate(ctx, 'municipal.citizens.read', munCode);
      let visible = store.citizens(mun.id);
      if (scope !== 'M' && scope !== 'ALL') {
        const filter = scopedFilter(ctx);
        const linked = new Set((filter ? store.findRequests(filter) : []).filter((r) => access.canReadRequest(ctx, r)).map((r) => r.citizenId));
        visible = visible.filter((c) => linked.has(c.id) || c.createdBy === ctx.userId);
      }
      if (query.q) {
        const q = String(query.q).toLocaleLowerCase('es-MX');
        visible = visible.filter((c) => c.fullName.toLocaleLowerCase('es-MX').includes(q));
      }
      visible.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es-MX'));
      const { slice, pagination } = page(visible, query);
      return { items: slice.map(present.citizen), pagination };
    },

    async updateRequest(ctx, munCode, folioValue, body, expectedVersion, meta = {}) {
      const { mun } = gate(ctx, 'municipal.requests.update', munCode);
      const input = V.validateRequestUpdate(body);
      const current = loadInScope(ctx, mun, folioValue, meta);
      if (access.TERMINAL.includes(current.status)) throw new MunicipalError(409, 'INVALID_TRANSITION', 'Expediente concluido');
      if (!access.canWriteRequest(ctx, current, 'municipal.requests.update')) throw new MunicipalError(403, 'FORBIDDEN', 'Sin permiso sobre este expediente');
      if (expectedVersion !== current.version) throw new MunicipalError(409, 'CONFLICT', 'La solicitud cambió; recargue');
      if (input.confidentiality && input.confidentiality !== current.confidentiality &&
          !access.canWriteRequest(ctx, current, 'municipal.requests.readConfidential'))
        throw new MunicipalError(403, 'FORBIDDEN', 'Cambiar la confidencialidad requiere municipal.requests.readConfidential');
      const at = clock();
      const saved = await store.transaction(async () => {
        const updated = store.updateRequest(current.id, current.version, {
          ...input, version: current.version + 1, updatedAt: at,
          history: [...(current.history || []), editEntry(ctx.userId, at, current.status, Object.keys(input))],
        });
        audit(ctx, mun, 'REQUEST_UPDATED', 'Request', 'success', { ...meta, entityId: current.id, folio: current.folio });
        return updated;
      }).catch((e) => {
        if (e.code === 'STALE_VERSION') throw new MunicipalError(409, 'CONFLICT', 'La solicitud cambió; recargue');
        throw e;
      });
      return toDto(ctx, mun, saved);
    },

    async createGrant(ctx, munCode, folioValue, body, meta = {}) {
      const { mun } = gate(ctx, 'municipal.requests.grant', munCode);
      const input = V.validateGrantCreate(body, clock());
      const request = loadInScope(ctx, mun, folioValue, meta);
      if (!access.canWriteRequest(ctx, request, 'municipal.requests.grant')) {
        if (access.TERMINAL.includes(request.status)) throw new MunicipalError(409, 'INVALID_TRANSITION', 'Expediente concluido');
        throw new MunicipalError(403, 'FORBIDDEN', 'Sin permiso para compartir este expediente');
      }
      let granteeDependencyId = null;
      if (input.granteeDependency) {
        const dep = depByCode(mun).get(input.granteeDependency);
        if (!dep || dep.status !== 'ACTIVA') throw new MunicipalError(400, 'VALIDATION_ERROR', 'Dependencia inválida');
        granteeDependencyId = dep.id;
      }
      if (input.granteeUserId) {
        if (input.granteeUserId === ctx.userId) throw new MunicipalError(400, 'VALIDATION_ERROR', 'No puede compartirse consigo mismo');
        const target = store.membershipsOf(input.granteeUserId).find((m) => m.municipalityId === mun.id && access.isMembershipActive(m, clock()));
        if (!target) throw new MunicipalError(400, 'VALIDATION_ERROR', 'El usuario no tiene membresía vigente en el municipio');
      }
      const grant = {
        id: store.newId(), requestId: request.id, municipalityId: mun.id, granteeUserId: input.granteeUserId,
        granteeDependencyId, level: input.level, expiresAt: input.expiresAt, revokedAt: null, grantedBy: ctx.userId, createdAt: clock(),
      };
      store.addGrant(grant);
      audit(ctx, mun, 'GRANT_CREATED', 'Grant', 'success', { ...meta, entityId: grant.id, folio: request.folio });
      return { id: grant.id, folio: request.folio, granteeUserId: grant.granteeUserId || undefined, granteeDependency: input.granteeDependency || undefined, level: grant.level, expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null };
    },

    revokeGrant(ctx, munCode, folioValue, grantId, meta = {}) {
      const { mun } = gate(ctx, 'municipal.requests.grant', munCode);
      const request = loadInScope(ctx, mun, folioValue, meta);
      const grant = store.grant(grantId);
      if (!grant || grant.requestId !== request.id || grant.municipalityId !== mun.id || grant.revokedAt) throw notFound();
      const openView = access.TERMINAL.includes(request.status) ? { ...request, status: 'EN_TRAMITE' } : request;
      if (!access.canWriteRequest(ctx, openView, 'municipal.requests.grant'))
        throw new MunicipalError(403, 'FORBIDDEN', 'Sin permiso para revocar');
      store.revokeGrant(grantId, clock());
      audit(ctx, mun, 'GRANT_REVOKED', 'Grant', 'success', { ...meta, entityId: grantId, folio: request.folio });
    },

    verifyFolio(ctx, munCode, folioValue, meta) {
      const { mun } = gate(ctx, 'municipal.requests.read', munCode);
      const r = loadInScope(ctx, mun, folioValue, meta);
      const parts = folio.parseFolio(r.folio);
      return { folio: r.folio, type: r.type, ownerDependency: codeOf(mun)(r.ownerDependencyId), year: parts.year, sequence: parts.sequence, status: r.status, createdAt: present.iso(r.createdAt) };
    },

    listAuditEvents(ctx, munCode, query = {}) {
      const { mun } = gate(ctx, 'municipal.audit.read', munCode);
      const rows = store.auditEvents()
        .filter((e) => e.municipalityId === mun.id)
        .filter((e) => !query.folio || e.folio === query.folio)
        .filter((e) => !query.entityId || e.entityId === query.entityId)
        .filter((e) => !query.from || e.at >= query.from)
        .filter((e) => !query.to || e.at < query.to)
        .sort((a, b) => b.at - a.at);
      const { slice, pagination } = page(rows, query);
      return { items: slice.map(present.auditEvent), pagination };
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
