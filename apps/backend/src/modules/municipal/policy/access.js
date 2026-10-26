// @ts-check
'use strict';
/**
 * MuniERP IA — política de acceso por municipio, dependencia y expediente (ADR-05, RQ03/RQ05).
 *
 * Funciones puras: no consultan la base de datos. La capa HTTP (pendiente de montaje por Codex)
 * debe: 1) autenticar con el JWT central, 2) llamar a resolveAccess() del ERP (usuario activo +
 * sessionVersion), 3) cargar la membresía y las concesiones vigentes, 4) usar estas funciones.
 * Un token válido NO equivale a autorización: sin membresía activa todo se deniega.
 *
 * Invariante probada: buildRequestScopeFilter(ctx) selecciona exactamente los expedientes para los
 * que canReadRequest(ctx, e) es verdadero (tests/municipal/access.test.js).
 */
const { scopeFor } = require('./permissions');

const TERMINAL = Object.freeze(['CERRADA', 'CANCELADA']);
const CONFIDENTIALITY_RANK = Object.freeze({ PUBLICA: 0, RESERVADA: 1, CONFIDENCIAL: 2 });

/**
 * @typedef {{ id: string, userId: string, municipalityId: string, role: string,
 *   dependencyIds: string[], status: 'ACTIVA'|'INACTIVA', validFrom: Date, validTo?: Date|null }} Membership
 * @typedef {{ requestId: string, granteeUserId?: string|null, granteeDependencyId?: string|null,
 *   level: 'READ'|'CONTRIBUTE', expiresAt?: Date|null, revokedAt?: Date|null }} Grant
 * @typedef {{ userId: string, membership: Membership|null, grants?: Grant[], now: Date }} AccessContext
 * @typedef {{ id: string, municipalityId: string, ownerDependencyId: string,
 *   assignedDependencyIds?: string[], assignedUserId?: string|null, createdBy: string,
 *   confidentiality?: string, status: string }} RequestLike
 */

/** @param {Membership|null|undefined} m @param {Date} now */
function isMembershipActive(m, now) {
  if (!m || m.status !== 'ACTIVA') return false;
  if (m.validFrom && now < m.validFrom) return false;
  if (m.validTo && now >= m.validTo) return false;
  return true;
}

/**
 * Autorización a nivel de ruta (antes de tocar recursos).
 * @param {AccessContext} ctx
 * @param {string} permission
 * @param {string} municipalityId municipio tomado de la RUTA, nunca del cuerpo
 * @returns {{ allowed: true, scope: string } | { allowed: false, status: 403, code: string }}
 */
function authorize(ctx, permission, municipalityId) {
  const m = ctx.membership;
  if (!isMembershipActive(m, ctx.now) || !m || m.municipalityId !== municipalityId || m.userId !== ctx.userId)
    return { allowed: false, status: 403, code: 'MUNICIPAL_MEMBERSHIP_REQUIRED' };
  const scope = scopeFor(m.role, permission);
  if (!scope) return { allowed: false, status: 403, code: 'FORBIDDEN' };
  return { allowed: true, scope };
}

/** @param {AccessContext} ctx @param {RequestLike} e */
function grantsFor(ctx, e) {
  const m = ctx.membership;
  return (ctx.grants || []).filter(
    (g) =>
      g.requestId === e.id &&
      !g.revokedAt &&
      (!g.expiresAt || ctx.now < g.expiresAt) &&
      (g.granteeUserId === ctx.userId || (!!g.granteeDependencyId && !!m && m.dependencyIds.includes(g.granteeDependencyId))),
  );
}

/**
 * IDs de expedientes con concesión vigente para el usuario o sus dependencias.
 * @param {AccessContext} ctx
 */
function activeGrantRequestIds(ctx) {
  const ids = new Set();
  for (const g of ctx.grants || []) if (grantsFor(ctx, { id: g.requestId, municipalityId: '', ownerDependencyId: '', createdBy: '', status: '' }).length) ids.add(g.requestId);
  return [...ids];
}

/** @param {string|null} scope @param {AccessContext} ctx @param {RequestLike} e */
function matchesScope(scope, ctx, e) {
  const m = ctx.membership;
  if (!scope || !m || e.municipalityId !== m.municipalityId) return false;
  switch (scope) {
    case 'ALL':
    case 'M':
    case 'META':
      return true;
    case 'D':
      return (
        m.dependencyIds.includes(e.ownerDependencyId) ||
        (e.assignedDependencyIds || []).some((d) => m.dependencyIds.includes(d))
      );
    case 'A':
      return !!e.assignedUserId && e.assignedUserId === ctx.userId;
    case 'P':
      return e.createdBy === ctx.userId;
    default:
      return false;
  }
}

/** @param {AccessContext} ctx @param {RequestLike} e */
function confidentialAllowed(ctx, e) {
  if (e.confidentiality !== 'CONFIDENCIAL') return true;
  if (e.assignedUserId && e.assignedUserId === ctx.userId) return true;
  const m = ctx.membership;
  return !!m && matchesScope(scopeFor(m.role, 'municipal.requests.readConfidential'), ctx, e);
}

/**
 * Regla de lectura de expediente (docs/munierp/04-ROLES-PERMISOS.md).
 * @param {AccessContext} ctx @param {RequestLike} e
 */
