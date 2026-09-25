const { expect } = require('chai');
const sinon = require('sinon');
const service = require('./inventory.service'),
  repo = require('./inventory.repository'),
  v = require('./inventory.validation');
const { InventoryMovement, InventoryBalance } = require('./inventory.model');
const { ConflictError } = require('../../shared/errors/appErrors');
const p = '507f1f77bcf86cd799439011',
  a = '507f1f77bcf86cd799439012',
  b = '507f1f77bcf86cd799439013',
  actor = '507f1f77bcf86cd799439014';
const input = (type = 'ENTRY', quantity = '2.5') => ({
  productId: p,
  type,
  quantity,
  reason: 'Physical count',
  idempotencyKey: 'test_key_123',
  ...(['EXIT', 'TRANSFER'].includes(type) || quantity.startsWith('-')
    ? { sourceWarehouseId: a }
    : {}),
  ...(['ENTRY', 'TRANSFER'].includes(type) ||
  (type === 'ADJUSTMENT' && !quantity.startsWith('-'))
    ? { destinationWarehouseId: type === 'TRANSFER' ? b : a }
    : {}),
});
async function rejects(promise, status) {
  try {
    await promise;
    throw new Error('Expected rejection');
  } catch (e) {
    expect(e.statusCode).eq(status);
  }
}
describe('M06 inventory domain', () => {
  beforeEach(() => {
    sinon.stub(repo, 'transaction').callsFake((work) => work({}));
    sinon.stub(repo, 'replay').resolves(null);
    sinon
      .stub(repo, 'product')
      .resolves({ type: 'PRODUCT', trackInventory: true, status: 'active' });
    sinon.stub(repo, 'warehouse').resolves({ status: 'active' });
    sinon.stub(repo, 'change').resolves({});
    sinon.stub(repo, 'append').callsFake(async (data) => ({ ...data, _id: p }));
  });
  afterEach(() => sinon.restore());
  for (const [type, quantity, deltas] of [
    ['ENTRY', '2.5', [25000]],
    ['EXIT', '2.5', [-25000]],
    ['TRANSFER', '2.5', [-25000, 25000]],
    ['ADJUSTMENT', '-0.1', [-1000]],
    ['ADJUSTMENT', '0.2', [2000]],
  ])
    it(
      type + ' ' + quantity + ' exact balance legs and authenticated actor',
      async () => {
        const result = await service.move(input(type, quantity), actor);
        expect(repo.change.getCalls().map((c) => c.args[2])).deep.eq(deltas);
        expect(result.data.createdBy).eq(actor);
        expect(result.data.quantity).eq(v.decimal(v.units(quantity, true)));
        expect(result.data).not.have.property('requestHash');
        expect(result.data).not.have.property('quantityUnits');
        expect(repo.append.calledOnce).eq(true);
      },
    );
  for (const product of [
    null,
    { status: 'deleted' },
    { type: 'SERVICE', status: 'active' },
    { type: 'PRODUCT', trackInventory: false, status: 'active' },
    { type: 'PRODUCT', trackInventory: true, status: 'inactive' },
  ])
    it('blocks ineligible product ' + JSON.stringify(product), async () => {
      repo.product.resolves(product);
      await rejects(
        service.move(input(), actor),
        !product || product.status === 'deleted' ? 404 : 400,
      );
      expect(repo.change.called).eq(false);
    });
  for (const warehouse of [null, { status: 'inactive' }])
    it('blocks warehouse ' + JSON.stringify(warehouse), async () => {
      repo.warehouse.resolves(warehouse);
      await rejects(service.move(input(), actor), warehouse ? 400 : 404);
      expect(repo.append.called).eq(false);
    });
  for (const type of ['EXIT', 'TRANSFER'])
    it(type + ' insufficient balance never appends', async () => {
      repo.change.rejects(new ConflictError('Stock insuficiente'));
      await rejects(service.move(input(type), actor), 409);
      expect(repo.append.called).eq(false);
    });
  it('repository failure propagates without successful result', async () => {
    repo.append.rejects(new Error('internal-secret'));
    let error;
    try {
      await service.move(input(), actor);
    } catch (e) {
      error = e;
    }
    expect(error.message).eq('internal-secret');
  });
  it('retry replays exactly once and different payload conflicts', async () => {
    await service.move(input(), actor);
    const stored = repo.append.firstCall.args[0];
    repo.replay.resolves(stored);
    repo.change.resetHistory();
    expect((await service.move(input(), actor)).replayed).eq(true);
    expect(repo.change.called).eq(false);
    await rejects(service.move(input('ENTRY', '3'), actor), 409);
  });
  it('paginated balances serialize exact quantities', async () => {
    sinon
      .stub(repo, 'list')
      .resolves({ rows: [{ warehouseId: a, quantityUnits: 1234 }], total: 31 });
    const result = await service.list('balances', {
      page: '2',
      limit: '20',
      productId: p,
    });
    expect(result.data[0].quantity).eq('0.1234');
    expect(result.data[0].available).eq('0.1234');
    expect(result.pagination).deep.eq({
      page: 2,
      limit: 20,
      total: 31,
      pages: 2,
    });
  });
});
describe('M06 input security and precision', () => {
  for (const value of [
    0,
    1,
    null,
    {},
    [],
    'NaN',
    'Infinity',
    '0',
    '-0',
    '-1',
    '1.12345',
    '1e2',
    '01',
    '100000000.0001',
    '9999999999999999999',
  ])
    it('rejects quantity ' + JSON.stringify(value), () =>
      expect(() => v.movement({ ...input(), quantity: value })).to.throw(),
    );
  for (const field of [
    'createdBy',
    'updatedBy',
    'role',
    'quantityUnits',
    'balance',
    'requestHash',
    'status',
  ])
    it('rejects mass assignment ' + field, () =>
      expect(() => v.movement({ ...input(), [field]: actor })).to.throw(),
    );
  for (const change of [
    { productId: 'bad' },
    { sourceWarehouseId: a },
    { reason: '' },
    { idempotencyKey: 'x' },
    { type: 'toString' },
    { destinationWarehouseId: 'bad' },
  ])
    it('rejects malformed movement ' + JSON.stringify(change), () =>
      expect(() => v.movement({ ...input(), ...change })).to.throw(),
    );
  it('rejects same warehouse transfer', () =>
    expect(() =>
      v.movement({ ...input('TRANSFER'), destinationWarehouseId: a }),
    ).to.throw());
  it('fractional arithmetic remains exact', () =>
    expect(v.decimal(v.units('0.1') + v.units('0.2'))).eq('0.3000'));
  it('accepts maximum quantity', () =>
    expect(v.units('100000000')).eq(v.MAX_UNITS));
  for (const query of [
    { page: '0' },
    { limit: '101' },
    { page: {} },
    { type: 'BAD' },
    { warehouseId: 'bad' },
    { from: 'bad' },
    { from: '2026-02-30T00:00:00Z' },
    { from: '2026-02-01T00:00:00Z', to: '2026-01-01T00:00:00Z' },
    { createdBy: actor },
  ])
    it('rejects query ' + JSON.stringify(query), () =>
      expect(() => v.query(query, 'movements')).to.throw(),
    );
  it('validates all movement filters', () =>
    expect(
      v.query(
        {
          productId: p,
          warehouseId: a,
          type: 'ENTRY',
          from: '2026-01-01T00:00:00Z',
          search: 'SKU',
        },
        'movements',
      ),
    ).includes({ productId: p, warehouseId: a, type: 'ENTRY' }));
  it('warehouse validates and normalizes code', () =>
    expect(v.warehouse({ code: 'qa_1', name: ' QA ' })).deep.eq({
      code: 'QA_1',
      name: 'QA',
    }));
  it('warehouse rejects forged actor and immutable code update', () => {
    expect(() =>
      v.warehouse({ code: 'A', name: 'A', createdBy: actor }),
    ).to.throw();
    expect(() => v.warehouse({ code: 'B' }, true)).to.throw();
  });
  it('model rejects unsafe or negative balance', () => {
    for (const n of [-1, 0.1, Number.MAX_SAFE_INTEGER])
      expect(
        new InventoryBalance({
          productId: p,
          warehouseId: a,
          quantityUnits: n,
        }).validateSync(),
      ).to.exist;
  });
  it('applied movement cannot be updated', async () => {
    let error;
    try {
      await InventoryMovement.updateOne({ _id: p }, { quantityUnits: 1 });
    } catch (e) {
      error = e;
    }
    expect(error.message).eq('Applied movements are immutable');
  });
});
describe('M06 transaction orchestration', () => {
  afterEach(() => sinon.restore());
  it('uses snapshot and majority, and closes session after success', async () => {
    const mongoose = require('mongoose');
    const session = {
      withTransaction: sinon.stub().callsFake(async (fn) => fn()),
      endSession: sinon.stub().resolves(),
    };
    sinon.stub(mongoose, 'startSession').resolves(session);
    expect(await repo.transaction(async () => 42)).eq(42);
    expect(session.withTransaction.firstCall.args[1]).deep.eq({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });
    expect(session.endSession.calledOnce).eq(true);
  });
  it('aborts errors and closes session', async () => {
    const mongoose = require('mongoose');
    const session = {
      withTransaction: async (fn) => fn(),
      endSession: sinon.stub().resolves(),
    };
    sinon.stub(mongoose, 'startSession').resolves(session);
    await rejects(
      repo.transaction(async () => {
        throw new ConflictError();
      }),
      409,
    );
    expect(session.endSession.calledOnce).eq(true);
  });
  it('conditional debit prevents double consumption in atomic storage stub', async () => {
    let stock = 100000;
    const model = InventoryBalance;
    sinon.stub(model, 'updateOne').resolves({});
    sinon.stub(model, 'findOneAndUpdate').callsFake(async (filter, update) => {
      if (stock < filter.quantityUnits.$gte) return null;
      stock += update.$inc.quantityUnits;
      return { quantityUnits: stock };
    });
    const results = await Promise.allSettled([
      repo.change(p, a, -80000, {}),
      repo.change(p, a, -80000, {}),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).length(1);
    expect(stock).eq(20000);
  });
});

describe('M06 catalog lifecycle coordination', () => {
  const mongoose = require('mongoose'),
    Product = require('../products/products.model'),
    catalog = require('../products/products.repository');
  afterEach(() => sinon.restore());
  for (const set of [
    { type: 'SERVICE', trackInventory: false },
    { trackInventory: false },
  ])
    it(
      'blocks eligibility removal after history ' + JSON.stringify(set),
      async () => {
        sinon
          .stub(mongoose.connection, 'transaction')
          .callsFake((work) => work({}));
        sinon
          .stub(Product, 'findOneAndUpdate')
          .resolves({ _id: p, type: 'PRODUCT', trackInventory: true });
        sinon
          .stub(mongoose.connection, 'collection')
          .returns({ findOne: async () => ({ _id: p }) });
        await rejects(catalog.update(p, set), 409);
        expect(Product.findOneAndUpdate.calledOnce).eq(true);
      },
    );
  it('allows conversion without history inside the same transaction', async () => {
    sinon
      .stub(mongoose.connection, 'transaction')
      .callsFake((work) => work({}));
    const write = sinon.stub(Product, 'findOneAndUpdate');
    write
      .onFirstCall()
      .resolves({ _id: p, type: 'PRODUCT', trackInventory: true });
    write.onSecondCall().resolves({ _id: p, type: 'SERVICE' });
    sinon
      .stub(mongoose.connection, 'collection')
      .returns({ findOne: async () => null });
    expect(
      (await catalog.update(p, { type: 'SERVICE', trackInventory: false }))
        .type,
    ).eq('SERVICE');
    expect(write.firstCall.args[1]).deep.eq({ $inc: { __v: 1 } });
  });
  it('catalog lock is acquired with the movement transaction session', async () => {
    const session = {},
      query = { lean: async () => ({ _id: p }) },
      lock = sinon.stub(Product, 'findOneAndUpdate').returns(query);
    await repo.product(p, session);
    expect(lock.firstCall.args[2].session).eq(session);
    expect(lock.firstCall.args[1]).deep.eq({ $inc: { __v: 1 } });
  });
});
