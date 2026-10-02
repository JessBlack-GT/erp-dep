const User = require('./users.model');
const v = require('./users.validation');
const admin = require('../../security/administration');
const rbac = require('../../security/rbac');
const emailService = require('../../shared/services/email');
const { createDiagnostics } = require('./users.diagnostics');
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
  async create(data, actor, trace = createDiagnostics()) {
    const fields = await trace.run('validation', () => v.payload(data, true));
    await trace.run('authorization', () => {
      if (fields.role !== 'user' && !rbac.hasPermission(actor, 'users.assignRole'))
        throw new ForbiddenError();
    });
    const saved = await trace.run('database_transaction', () => admin.transaction(actor, 'users.create', async (session, fresh) => {
      await trace.run('authorization', () => {
        if (fields.role !== 'user' && !rbac.hasPermission(fresh, 'users.assignRole'))
          throw new ForbiddenError();
      });
      const selected = await trace.run('database_lookup', () => admin.assignable(fields.role, fresh, session));
      const user = await trace.run('user_create', () => new User({
        ...fields,
        role: selected.name,
        createdBy: actor.id,
        updatedBy: actor.id,
      }));
      user.$locals.creationDiagnostics = trace;
      await trace.run('user_save', () => user.save({ session }));
      trace.mark('database_commit');
      return publicUser(user);
    }, trace));
    // Outside the retryable transaction: save AND commit have succeeded.
    // A failed/uncertain commit must never send a welcome message.
    try {
      const message = await trace.run('welcome_email_prepare', () => ({
        to: saved.email,
        subject: 'Bienvenido a YJ Nexo ERP',
        text: `Hola, ${saved.firstName} ${saved.lastName}.\n\nTu cuenta ha sido creada correctamente en YJ Nexo ERP.\nYa puedes ingresar al sistema.`,
      }));
      await trace.run('welcome_email_send', () => emailService.sendEmail(message));
    } catch (_) {
      // Already logged by run(). Preserve the committed account and normal DTO.
    }
    return saved;
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
