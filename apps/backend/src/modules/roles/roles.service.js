const Role = require('./roles.model');
const v = require('../users/users.validation');
const admin = require('../../security/administration');
const rbac = require('../../security/rbac');
const { ForbiddenError, NotFoundError } = require('../../shared/errors/appErrors');
function payload(data, create) {
  v.object(
    data,
    create ? ['name', 'description', 'permissions'] : ['description', 'permissions', 'status'],
  );
  if (
    create &&
    (typeof data.name !== 'string' ||
      !/^[a-z][a-z0-9_]{1,63}$/.test(data.name) ||
      admin.system(data.name))
  )
    v.fail();
  if (
    data.description !== undefined &&
    (typeof data.description !== 'string' || data.description.length > 500)
  )
    v.fail();
  if (data.status !== undefined && !['active', 'inactive'].includes(data.status)) v.fail();
  if (
    (create || data.permissions !== undefined) &&
    (!Array.isArray(data.permissions) ||
      data.permissions.some((p) => !rbac.PERMISSIONS.includes(p)) ||
      new Set(data.permissions).size !== data.permissions.length)
  )
    v.fail();
  if (!Object.keys(data).length) v.fail();
  return data;
}
function decorate(role, actor) {
  return {
    name: role.name,
    description: role.description || '',
    permissions: role.permissions,
    status: role.status,
    isSystem: admin.system(role.name),
    editable:
      !admin.system(role.name) &&
      role.name !== actor.role &&
      rbac.hasPermission(actor, 'roles.manage') &&
      admin.subset(role.permissions, actor),
  };
}
exports.list = async (actor) => {
  const stored = await Role.find().lean();
  const roles = admin.SYSTEM_ROLES.map((name) => {
    const persisted =
      stored.find((r) => r.name === name) ||
      (name === 'superadmin' && stored.find((r) => r.name === 'super_admin'));
    const selected = persisted
      ? { ...persisted, name }
      : { name, status: 'active', permissions: rbac.ROLE_PERMISSIONS[name] };
    if (name === 'superadmin' && selected.status === 'active')
      selected.permissions = [...rbac.PERMISSIONS];
    return selected;
  });
  return [
    ...roles,
    ...stored.filter((r) => !admin.SYSTEM_ROLES.includes(rbac.normalizeRole(r.name))),
  ].map((r) => ({
    ...decorate(r, actor),
    assignable:
      r.status === 'active' &&
      (r.name !== 'superadmin' || actor.isSuperadmin) &&
      admin.subset(r.permissions, actor),
  }));
};
exports.create = async (data, actor) => {
  const fields = payload(data, true);
  return admin.transaction(actor, 'roles.manage', async (session, fresh) => {
    if (!admin.subset(fields.permissions, fresh))
      throw new ForbiddenError('Permisos fuera de su ámbito');
    const created = await new Role({
      ...fields,
      isSystem: false,
      createdBy: actor.id,
      updatedBy: actor.id,
    }).save({ session });
    return decorate(created, fresh);
  });
};
exports.update = async (name, data, actor) => {
  if (typeof name !== 'string' || !/^[a-z][a-z0-9_]{1,63}$/.test(name)) v.fail();
  if (admin.system(name)) throw new ForbiddenError('Rol del sistema protegido');
  const fields = payload(data, false);
  return admin.transaction(actor, 'roles.manage', async (session, fresh) => {
    const target = await Role.findOneAndUpdate(
      { name },
      { $inc: { __v: 1 } },
      { new: true, session, timestamps: false },
    );
    if (!target) throw new NotFoundError('Rol no encontrado');
    if (
      fresh.role === name ||
      !admin.subset(target.permissions, fresh) ||
      (fields.permissions && !admin.subset(fields.permissions, fresh))
    )
      throw new ForbiddenError('Permisos fuera de su ámbito');
    Object.assign(target, fields, { updatedBy: actor.id });
    await target.save({ session });
    return decorate(target, fresh);
  });
};
