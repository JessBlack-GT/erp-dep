const { expect } = require('chai'),
  sinon = require('sinon'),
  mongoose = require('mongoose');
const admin = require('../src/security/administration'),
  rbac = require('../src/security/rbac');
const User = require('../src/modules/users/users.model'),
  Role = require('../src/modules/roles/roles.model');
const id = '507f1f77bcf86cd799439011';
describe('M01 transaction authorization and driver result', () => {
  afterEach(() => sinon.restore());
  it('lists legacy superadmin once with protected effective grants', async () => {
    sinon
      .stub(Role, 'find')
      .returns({ lean: async () => [{ name: 'super_admin', status: 'active', permissions: [] }] });
    const roles = await require('../src/modules/roles/roles.service').list({
      role: 'admin',
      permissions: rbac.PERMISSIONS,
      isSuperadmin: false,
    });
    expect(roles.filter((r) => r.name === 'superadmin')).to.have.length(1);
    expect(roles.some((r) => r.name === 'super_admin')).to.equal(false);
    const owner = roles.find((r) => r.name === 'superadmin');
    expect(owner.assignable).to.equal(false);
    expect(owner.editable).to.equal(false);
    expect(owner.permissions).to.deep.equal(rbac.PERMISSIONS);
  });
  it('canonical superadmin honors inactive legacy persisted policy', async () => {
    sinon
      .stub(User, 'findById')
      .returns({
        select: () => ({ lean: async () => ({ _id: id, status: 'active', role: 'superadmin' }) }),
      });
    sinon
      .stub(Role, 'findOne')
      .onFirstCall()
      .returns({ lean: async () => null })
      .onSecondCall()
      .returns({ lean: async () => ({ status: 'inactive', permissions: [] }) });
    const access = await rbac.resolveAccess(id);
    expect(access.isSuperadmin).to.equal(false);
    expect(access.permissions).to.deep.equal([]);
  });
  function setup(user, role = null) {
    sinon.stub(mongoose.connection, 'transaction').callsFake(async (fn) => {
      await fn({});
      return { ok: 1 };
    });
    sinon.stub(User, 'findOneAndUpdate').returns({ select: async () => user });
    sinon.stub(Role, 'findOneAndUpdate').resolves(role);
  }
  it('returns domain DTO, not MongoDB commit metadata', async () => {
    setup({ _id: id, role: 'admin', sessionVersion: 0 });
    const result = await admin.transaction({ id, sessionVersion: 0 }, 'users.create', async () => ({
      email: 'qa@example.com',
    }));
    expect(result).to.deep.equal({ email: 'qa@example.com' });
  });
  it('rechecks current grants inside transaction', async () => {
    setup({ _id: id, role: 'admin', sessionVersion: 0 }, { status: 'active', permissions: [] });
    const work = sinon.spy();
    try {
      await admin.transaction({ id, permissions: rbac.PERMISSIONS }, 'users.create', work);
      expect.fail();
    } catch (e) {
      expect(e.statusCode).to.equal(403);
    }
    expect(work.called).to.equal(false);
  });
  it('rechecks revocation version inside transaction', async () => {
    setup({ _id: id, role: 'admin', sessionVersion: 1 });
    try {
      await admin.transaction({ id, sessionVersion: 0 }, 'users.create', async () => {});
      expect.fail();
    } catch (e) {
      expect(e.statusCode).to.equal(401);
    }
  });
  it('missing/inactive actor cannot write', async () => {
    setup(null);
    try {
      await admin.transaction({ id }, 'users.create', async () => {});
      expect.fail();
    } catch (e) {
      expect(e.statusCode).to.equal(401);
    }
  });
  it('resolves legacy superadmin stored policy consistently', async () => {
    sinon
      .stub(Role, 'findOneAndUpdate')
      .onFirstCall()
      .resolves(null)
      .onSecondCall()
      .resolves({ status: 'inactive', permissions: [] });
    const role = await admin.role('super_admin', {});
    expect(role.name).to.equal('superadmin');
    expect(role.status).to.equal('inactive');
  });
});
