/* eslint-env es2020 */
const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const numbering = require('../src/modules/commercial/numbering');
const Document = require('../src/modules/commercial/commercial.model');
const repo = require('../src/modules/commercial/commercial.repository');
const Product = require('../src/modules/products/products.model');
const Customer = require('../src/modules/customers/customers.model');
const Supplier = require('../src/modules/suppliers/suppliers.model');
const Audit = require('../src/modules/audit/audit.model');
const audit = require('../src/modules/audit/audit.service');
const auditRepo = require('../src/modules/audit/audit.repository');
const inventory = require('../src/modules/commercial/inventory.contract');
const validation = require('../src/modules/commercial/commercial.validation');
const id = '507f1f77bcf86cd799439011';
const session = { transaction: 'fixture' };
async function failure(promise) {
  try { await promise; } catch (error) { return error; }
  throw new Error('Expected rejection');
}

describe('Commercial persistent numbering (atomic storage simulated)', () => {
  let persisted;
  beforeEach(() => {
    persisted = new Map();
    sinon.stub(numbering.Counter, 'findOneAndUpdate').callsFake(async (filter, update, options) => {
      expect(filter.value).to.deep.equal({ $lt: Number.MAX_SAFE_INTEGER });
      expect(update).to.deep.equal({ $inc: { value: 1 } });
      expect(options).to.include({ new: true, upsert: true, session, setDefaultsOnInsert: false });
      const value = (persisted.get(filter._id) || 0) + 1;
      persisted.set(filter._id, value);
      return { value };
    });
  });
  afterEach(() => sinon.restore());
  it('generates incremental visible numbers and separate sequences per type', async () => {
    expect(await numbering.next('SALE', session)).to.deep.equal({ number: 'SALE-000001', sequence: 1 });
    expect(await numbering.next('SALE', session)).to.deep.equal({ number: 'SALE-000002', sequence: 2 });
    expect(await numbering.next('PURCHASE', session)).to.deep.equal({ number: 'PURCHASE-000001', sequence: 1 });
  });
  it('simulated concurrent callers get 100 unique numbers across document types', async () => {
    const rows = await Promise.all(Array.from({ length: 100 }, (_, i) => numbering.next(i % 2 ? 'SALE' : 'PURCHASE', session)));
    expect(new Set(rows.map(row => row.number)).size).to.equal(100);
    expect(persisted.get('SALE')).to.equal(50);
    expect(persisted.get('PURCHASE')).to.equal(50);
  });
  it('module reload preserves the database-backed sequence instead of resetting in memory', async () => {
    await numbering.next('SALE', session);
    const path = require.resolve('../src/modules/commercial/numbering');
    const cached = require.cache[path];
    try {
      delete require.cache[path];
      const restarted = require(path);
      expect(await restarted.next('SALE', session)).to.deep.equal({ number: 'SALE-000002', sequence: 2 });
    } finally { require.cache[path] = cached; }
  });
  it('requires the shared transaction and a registered type', async () => {
    expect((await failure(numbering.next('SALE'))).message).to.include('transaction');
    expect((await failure(numbering.next('SALE-X', session))).statusCode).to.equal(400);
    expect(numbering.Counter.findOneAndUpdate.called).to.equal(false);
  });
  for (const value of [0, 1.5, Number.MAX_SAFE_INTEGER + 1])
    it('rejects corrupt counter value ' + value, async () => {
      numbering.Counter.findOneAndUpdate.resolves({ value });
      expect((await failure(numbering.next('SALE', session))).statusCode).to.equal(409);
    });
});

describe('Commercial schemas, persistence and transitions', () => {
  afterEach(() => sinon.restore());
  it('defines unique indexes for visible numbers and per-type sequences', () => {
    const unique = Document.schema.indexes().filter(([, options]) => options.unique).map(([keys]) => keys);
    expect(unique).to.deep.include({ number: 1 });
    expect(unique).to.deep.include({ type: 1, sequence: 1 });
    expect(numbering.Counter.schema.path('_id').instance).to.equal('String');
  });
  it('explicit setup creates collections and unique indexes before transaction use', async () => {
    const calls = [];
    for (const Model of [numbering.Counter, Document, Audit]) {
      sinon.stub(Model, 'createCollection').callsFake(async () => calls.push(Model.modelName + '.collection'));
      sinon.stub(Model, 'createIndexes').callsFake(async () => calls.push(Model.modelName + '.indexes'));
    }
    await require('../src/modules/commercial/commercial.setup')();
    expect(calls).to.deep.equal(['CommercialCounter.collection', 'CommercialCounter.indexes', 'CommercialDocument.collection', 'CommercialDocument.indexes', 'audit.collection', 'audit.indexes']);
  });
  it('rejects missing lines, invalid state and invalid totals at schema level', () => {
    const error = new Document({ status: 'paid', total: '-1', lines: [] }).validateSync();
    expect(error.errors).to.have.all.keys('number', 'sequence', 'type', 'date', 'currency', 'entity', 'subtotal', 'discount', 'tax', 'total', 'createdBy', 'updatedBy', 'status', 'lines');
  });
  it('strict schemas reject internal/unrecognized payload fields', () => {
    expect(() => new Document({ jwt: 'fixture' })).to.throw();
    expect(() => new Audit({ password: 'fixture' })).to.throw();
  });
  for (const [from, to] of [['draft', 'confirmed'], ['draft', 'cancelled'], ['confirmed', 'cancelled']])
    it(`allows ${from} -> ${to}`, () => expect(() => validation.transition(from, to)).not.to.throw());
  for (const [from, to] of [['cancelled', 'confirmed'], ['cancelled', 'draft'], ['confirmed', 'draft'], ['confirmed', 'confirmed'], ['cancelled', 'cancelled'], ['draft', 'draft']])
    it(`rejects ${from} -> ${to}`, () => expect(() => validation.transition(from, to)).to.throw().with.property('statusCode', 409));
  it('rejects unknown document states', () => expect(() => validation.transition('paid', 'confirmed')).to.throw().with.property('statusCode', 400));
  for (const [name, Model] of [['product', Product], ['customer', Customer], ['supplier', Supplier]])
    it('locks an active ' + name + ' with the document session', async () => {
      const find = sinon.stub(Model, 'findOneAndUpdate').returns({ lean: async () => ({ _id: id }) });
      if (name === 'product') await repo.product(id, session);
      else await repo.entity(name, id, session);
      expect(find.firstCall.args).to.deep.equal([
        { _id: id, status: 'active' }, { $inc: { __v: 1 } }, { new: true, session, timestamps: false },
      ]);
    });
  it('locks documents and persists conditional updates in the same session', async () => {
    const find = sinon.stub(Document, 'findOneAndUpdate').returns({ lean: async () => ({ _id: id }) });
    await repo.lock(id, session);
    expect(find.firstCall.args[1]).to.deep.equal({ $inc: { __v: 1 } });
    expect(find.firstCall.args[2].session).to.equal(session);
    await repo.update(id, 'draft', { status: 'confirmed' }, session);
    expect(find.secondCall.args).to.deep.equal([
      { _id: id, status: 'draft' }, { $set: { status: 'confirmed' } }, { new: true, runValidators: true, session },
    ]);
  });
});

