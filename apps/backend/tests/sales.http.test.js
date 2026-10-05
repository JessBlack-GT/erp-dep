/* eslint-env node, es2020, mocha */
const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const sales = require('../src/modules/sales/sales.service');
const Document = require('../src/modules/commercial/commercial.model');
const repo = require('../src/modules/commercial/commercial.repository');
const { fixture, ids, input } = require('./helpers/sales.fixture');
const {
  InventoryMovement,
} = require('../src/modules/inventory/inventory.model');
const v = require('../src/modules/inventory/inventory.validation');

describe('Sales HTTP with real business services and simulated storage', () => {
  let f, token;
  beforeEach(() => {
    f = fixture();
    token = jwt.sign(
      { id: ids.actor, sessionVersion: 0 },
      process.env.JWT_SECRET,
    );
  });
  afterEach(() => sinon.restore());
  const call = (method, path, body) =>
    request(app)[method]('/api/v1/sales' + path)
      .set('Authorization', 'Bearer ' + token)
      .send(body);
  it('implements create, get, PUT, confirm and cancel with calculated totals', async () => {
    const created = await call('post', '', input()).expect(201),
      id = created.body.data._id;
    expect(created.body.data).include({
      type: 'SALE',
      status: 'draft',
      revision: 0,
      number: 'SALE-000001',
      total: '20.0000',
    });
    await call('get', '/' + id).expect(200);
    const updated = await call('put', '/' + id, {
      ...input([
        {
          productId: ids.product,
          quantity: '2',
          warehouseId: ids.warehouse,
          discountRate: '10',
          taxRate: '7.5',
        },
      ]),
      expectedRevision: 0,
    }).expect(200);
    expect(updated.body.data).include({
      revision: 1,
      discount: '2.0000',
      tax: '1.3500',
      total: '19.3500',
    });
    await call('post', '/' + id + '/confirm', { expectedRevision: 1 }).expect(
      200,
    );
    await call('post', '/' + id + '/cancel', { expectedRevision: 2 }).expect(
      200,
    );
  });
  for (const key of ['service', 'untracked', 'product'])
    it('creates a ' + key + ' draft without stock effects', async () => {
      await call(
        'post',
        '',
        input([{ productId: ids[key], quantity: '1' }]),
      ).expect(201);
      expect(Object.keys(f.db.movements)).length(0);
    });
  for (const kind of ['customer', 'product'])
    for (const status of ['missing', 'inactive', 'deleted'])
      it('rejects ' + kind + ' ' + status, async () => {
        if (kind === 'customer')
          f.customer = status === 'missing' ? null : { ...f.customer, status };
        else if (status === 'missing') delete f.products[ids.product];
        else f.products[ids.product].status = status;
        await call('post', '', input()).expect(404);
        expect(Object.keys(f.db.documents)).length(0);
      });
  for (const change of [
    { type: 'SALE' },
    { type: 'PURCHASE' },
    { status: 'confirmed' },
    { total: '1' },
    { subtotal: '1' },
    { snapshot: {} },
    { audit: {} },
    { revision: 0 },
    { createdBy: ids.other },
    { entityId: 'bad' },
    { date: '2026-02-30' },
    { currency: 'usd' },
    { currency: 'EUR' },
    { lines: [] },
    ...['0', '-1', '1e2', '1.00001', 1].map((quantity) => ({
      lines: [{ productId: ids.product, quantity }],
    })),
    ...['-1', 'Infinity', 1].map((unitPrice) => ({
      lines: [{ productId: ids.product, quantity: '1', unitPrice }],
    })),
    ...['discountRate', 'taxRate'].map((field) => ({
      lines: [{ productId: ids.product, quantity: '1', [field]: '101' }],
    })),
    ...[
      'snapshot',
      'exitMovementId',
      'reversalMovementId',
      'origin',
      'reversalOf',
    ].map((field) => ({
      lines: [{ productId: ids.product, quantity: '1', [field]: ids.other }],
    })),
    { lines: [{ productId: ids.product, quantity: '1', warehouseId: 'bad' }] },
    {
      lines: [
        { productId: ids.service, quantity: '1', warehouseId: ids.warehouse },
      ],
    },
  ])
    it(
      'rejects invalid/protected creation input ' + JSON.stringify(change),
      async () => {
        await call('post', '', { ...input(), ...change }).expect(400);
        expect(Object.keys(f.db.documents)).length(0);
      },
    );
  it('allows explicit zero price and full discount', async () => {
    for (const values of [{ unitPrice: '0' }, { discountRate: '100' }]) {
      const response = await call(
        'post',
        '',
        input([{ productId: ids.service, quantity: '1', ...values }]),
      ).expect(201);
      expect(response.body.data.total).eq('0.0000');
    }
  });
  it('rejects inactive/missing warehouse during draft creation', async () => {
    f.warehouses[ids.warehouse].status = 'inactive';
    await call('post', '', input()).expect(409);
    delete f.warehouses[ids.warehouse];
    await call('post', '', input()).expect(409);
  });
  for (const revision of [
    undefined,
    null,
    '0',
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    it('requires an exact expectedRevision ' + revision, async () => {
      const row = await sales.create(input(), f.actor);
      for (const action of ['confirm', 'cancel'])
        await call('post', '/' + row._id + '/' + action, {
          expectedRevision: revision,
        }).expect(400);
      await call('put', '/' + row._id, {
        ...input(),
        expectedRevision: revision,
      }).expect(400);
    });
  it('isolates PURCHASE for every ID operation', async () => {
    const row = await sales.create(input(), f.actor);
    f.db.documents[row._id].type = 'PURCHASE';
    await call('get', '/' + row._id).expect(404);
    await call('put', '/' + row._id, {
      ...input(),
      expectedRevision: 0,
    }).expect(404);
    for (const action of ['confirm', 'cancel'])
      await call('post', '/' + row._id + '/' + action, {
        expectedRevision: 0,
      }).expect(404);
    expect(f.db.documents[row._id].status).eq('draft');
  });
  it('passes validated filters to a SALE-only paginated repository query', async () => {
    const chain = {
      sort: sinon.stub().returnsThis(),
      skip: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis(),
      lean: async () => [],
    };
    const find = sinon.stub(Document, 'find').returns(chain),
      count = sinon.stub(Document, 'countDocuments').resolves(0);
    const response = await call(
      'get',
      '?page=2&limit=5&status=draft&entityId=' +
        ids.customer +
        '&from=2026-01-01&to=2026-12-31&search=SALE.',
    ).expect(200);
    expect(find.firstCall.args[0]).include({
      type: 'SALE',
      status: 'draft',
      'entity.id': ids.customer,
    });
    expect(find.firstCall.args[0].number.$regex).eq('SALE\\.');
    expect(count.firstCall.args[0]).deep.eq(find.firstCall.args[0]);
    expect(chain.skip.calledWith(5)).eq(true);
    expect(response.body.pagination).include({ page: 2, limit: 5, total: 0 });
  });
  for (const query of [
    'type=PURCHASE',
    'page=0',
    'limit=101',
    'status=paid',
    'entityId=bad',
    'from=2026-02-30',
    'from=2026-12-01&to=2026-01-01',
    'search[x]=a',
  ])
    it('rejects invalid listing filters ' + query, async () => {
      await call('get', '?' + query).expect(400);
    });
  it('does not expose internal errors or database details', async () => {
    repo.get.rejects(new Error('mongodb://private:password@host JWT api-key'));
    const response = await call('get', '/' + ids.product).expect(500);
    expect(response.body).deep.eq({
      success: false,
      error: 'Servicio no disponible',
    });
  });
  it('has no DELETE or PATCH operation', async () => {
    await call('delete', '/' + ids.product).expect(404);
    await call('patch', '/' + ids.product, {}).expect(404);
  });
  it('sanitizes malformed JSON before the router without echoing secrets', async () => {
    const response = await request(app)
      .post('/api/v1/sales')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer ' + token)
      .send('{"password":"private",')
      .expect(400);
    expect(response.body).deep.eq({ success: false, error: 'Datos inválidos' });
  });
  it('public inventory validation cannot inject commercial metadata', () => {
    for (const field of ['origin', 'reversalOf', 'expectedUnit'])
      expect(() =>
        v.movement({
          productId: ids.product,
          type: 'ENTRY',
          quantity: '1',
          destinationWarehouseId: ids.warehouse,
          reason: 'manual',
          idempotencyKey: 'manual_key',
          [field]: {},
        }),
      ).to.throw();
    expect(InventoryMovement.schema.path('origin')).to.exist;
  });
});
