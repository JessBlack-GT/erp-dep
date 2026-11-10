// @ts-check
'use strict';
/**
 * MuniERP IA — capa HTTP (F1-04). Conecta las operaciones del contrato municipal-v1 con
 * application/municipal.service.js. Sin lógica de negocio: valida forma HTTP, construye el contexto
 * de acceso y traduce resultados/errores.
 *
 * Cadena por petición:
 *   ensureErrorCode → requestMeta → JSON → identidad ERP (JWT + usuario activo + sesión)
 *   → contexto municipal (membresía/concesiones desde el almacén, nunca desde el cliente)
 *   → servicio (permiso por operación + alcance por dependencia y expediente) → DTO del contrato.
 *
 * Compatible con Express 4 y 5: handlers async envueltos, sin rutas comodín `*`, sin `req.param`.
 * NO montado en app.js del ERP (dependencia C-01).
 */
const crypto = require('crypto');
const express = require('express');
const { HttpError, toErrorResponse, ensureErrorCode } = require('./errors');
const P = require('./params');
const { buildAccessContext } = require('../policy/context');

/**
 * Operaciones del contrato pendientes de historia propia. Responden 501 tras autenticar.
 * Vacío desde F1-12 (2026-11-09): las 24 operaciones están implementadas.
 */
const PENDING = Object.freeze({});

const REQUEST_ID = /^[A-Za-z0-9._-]{8,100}$/;

function requestMeta(req, res, next) {
  const incoming = req.get('X-Request-Id');
  const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
  res.set('X-Request-Id', requestId);
  // IP según la configuración `trust proxy` de la app anfitriona (en el ERP: 1 salto).
  req.municipalMeta = { ip: req.ip || null, requestId };
  next();
}

const ok = (res, status, data, extra = {}) => res.status(status).json({ success: true, data, ...extra });

/**
 * Tabla de rutas = fuente única para el registro en Express y para la prueba de sincronía con el
 * OpenAPI. `path` usa la sintaxis del contrato ({param}).
 * @type {Array<{ method: 'get'|'post'|'patch'|'delete', path: string, operationId: string, handler?: Function }>}
 */
