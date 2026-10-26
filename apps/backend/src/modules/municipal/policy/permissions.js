// @ts-check
'use strict';
/**
 * MuniERP IA — catálogo de permisos municipales (ADR-04).
 * INDEPENDIENTE de src/security/rbac.js: ningún rol del ERP concede estos permisos.
 * Matriz: docs/munierp/04-ROLES-PERMISOS.md. Cualquier cambio debe actualizar el documento y la
 * prueba que congela esta matriz (tests/municipal/permissions.test.js).
 */

/** @typedef {'M'|'D'|'A'|'P'|'META'|'ALL'} Scope */

const PERMISSIONS = Object.freeze([
  'municipal.dependencies.read',
  'municipal.dependencies.manage',
  'municipal.memberships.read',
  'municipal.memberships.manage',
  'municipal.citizens.read',
  'municipal.citizens.create',
  'municipal.citizens.update',
  'municipal.requests.create',
  'municipal.requests.read',
  'municipal.requests.update',
  'municipal.requests.assign',
  'municipal.requests.assignUser',
  'municipal.requests.close',
  'municipal.requests.cancel',
  'municipal.requests.grant',
  'municipal.requests.readConfidential',
  'municipal.documents.read',
  'municipal.documents.upload',
  'municipal.documents.retire',
  'municipal.indicators.read',
  'municipal.audit.read',
]);

const ROLES = Object.freeze([
  'ADMIN_MUNICIPAL',
  'SUPERVISOR_MUNICIPAL',
  'TITULAR_DEPENDENCIA',
  'OPERADOR_DEPENDENCIA',
  'VENTANILLA',
  'AUDITOR_MUNICIPAL',
  'CONSULTA',
]);

const p = (name) => 'municipal.' + name;

/** @type {Readonly<Record<string, Readonly<Record<string, Scope>>>>} */
const ROLE_MATRIX = Object.freeze({
  ADMIN_MUNICIPAL: Object.freeze({
    [p('dependencies.read')]: 'ALL',
    [p('dependencies.manage')]: 'ALL',
    [p('memberships.read')]: 'ALL',
    [p('memberships.manage')]: 'ALL',
  }),
  SUPERVISOR_MUNICIPAL: Object.freeze({
    [p('dependencies.read')]: 'ALL',
    [p('memberships.read')]: 'ALL',
    [p('citizens.read')]: 'M',
    [p('requests.create')]: 'ALL',
    [p('requests.read')]: 'M',
    [p('requests.assign')]: 'M',
    [p('requests.cancel')]: 'M',
    [p('requests.grant')]: 'M',
    [p('requests.readConfidential')]: 'ALL',
    [p('documents.read')]: 'M',
    [p('indicators.read')]: 'M',
  }),
  TITULAR_DEPENDENCIA: Object.freeze({
    [p('dependencies.read')]: 'ALL',
    [p('memberships.read')]: 'D',
    [p('citizens.read')]: 'D',
    [p('citizens.create')]: 'ALL',
    [p('citizens.update')]: 'D',
    [p('requests.create')]: 'D',
    [p('requests.read')]: 'D',
    [p('requests.update')]: 'D',
    [p('requests.assign')]: 'D',
    [p('requests.assignUser')]: 'D',
    [p('requests.close')]: 'D',
    [p('requests.cancel')]: 'D',
    [p('requests.grant')]: 'D',
    [p('requests.readConfidential')]: 'D',
    [p('documents.read')]: 'D',
    [p('documents.upload')]: 'D',
    [p('documents.retire')]: 'D',
    [p('indicators.read')]: 'D',
  }),
  OPERADOR_DEPENDENCIA: Object.freeze({
    [p('dependencies.read')]: 'ALL',
    [p('citizens.read')]: 'D',
    [p('citizens.create')]: 'ALL',
    [p('citizens.update')]: 'D',
    [p('requests.create')]: 'D',
    [p('requests.read')]: 'D',
    [p('requests.update')]: 'A',
    [p('documents.read')]: 'D',
    [p('documents.upload')]: 'D',
  }),
  VENTANILLA: Object.freeze({
    [p('dependencies.read')]: 'ALL',
    [p('citizens.read')]: 'P',
    [p('citizens.create')]: 'ALL',
    [p('citizens.update')]: 'P',
    [p('requests.create')]: 'ALL',
    [p('requests.read')]: 'P',
    [p('documents.read')]: 'P',
    [p('documents.upload')]: 'P',
  }),
  AUDITOR_MUNICIPAL: Object.freeze({
    [p('dependencies.read')]: 'ALL',
    [p('memberships.read')]: 'ALL',
    [p('requests.read')]: 'META',
    [p('indicators.read')]: 'ALL',
    [p('audit.read')]: 'ALL',
  }),
  CONSULTA: Object.freeze({
    [p('dependencies.read')]: 'ALL',
    [p('citizens.read')]: 'D',
    [p('requests.read')]: 'D',
    [p('documents.read')]: 'D',
    [p('indicators.read')]: 'D',
  }),
});

for (const [role, grants] of Object.entries(ROLE_MATRIX)) {
  if (!ROLES.includes(role)) throw new Error('Rol municipal no registrado: ' + role);
  for (const permission of Object.keys(grants))
    if (!PERMISSIONS.includes(permission)) throw new Error('Permiso municipal no registrado: ' + permission);
}

/**
 * Alcance concedido por un rol para un permiso, o null si no lo concede.
 * @param {string} role
 * @param {string} permission
 * @returns {Scope|null}
 */
function scopeFor(role, permission) {
  if (!PERMISSIONS.includes(permission)) throw new Error('Permiso municipal no registrado: ' + permission);
  const grants = ROLE_MATRIX[role];
  return (grants && grants[permission]) || null;
}

/** @param {string} role */
function permissionsOf(role) {
  return Object.keys(ROLE_MATRIX[role] || {});
}

/**
 * Regla de M01 aplicada a membresías: solo se asignan roles cuyos permisos sean subconjunto de los
 * del actor; ADMIN_MUNICIPAL queda reservado al bootstrap.
 * @param {string} actorRole
 * @param {string} targetRole
 */
function canAssignRole(actorRole, targetRole) {
  if (!ROLES.includes(targetRole) || targetRole === 'ADMIN_MUNICIPAL') return false;
  if (actorRole !== 'ADMIN_MUNICIPAL') return false;
  return true;
}

module.exports = { PERMISSIONS, ROLES, ROLE_MATRIX, scopeFor, permissionsOf, canAssignRole };
