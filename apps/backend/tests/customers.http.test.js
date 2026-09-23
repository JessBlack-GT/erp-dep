const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const repo = require('../src/modules/customers/customers.repository');
const Customer = require('../src/modules/customers/customers.model');
const { errorHandler } = require('../src/middleware/errorHandler');
const { logger } = require('../src/shared/utils/logger');
const { authorizeRoles } = require('../src/middleware/authorize');
const { ROLES } = require('../src/shared/constants/appConstants');
const id = '507f1f77bcf86cd799439011';
const customer = { _id: id, name: 'QA M03', email: 'qa-m03@example.com', status: 'active' };
const app = express();
app.use(express.json());
app.use('/api/v1/customers', require('../src/modules/customers/customers.routes'));
app.use(errorHandler);
const token = jwt.sign({ id, role: ROLES.ADMIN }, process.env.JWT_SECRET);
const call = (method, path = '') => request(app)[method]('/api/v1/customers' + path).set('Authorization', `Bearer ${token}`);

describe('M03 HTTP with real router/authentication and stubbed persistence', () => {
  beforeEach(() => {
    sinon.stub(logger, 'error'); sinon.stub(logger, 'warn');
    // Persisted identity fixture; authorization itself remains real.
    sinon.stub(require('../src/modules/users/users.model'), 'findById').returns({ select: () => ({ lean: async () => ({ _id: id, role: 'admin', status: 'active' }) }) });
    sinon.stub(require('../src/modules/roles/roles.model'), 'findOne').returns({ lean: async () => null });
  });
  afterEach(() => sinon.restore());
  it('requires authentication for every customer endpoint', async () => {
    for (const [method, path] of [['get',''],['post',''],['get','/search?q=qa'],['get',`/${id}`],['patch',`/${id}`],['patch',`/${id}/status`],['delete',`/${id}`]]) {
      await request(app)[method]('/api/v1/customers' + path).expect(401);
    }
  });
  it('rejects invalid and expired tokens', async () => {
    for (const bad of ['invalid', jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: -1 })]) {
      await request(app).get('/api/v1/customers').set('Authorization', `Bearer ${bad}`).expect(401);
    }
  });
  it('creates a customer and returns 201', async () => {
    sinon.stub(repo, 'exists').resolves(null);
    sinon.stub(repo, 'create').resolves(customer);
    const res = await call('post').send({ name: customer.name, email: customer.email }).expect(201);
    expect(res.body.data._id).to.equal(id);
  });
  it('passes pagination, sorting and status/type/city filters to persistence', async () => {
    const stub = sinon.stub(repo, 'findAll').resolves([customer]);
    const res = await call('get', '?page=2&limit=5&status=active&type=natural&city=Lima&sortBy=name&sortOrder=asc').expect(200);
    expect(res.body.data).to.deep.equal([customer]);
    expect(stub.firstCall.args).to.deep.equal([{ status: 'active', type: 'natural', city: 'Lima' }, { page: 2, limit: 5, sortBy: 'name', sortOrder: 'asc', search: '' }]);
  });
  it('gets a customer by ID', async () => {
    sinon.stub(repo, 'findById').withArgs(id).resolves(customer);
    const res = await call('get', `/${id}`).expect(200);
    expect(res.body.data.email).to.equal(customer.email);
  });
  it('updates customer data', async () => {
    sinon.stub(repo, 'findById').resolves(customer);
    const stub = sinon.stub(repo, 'updateById').resolves({ ...customer, name: 'Updated' });
    const res = await call('patch', `/${id}`).send({ name: 'Updated' }).expect(200);
    expect(res.body.data.name).to.equal('Updated');
    expect(stub.calledWith(id, { name: 'Updated' })).to.equal(true);
  });
  it('searches by text', async () => {
    const stub = sinon.stub(repo, 'findAll').resolves([customer]);
    await call('get', '/search?q=QA').expect(200);
    expect(stub.firstCall.args[1].search).to.equal('QA');
  });
  it('changes status', async () => {
    sinon.stub(repo, 'findById').resolves(customer);
    sinon.stub(repo, 'updateStatus').withArgs(id, 'inactive').resolves({ ...customer, status: 'inactive' });
    const res = await call('patch', `/${id}/status`).send({ status: 'inactive' }).expect(200);
    expect(res.body.data.status).to.equal('inactive');
  });
  it('rejects an undefined status', async () => {
    await call('patch', `/${id}/status`).send({ status: 'invalid-status' }).expect(400);
  });
  it('soft deletes without invoking physical deletion', async () => {
    sinon.stub(repo, 'findById').resolves(customer);
    const stub = sinon.stub(repo, 'softDelete').resolves({ ...customer, status: 'deleted' });
    await call('delete', `/${id}`).expect(200);
    expect(stub.calledOnceWithExactly(id)).to.equal(true);
  });
  it('returns 400 for invalid creation, pagination and ID', async () => {
    await call('post').send({ email: 'invalid' }).expect(400);
    await call('get', '?limit=0').expect(400);
    await call('get', '/invalid-id').expect(400);
    await call('get', '/search?q=x').expect(400);
    await call('get', '?page=1.5').expect(400);
    await call('get', '?status=invalid').expect(400);
    await call('get', '/search?q[$ne]=x').expect(400);
    await call('patch', `/${id}`).send({ $set: { status: 'deleted' } }).expect(400);
    await call('patch', `/${id}`).send({ name: '' }).expect(400);
  });
  it('returns 404 for a missing customer', async () => {
    sinon.stub(repo, 'findById').resolves(null);
    await call('get', `/${id}`).expect(404);
  });
  it('rejects duplicate emails', async () => {
    sinon.stub(repo, 'exists').resolves(customer);
    await call('post').send({ name: 'Duplicate', email: customer.email }).expect(409);
  });
  it('rejects duplicate document numbers independently of email', async () => {
    sinon.stub(repo, 'exists').resolves(null);
    sinon.stub(repo, 'findByDocumentNumber').resolves(customer);
    await call('post').send({ name: 'Duplicate', email: 'different@example.com', documentNumber: 'QA-123' }).expect(409);
  });
  it('rejects duplicate document numbers on update', async () => {
    sinon.stub(repo, 'findById').resolves(customer);
    sinon.stub(repo, 'findByDocumentNumber').resolves({ _id: '507f1f77bcf86cd799439012' });
    await call('patch', `/${id}`).send({ documentNumber: 'QA-123' }).expect(409);
  });
  it('omits blank optional document numbers and normalizes emails on creation', async () => {
    sinon.stub(repo, 'exists').resolves(null);
    const stub = sinon.stub(repo, 'create').resolves(customer);
    await call('post').send({ name: 'QA', email: 'QA@EXAMPLE.COM', documentNumber: '' }).expect(201);
    expect(stub.firstCall.args[0]).to.deep.equal({ name: 'QA', email: 'qa@example.com' });
  });
  it('maps persistence failures to 500 and duplicate index races to 409', async () => {
    const stub = sinon.stub(repo, 'findAll').rejects(new Error('simulated persistence failure'));
    await call('get').expect(500);
    stub.rejects(Object.assign(new Error('duplicate'), { code: 11000, keyValue: { email: customer.email } }));
    await call('get').expect(409);
  });
});

