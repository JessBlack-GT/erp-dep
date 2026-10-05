/* eslint-env node, es2020, mocha */
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const Document = require('../src/modules/commercial/commercial.model');
const repo = require('../src/modules/commercial/commercial.repository');
const { Counter } = require('../src/modules/commercial/numbering');
const Audit = require('../src/modules/audit/audit.model');
const inventory = require('../src/modules/inventory/inventory.model');
const initialize = require('../src/modules/sales/sales.setup');
const { ids } = require('./helpers/sales.fixture');

describe('Sales persistent query scope and startup preparation', () => {
  afterEach(() => sinon.restore());
  it('scopes MongoDB reads, locks and conditional writes to SALE', async () => {
    const query = { lean: async () => null }, session = {};
    const read = sinon.stub(Document, 'findOne').returns(query);
    const write = sinon.stub(Document, 'findOneAndUpdate').returns(query);
    await repo.get(ids.product, 'SALE');
    await repo.lock(ids.product, session, 'SALE');
    await repo.update(ids.product, 'draft', { revision: 3 }, session, 'SALE', 2);
    expect(read.firstCall.args[0]).deep.eq({ _id: ids.product, type: 'SALE' });
    expect(write.firstCall.args[0]).deep.eq({ _id: ids.product, type: 'SALE' });
    expect(write.secondCall.args[0]).deep.eq({ _id: ids.product, type: 'SALE', status: 'draft', revision: 2 });
    expect(write.secondCall.args[2].session).eq(session);
    expect(write.firstCall.args[1]).deep.eq({ $inc: { __v: 1 } });
  });
  it('accepts revision zero or absent only for legacy revision-zero writes', async () => {
    const write = sinon.stub(Document, 'findOneAndUpdate').returns({ lean: async () => null });
    await repo.update(ids.product, 'draft', { revision: 1 }, {}, 'SALE', 0);
    expect(write.firstCall.args[0].$or).deep.eq([{ revision: 0 }, { revision: { $exists: false } }]);
  });
  for (const topology of [{ setName: 'test' }, { msg: 'isdbgrid' }, {}])
    it('prepares indexes before serving traffic for topology ' + JSON.stringify(topology), async () => {
      const previous = mongoose.connection.db, calls = [];
      mongoose.connection.db = { admin: () => ({ command: async () => topology }) };
      try {
        const models = [Counter, Document, Audit, inventory.Warehouse, inventory.InventoryBalance, inventory.InventoryMovement];
        for (const Model of models) {
          sinon.stub(Model, 'createCollection').callsFake(async () => calls.push(Model.modelName + ':collection'));
          sinon.stub(Model, 'createIndexes').callsFake(async () => calls.push(Model.modelName + ':indexes'));
        }
        if (!topology.setName && !topology.msg) {
          try { await initialize(); throw new Error('Expected failure'); }
          catch (error) { expect(error.message).include('transaction-capable'); }
          expect(calls).length(0);
        } else {
          await initialize();
          expect(calls).deep.eq(models.flatMap(Model => [Model.modelName + ':collection', Model.modelName + ':indexes']));
        }
      } finally { mongoose.connection.db = previous; }
    });
});