function canReadRequest(ctx, e) {
  const m = ctx.membership;
  if (!isMembershipActive(m, ctx.now) || !m || e.municipalityId !== m.municipalityId) return false;
  const scope = scopeFor(m.role, 'municipal.requests.read');
  if (!scope) return false;
  const reachable =
    matchesScope(scope, ctx, e) ||
    (!!e.assignedUserId && e.assignedUserId === ctx.userId) ||
    grantsFor(ctx, e).length > 0;
  return reachable && confidentialAllowed(ctx, e);
}

/**
 * Filtro Mongo equivalente a canReadRequest. `grantedRequestIds` son los IDs de expedientes con
 * concesión vigente para el usuario o sus dependencias (consulta previa a municipal_request_grants).
 * @param {AccessContext} ctx @param {string[]} [grantedRequestIds]
 * @returns {object|null} null = no puede leer nada (la capa HTTP responde lista vacía o 403)
 */
function buildRequestScopeFilter(ctx, grantedRequestIds = []) {
  const m = ctx.membership;
  if (!isMembershipActive(m, ctx.now) || !m) return null;
  const scope = scopeFor(m.role, 'municipal.requests.read');
  if (!scope) return null;
  const deps = [...m.dependencyIds];
  /** @type {object[]} */
  const reach = [{ assignedUserId: ctx.userId }];
  if (grantedRequestIds.length) reach.push({ _id: { $in: [...grantedRequestIds] } });
  if (['ALL', 'M', 'META'].includes(scope)) reach.push({ municipalityId: m.municipalityId });
  if (scope === 'D') reach.push({ ownerDependencyId: { $in: deps } }, { assignedDependencyIds: { $in: deps } });
  if (scope === 'P') reach.push({ createdBy: ctx.userId });

  const confScope = scopeFor(m.role, 'municipal.requests.readConfidential');
  /** @type {object[]} */
  const conf = [{ confidentiality: { $ne: 'CONFIDENCIAL' } }, { assignedUserId: ctx.userId }];
  if (confScope === 'ALL' || confScope === 'M') conf.push({ municipalityId: m.municipalityId });
  if (confScope === 'D') conf.push({ ownerDependencyId: { $in: deps } }, { assignedDependencyIds: { $in: deps } });

  return { $and: [{ municipalityId: m.municipalityId }, { $or: reach }, { $or: conf }] };
}

/**
 * Escritura sobre un expediente ya legible. CONTRIBUTE permite actualizar/subir documentos si el
 * rol tiene el permiso con cualquier alcance; READ nunca permite escribir.
 * @param {AccessContext} ctx @param {RequestLike} e @param {string} permission
 */
function canWriteRequest(ctx, e, permission) {
  if (!canReadRequest(ctx, e)) return false;
  if (TERMINAL.includes(e.status)) return false;
  const m = /** @type {Membership} */ (ctx.membership);
  const scope = scopeFor(m.role, permission);
  if (!scope || scope === 'META') return false;
  if (matchesScope(scope, ctx, e)) return true;
  const contributes = grantsFor(ctx, e).some((g) => g.level === 'CONTRIBUTE');
  return contributes && ['municipal.requests.update', 'municipal.documents.upload'].includes(permission);
}

/**
 * Lectura/descarga de un documento privado (ADR-10, RQ05). Un documento nunca es menos restrictivo
 * que su expediente.
 * @param {AccessContext} ctx @param {RequestLike} e
 * @param {{ requestId: string, municipalityId: string, confidentiality?: string, status: string }} doc
 */
function canReadDocument(ctx, e, doc) {
  if (!doc || doc.status !== 'VIGENTE' || doc.requestId !== e.id || doc.municipalityId !== e.municipalityId) return false;
  if (!canReadRequest(ctx, e)) return false;
  const m = /** @type {Membership} */ (ctx.membership);
  const scope = scopeFor(m.role, 'municipal.documents.read');
  const viaGrant = grantsFor(ctx, e).length > 0 && !!scope;
  if (!(matchesScope(scope, ctx, e) || viaGrant || (!!scope && e.assignedUserId === ctx.userId))) return false;
  const effective = effectiveConfidentiality(e.confidentiality, doc.confidentiality);
  return confidentialAllowed(ctx, { ...e, confidentiality: effective });
}

/** @param {string|undefined} a @param {string|undefined} b */
function effectiveConfidentiality(a = 'PUBLICA', b = 'PUBLICA') {
  return (CONFIDENTIALITY_RANK[a] ?? 2) >= (CONFIDENTIALITY_RANK[b] ?? 2) ? a : b;
}

const META_FIELDS = Object.freeze(['folio', 'type', 'status', 'ownerDependencyId', 'assignedDependencyIds', 'confidentiality', 'channel', 'createdAt', 'updatedAt']);

/**
 * Proyección según alcance: el auditor (META) nunca recibe asunto, descripción ni ciudadano.
 * @param {AccessContext} ctx @param {Record<string, any>} e
 */
function projectRequest(ctx, e) {
  const m = ctx.membership;
  const scope = m ? scopeFor(m.role, 'municipal.requests.read') : null;
  if (scope === 'META') return Object.fromEntries(META_FIELDS.filter((k) => k in e).map((k) => [k, e[k]]));
  const { idempotencyKey, payloadHash, ...visible } = e; // eslint-disable-line no-unused-vars
  return visible;
}

module.exports = {
  TERMINAL,
  isMembershipActive,
  authorize,
  activeGrantRequestIds,
  canReadRequest,
  buildRequestScopeFilter,
  canWriteRequest,
  canReadDocument,
  effectiveConfidentiality,
  projectRequest,
};