describe('Commercial inventory interfaces are plans, not stock operations', () => {
  const document = (type = 'SALE') => ({
    _id: id, type, status: 'draft',
    lines: [
      { _id: 'line1', productId: id, quantity: '1.2500', snapshot: { type: 'PRODUCT', trackInventory: true } },
      { _id: 'line2', productId: id, quantity: '2.0000', snapshot: { type: 'SERVICE', trackInventory: false } },
      { _id: 'line3', productId: id, quantity: '2.0000', snapshot: { type: 'PRODUCT', trackInventory: false } },
    ],
  });
  for (const [type, direction, reverse] of [['SALE', 'EXIT', 'ENTRY'], ['PURCHASE', 'ENTRY', 'EXIT']])
    it('describes future ' + type + ' effects and requires original movement for cancellation', () => {
      const row = document(type);
      const plan = inventory.plan(row, 'confirm');
      expect(plan.length).to.equal(1);
      expect(plan[0]).to.include({ direction, quantity: '1.2500', requiresOriginalMovement: false });
      expect(inventory.plan(row, 'confirm')[0].idempotencyKey).to.equal(plan[0].idempotencyKey);
      expect(inventory.plan(row, 'cancel')).to.deep.equal([]);
      row.status = 'confirmed';
      expect(inventory.plan(row, 'cancel')[0]).to.include({ direction: reverse, requiresOriginalMovement: true });
      expect(() => inventory.requireImplemented(plan)).to.throw().with.property('statusCode', 409);
    });
  it('rejects unknown operations rather than assuming a movement direction', () => {
    expect(() => inventory.plan(document('OTHER'), 'confirm')).to.throw();
    expect(() => inventory.plan(document(), 'receive')).to.throw();
  });
});

describe('Existing audit module: append-only allowlisted commercial metadata', () => {
  const data = { actorId: id, action: 'create', module: 'commercial', entity: 'CommercialDocument', entityId: id, result: 'success' };
  afterEach(() => sinon.restore());
  it('uses the existing audit model and transaction without recording payloads', async () => {
    const create = sinon.stub(Audit, 'create').resolves([{ _id: id }]);
    await audit.record(data, session);
    expect(create.firstCall.args).to.deep.equal([[data], { session }]);
    expect(Audit.schema.options.timestamps).to.equal(true);
  });
  for (const key of ['password', 'passwordHash', 'jwt', 'token', 'apiKey', 'connectionString', 'payload'])
    it('rejects sensitive/arbitrary audit field ' + key, async () => {
      const append = sinon.stub(auditRepo, 'append');
      expect((await failure(audit.record({ ...data, [key]: 'fixture-sensitive-value' }, session))).statusCode).to.equal(400);
      expect(append.called).to.equal(false);
    });
  it('rejects secret-like values in metadata enums and malformed identifiers', async () => {
    sinon.stub(auditRepo, 'append');
    for (const key of ['actorId', 'entityId', 'action', 'module', 'entity', 'result'])
      expect((await failure(audit.record({ ...data, [key]: 'fixture-sensitive-value' }, session))).statusCode).to.equal(400);
    expect(auditRepo.append.called).to.equal(false);
  });
  it('requires a transaction and denies mutation/deletion of audit history', async () => {
    expect((await failure(audit.record(data))).message).to.include('transaction');
    expect((await failure(Audit.updateOne({ _id: id }, { result: 'failure' }).exec())).message).to.equal('Audit records are immutable');
    expect((await failure(Audit.deleteOne({ _id: id }).exec())).message).to.equal('Audit records are immutable');
    const row = new Audit(data); row.isNew = false;
    expect((await failure(row.save())).message).to.equal('Audit records are immutable');
  });
  it('supports a failure outcome without free-form error details', async () => {
    const append = sinon.stub(auditRepo, 'append').resolves({});
    await audit.record({ ...data, result: 'failure' }, session);
    expect(append.firstCall.args[0].result).to.equal('failure');
  });
});
