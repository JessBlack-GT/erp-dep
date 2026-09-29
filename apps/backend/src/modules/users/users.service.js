const User = require('./users.model');
const v = require('./users.validation');
const admin = require('../../security/administration');
const rbac = require('../../security/rbac');
const { NotFoundError, ForbiddenError, ValidationError } = require('../../shared/errors/appErrors');
const publicUser = (user) => {
  const data = user.toObject ? user.toObject() : user;
  return Object.fromEntries(
    [
      '_id',
      'email',
      'firstName',
      'lastName',
      'phone',
      'role',
      'status',
      'createdAt',
      'updatedAt',
      'createdBy',
      'updatedBy',
      'lastLoginAt',
    ]
      .filter((k) => data[k] !== undefined)
      .map((k) => [k, data[k]]),
  );
};
class UserService {
  async getAll(query) {
    const { filter, page, limit } = v.query(query);
    const [rows, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    return {
      items: rows.map(publicUser),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
  async getById(id) {
    v.id(id);
    const user = await User.findById(id);
    if (!user) throw new NotFoundError('Usuario no encontrado');
    return publicUser(user);
  }
  async create(data, actor) {
    const fields = v.payload(data, true);
    if (fields.role !== 'user' && !rbac.hasPermission(actor, 'users.assignRole'))
      throw new ForbiddenError();
    return admin.transaction(actor, 'users.create', async (session, fresh) => {
      if (fields.role !== 'user' && !rbac.hasPermission(fresh, 'users.assignRole'))
        throw new ForbiddenError();
      const selected = await admin.assignable(fields.role, fresh, session);
      const user = new User({
        ...fields,
        role: selected.name,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
      await user.save({ session });
      return publicUser(user);
    });
  }
  async mutate(id, data, actor, action) {
    v.id(id);
    let fields;
    if (action === 'update') fields = v.payload(data);
    else if (action === 'status') {
      v.object(data, ['status']);
      if (!['active', 'inactive', 'deleted'].includes(data.status)) v.fail();
      fields = { status: data.status };
    } else {
      v.object(data, ['role']);
      if (typeof data.role !== 'string') v.fail();
      fields = { role: data.role };
    }
    return admin.transaction(actor, 'users.' + action, async (session, fresh) => {
      const target = await User.findOneAndUpdate(
        { _id: id },
        { $inc: { __v: 1 } },
        { new: true, session, timestamps: false },
      ).select('+sessionVersion');
      if (!target) throw new NotFoundError('Usuario no encontrado');
      if (target.status === 'deleted') throw new ValidationError('Usuario eliminado');
      const targetRole = await admin.role(target.role, session);
      // All superadmin lifecycle changes are prohibited, protecting the last
      // operational account without a racy count-then-write check.
      if (
        targetRole.name === 'superadmin' &&
        (action !== 'update' || String(target._id) !== fresh.id)
      )
        throw new ForbiddenError('Cuenta superadmin protegida');
      if (!admin.subset(targetRole.permissions, fresh))
        throw new ForbiddenError('Usuario fuera de su ámbito');
      if (String(target._id) === fresh.id && action !== 'update')
        throw new ForbiddenError('No puede cambiar su propio rol o estado');
      if (action === 'assignRole')
        fields.role = (await admin.assignable(fields.role, fresh, session)).name;
      Object.assign(target, fields, { updatedBy: actor.id });
      if (action !== 'update') target.sessionVersion = (target.sessionVersion || 0) + 1;
      await target.save({ session });
      return publicUser(target);
    });
  }
  getProfile(id) {
    return this.getById(id);
  }
}
module.exports = new UserService();
module.exports.publicUser = publicUser;
