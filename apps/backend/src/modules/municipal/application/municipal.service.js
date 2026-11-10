// @ts-check
'use strict';
/**
 * Capa de aplicación de MuniERP IA, independiente de Express y de Mongo. Recibe un AccessContext ya
 * resuelto (JWT central + resolveAccess del ERP + membresía + concesiones) y un almacén que implementa
 * el puerto ASÍNCRONO de persistence/repository-port.js (F1-05 paso 1). Toda escritura de negocio y su
 * evento de bitácora se confirman en la misma transacción. Los errores llevan statusCode/code del
 * contrato OpenAPI.
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
const { assertRepositoryPort } = require('../persistence/repository-port');

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
 * @param {{ store: any, storage: { put: Function, get: Function }, clock?: () => Date, userLookup?: Function|null }} deps
 */
function createMunicipalService({ store, storage, clock = () => new Date(), userLookup = null }) {
  assertRepositoryPort(store);

  async function municipality(code) {
    const m = await store.municipalityByCode(code);
    if (!m) throw new MunicipalError(403, 'MUNICIPAL_MEMBERSHIP_REQUIRED', 'Sin acceso al municipio');
    return m;
  }

  async function gate(ctx, permission, munCode) {
    const mun = await municipality(munCode);
    const result = access.authorize(ctx, permission, mun.id);
    if (!result.allowed) throw new MunicipalError(403, result.code, 'Sin permisos municipales suficientes');
    return { mun, scope: result.scope };
  }

  /** Evento de bitácora sobre `repo` (el almacén o la transacción en curso). */
  function audit(repo, ctx, mun, action, entity, result, extra = {}) {
    return repo.appendAudit({
      at: clock(), actorId: ctx.userId, membershipId: ctx.membership && ctx.membership.id,
      municipalityId: mun.id, action, entity, result, ip: extra.ip || null, requestId: extra.requestId || null,
      entityId: extra.entityId || null, folio: extra.folio || null,
    });
  }

  function scopedFilter(ctx) {
    return access.buildRequestScopeFilter(ctx, access.activeGrantRequestIds(ctx));
  }

  /** Expediente en alcance o 404 (registrando la denegación si existe fuera de alcance). */
  async function loadInScope(ctx, mun, folioValue, meta = {}) {
    const parsed = folio.parseFolio(folioValue);
    if (!parsed || parsed.municipality !== mun.code) throw notFound();
    const filter = scopedFilter(ctx);
    const found = filter ? (await store.findRequests({ $and: [filter, { folio: folioValue }] }))[0] : null;
    if (!found || !access.canReadRequest(ctx, found)) {
      if (await store.existsByFolio(mun.id, folioValue)) await audit(store, ctx, mun, 'ACCESS_DENIED', 'Request', 'denied', { ...meta, folio: folioValue });
      throw notFound();
    }
    return found;
  }

  /** Catálogo de dependencias del municipio, indexado por id y por código. */
  async function depsOf(mun, repo = store) {
    const all = await repo.dependencies(mun.id);
    const byId = new Map(all.map((d) => [d.id, d]));
    const byCode = new Map(all.map((d) => [d.code, d]));
    return { all, byId, byCode, codeOf: (id) => (byId.get(id) || {}).code || null };
  }
  /** Códigos → IDs; todos deben existir y estar activos en el municipio. */
  function resolveDependencyIds(deps, codes) {
    const bad = codes.filter((c) => !deps.byCode.has(c) || deps.byCode.get(c).status !== 'ACTIVA');
    if (bad.length) throw new MunicipalError(400, 'VALIDATION_ERROR', 'Dependencias inexistentes o inactivas: ' + bad.join(', '));
    return codes.map((c) => deps.byCode.get(c).id);
  }

  const isMeta = (ctx) => !!ctx.membership && scopeFor(ctx.membership.role, 'municipal.requests.read') === 'META';

  /** DTO del contrato: RequestSummary para alcance META (auditor), Request completo en otro caso. */
  async function toDto(ctx, mun, r, deps) {
    const d = deps || (await depsOf(mun));
    if (isMeta(ctx)) return present.requestSummary(r, d.codeOf);
    return present.requestFull(r, d.codeOf, await store.citizen(mun.id, r.citizenId));
  }
  /** Elemento de lista: resumen + asunto (el asunto se omite en alcance META). */
  function toListItem(ctx, deps, r) {
    const item = present.requestSummary(r, deps.codeOf);
    return isMeta(ctx) ? item : { ...item, subject: r.subject };
  }
  const page = (rows, query) => {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const p = Math.max(Number(query.page) || 1, 1);
    return { slice: rows.slice((p - 1) * limit, p * limit), pagination: { page: p, limit, total: rows.length, pages: Math.ceil(rows.length / limit) } };
  };
  /** Versión obsoleta o conflicto de concurrencia agotado en el adaptador → 409 «recargue». */
  const conflictOnStale = (message) => (e) => {
    if (e.code === 'STALE_VERSION' || e.code === 'TRANSIENT_CONFLICT') throw new MunicipalError(409, 'CONFLICT', message);
    throw e;
  };

  return {
    MunicipalError,

    async createRequest(ctx, munCode, body, idempotencyKey, meta = {}) {
      const { mun, scope } = await gate(ctx, 'municipal.requests.create', munCode);
      const key = validateIdempotencyKey(idempotencyKey);
      const input = validateRequestCreate(body);
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const previous = await store.requestByIdempotency(mun.id, ctx.userId, key);
      if (previous) {
        if (previous.payloadHash !== payloadHash) throw new MunicipalError(409, 'CONFLICT', 'Idempotency-Key usada con otro contenido');
        return { status: 200, data: await toDto(ctx, mun, previous) };
      }
      const deps = await depsOf(mun);
      const dep = deps.byCode.get(input.ownerDependency);
      if (!dep || dep.status !== 'ACTIVA') throw new MunicipalError(400, 'VALIDATION_ERROR', 'Dependencia inválida');
      if (scope === 'D' && !ctx.membership.dependencyIds.includes(dep.id))
        throw new MunicipalError(403, 'FORBIDDEN', 'Solo puede registrar en sus dependencias');
      if (!(await store.citizen(mun.id, input.citizenId))) throw new MunicipalError(400, 'VALIDATION_ERROR', 'Ciudadano inexistente');

      const now = clock();
      const created = await store.transaction(async (tx) => {
        const parts = { municipality: mun.code, dependency: dep.code, type: input.type, year: folio.yearInMexico(now) };
        const sequence = await tx.nextSequence(folio.counterKey(parts));
        const doc = {
          id: tx.newId(), municipalityId: mun.id, folio: folio.formatFolio({ ...parts, sequence }),
          type: input.type, subject: input.subject, description: input.description || '', citizenId: input.citizenId,
          ownerDependencyId: dep.id, assignedDependencyIds: [], assignedUserId: null,
          confidentiality: input.confidentiality, channel: input.channel, status: 'REGISTRADA', version: 0,
          history: [registrationEntry(ctx.userId, now)], createdBy: ctx.userId, createdAt: now, updatedAt: now,
          idempotencyKey: key, payloadHash,
        };
        const saved = await tx.insertRequest(doc);
        await audit(tx, ctx, mun, 'REQUEST_CREATED', 'Request', 'success', { ...meta, entityId: saved.id, folio: saved.folio });
        return saved;
      }).catch((e) => {
        if (e.code === 'DUPLICATE_IDEMPOTENCY') return null;
        if (e.code === 'DUPLICATE_FOLIO' || e.code === 'TRANSIENT_CONFLICT') throw new MunicipalError(409, 'CONFLICT', 'Colisión de folio; reintente con la misma Idempotency-Key');
        throw e;
      });
      if (!created) {
        const raced = await store.requestByIdempotency(mun.id, ctx.userId, key);
        if (!raced || raced.payloadHash !== payloadHash) throw new MunicipalError(409, 'CONFLICT', 'Idempotency-Key usada con otro contenido');
        return { status: 200, data: await toDto(ctx, mun, raced, deps) };
      }
      return { status: 201, data: await toDto(ctx, mun, created, deps) };
    },

    async listRequests(ctx, munCode, query = {}) {
      const { mun } = await gate(ctx, 'municipal.requests.read', munCode);
      const filter = scopedFilter(ctx);
      if (!filter) return { items: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
      const deps = await depsOf(mun);
      const narrow = [filter];
      if (query.status) narrow.push({ status: query.status });
      if (query.dependency) {
        const dep = deps.byCode.get(query.dependency);
        narrow.push({ ownerDependencyId: dep ? dep.id : '__ninguna__' });
      }
      if (query.assignedToMe) narrow.push({ assignedUserId: ctx.userId });
      const rows = (await store.findRequests({ $and: narrow })).filter((r) => access.canReadRequest(ctx, r));
      rows.sort((a, b) => b.createdAt - a.createdAt || (a.folio < b.folio ? 1 : -1));
      const { slice, pagination } = page(rows, query);
      return { items: slice.map((r) => toListItem(ctx, deps, r)), pagination };
    },

    async getRequest(ctx, munCode, folioValue, meta) {
      const { mun } = await gate(ctx, 'municipal.requests.read', munCode);
      return toDto(ctx, mun, await loadInScope(ctx, mun, folioValue, meta));
    },

    async getHistory(ctx, munCode, folioValue) {
      const { mun, scope } = await gate(ctx, 'municipal.requests.read', munCode);
      if (scope === 'META') throw new MunicipalError(403, 'FORBIDDEN', 'Solo metadatos');
      const request = await loadInScope(ctx, mun, folioValue);
      const deps = await depsOf(mun);
      return (request.history || []).map((h) => present.historyEntry(h, deps.codeOf));
    },

    async transition(ctx, munCode, folioValue, body, meta = {}) {
      const rule = ACTIONS[body && body.action];
      if (!rule) throw new MunicipalError(400, 'VALIDATION_ERROR', 'Acción no reconocida');
      V.validateTransitionInput(body);
      const { mun } = await gate(ctx, rule.permission, munCode);
      const current = await loadInScope(ctx, mun, folioValue, meta);
      if (!access.canWriteRequest(ctx, current, rule.permission)) {
        if (access.TERMINAL.includes(current.status)) throw new MunicipalError(409, 'INVALID_TRANSITION', 'Expediente concluido');
        throw new MunicipalError(403, 'FORBIDDEN', 'Sin permiso sobre este expediente');
      }
      const deps = await depsOf(mun);
      const toDependencies = body.toDependencies && body.toDependencies.map((c) => (deps.byCode.get(c) || {}).id || '__invalida__');
      let next;
      try {
        next = applyTransition(current, { ...body, toDependencies }, {
          actorId: ctx.userId, at: clock(), validDependencyIds: deps.all.filter((d) => d.status === 'ACTIVA').map((d) => d.id),
        });
      } catch (e) {
        throw new MunicipalError(e.statusCode || 400, e.code || 'VALIDATION_ERROR', e.message);
      }
      const saved = await store.transaction(async (tx) => {
        const updated = await tx.updateRequest(mun.id, current.id, current.version, {
          status: next.status, version: next.version, assignedDependencyIds: next.assignedDependencyIds,
          assignedUserId: next.assignedUserId, history: next.history, updatedAt: next.entry.at,
        });
        await audit(tx, ctx, mun, 'REQUEST_' + body.action, 'Request', 'success', { ...meta, entityId: current.id, folio: current.folio });
        return updated;
      }).catch(conflictOnStale('La solicitud cambió; recargue'));
      return toDto(ctx, mun, saved, deps);
    },

    /**
     * Documento privado en tres pasos (docs/munierp/12 §7): metadatos PENDIENTE → binario → VIGENTE con
     * su evento de bitácora. Si el binario falla, el metadato queda PENDIENTE (nunca visible ni
     * descargable) para conciliación, sin borrados automáticos.
     */
    async uploadDocument(ctx, munCode, folioValue, body, meta = {}) {
      const { mun } = await gate(ctx, 'municipal.documents.upload', munCode);
      const request = await loadInScope(ctx, mun, folioValue, meta);
      if (access.TERMINAL.includes(request.status)) throw new MunicipalError(409, 'INVALID_TRANSITION', 'Expediente concluido');
      if (!access.canWriteRequest(ctx, request, 'municipal.documents.upload'))
        throw new MunicipalError(403, 'FORBIDDEN', 'Sin permiso para adjuntar');
      let file;
      try { file = docs.validateUpload(body); } catch (e) { throw new MunicipalError(e.statusCode, e.code, e.message); }
      const storageKey = docs.newStorageKey();
      const pending = await store.insertDocument({
        id: store.newId(), municipalityId: mun.id, requestId: request.id, folio: request.folio,
        filename: file.filename, mimeType: file.mimeType, size: file.size, sha256: file.sha256,
        storageKey, confidentiality: access.effectiveConfidentiality(request.confidentiality, file.confidentiality),
        status: 'PENDIENTE', uploadedBy: ctx.userId, uploadedAt: clock(),
      });
      await storage.put(storageKey, file.buffer);
      const doc = await store.transaction(async (tx) => {
        const active = await tx.updateDocumentStatus(mun.id, pending.id, 'VIGENTE');
        await audit(tx, ctx, mun, 'DOCUMENT_UPLOADED', 'Document', 'success', { ...meta, entityId: pending.id, folio: request.folio });
        return active;
      });
      return present.document(doc);
    },

    async listDocuments(ctx, munCode, folioValue) {
      const { mun } = await gate(ctx, 'municipal.documents.read', munCode);
      const request = await loadInScope(ctx, mun, folioValue);
      return (await store.documentsOf(mun.id, request.id))
        .filter((d) => d.status === 'VIGENTE')
        .map((d) => (access.canReadDocument(ctx, request, d) ? present.document(d) : { id: d.id, confidentiality: d.confidentiality, restricted: true }));
    },

    async downloadDocument(ctx, munCode, folioValue, documentId, meta = {}) {
      const { mun } = await gate(ctx, 'municipal.documents.read', munCode);
      const request = await loadInScope(ctx, mun, folioValue, meta);
      const doc = (await store.documentsOf(mun.id, request.id)).find((d) => d.id === documentId && d.status === 'VIGENTE');
      if (!doc || !access.canReadDocument(ctx, request, doc)) {
        if (doc) await audit(store, ctx, mun, 'ACCESS_DENIED', 'Document', 'denied', { ...meta, entityId: doc.id, folio: request.folio });
        throw notFound();
      }
      const buffer = await storage.get(doc.storageKey);
      // Integridad (docs/munierp/12 §7): el binario debe corresponder al hash registrado al subirlo.
      if (doc.sha256 && crypto.createHash('sha256').update(buffer).digest('hex') !== doc.sha256) {
        await audit(store, ctx, mun, 'DOCUMENT_INTEGRITY_FAILED', 'Document', 'denied', { ...meta, entityId: doc.id, folio: request.folio });
        throw new MunicipalError(500, 'INTERNAL_ERROR', 'El documento no supera la verificación de integridad');
      }
      await audit(store, ctx, mun, 'DOCUMENT_DOWNLOADED', 'Document', 'success', { ...meta, entityId: doc.id, folio: request.folio });
      return { headers: docs.downloadHeaders(doc), buffer };
    },

    async indicators(ctx, munCode, query) {
      const { mun } = await gate(ctx, 'municipal.indicators.read', munCode);
      const deps = await depsOf(mun);
      const filter = scopedFilter(ctx);
      const narrow = [filter || { municipalityId: '__ninguno__' }];
      if (query.dependency) {
        const dep = deps.byCode.get(query.dependency);
        narrow.push({ ownerDependencyId: dep ? dep.id : '__ninguna__' });
      }
      const rows = (await store.findRequests({ $and: narrow })).filter((r) => access.canReadRequest(ctx, r));
      const result = computeIndicators(rows, { from: query.from, to: query.to, now: clock(), slaDays: query.slaDays });
      result.byDependency = Object.fromEntries(Object.entries(result.byDependency).map(([id, n]) => [deps.codeOf(id) || id, n]));
      return result;
    },

    /** Membresías vigentes del usuario autenticado (solo requiere identidad central). */
    async myMemberships(userId) {
      const now = clock();
      const active = (await store.membershipsOf(userId)).filter((m) => access.isMembershipActive(m, now));
      const out = [];
      for (const m of active) {
        const municipality = await store.municipalityById(m.municipalityId);
        if (!municipality) continue;
        const deps = await depsOf(municipality);
        out.push(present.myMembership(m, municipality, m.dependencyIds.map((id) => deps.codeOf(id)).filter(Boolean)));
      }
      return out;
    },

    async listDependencies(ctx, munCode, query = {}) {
      const { mun } = await gate(ctx, 'municipal.dependencies.read', munCode);
      const { all, byId } = await depsOf(mun);
      return all
        .filter((d) => !query.status || d.status === query.status)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((d) => present.dependency(d, d.parentCode || (d.parentId && byId.get(d.parentId) ? byId.get(d.parentId).code : null)));
    },

    /* ----------------------------- F1-12: dependencias ----------------------------- */

    async createDependency(ctx, munCode, body, meta = {}) {
      const { mun } = await gate(ctx, 'municipal.dependencies.manage', munCode);
      const input = V.validateDependencyCreate(body);
      if (input.parentCode) {
        const parent = (await depsOf(mun)).byCode.get(input.parentCode);
        if (!parent || parent.status !== 'ACTIVA') throw new MunicipalError(400, 'VALIDATION_ERROR', 'Dependencia superior inexistente o inactiva');
      }
      const doc = await store.transaction(async (tx) => {
        const saved = await tx.insertDependency({ id: tx.newId(), municipalityId: mun.id, code: input.code, name: input.name, parentCode: input.parentCode, status: 'ACTIVA', createdBy: ctx.userId, createdAt: clock() });
        await audit(tx, ctx, mun, 'DEPENDENCY_CREATED', 'Dependency', 'success', { ...meta, entityId: saved.id });
        return saved;
      }).catch((e) => {
        if (e.code === 'DUPLICATE_DEPENDENCY') throw new MunicipalError(409, 'CONFLICT', 'Ya existe una dependencia con ese código en el municipio');
        throw e;
      });
      return present.dependency(doc, doc.parentCode);
    },

    async updateDependency(ctx, munCode, code, body, meta = {}) {
      const { mun } = await gate(ctx, 'municipal.dependencies.manage', munCode);
      const input = V.validateDependencyUpdate(body);
      const saved = await store.transaction(async (tx) => {
        const deps = await depsOf(mun, tx);
        const dep = deps.byCode.get(code);
        if (!dep) throw notFound();
        if (input.status === 'INACTIVA' && dep.status === 'ACTIVA') {
          const open = (await tx.findRequests({ municipalityId: mun.id }))
            .filter((r) => !access.TERMINAL.includes(r.status))
            .filter((r) => r.ownerDependencyId === dep.id || (r.assignedDependencyIds || []).includes(dep.id));
          if (open.length) throw new MunicipalError(409, 'CONFLICT', `La dependencia tiene ${open.length} expediente(s) abierto(s); concluya o turne antes de desactivar`);
          const children = deps.all.filter((d) => d.parentCode === dep.code && d.status === 'ACTIVA');
          if (children.length) throw new MunicipalError(409, 'CONFLICT', 'La dependencia tiene dependencias subordinadas activas');
        }
        const updated = await tx.updateDependency(mun.id, dep.id, { ...input, updatedAt: clock(), updatedBy: ctx.userId });
        await audit(tx, ctx, mun, 'DEPENDENCY_UPDATED', 'Dependency', 'success', { ...meta, entityId: dep.id });
        return updated;
      });
      return present.dependency(saved, saved.parentCode);
    },

    /* ----------------------------- F1-12: membresías ------------------------------ */

    async listMemberships(ctx, munCode, query = {}) {
      const { mun, scope } = await gate(ctx, 'municipal.memberships.read', munCode);
      const now = clock();
      const deps = await depsOf(mun);
      let rows = await store.membershipsIn(mun.id);
      if (scope === 'D') rows = rows.filter((m) => m.dependencyIds.some((d) => ctx.membership.dependencyIds.includes(d)));
      if (query.role) rows = rows.filter((m) => m.role === query.role);
      if (query.status) rows = rows.filter((m) => m.status === query.status);
      if (query.dependency) {
        const dep = deps.byCode.get(query.dependency);
        rows = rows.filter((m) => !!dep && m.dependencyIds.includes(dep.id));
      }
      rows.sort((a, b) => (a.role + a.id).localeCompare(b.role + b.id));
      const { slice, pagination } = page(rows, query);
      return { items: slice.map((m) => present.membership(m, m.dependencyIds.map(deps.codeOf).filter(Boolean), access.isMembershipActive(m, now))), pagination };
    },

    async createMembership(ctx, munCode, body, meta = {}) {
      const { mun } = await gate(ctx, 'municipal.memberships.manage', munCode);
      const now = clock();
      const input = V.validateMembershipCreate(body, now);
      if (input.userId === ctx.userId) throw new MunicipalError(403, 'FORBIDDEN', 'No puede asignarse una membresía a sí mismo');
      if (!canAssignRole(ctx.membership.role, input.role))
        throw new MunicipalError(403, 'FORBIDDEN', 'Rol no asignable por el actor');
      const depIds = resolveDependencyIds(await depsOf(mun), input.dependencies);
      if (typeof userLookup !== 'function') throw new MunicipalError(503, 'AUTHORIZATION_UNAVAILABLE', 'Identidad central no disponible');
      let central;
      try { central = await userLookup(input.userId); } catch (_) { throw new MunicipalError(503, 'AUTHORIZATION_UNAVAILABLE', 'Identidad central no disponible'); }
      if (!central || central.id !== input.userId) throw new MunicipalError(404, 'NOT_FOUND', 'Usuario no encontrado o inactivo en la identidad central');
      const doc = await store.transaction(async (tx) => {
        const saved = await tx.insertMembership({
          id: tx.newId(), userId: input.userId, municipalityId: mun.id, role: input.role, dependencyIds: depIds,
          status: 'ACTIVA', validFrom: input.validFrom, validTo: input.validTo, version: 0, createdBy: ctx.userId, createdAt: now,
        });
        await audit(tx, ctx, mun, 'MEMBERSHIP_CREATED', 'Membership', 'success', { ...meta, entityId: saved.id });
        return saved;
      }).catch((e) => {
        if (e.code === 'DUPLICATE_MEMBERSHIP') throw new MunicipalError(409, 'CONFLICT', 'El usuario ya tiene una membresía en este municipio');
        throw e;
      });
      return present.membership(doc, input.dependencies, access.isMembershipActive(doc, now));
    },

    async updateMembership(ctx, munCode, membershipId, body, meta = {}) {
      const { mun } = await gate(ctx, 'municipal.memberships.manage', munCode);
      const now = clock();
      const input = V.validateMembershipUpdate(body, now);
      // El puerto filtra por municipio: otro municipio o inexistente → null → mismo 404.
      const current = await store.membership(mun.id, membershipId);
      if (!current) throw notFound();
      if (current.userId === ctx.userId) throw new MunicipalError(403, 'FORBIDDEN', 'No puede modificar su propia membresía');
      if (current.role === 'ADMIN_MUNICIPAL') throw new MunicipalError(403, 'FORBIDDEN', 'Las membresías ADMIN_MUNICIPAL solo se gestionan por bootstrap/ops');
      if (input.role && !canAssignRole(ctx.membership.role, input.role))
        throw new MunicipalError(403, 'FORBIDDEN', 'Rol no asignable por el actor');
      const deps = await depsOf(mun);
      const patch = { updatedAt: now, updatedBy: ctx.userId };
      if (input.role) patch.role = input.role;
      if (input.status) patch.status = input.status;
      if (input.validTo !== undefined) patch.validTo = input.validTo;
      if (input.dependencies) patch.dependencyIds = resolveDependencyIds(deps, input.dependencies);
      const role = patch.role || current.role;
      const depIds = patch.dependencyIds || current.dependencyIds;
      if (V.DEPENDENCY_SCOPED_ROLES.includes(role) && depIds.length === 0)
        throw new MunicipalError(400, 'VALIDATION_ERROR', 'El rol requiere al menos una dependencia');
      const saved = await store.transaction(async (tx) => {
        const updated = await tx.updateMembership(mun.id, current.id, current.version || 0, patch);
        const revoked = current.status === 'ACTIVA' && updated.status === 'INACTIVA';
        await audit(tx, ctx, mun, revoked ? 'MEMBERSHIP_REVOKED' : 'MEMBERSHIP_UPDATED', 'Membership', 'success', { ...meta, entityId: current.id });
        return updated;
      }).catch(conflictOnStale('La membresía cambió; recargue'));
      return present.membership(saved, saved.dependencyIds.map(deps.codeOf).filter(Boolean), access.isMembershipActive(saved, now));
    },

    async createCitizen(ctx, munCode, body, meta = {}) {
      const { mun } = await gate(ctx, 'municipal.citizens.create', munCode);
      const input = V.validateCitizenCreate(body);
      const doc = await store.transaction(async (tx) => {
        const saved = await tx.insertCitizen({ id: tx.newId(), municipalityId: mun.id, ...input, createdBy: ctx.userId, createdAt: clock() });
        await audit(tx, ctx, mun, 'CITIZEN_CREATED', 'Citizen', 'success', { ...meta, entityId: saved.id });
        return saved;
      });
      return present.citizen(doc);
    },

    /** Ciudadanos visibles: todos (M) o los vinculados a expedientes en alcance y los creados por el actor. */
    async searchCitizens(ctx, munCode, query = {}) {
      const { mun, scope } = await gate(ctx, 'municipal.citizens.read', munCode);
      let visible = await store.citizens(mun.id);
      if (scope !== 'M' && scope !== 'ALL') {
        const filter = scopedFilter(ctx);
        const linked = new Set((filter ? await store.findRequests(filter) : []).filter((r) => access.canReadRequest(ctx, r)).map((r) => r.citizenId));
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
      const { mun } = await gate(ctx, 'municipal.requests.update', munCode);
      const input = V.validateRequestUpdate(body);
      const current = await loadInScope(ctx, mun, folioValue, meta);
      if (access.TERMINAL.includes(current.status)) throw new MunicipalError(409, 'INVALID_TRANSITION', 'Expediente concluido');
      if (!access.canWriteRequest(ctx, current, 'municipal.requests.update')) throw new MunicipalError(403, 'FORBIDDEN', 'Sin permiso sobre este expediente');
      if (expectedVersion !== current.version) throw new MunicipalError(409, 'CONFLICT', 'La solicitud cambió; recargue');
      if (input.confidentiality && input.confidentiality !== current.confidentiality &&
          !access.canWriteRequest(ctx, current, 'municipal.requests.readConfidential'))
        throw new MunicipalError(403, 'FORBIDDEN', 'Cambiar la confidencialidad requiere municipal.requests.readConfidential');
      const at = clock();
      const saved = await store.transaction(async (tx) => {
        const updated = await tx.updateRequest(mun.id, current.id, current.version, {
          ...input, version: current.version + 1, updatedAt: at,
          history: [...(current.history || []), editEntry(ctx.userId, at, current.status, Object.keys(input))],
        });
        await audit(tx, ctx, mun, 'REQUEST_UPDATED', 'Request', 'success', { ...meta, entityId: current.id, folio: current.folio });
        return updated;
      }).catch(conflictOnStale('La solicitud cambió; recargue'));
      return toDto(ctx, mun, saved);
    },

    async createGrant(ctx, munCode, folioValue, body, meta = {}) {
      const { mun } = await gate(ctx, 'municipal.requests.grant', munCode);
      const input = V.validateGrantCreate(body, clock());
      const request = await loadInScope(ctx, mun, folioValue, meta);
      if (!access.canWriteRequest(ctx, request, 'municipal.requests.grant')) {
        if (access.TERMINAL.includes(request.status)) throw new MunicipalError(409, 'INVALID_TRANSITION', 'Expediente concluido');
        throw new MunicipalError(403, 'FORBIDDEN', 'Sin permiso para compartir este expediente');
      }
      let granteeDependencyId = null;
      if (input.granteeDependency) {
        const dep = (await depsOf(mun)).byCode.get(input.granteeDependency);
        if (!dep || dep.status !== 'ACTIVA') throw new MunicipalError(400, 'VALIDATION_ERROR', 'Dependencia inválida');
        granteeDependencyId = dep.id;
      }
      if (input.granteeUserId) {
        if (input.granteeUserId === ctx.userId) throw new MunicipalError(400, 'VALIDATION_ERROR', 'No puede compartirse consigo mismo');
        const target = (await store.membershipsOf(input.granteeUserId)).find((m) => m.municipalityId === mun.id && access.isMembershipActive(m, clock()));
        if (!target) throw new MunicipalError(400, 'VALIDATION_ERROR', 'El usuario no tiene membresía vigente en el municipio');
      }
      const grant = {
        id: store.newId(), requestId: request.id, municipalityId: mun.id, granteeUserId: input.granteeUserId,
        granteeDependencyId, level: input.level, expiresAt: input.expiresAt, revokedAt: null, grantedBy: ctx.userId, createdAt: clock(),
      };
      await store.transaction(async (tx) => {
        await tx.addGrant(grant);
        await audit(tx, ctx, mun, 'GRANT_CREATED', 'Grant', 'success', { ...meta, entityId: grant.id, folio: request.folio });
      });
      return { id: grant.id, folio: request.folio, granteeUserId: grant.granteeUserId || undefined, granteeDependency: input.granteeDependency || undefined, level: grant.level, expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null };
    },

    async revokeGrant(ctx, munCode, folioValue, grantId, meta = {}) {
      const { mun } = await gate(ctx, 'municipal.requests.grant', munCode);
      const request = await loadInScope(ctx, mun, folioValue, meta);
      const grant = await store.grant(mun.id, grantId);
      if (!grant || grant.requestId !== request.id || grant.revokedAt) throw notFound();
      const openView = access.TERMINAL.includes(request.status) ? { ...request, status: 'EN_TRAMITE' } : request;
      if (!access.canWriteRequest(ctx, openView, 'municipal.requests.grant'))
        throw new MunicipalError(403, 'FORBIDDEN', 'Sin permiso para revocar');
      await store.transaction(async (tx) => {
        // Si otra petición la revocó entre la lectura y la escritura: mismo 404.
        if (!(await tx.revokeGrant(mun.id, grantId, clock()))) throw notFound();
        await audit(tx, ctx, mun, 'GRANT_REVOKED', 'Grant', 'success', { ...meta, entityId: grantId, folio: request.folio });
      });
    },

    async verifyFolio(ctx, munCode, folioValue, meta) {
      const { mun } = await gate(ctx, 'municipal.requests.read', munCode);
      const r = await loadInScope(ctx, mun, folioValue, meta);
      const parts = folio.parseFolio(r.folio);
      const deps = await depsOf(mun);
      return { folio: r.folio, type: r.type, ownerDependency: deps.codeOf(r.ownerDependencyId), year: parts.year, sequence: parts.sequence, status: r.status, createdAt: present.iso(r.createdAt) };
    },

    async listAuditEvents(ctx, munCode, query = {}) {
      const { mun } = await gate(ctx, 'municipal.audit.read', munCode);
      const rows = (await store.auditEvents(mun.id))
        .filter((e) => !query.folio || e.folio === query.folio)
        .filter((e) => !query.entityId || e.entityId === query.entityId)
        .filter((e) => !query.from || e.at >= query.from)
        .filter((e) => !query.to || e.at < query.to)
        .sort((a, b) => b.at - a.at);
      const { slice, pagination } = page(rows, query);
      return { items: slice.map(present.auditEvent), pagination };
    },

    async receipt(ctx, munCode, folioValue) {
      const { mun } = await gate(ctx, 'municipal.requests.read', munCode);
      const r = await loadInScope(ctx, mun, folioValue);
      const dep = (await depsOf(mun)).byId.get(r.ownerDependencyId);
      return buildReceipt(r, { municipalityName: mun.name, dependencyName: dep ? dep.name : '' });
    },
  };
}

module.exports = { createMunicipalService, MunicipalError };