function routeTable(service) {
  /** Contexto municipal (asíncrono desde F1-05: membresías y concesiones salen del puerto). */
  const ctx = (req) => req.municipalCtx(P.mun(req.params.mun));
  const meta = (req) => req.municipalMeta;
  const list = (res, r) => ok(res, 200, r.items, { pagination: r.pagination });
  return [
    { method: 'get', path: '/me/memberships', operationId: 'listMyMemberships',
      handler: async (req, res) => ok(res, 200, await service.myMemberships(req.user.id)) },

    { method: 'get', path: '/municipalities/{mun}/dependencies', operationId: 'listDependencies',
      handler: async (req, res) => {
        const c = await ctx(req);
        return ok(res, 200, await service.listDependencies(c, req.params.mun, P.parseQuery(req.query, { status: P.q.activeStatus })));
      } },
    { method: 'post', path: '/municipalities/{mun}/dependencies', operationId: 'createDependency',
      handler: async (req, res) => ok(res, 201, await service.createDependency(await ctx(req), req.params.mun, req.body, meta(req))) },
    { method: 'patch', path: '/municipalities/{mun}/dependencies/{code}', operationId: 'updateDependency',
      handler: async (req, res) => {
        const c = await ctx(req);
        return ok(res, 200, await service.updateDependency(c, req.params.mun, P.depCodeOr404(req.params.code), req.body, meta(req)));
      } },
    { method: 'get', path: '/municipalities/{mun}/memberships', operationId: 'listMemberships',
      handler: async (req, res) => {
        const query = P.parseQuery(req.query, { role: P.q.role, dependency: P.q.dependency, status: P.q.activeStatus, page: P.q.page, limit: P.q.limit });
        return list(res, await service.listMemberships(await ctx(req), req.params.mun, query));
      } },
    { method: 'post', path: '/municipalities/{mun}/memberships', operationId: 'createMembership',
      handler: async (req, res) => ok(res, 201, await service.createMembership(await ctx(req), req.params.mun, req.body, meta(req))) },
    { method: 'patch', path: '/municipalities/{mun}/memberships/{membershipId}', operationId: 'updateMembership',
      handler: async (req, res) => {
        const c = await ctx(req);
        return ok(res, 200, await service.updateMembership(c, req.params.mun, P.objectIdOr404(req.params.membershipId), req.body, meta(req)));
      } },

    { method: 'post', path: '/municipalities/{mun}/citizens', operationId: 'createCitizen',
      handler: async (req, res) => ok(res, 201, await service.createCitizen(await ctx(req), req.params.mun, req.body, meta(req))) },
    { method: 'get', path: '/municipalities/{mun}/citizens', operationId: 'searchCitizens',
      handler: async (req, res) => {
        const c = await ctx(req);
        return list(res, await service.searchCitizens(c, req.params.mun, P.parseQuery(req.query, { q: P.q.search, page: P.q.page, limit: P.q.limit })));
      } },

    { method: 'post', path: '/municipalities/{mun}/requests', operationId: 'createRequest',
      handler: async (req, res) => {
        const c = await ctx(req);
        const r = await service.createRequest(c, req.params.mun, req.body, P.idempotencyKey(req), meta(req));
        if (r.data.version !== undefined) res.set('ETag', `"${r.data.version}"`);
        return ok(res, r.status, r.data);
      } },
    { method: 'get', path: '/municipalities/{mun}/requests', operationId: 'listRequests',
      handler: async (req, res) => {
        const query = P.parseQuery(req.query, { status: P.q.status, dependency: P.q.dependency, assignedToMe: P.q.bool, page: P.q.page, limit: P.q.limit });
        return list(res, await service.listRequests(await ctx(req), req.params.mun, query));
      } },
    { method: 'get', path: '/municipalities/{mun}/requests/{folio}', operationId: 'getRequest',
      handler: async (req, res) => {
        const c = await ctx(req);
        const data = await service.getRequest(c, req.params.mun, P.folio(req.params.folio), meta(req));
        if (data.version !== undefined) res.set('ETag', `"${data.version}"`);
        return ok(res, 200, data);
      } },
    { method: 'patch', path: '/municipalities/{mun}/requests/{folio}', operationId: 'updateRequest',
      handler: async (req, res) => {
        const c = await ctx(req);
        const folio = P.folio(req.params.folio);
        const version = P.ifMatchVersion(req);
        const data = await service.updateRequest(c, req.params.mun, folio, req.body, version, meta(req));
        res.set('ETag', `"${data.version}"`);
        return ok(res, 200, data);
      } },
    { method: 'post', path: '/municipalities/{mun}/requests/{folio}/transitions', operationId: 'transitionRequest',
      handler: async (req, res) => {
        const c = await ctx(req);
        const data = await service.transition(c, req.params.mun, P.folio(req.params.folio), req.body, meta(req));
        res.set('ETag', `"${data.version}"`);
        return ok(res, 200, data);
      } },
    { method: 'post', path: '/municipalities/{mun}/requests/{folio}/grants', operationId: 'createGrant',
      handler: async (req, res) => {
        const c = await ctx(req);
        return ok(res, 201, await service.createGrant(c, req.params.mun, P.folio(req.params.folio), req.body, meta(req)));
      } },
    { method: 'delete', path: '/municipalities/{mun}/requests/{folio}/grants/{grantId}', operationId: 'revokeGrant',
      handler: async (req, res) => {
        const c = await ctx(req);
        await service.revokeGrant(c, req.params.mun, P.folio(req.params.folio), P.objectIdOr404(req.params.grantId), meta(req));
        return res.status(204).end();
      } },
    { method: 'get', path: '/municipalities/{mun}/requests/{folio}/history', operationId: 'getRequestHistory',
      handler: async (req, res) => {
        const c = await ctx(req);
        return ok(res, 200, await service.getHistory(c, req.params.mun, P.folio(req.params.folio)));
      } },
    { method: 'get', path: '/municipalities/{mun}/requests/{folio}/receipt', operationId: 'getRequestReceipt',
      handler: async (req, res) => {
        const c = await ctx(req);
        return ok(res, 200, await service.receipt(c, req.params.mun, P.folio(req.params.folio)));
      } },
    { method: 'get', path: '/municipalities/{mun}/requests/{folio}/documents', operationId: 'listDocuments',
      handler: async (req, res) => {
        const c = await ctx(req);
        return ok(res, 200, await service.listDocuments(c, req.params.mun, P.folio(req.params.folio)));
      } },
    { method: 'post', path: '/municipalities/{mun}/requests/{folio}/documents', operationId: 'uploadDocument',
      handler: async (req, res) => {
        const c = await ctx(req);
        return ok(res, 201, await service.uploadDocument(c, req.params.mun, P.folio(req.params.folio), req.body, meta(req)));
      } },
    { method: 'get', path: '/municipalities/{mun}/requests/{folio}/documents/{documentId}/content', operationId: 'downloadDocument',
      handler: async (req, res) => {
        const c = await ctx(req);
        const out = await service.downloadDocument(c, req.params.mun, P.folio(req.params.folio), P.objectIdOr404(req.params.documentId), meta(req));
        res.status(200).set(out.headers);
        return res.end(out.buffer);
      } },
    { method: 'get', path: '/municipalities/{mun}/indicators', operationId: 'getIndicators',
      handler: async (req, res) => {
        const query = P.parseQuery(req.query, { from: P.q.dateTime, to: P.q.dateTime, dependency: P.q.dependency, slaDays: P.q.slaDays });
        if (!query.from || !query.to) throw new HttpError(400, 'VALIDATION_ERROR', 'from y to son obligatorios', ['from', 'to']);
        if (query.from >= query.to) throw new HttpError(400, 'VALIDATION_ERROR', 'from debe ser anterior a to', ['from', 'to']);
        return ok(res, 200, await service.indicators(await ctx(req), req.params.mun, query));
      } },
    { method: 'get', path: '/municipalities/{mun}/folios/{folio}', operationId: 'verifyFolio',
      handler: async (req, res) => {
        const c = await ctx(req);
        return ok(res, 200, await service.verifyFolio(c, req.params.mun, P.folio(req.params.folio), meta(req)));
      } },
    { method: 'get', path: '/municipalities/{mun}/audit-events', operationId: 'listAuditEvents',
      handler: async (req, res) => {
        const query = P.parseQuery(req.query, { entityId: P.q.objectId, folio: P.q.folio, from: P.q.dateTime, to: P.q.dateTime, page: P.q.page, limit: P.q.limit });
        return list(res, await service.listAuditEvents(await ctx(req), req.params.mun, query));
      } },
  ];
}

