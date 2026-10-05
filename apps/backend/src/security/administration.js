const mongoose = require('mongoose');
const User = require('../modules/users/users.model');
const Role = require('../modules/roles/roles.model');
const rbac = require('./rbac');
const {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} = require('../shared/errors/appErrors');
const SYSTEM_ROLES = Object.freeze(Object.keys(rbac.ROLE_PERMISSIONS));
const system = (name) => SYSTEM_ROLES.includes(name) || ['super_admin', 'viewer'].includes(name);
const subset = (permissions, actor) =>
  actor.isSuperadmin || permissions.every((p) => actor.permissions.includes(p));
async function role(name, session) {
  if (typeof name !== 'string' || !/^[a-z][a-z0-9_]{1,63}$/.test(name))
    throw new ValidationError('Rol inválido');
  name = rbac.normalizeRole(name);
  const read = (key) =>
    session
      ? Role.findOneAndUpdate(
          { name: key },
          { $inc: { __v: 1 } },
          { new: true, session, timestamps: false },
        )
      : Role.findOne({ name: key }).lean();
  let stored = await read(name);
  if (!stored && name === 'superadmin') stored = await read('super_admin');
  if (stored)
    return { name, status: stored.status, permissions: stored.permissions, isSystem: system(name) };
  if (!system(name)) throw new ValidationError('Rol inexistente');
  return { name, status: 'active', permissions: rbac.ROLE_PERMISSIONS[name] || [], isSystem: true };
}
async function assignable(name, actor, session) {
  const selected = await role(name, session);
  if (selected.status !== 'active') throw new ValidationError('Rol inactivo');
  if (
    (selected.name === 'superadmin' && !actor.isSuperadmin) ||
    !subset(selected.permissions, actor)
  )
    throw new ForbiddenError('No puede asignar este rol');
  return selected;
}
async function transaction(actor, permission, operation, trace, options) {
  let result;
  await mongoose.connection.transaction(async (session) => {
    trace?.mark('database_lookup');
    // Actor/role locks serialize authorization changes with administrative writes.
    const current = await User.findOneAndUpdate(
      { _id: actor.id, status: 'active' },
      { $inc: { __v: 1 } },
      { new: true, session, timestamps: false },
    ).select('+sessionVersion');
    trace?.mark('authorization');
    if (!current || (current.sessionVersion || 0) !== (actor.sessionVersion || 0))
      throw new UnauthorizedError('Sesión revocada');
    trace?.mark('database_lookup');
    const selected = await role(current.role, session);
    const fresh = {
      ...actor,
      role: selected.name,
      isSuperadmin: selected.name === 'superadmin' && selected.status === 'active',
      permissions:
        selected.status === 'active'
          ? selected.permissions.filter((p) => rbac.PERMISSIONS.includes(p))
          : [],
    };
    trace?.mark('authorization');
    if (!rbac.hasPermission(fresh, permission)) throw new ForbiddenError();
    result = await operation(session, fresh);
  }, options);
  return result;
}
module.exports = { SYSTEM_ROLES, system, subset, role, assignable, transaction };
