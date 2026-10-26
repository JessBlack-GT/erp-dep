// @ts-check
'use strict';
/**
 * Construcción del AccessContext municipal a partir del acceso resuelto por el ERP.
 *
 * `erpAccess` es el objeto que devuelve resolveAccess() del ERP (usuario activo y sesión vigente).
 * De él SOLO se usa `id`: el rol y los permisos comerciales se ignoran deliberadamente, de modo que
 * superadmin/admin del ERP no obtienen acceso municipal (ADR-04). Si el ERP no resolvió acceso
 * (usuario inactivo, sesión revocada), la capa HTTP ya respondió 401 y esta función no se invoca.
 *
 * @param {{ erpAccess: { id: string }, memberships: Array<import('./access').Membership>,
 *   grants?: Array<import('./access').Grant & { municipalityId?: string }>, municipalityId: string, now: Date }} input
 * @returns {import('./access').AccessContext}
 */
function buildAccessContext({ erpAccess, memberships, grants = [], municipalityId, now }) {
  if (!erpAccess || typeof erpAccess.id !== 'string' || !erpAccess.id) throw new TypeError('Acceso del ERP requerido');
  const membership =
    memberships.find((m) => m.userId === erpAccess.id && m.municipalityId === municipalityId) || null;
  return {
    userId: erpAccess.id,
    membership,
    grants: grants.filter((g) => !g.municipalityId || g.municipalityId === municipalityId),
    now,
  };
}

module.exports = { buildAccessContext };
