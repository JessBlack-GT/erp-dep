const { expect } = require('chai');
const { describe, it, beforeEach, afterEach } = require('mocha');
const sinon = require('sinon');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const Product = require('../src/modules/products/products.model');
const products = require('../src/modules/products/products.repository');
const Customer = require('../src/modules/customers/customers.model');
const customers = require('../src/modules/customers/customers.repository');
const User = require('../src/modules/users/users.model');
const Role = require('../src/modules/roles/roles.model');
const email = require('../src/shared/services/email');
const id = '507f1f77bcf86cd799439011';

describe('Phase 1 product stock transaction (isolated persistence)', () => {
  afterEach(() => sinon.restore());
  for (const status of ['deleted', 'inactive']) {
    for (const quantities of [[], [0], [1], [0, 20], [10, 20]]) {
      it(`${status} checks balances ${JSON.stringify(quantities)} under the inventory product lock`, async () => {
        const session = {};
        const transaction = sinon.stub(mongoose.connection, 'transaction')
          .callsFake(async (work) => work(session));
        const update = sinon.stub(Product, 'findOneAndUpdate');
        update.onFirstCall().resolves({ _id: id, type: 'PRODUCT', trackInventory: true });
        update.onSecondCall().resolves({ _id: id, status });
        const find = sinon.stub().callsFake(async (filter, options) => {
          expect(filter).to.deep.equal({ productId: id, quantityUnits: { $gt: 0 } });
          expect(options.session).to.equal(session);
          return quantities.some(q => q > 0) ? { _id: 'balance' } : null;
        });
        const collection = sinon.stub(mongoose.connection, 'collection').returns({ findOne: find });
        let failure;
        try { await products.update(id, { status }); } catch (error) { failure = error; }
        if (quantities.some(q => q > 0)) {
          expect(failure.statusCode).to.equal(409);
          expect(update.callCount).to.equal(1);
        } else {
          expect(failure).to.equal(undefined);
          expect(update.secondCall.args[2].session).to.equal(session);
        }
        sinon.assert.callOrder(update, find);
        expect(update.firstCall.args[1]).to.deep.equal({ $inc: { __v: 1 } });
        expect(update.firstCall.args[2].session).to.equal(session);
        expect(transaction.firstCall.args[1].readConcern.level).to.equal('snapshot');
        expect(collection.calledOnceWithExactly('inventoryBalances')).to.equal(true);
      });
    }
  }
  for (const type of ['PRODUCT', 'SERVICE']) {
    it(`allows zero-stock ${type} with history and never alters its ledger`, async () => {
      sinon.stub(mongoose.connection, 'transaction').callsFake(async work => work({}));
      const update = sinon.stub(Product, 'findOneAndUpdate');
      update.onFirstCall().resolves({ _id: id, type, trackInventory: type === 'PRODUCT' });
      update.onSecondCall().resolves({ _id: id, status: 'deleted' });
      const collection = sinon.stub(mongoose.connection, 'collection').callsFake(name => {
        if (name === 'inventoryBalances') return { findOne: async () => null };
        throw new Error('History must not be queried or modified for status changes');
      });
      expect((await products.update(id, { status: 'deleted' })).status).to.equal('deleted');
      expect(collection.calledOnce).to.equal(true);
    });
  }
});

