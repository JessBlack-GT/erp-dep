const { expect } = require('chai'),
  sinon = require('sinon'),
  request = require('supertest'),
  jwt = require('jsonwebtoken');
const app = require('../src/app'),
  service = require('../src/modules/inventory/inventory.service'),
  User = require('../src/modules/users/users.model'),
  Role = require('../src/modules/roles/roles.model');
const id = '507f1f77bcf86cd799439011';
const matrix = {
  superadmin: [1, 1, 1, 1, 1, 1],
  admin: [1, 1, 1, 1, 1, 1],
  manager: [1, 1, 1, 1, 1, 1],
  sales: [1, 0, 0, 0, 0, 0],
  purchasing: [1, 1, 0, 0, 0, 0],
  warehouse: [1, 1, 1, 1, 1, 1],
  finance: [1, 0, 0, 0, 0, 0],
  hr: [0, 0, 0, 0, 0, 0],
  auditor: [1, 0, 0, 0, 0, 0],
  user: [0, 0, 0, 0, 0, 0],
};
const endpoints = [
  ['get', '/balances', 0, 200],
  ['get', '/balances/product/' + id, 0, 200],
  ['get', '/movements', 0, 200],
  ['get', '/warehouses', 0, 200],
  ['get', '/products', 0, 200],
  ...['ENTRY', 'EXIT', 'TRANSFER', 'ADJUSTMENT'].map((type, i) => [
    'post',
    '/movements',
    i + 1,
    201,
    { type },
  ]),
  ['post', '/warehouses', 5, 201],
  ['patch', '/warehouses/' + id, 5, 200],
];
describe('M06 RBAC HTTP matrix', () => {
  let role;
  const token = jwt.sign(
    { id, role: 'superadmin', permissions: ['inventory.adjust'] },
    process.env.JWT_SECRET,
  );
  beforeEach(() => {
    role = 'user';
    sinon.stub(User, 'findById').returns({
      select: () => ({
        lean: async () => ({ _id: id, role, status: 'active' }),
      }),
    });
    sinon.stub(Role, 'findOne').returns({ lean: async () => null });
    for (const method of ['list', 'move', 'createWarehouse', 'updateWarehouse'])
      sinon.stub(service, method).resolves({});
  });
  afterEach(() => sinon.restore());
  for (const [name, grants] of Object.entries(matrix))
    for (const [i, action] of [
      'read',
      'entry',
      'exit',
      'transfer',
      'adjust',
      'warehouse.manage',
    ].entries())
      it(name + ' ' + action, async () => {
        role = name;
        for (const [method, path, index, status, body] of endpoints.filter(
          (e) => e[2] === i,
        ))
          await request(app)
            [method]('/api/v1/inventory' + path)
            .set('Authorization', 'Bearer ' + token)
            .send(body || {})
            .expect(grants[index] ? status : 403);
        if (!grants[i])
          for (const method of [
            'list',
            'move',
            'createWarehouse',
            'updateWarehouse',
          ])
            expect(service[method].called).eq(false);
      });
  it('all routes require token', async () => {
    for (const [method, path, , , body] of endpoints)
      await request(app)
        [method]('/api/v1/inventory' + path)
        .send(body || {})
        .expect(401);
  });
  it('invalid token is 401', async () => {
    await request(app)
      .get('/api/v1/inventory/balances')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });
  it('internal details are never exposed', async () => {
    role = 'admin';
    service.list.rejects(new Error('private-secret'));
    const r = await request(app)
      .get('/api/v1/inventory/balances')
      .set('Authorization', 'Bearer ' + token)
      .expect(500);
    expect(JSON.stringify(r.body)).not.includes('private-secret');
  });
  it('no balance or movement mutation routes exist', async () => {
    role = 'admin';
    for (const path of ['/balances/' + id, '/movements/' + id])
      for (const method of ['patch', 'put', 'delete'])
        await request(app)
          [method]('/api/v1/inventory' + path)
          .set('Authorization', 'Bearer ' + token)
          .send({ quantity: '500' })
          .expect(404);
  });
  it('unknown and prototype movement types return 400', async () => {
    role = 'admin';
    for (const type of ['BAD', 'toString', '__proto__'])
      await request(app)
        .post('/api/v1/inventory/movements')
        .set('Authorization', 'Bearer ' + token)
        .send({ type })
        .expect(400);
  });
});
