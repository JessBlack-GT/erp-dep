/* eslint-env node, es2020, mocha */
const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const sales = require('../src/modules/sales/sales.service');
const rbac = require('../src/security/rbac');
const {
  fixture,
  ids,
  input,
  rejects,
  clone,
} = require('./helpers/sales.fixture');

describe('Sales persisted RBAC at HTTP and transactional service boundaries', () => {
  let f, row, token;
  beforeEach(async () => {
    f = fixture();
    row = await sales.create(input(), f.actor);
    token = jwt.sign(
      { id: ids.actor, role: 'superadmin', permissions: rbac.PERMISSIONS },
      process.env.JWT_SECRET,
    );
  });
  afterEach(() => sinon.restore());
  for (const action of ['read', 'create', 'update', 'confirm', 'cancel']) {
    const method =
      action === 'read' ? 'get' : action === 'update' ? 'put' : 'post';
    const path = () =>
      action === 'create'
        ? ''
        : '/' +
          row._id +
          (['confirm', 'cancel'].includes(action) ? '/' + action : '');
    const body = () =>
      action === 'create'
        ? input()
        : action === 'update'
          ? { ...input(), expectedRevision: 0 }
          : { expectedRevision: 0 };
    it('requires exactly commercial.' + action + ' at the route', async () => {
      f.permissions = rbac.PERMISSIONS.filter(
        (p) => p !== 'commercial.' + action,
      );
      await request(app)[method]('/api/v1/sales' + path())
        .set('Authorization', 'Bearer ' + token)
        .send(body())
        .expect(403);
      f.permissions = ['commercial.' + action];
      await request(app)[method]('/api/v1/sales' + path())
        .set('Authorization', 'Bearer ' + token)
        .send(body())
        .expect(action === 'create' ? 201 : 200);
    });
    it(
      'requires commercial.' + action + ' without HTTP, ignoring forged grants',
      async () => {
        f.permissions = [];
        const actor = {
          ...f.actor,
          isSuperadmin: true,
          permissions: rbac.PERMISSIONS,
        };
        const invoke = () =>
          action === 'read'
            ? sales.getById(row._id, actor)
            : action === 'create'
              ? sales.create(input(), actor)
              : sales[action](row._id, body(), actor);
        const before = clone(f.db);
        await rejects(invoke(), 403);
        expect(f.db).deep.eq(before);
        f.permissions = ['commercial.' + action];
        expect(await invoke()).have.property('_id');
      },
    );
    it('requires authentication for ' + action, async () => {
      await request(app)[method]('/api/v1/sales' + path())
        .send(body())
        .expect(401);
    });
  }
  it('requires read permission for the list', async () => {
    f.permissions = [];
    await request(app)
      .get('/api/v1/sales')
      .set('Authorization', 'Bearer ' + token)
      .expect(403);
    await request(app).get('/api/v1/sales').expect(401);
  });
  it('rechecks revocation inside the business transaction', async () => {
    f.sessionVersion = 1;
    await rejects(
      sales.confirm(row._id, { expectedRevision: 0 }, f.actor),
      401,
    );
    f.sessionVersion = 0;
    f.roleActive = false;
    await rejects(
      sales.confirm(row._id, { expectedRevision: 0 }, f.actor),
      403,
    );
    f.roleActive = true;
    f.userActive = false;
    await rejects(
      sales.confirm(row._id, { expectedRevision: 0 }, f.actor),
      401,
    );
    expect(f.balance()).eq(100000);
  });
  it('does not broaden any nonadministrator default role', () => {
    for (const [name, permissions] of Object.entries(rbac.ROLE_PERMISSIONS))
      if (!['admin', 'superadmin'].includes(name))
        expect(permissions.some((p) => p.startsWith('commercial.'))).eq(false);
  });
});