/** `{param}` del contrato → `:param` de Express. */
const toExpressPath = (p) => p.replace(/\{(\w+)\}/g, ':$1');

/**
 * @param {{ service: any, store: any, clock?: () => Date, identity: Function[], jsonLimit?: string, environment?: string, allowProduction?: boolean }} deps
 *   `identity`: middlewares que dejan en `req.user` el acceso resuelto por el ERP. En producción y en
 *   pruebas se usa `erpIdentityMiddlewares()` (los middlewares reales del ERP).
 */
function createMunicipalRouter({ service, store, clock = () => new Date(), identity, jsonLimit = '10mb', environment = process.env.NODE_ENV, allowProduction = false }) {
  if (!Array.isArray(identity) || identity.length === 0) throw new Error('La identidad central del ERP es obligatoria');
  // Salvaguarda: la API municipal no puede activarse en producción sin decisión explícita (C-01).
  if (environment === 'production' && allowProduction !== true)
    throw new Error('API municipal deshabilitada en producción: requiere allowProduction:true tras aprobación del contrato (C-01)');
  const router = express.Router({ caseSensitive: true, strict: false });
  router.use(ensureErrorCode, requestMeta, express.json({ limit: jsonLimit, strict: true }), ...identity);

  // Contexto municipal: SOLO el id del acceso resuelto por el ERP; rol/permisos comerciales se ignoran.
  router.use((req, res, next) => {
    if (!req.user || typeof req.user.id !== 'string' || !req.user.id) return next(new HttpError(401, 'UNAUTHORIZED', 'No autenticado'));
    const userId = req.user.id;
    req.municipalCtx = async (munCode) => {
      const municipality = await store.municipalityByCode(munCode);
      // Municipio inexistente: misma respuesta que sin membresía (no revela qué municipios existen).
      if (!municipality) throw new HttpError(403, 'MUNICIPAL_MEMBERSHIP_REQUIRED', 'Sin acceso al municipio');
      return buildAccessContext({
        erpAccess: { id: userId },
        memberships: await store.membershipsOf(userId),
        grants: await store.grantsFor(municipality.id),
        municipalityId: municipality.id,
        now: clock(),
      });
    };
    next();
  });

  for (const route of routeTable(service)) {
    const handler = route.handler || ((req) => {
      P.mun(req.params.mun);
      throw new HttpError(501, 'NOT_IMPLEMENTED', `Operación ${route.operationId} pendiente (${PENDING[route.operationId]})`);
    });
    router[route.method](toExpressPath(route.path), (req, res, next) => {
      Promise.resolve()
        .then(() => handler(req, res))
        .catch(next);
    });
  }

  router.use((req, res, next) => next(new HttpError(404, 'NOT_FOUND', 'Recurso no encontrado')));
  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    const { status, body } = toErrorResponse(err);
    if (res.headersSent) return res.end();
    return res.status(status).json(body);
  });
  return router;
}

/** Inventario de rutas para la prueba de sincronía con el contrato. */
function listRoutes() {
  return routeTable({}).map(({ method, path, operationId, handler }) => ({ method, path, operationId, implemented: !!handler }));
}

module.exports = { createMunicipalRouter, listRoutes, PENDING, toExpressPath };
