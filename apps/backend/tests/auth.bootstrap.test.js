const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/users.model');
describe('Authentication needed by the M03 entry flow', () => {
  afterEach(() => sinon.restore());
  it('rejects malformed login without database access', async () => {
    const find = sinon.spy(User, 'findOne');
    await request(app).post('/api/v1/auth/login').send({}).expect(400);
    expect(find.called).to.equal(false);
  });
  it('rejects inactive users without issuing tokens', async () => {
    sinon.stub(User, 'findOne').returns({ select: sinon.stub().resolves({ status: 'inactive' }) });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'qa@example.com', password: 'fictional' }).expect(401);
    expect(res.body).not.to.have.property('data');
  });
  it('does not grant a public registrant privileged roles or return password hashes', async () => {
    sinon.stub(User, 'findOne').resolves(null);
    sinon.stub(User.prototype, 'save').callsFake(async function () { return this; });
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'qa@example.com', password: 'fictional', firstName: 'QA', lastName: 'M03', role: 'super_admin', permissions: ['customers.delete'] }).expect(201);
    expect(res.body.data.role).to.equal('user');
    expect(res.body.data.permissions).to.deep.equal([]);
    expect(res.body.data).not.to.have.property('password');
  });
});