describe('Phase 1 deleted customers through real repository and HTTP routes', () => {
  let row;
  const call = (method, path = '') => request(app)[method]('/api/v1/customers' + path)
    .set('Authorization', 'Bearer ' + jwt.sign({ id }, process.env.JWT_SECRET));
  beforeEach(() => {
    row = { _id: id, name: 'QA', email: 'qa@example.com', status: 'active' };
    sinon.stub(User, 'findById').returns({ select: () => ({ lean: async () => ({ _id: id, role: 'admin', status: 'active' }) }) });
    sinon.stub(Role, 'findOne').returns({ lean: async () => null });
    const visible = filter => filter.status?.$ne === 'deleted' ? row.status !== 'deleted'
      : filter.status?.$in ? false : filter.status === row.status;
    sinon.stub(Customer, 'findOne').callsFake(async filter => visible(filter) ? { ...row } : null);
    sinon.stub(Customer, 'findOneAndUpdate').callsFake(async (filter, changes) => {
      expect(filter).to.deep.equal({ _id: id, status: { $ne: 'deleted' } });
      if (!visible(filter)) return null;
      Object.assign(row, changes);
      return { ...row };
    });
    sinon.stub(Customer, 'find').callsFake(filter => ({
      sort() { return this; }, skip() { return this; }, limit() { return this; },
      lean: async () => visible(filter) ? [{ ...row }] : [],
    }));
  });
  afterEach(() => sinon.restore());
  it('active customer can be read, edited, changed and logically deleted; all normal flows then exclude it', async () => {
    await call('get', '/' + id).expect(200);
    await call('patch', '/' + id).send({ name: 'Updated' }).expect(200);
    await call('patch', '/' + id + '/status').send({ status: 'inactive' }).expect(200);
    await call('delete', '/' + id).expect(200);
    expect(row.status).to.equal('deleted');
    await call('get', '/' + id).expect(404);
    await call('patch', '/' + id).send({ status: 'active' }).expect(404);
    await call('patch', '/' + id + '/status').send({ status: 'active' }).expect(404);
    await call('delete', '/' + id).expect(404);
    for (const path of ['', '/search?q=QA', '?status=deleted', '?search=QA']) {
      const result = await call('get', path).expect(200);
      expect(result.body.data).to.deep.equal([]);
    }
  });
  it('conditional writes reject a customer deleted after the service pre-read', async () => {
    sinon.stub(customers, 'findById').callsFake(async () => {
      row.status = 'deleted';
      return { ...row, status: 'active' };
    });
    await call('patch', '/' + id).send({ name: 'Lost race' }).expect(404);
    await call('patch', '/' + id + '/status').send({ status: 'active' }).expect(404);
    await call('delete', '/' + id).expect(404);
    expect(row.status).to.equal('deleted');
  });
  it('still enforces current permissions', async () => {
    User.findById.returns({ select: () => ({ lean: async () => ({ _id: id, role: 'user', status: 'active' }) }) });
    await call('patch', '/' + id).send({ status: 'active' }).expect(403);
    await call('delete', '/' + id).expect(403);
    expect(Customer.findOneAndUpdate.called).to.equal(false);
  });
});

describe('Phase 1 public registration validation', () => {
  afterEach(() => sinon.restore());
  for (const fields of [{}, { firstName: 'x'.repeat(101), lastName: 'QA' }, { firstName: {}, lastName: 'QA' }]) {
    it(`returns safe HTTP 400 for model-invalid registration ${Object.keys(fields)}`, async () => {
      sinon.stub(User, 'findOne').resolves(null);
      const send = sinon.stub(email, 'sendEmail');
      const result = await request(app).post('/api/v1/auth/register').send({
        email: 'qa@example.com', password: 'NotForPublicErrors-123!', ...fields,
      }).expect(400);
      expect(result.body).to.deep.equal({ success: false, error: 'Datos de registro inválidos' });
      expect(send.called).to.equal(false);
    });
  }
  it('keeps non-validation persistence failures private and classified as 500', async () => {
    sinon.stub(User, 'findOne').rejects(new Error('mongodb://secret/internal-collection'));
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'qa@example.com', password: 'NotForPublicErrors-123!', firstName: 'QA', lastName: 'User',
    }).expect(500);
    expect(response.body).to.deep.equal({ success: false, error: 'Error interno del servidor' });
  });
  it('also classifies validation on the accepted trailing-slash route', async () => {
    sinon.stub(User, 'findOne').resolves(null);
    await request(app).post('/api/v1/auth/register/').send({
      email: 'qa@example.com', password: 'NotForPublicErrors-123!',
    }).expect(400);
  });
});

describe('Phase 1 ESLint configuration', () => {
  it('loads valid JSON, existing rules and the referenced plugins', async () => {
    const path = require('path');
    const fs = require('fs');
    const root = path.resolve(__dirname, '../../..');
    const config = JSON.parse(fs.readFileSync(path.join(root, '.eslintrc.json'), 'utf8'));
    expect(config.extends).to.deep.equal(['eslint-config-prettier', 'plugin:react/recommended']);
    expect(config.rules).to.deep.equal({
      'no-unused-vars': 'warn', 'no-console': 'off', semi: ['error', 'always'], quotes: ['error', 'single'],
    });
    const { ESLint } = require('eslint');
    const loaded = await new ESLint({ cwd: root }).calculateConfigForFile(path.join(root, 'apps/frontend/src/components/layout/Sidebar.js'));
    expect(loaded.plugins).to.include('react');
    expect(loaded.rules['react/prop-types'][0]).to.equal(2);
  });
});
