const { expect } = require('chai'),
  sinon = require('sinon'),
  request = require('supertest'),
  jwt = require('jsonwebtoken');
const app = require('../src/app'),
  repo = require('../src/modules/products/products.repository'),
  User = require('../src/modules/users/users.model'),
  Role = require('../src/modules/roles/roles.model');
const id = '507f1f77bcf86cd799439011',
  item = {
    _id: id,
    name: 'QA',
    sku: 'QA-1',
    type: 'PRODUCT',
    unit: 'unit',
    status: 'active',
    trackInventory: false,
  };
const token = jwt.sign({ id }, process.env.JWT_SECRET);
const call = (method, path = '') =>
  request(app)
    [method]('/api/v1/products' + path)
    .set('Authorization', 'Bearer ' + token);
describe('M05 functional HTTP with isolated persistence', () => {
  beforeEach(() => {
    sinon
      .stub(User, 'findById')
      .returns({
        select: () => ({
          lean: async () => ({ _id: id, role: 'admin', status: 'active' }),
        }),
      });
    sinon.stub(Role, 'findOne').returns({ lean: async () => null });
    sinon.stub(repo, 'get').resolves(item);
    sinon.stub(repo, 'list').resolves({ rows: [item], total: 1 });
    sinon.stub(repo, 'unique').resolves(null);
    sinon
      .stub(repo, 'create')
      .callsFake(async (data) => ({ _id: id, ...data }));
    sinon
      .stub(repo, 'update')
      .callsFake(async (id, set) => ({ ...item, ...set }));
  });
  afterEach(() => sinon.restore());
  for (const type of ['PRODUCT', 'SERVICE'])
    it('creates ' + type, async () => {
      const r = await call('post')
        .send({ name: ' QA ', sku: ' qa  1 ', type })
        .expect(201);
      expect(r.body.data).to.include({
        name: 'QA',
        sku: 'QA-1',
        type,
        unit: type === 'SERVICE' ? 'service' : 'unit',
        trackInventory: false,
        createdBy: id,
      });
    });
  it('stores exact monetary strings, zero and four fractional places', async () => {
    const r = await call('post')
      .send({
        name: 'QA',
        sku: 'QA',
        price: '999999999999.9999',
        cost: '0',
        currency: 'usd',
      })
      .expect(201);
    expect(r.body.data).to.include({
      price: '999999999999.9999',
      cost: '0.0000',
      currency: 'USD',
    });
  });
  const bad = {
    name: '',
    sku: '',
    type: 'OTHER',
    barcode: 'a b',
    unit: '',
    price: '-1',
    cost: '-0.01',
    currency: 'US',
    trackInventory: 'true',
    description: 'x'.repeat(2001),
    category: 'x'.repeat(101),
    notes: 'x'.repeat(2001),
    taxCategory: 'x'.repeat(81),
    createdBy: id,
    role: 'admin',
    status: 'deleted',
    stock: 1,
  };
  for (const [key, value] of Object.entries(bad))
    it('rejects invalid ' + key, async () => {
      await call('post')
        .send({ name: 'QA', sku: 'QA', [key]: value })
        .expect(400);
      expect(repo.create.called).to.equal(false);
    });
  for (const value of [
    1.1,
    NaN,
    null,
    {},
    '1e3',
    '01',
    '1.00001',
    '1000000000000',
    'Infinity',
    '0.1+0.2',
  ])
    it('rejects monetary representation ' + JSON.stringify(value), async () => {
      await call('post')
        .send({ name: 'QA', sku: 'QA', price: value, currency: 'USD' })
        .expect(400);
    });
  for (const body of [
    {},
    { name: 'QA' },
    [],
    { name: 'QA', sku: {} },
    { name: 'QA', sku: '$bad' },
    { name: 'QA', sku: 'QA', $set: { price: '0' } },
    { name: 'QA', sku: 'QA', price: '1' },
    { name: 'QA', sku: 'QA', type: 'SERVICE', barcode: '123' },
    { name: 'QA', sku: 'QA', type: 'SERVICE', trackInventory: true },
  ])
    it('rejects invalid domain payload ' + JSON.stringify(body), async () => {
      await call('post').send(body).expect(400);
    });
  it('allows optional barcode and normalized extensible unit/category', async () => {
    const r = await call('post')
      .send({
        name: 'QA',
        sku: 'QA',
        barcode: '',
        unit: ' Labor hour ',
        category: 'Custom   work',
      })
      .expect(201);
    expect(r.body.data).to.include({
      unit: 'labor hour',
      category: 'Custom work',
    });
    expect(r.body.data).not.to.have.property('barcode');
  });
  for (const field of ['sku', 'barcode'])
    it('rejects duplicate ' + field + ' on create and update', async () => {
      repo.unique.callsFake(async (f) =>
        f === field ? { _id: '507f1f77bcf86cd799439012' } : null,
      );
      await call('post')
        .send({ name: 'QA', sku: 'QA', barcode: '123' })
        .expect(409);
      await call('patch', '/' + id)
        .send({ [field]: '123' })
        .expect(409);
    });
  it('permits unchanged own SKU with uppercase ObjectId', async () => {
    repo.unique.resolves(item);
    await call('patch', '/' + id.toUpperCase())
      .send({ sku: 'qa-1' })
      .expect(200);
  });
  it('returns paginated filters', async () => {
    const r = await call(
      'get',
      '?page=2&limit=5&type=SERVICE&category=Labor&status=inactive&currency=usd',
    ).expect(200);
    expect(r.body.pagination).to.deep.equal({
      page: 2,
      limit: 5,
      total: 1,
      pages: 1,
    });
    expect(repo.list.firstCall.args[0].filters).to.deep.equal({
      type: 'SERVICE',
      category: 'Labor',
      status: 'inactive',
      currency: 'USD',
    });
  });
  for (const q of [
    'page=0',
    'page=1.5',
    'limit=101',
    'limit=-1',
    'type=other',
    'status=deleted',
    'currency=US',
    'category=',
    'sortBy=password',
    'sortOrder=up',
    'search[$ne]=x',
    'unknown=x',
  ])
    it('rejects query ' + q, async () => {
      await call('get', '?' + q).expect(400);
    });
  it('gets detail and searches by literal query', async () => {
    await call('get', '/' + id).expect(200);
    await call('get', '/search?q=QA').expect(200);
    expect(repo.list.firstCall.args[0].search).to.equal('QA');
    await call('get', '/search?q=').expect(400);
  });
  it('invalid and absent IDs', async () => {
    await call('get', '/invalid').expect(400);
    repo.get.resolves(null);
    await call('get', '/' + id).expect(404);
    await call('patch', '/' + id)
      .send({ name: 'X' })
      .expect(404);
  });
  it('validates merged type transition and allows explicit physical field clearing', async () => {
    repo.get.resolves({ ...item, barcode: '123', trackInventory: true });
    await call('patch', '/' + id)
      .send({ type: 'SERVICE' })
      .expect(400);
    await call('patch', '/' + id)
      .send({
        type: 'SERVICE',
        barcode: '',
        trackInventory: false,
        unit: 'hour',
      })
      .expect(200);
    expect(repo.update.firstCall.args[2]).to.deep.equal({ barcode: 1 });
  });
  it('preserves price/currency invariant on partial edits', async () => {
    repo.get.resolves({ ...item, price: '1.0000', currency: 'USD' });
    await call('patch', '/' + id)
      .send({ currency: '' })
      .expect(400);
    await call('patch', '/' + id)
      .send({ price: '', currency: '' })
      .expect(200);
    expect(repo.update.firstCall.args[2]).to.deep.equal({
      price: 1,
      currency: 1,
    });
  });
  it('changes state but never deletes via status', async () => {
    for (const status of ['inactive', 'active'])
      await call('patch', '/' + id + '/status')
        .send({ status })
        .expect(200);
    await call('patch', '/' + id + '/status')
      .send({ status: 'deleted' })
      .expect(400);
    await call('patch', '/' + id + '/status')
      .send({ status: 'active', role: 'admin' })
      .expect(400);
  });
  it('soft deletes and rejects deleted targets', async () => {
    await call('delete', '/' + id).expect(200);
    expect(repo.update.firstCall.args[1]).to.include({ status: 'deleted' });
    repo.get.resolves(null);
    await call('patch', '/' + id + '/status')
      .send({ status: 'active' })
      .expect(404);
  });
  it('maps unique index race to conflict', async () => {
    repo.create.rejects({ code: 11000 });
    await call('post').send({ name: 'QA', sku: 'QA' }).expect(409);
  });
  it('sanitizes repository errors', async () => {
    repo.list.rejects(Error('PRIVATE_DB_DETAIL'));
    const r = await call('get').expect(500);
    expect(r.body).to.deep.equal({
      success: false,
      error: 'Error interno del servidor',
    });
  });
  it('handles update disappearance', async () => {
    repo.update.resolves(null);
    await call('patch', '/' + id)
      .send({ name: 'QA' })
      .expect(404);
  });
});
describe('M05 repository contract', () => {
  afterEach(() => sinon.restore());
  it('searches name SKU barcode literally with stable page ordering', async () => {
    const Model = require('../src/modules/products/products.model');
    const chain = {
      sort: sinon.stub().returnsThis(),
      skip: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis(),
      lean: sinon.stub().resolves([]),
    };
    const find = sinon.stub(Model, 'find').returns(chain);
    sinon.stub(Model, 'countDocuments').resolves(0);
    await repo.list({
      filters: { status: { $ne: 'deleted' } },
      page: 2,
      limit: 20,
      search: '.*',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(
      find.firstCall.args[0].$or.map((x) => Object.keys(x)[0]),
    ).to.deep.equal(['name', 'sku', 'barcode']);
    expect(find.firstCall.args[0].$or[0].name.$regex).to.equal('\\.\\*');
    expect(chain.sort.firstCall.args[0]).to.deep.equal({
      name: 'asc',
      _id: 'asc',
    });
    expect(chain.skip.calledWith(20)).to.equal(true);
  });
});