describe('M03 persistence query and model contracts (no database)', () => {
  afterEach(() => sinon.restore());
  it('excludes deleted customers, escapes regex text and applies pagination', async () => {
    const chain = { sort: sinon.stub().returnsThis(), skip: sinon.stub().returnsThis(), limit: sinon.stub().returnsThis(), lean: sinon.stub().resolves([]) };
    const find = sinon.stub(Customer, 'find').returns(chain);
    await repo.findAll({ city: 'Lima' }, { page: 3, limit: 5, search: 'A.*' });
    expect(find.firstCall.args[0].status).to.deep.equal({ $ne: 'deleted' });
    expect(find.firstCall.args[0].$or[0].name.$regex).to.equal('A\\.\\*');
    expect(chain.skip.calledWith(10)).to.equal(true);
    expect(chain.limit.calledWith(5)).to.equal(true);
  });
  it('soft delete writes only status', async () => {
    const update = sinon.stub(Customer, 'findByIdAndUpdate').resolves(customer);
    await repo.softDelete(id);
    expect(update.firstCall.args).to.deep.equal([id, { status: 'deleted' }, { new: true }]);
  });
  it('validates model fields without persistence', () => {
    const invalid = new Customer({ status: 'not-a-status', type: 'not-a-type' }).validateSync();
    expect(Object.keys(invalid.errors)).to.include.members(['name', 'email', 'status', 'type']);
  });
});

describe('Existing role middleware (not attached to customer routes)', () => {
  it('accepts admin and rejects viewer for an admin-only policy', () => {
    const next = sinon.spy();
    const res = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
    const policy = authorizeRoles(ROLES.ADMIN);
    policy({ user: { role: ROLES.ADMIN } }, res, next);
    expect(next.calledOnce).to.equal(true);
    policy({ user: { role: ROLES.VIEWER } }, res, next);
    expect(res.status.calledWith(403)).to.equal(true);
    policy({}, res, next);
    expect(res.status.calledWith(401)).to.equal(true);
  });
});
