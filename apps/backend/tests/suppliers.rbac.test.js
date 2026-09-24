const { expect } = require('chai'),
  sinon = require('sinon'),
  request = require('supertest'),
  jwt = require('jsonwebtoken');
const app = require('../src/app'),
  service = require('../src/modules/suppliers/suppliers.service'),
  User = require('../src/modules/users/users.model'),
  Role = require('../src/modules/roles/roles.model');
const id = '507f1f77bcf86cd799439011';
const matrix = {
  superadmin: [1, 1, 1, 1],
  admin: [1, 1, 1, 1],
  manager: [1, 1, 1, 0],
  sales: [1, 0, 0, 0],
  purchasing: [1, 1, 1, 0],
  warehouse: [1, 0, 0, 0],
  finance: [1, 0, 0, 0],
  hr: [0, 0, 0, 0],
  auditor: [1, 0, 0, 0],
  user: [0, 0, 0, 0],
};
const endpoints = [
  ['get', '', 0, 200],
  ['get', '/search?q=qa', 0, 200],
  ['get', '/' + id, 0, 200],
  ['post', '', 1, 201],
  ['patch', '/' + id, 2, 200],
  ['patch', '/' + id + '/status', 2, 200],
  ['delete', '/' + id, 3, 200],
];
describe('M04 RBAC approved matrix', () => {
  let role = 'user';
  const token = jwt.sign(
    { id, role: 'superadmin', permissions: ['suppliers.delete'] },
    process.env.JWT_SECRET,
  );
  beforeEach(() => {
    role = 'user';
    sinon
      .stub(User, 'findById')
      .returns({
        select: () => ({
          lean: async () => ({ _id: id, role, status: 'active' }),
        }),
      });
    sinon.stub(Role, 'findOne').returns({ lean: async () => null });
    for (const method of [
      'getAll',
      'getById',
      'create',
      'update',
      'status',
      'delete',
    ])
      sinon.stub(service, method).resolves({});
  });
  afterEach(() => sinon.restore());
  for (const [name, grants] of Object.entries(matrix))
    for (const [action, i] of ['read', 'create', 'update', 'delete'].map(
      (a, i) => [a, i],
    ))
      it(name + ' ' + action, async () => {
        role = name;
        for (const [method, path, index, status] of endpoints.filter(
          (e) => e[2] === i,
        ))
          await request(app)
            [method]('/api/v1/suppliers' + path)
            .set('Authorization', 'Bearer ' + token)
            .send({ status: 'inactive' })
            .expect(grants[index] ? status : 403);
        if (!grants[i])
          for (const method of [
            'getAll',
            'getById',
            'create',
            'update',
            'status',
            'delete',
          ])
            expect(service[method].called).to.equal(false);
      });
  it('rejects every route without a token', async () => {
    for (const [method, path] of endpoints)
      await request(app)
        [method]('/api/v1/suppliers' + path)
        .expect(401);
  });
  it('rejects an invalid token', async () => {
    await request(app)
      .get('/api/v1/suppliers')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });
});
