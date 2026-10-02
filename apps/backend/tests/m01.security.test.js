const { expect } = require('chai');
const sinon = require('sinon'),
  request = require('supertest'),
  jwt = require('jsonwebtoken'),
  crypto = require('crypto');
const app = require('../src/app'),
  rbac = require('../src/security/rbac'),
  admin = require('../src/security/administration');
const users = require('../src/modules/users/users.service'),
  roles = require('../src/modules/roles/roles.service');
const User = require('../src/modules/users/users.model'),
  Role = require('../src/modules/roles/roles.model');
const auth = require('../src/modules/auth/auth.service'),
  v = require('../src/modules/users/users.validation');
const id = '507f1f77bcf86cd799439011',
  other = '507f1f77bcf86cd799439012';
const password = () => crypto.randomBytes(20).toString('hex');
const token = (claims = {}, options = {}) =>
  jwt.sign({ id, sv: 0, ...claims }, process.env.JWT_SECRET, { expiresIn: '5m', ...options });
const actor = () => ({
  id,
  role: 'admin',
  permissions: [...rbac.PERMISSIONS],
  isSuperadmin: false,
  sessionVersion: 0,
});
async function rejects(promise, status) {
  try {
    await promise;
    expect.fail('Expected rejection');
  } catch (e) {
    expect(e.statusCode).to.equal(status);
  }
}
describe('M01 administrative HTTP and live authorization', () => {
  let access;
  beforeEach(() => {
    access = actor();
    sinon.stub(rbac, 'resolveAccess').callsFake(async () => access);
  });
  afterEach(() => sinon.restore());
  const routes = [
    ['get', '/users', 'users.read'],
    ['get', '/users/' + other, 'users.read'],
    ['post', '/users', 'users.create'],
    ['patch', '/users/' + other, 'users.update'],
    ['patch', '/users/' + other + '/status', 'users.status'],
    ['patch', '/users/' + other + '/role', 'users.assignRole'],
    ['delete', '/users/' + other, 'users.status'],
    ['get', '/roles', 'roles.read'],
    ['get', '/roles/permissions', 'roles.read'],
    ['post', '/roles', 'roles.manage'],
    ['patch', '/roles/custom_qa', 'roles.manage'],
  ];
  for (const [method, path, permission] of routes) {
    it(`${method} ${path} rejects anonymous`, async () => {
      await request(app)
        [method]('/api/v1' + path)
        .expect(401);
    });
    it(`${method} ${path} requires ${permission}`, async () => {
      access.permissions = [];
      await request(app)
        [method]('/api/v1' + path)
        .set('Authorization', 'Bearer ' + token())
        .send({})
        .expect(403);
    });
  }
  for (const [name, value] of [
    ['invalid', 'bad'],
    ['expired', token({}, { expiresIn: -1 })],
  ])
    it(name + ' token rejected', async () => {
      await request(app)
        .get('/api/v1/users')
        .set('Authorization', 'Bearer ' + value)
        .expect(401);
    });
  it('lists via authorized service', async () => {
    sinon.stub(users, 'getAll').resolves({ items: [], pagination: { total: 0 } });
    await request(app)
      .get('/api/v1/users')
      .set('Authorization', 'Bearer ' + token())
      .expect(200);
  });
  it('rechecks role permissions with the same token', async () => {
    sinon.stub(users, 'getAll').resolves({ items: [] });
    const t = token();
    await request(app)
      .get('/api/v1/users')
      .set('Authorization', 'Bearer ' + t)
      .expect(200);
    access.permissions = [];
    await request(app)
      .get('/api/v1/users')
      .set('Authorization', 'Bearer ' + t)
      .expect(403);
  });
  it('rejects deactivated identity', async () => {
    access = null;
    await request(app)
      .get('/api/v1/users')
      .set('Authorization', 'Bearer ' + token())
      .expect(401);
  });
  it('rejects revoked session version even when permissions remain', async () => {
    access.sessionVersion = 1;
    await request(app)
      .get('/api/v1/users')
      .set('Authorization', 'Bearer ' + token())
      .expect(401);
  });
  it('sanitizes repository failures', async () => {
    sinon.stub(users, 'getAll').rejects(Error('private-database-details'));
    const r = await request(app)
      .get('/api/v1/users')
      .set('Authorization', 'Bearer ' + token())
      .expect(500);
    expect(JSON.stringify(r.body)).not.to.include('private');
    expect(r.body).not.to.have.property('stack');
  });
});
describe('M01 validation and data boundaries', () => {
  afterEach(() => sinon.restore());
  for (const field of [
    '_id',
    'permissions',
    'sessionVersion',
    'createdBy',
    'updatedBy',
    'isSystem',
    'status',
    '$set',
  ])
    it('rejects mass assignment ' + field, () => {
      expect(() => v.payload({ [field]: 'injected' }, false)).to.throw();
    });
  for (const q of [
    { page: 0 },
    { limit: 101 },
    { page: '1e3' },
    { status: 'unknown' },
    { search: { $ne: null } },
    { role: { $ne: null } },
    { sortBy: 'password' },
  ])
    it('rejects unsafe query ' + JSON.stringify(q), () => {
      expect(() => v.query(q)).to.throw();
    });
  it('normalizes email and preserves password bytes', () => {
    const p = password(),
      result = v.payload(
        { email: ' USER@EXAMPLE.COM ', firstName: 'Name', lastName: 'Last', password: p },
        true,
      );
    expect(result.email).to.equal('user@example.com');
    expect(result.password).to.equal(p);
  });
  it('bounds password bytes and length', () => {
    expect(() => v.password('x')).to.throw();
    expect(() => v.password('é'.repeat(37))).to.throw();
  });
  it('rejects invalid identifier before database access', async () => {
    await rejects(users.getById('bad'), 400);
  });
  it('returns not found for missing user', async () => {
    sinon.stub(User, 'findById').resolves(null);
    await rejects(users.getById(other), 404);
  });
  it('uses safe public projection regardless of selected password/internal fields', () => {
    const output = users.publicUser({
      _id: id,
      email: 'a@example.com',
      password: password(),
      sessionVersion: 3,
      permissions: ['*'],
      __v: 10,
    });
    expect(Object.keys(output)).to.deep.equal(['_id', 'email']);
  });
  it('hashes and compares passwords without returning them', async () => {
    const bcrypt = require('bcryptjs'),
      p = password();
    const hash = await bcrypt.hash(p, 12);
    const u = new User({
      email: 'qa@example.com',
      firstName: 'QA',
      lastName: 'User',
      password: hash,
    });
    expect(await u.comparePassword(p)).to.equal(true);
    expect(u.toPublicJSON()).not.to.have.property('password');
  });
  it('escapes search and preserves bounded pagination/filter', () => {
    const q = v.query({ search: 'a.*', page: '2', limit: '5', status: 'inactive', role: 'sales' });
    expect(q.page).to.equal(2);
    expect(q.filter.$or[0].email.$regex).to.equal('a\\.\\*');
    expect(q.filter.status).to.equal('inactive');
  });
});
describe('M01 protected targets and role management', () => {
  let current;
  beforeEach(() => {
    sinon.stub(Role, 'findOneAndUpdate').resolves(null);
    current = actor();
    sinon.stub(admin, 'transaction').callsFake(async (a, p, fn) => fn({}, a));
    sinon
      .stub(admin, 'role')
      .callsFake(async (name) => ({
        name: rbac.normalizeRole(name),
        status: 'active',
        permissions: rbac.ROLE_PERMISSIONS[name] || [],
      }));
  });
  afterEach(() => sinon.restore());
  function target(role = 'user', targetId = other) {
    const doc = new User({
      _id: targetId,
      email: 'qa@example.com',
      firstName: 'QA',
      lastName: 'User',
      password: password(),
      role,
      status: 'active',
    });
    sinon.stub(doc, 'save').resolves(doc);
    sinon.stub(User, 'findOneAndUpdate').returns({ select: async () => doc });
    return doc;
  }
  it('creates a user with actor metadata and no password exposure', async () => {
    sinon.stub(require('../src/shared/services/email'), 'sendEmail').resolves({ id: 'mock-welcome' });
    sinon.stub(User.prototype, 'save').callsFake(async function () {
      return this;
    });
    const r = await users.create(
      {
        email: 'qa@example.com',
        firstName: 'QA',
        lastName: 'User',
        password: password(),
        role: 'sales',
      },
      current,
    );
    expect(r.role).to.equal('sales');
    expect(String(r.createdBy)).to.equal(id);
    expect(r).not.to.have.property('password');
  });
  it('updates only permitted profile fields', async () => {
    target();
    const r = await users.mutate(other, { firstName: 'Updated' }, current, 'update');
    expect(r.firstName).to.equal('Updated');
  });
  it('status change revokes sessions', async () => {
    const doc = target();
    await users.mutate(other, { status: 'inactive' }, current, 'status');
    expect(doc.sessionVersion).to.equal(1);
  });
  it('role change revokes sessions', async () => {
    const doc = target();
    await users.mutate(other, { role: 'sales' }, current, 'assignRole');
    expect(doc.role).to.equal('sales');
    expect(doc.sessionVersion).to.equal(1);
  });
  it('soft delete preserves identity', async () => {
    const doc = target();
    await users.mutate(other, { status: 'deleted' }, current, 'status');
    expect(String(doc._id)).to.equal(other);
    expect(doc.status).to.equal('deleted');
  });
  for (const action of ['status', 'assignRole'])
    it('rejects own ' + action, async () => {
      target('admin', id);
      await rejects(
        users.mutate(
          id,
          action === 'status' ? { status: 'inactive' } : { role: 'superadmin' },
          current,
          action,
        ),
        403,
      );
    });
  for (const status of ['inactive', 'deleted'])
    it('protects last superadmin from ' + status, async () => {
      target('superadmin');
      current.isSuperadmin = true;
      await rejects(users.mutate(other, { status }, current, 'status'), 403);
    });
  it('protects last superadmin from demotion', async () => {
    target('superadmin');
    current.isSuperadmin = true;
    await rejects(users.mutate(other, { role: 'user' }, current, 'assignRole'), 403);
  });
  it('prevents administrator assigning superadmin to others', async () => {
    target();
    await rejects(users.mutate(other, { role: 'superadmin' }, current, 'assignRole'), 403);
  });
  it('prevents delegated administrator granting permissions beyond own scope', async () => {
    target();
    current.permissions = ['users.assignRole'];
    await rejects(users.mutate(other, { role: 'admin' }, current, 'assignRole'), 403);
  });
  for (const name of admin.SYSTEM_ROLES)
    it('protects system role ' + name, async () => {
      await rejects(roles.update(name, { permissions: [] }, current), 403);
    });
  it('rejects arbitrary permission identifiers', async () => {
    await rejects(roles.create({ name: 'qa_role', permissions: ['*'] }, current), 400);
  });
  it('rejects custom role grants above actor authority', async () => {
    current.permissions = ['roles.manage'];
    await rejects(
      roles.create({ name: 'qa_role', permissions: ['customers.delete'] }, current),
      403,
    );
  });
  it('creates custom roles without internal payload control', async () => {
    sinon.stub(Role.prototype, 'save').callsFake(async function () {
      return this;
    });
    const r = await roles.create({ name: 'qa_role', permissions: ['customers.read'] }, current);
    expect(r.isSystem).to.equal(false);
    expect(r.permissions).to.deep.equal(['customers.read']);
  });
  it('rejects internal role protection override', async () => {
    await rejects(roles.create({ name: 'qa_role', permissions: [], isSystem: true }, current), 400);
  });
  it('updates custom roles and denies editing own authorization source', async () => {
    const doc = new Role({ name: 'qa_role', permissions: [], status: 'active' });
    sinon.stub(doc, 'save').resolves(doc);
    Role.findOneAndUpdate.resolves(doc);
    const r = await roles.update('qa_role', { permissions: ['customers.read'] }, current);
    expect(r.permissions).to.deep.equal(['customers.read']);
    current.role = 'qa_role';
    await rejects(roles.update('qa_role', { permissions: [] }, current), 403);
  });
});
describe('M01 sessions and password lifecycle', () => {
  afterEach(() => sinon.restore());
  it('logout atomically increments version for all sessions', async () => {
    const update = sinon.stub(User, 'updateOne').resolves({ modifiedCount: 1 });
    await auth.logout(id);
    expect(update.firstCall.args).to.deep.equal([{ _id: id }, { $inc: { sessionVersion: 1 } }]);
  });
  it('refresh rejects revoked token', async () => {
    sinon
      .stub(User, 'findById')
      .returns({ select: async () => ({ status: 'active', sessionVersion: 1 }) });
    const t = jwt.sign({ id, sv: 0 }, process.env.JWT_REFRESH_SECRET);
    await rejects(auth.refreshToken(t), 401);
  });
  it('refresh preserves current version', async () => {
    sinon
      .stub(User, 'findById')
      .returns({ select: async () => ({ _id: id, status: 'active', sessionVersion: 2 }) });
    const t = jwt.sign({ id, sv: 2 }, process.env.JWT_REFRESH_SECRET);
    const r = await auth.refreshToken(t);
    expect(jwt.verify(r.accessToken, process.env.JWT_SECRET).sv).to.equal(2);
  });
  it('password change hashes new password and revokes sessions', async () => {
    const p = password();
    sinon
      .stub(User, 'findById')
      .returns({
        select: async () => ({ password: 'old-hash', comparePassword: async () => true }),
      });
    const update = sinon.stub(User, 'updateOne').resolves({ modifiedCount: 1 });
    await auth.changePassword(id, { currentPassword: password(), newPassword: p });
    const change = update.firstCall.args[1];
    expect(change.$inc.sessionVersion).to.equal(1);
    expect(await require('bcryptjs').compare(p, change.$set.password)).to.equal(true);
  });
  it('wrong current password performs no write', async () => {
    sinon
      .stub(User, 'findById')
      .returns({ select: async () => ({ comparePassword: async () => false }) });
    const update = sinon.spy(User, 'updateOne');
    await rejects(
      auth.changePassword(id, { currentPassword: password(), newPassword: password() }),
      401,
    );
    expect(update.called).to.equal(false);
  });
});
