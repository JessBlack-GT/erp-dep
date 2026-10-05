/* eslint-env node, es2020, mocha */
const { expect } = require('chai');
const sinon = require('sinon');
const {
  fixture,
  ids,
  input,
  rejects,
  clone,
} = require('./helpers/sales.fixture');
const sales = require('../src/modules/sales/sales.service');
const inventory = require('../src/modules/inventory/inventory.service');
const inventoryRepo = require('../src/modules/inventory/inventory.repository');
const audit = require('../src/modules/audit/audit.repository');
const {
  InventoryMovement,
} = require('../src/modules/inventory/inventory.model');
const { MAX_UNITS } = require('../src/modules/inventory/inventory.validation');
const mongoose = require('mongoose');

describe('Sales + real services/adapter/core, SIMULATED transactional storage', () => {
  let f;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => sinon.restore());
  const confirm = (row, actor) =>
    sales.confirm(row._id, { expectedRevision: row.revision }, actor);
  const cancel = (row, actor) =>
    sales.cancel(row._id, { expectedRevision: row.revision }, actor);
  it('confirms and exactly reverses across multiple lines and warehouses in one session', async () => {
    const draft = await sales.create(
      input([
        {
          productId: ids.product,
          quantity: '1.25',
          warehouseId: ids.warehouse,
        },
        { productId: ids.product, quantity: '2', warehouseId: ids.second },
        { productId: ids.service, quantity: '3' },
        { productId: ids.untracked, quantity: '1' },
      ]),
      f.actor,
    );
    expect(Object.keys(f.db.movements)).length(0);
    const confirmed = await confirm(draft, f.actor);
    expect(confirmed).include({ status: 'confirmed', revision: 1 });
    expect(f.balance()).eq(87500);
    expect(f.balance(ids.second)).eq(80000);
    expect(Object.values(f.db.movements)).length(2);
    const cancelled = await cancel(confirmed, f.actor);
    expect(cancelled).include({ status: 'cancelled', revision: 2 });
    expect(f.balance()).eq(100000);
    expect(f.balance(ids.second)).eq(100000);
    for (const line of cancelled.lines.slice(0, 2)) {
      const original = f.db.movements[line.exitMovementId],
        reverse = f.db.movements[line.reversalMovementId];
      expect(original.type).eq('EXIT');
      expect(reverse.type).eq('ENTRY');
      expect(reverse.reversalOf).eq(original._id);
      expect(reverse.destinationWarehouseId).eq(original.sourceWarehouseId);
      expect(reverse.quantityUnits).eq(original.quantityUnits);
      expect(reverse.origin).deep.eq({
        documentId: draft._id,
        lineId: line._id,
        action: 'cancel',
      });
      expect(original).not.have.property('reversalOf');
    }
    expect(f.db.audits.map((a) => a.action)).deep.eq([
      'create',
      'confirm',
      'cancel',
    ]);
  });
  for (const key of ['service', 'untracked'])
    it(key + ' confirms and cancels without inventory', async () => {
      const draft = await sales.create(
        input([{ productId: ids[key], quantity: '1' }]),
        f.actor,
      );
      const done = await confirm(draft, f.actor);
      await cancel(done, f.actor);
      expect(Object.keys(f.db.movements)).length(0);
      expect(inventoryRepo.append.called).eq(false);
    });
  it('draft cancellation never moves stock', async () => {
    const draft = await sales.create(input(), f.actor);
    await cancel(draft, f.actor);
    expect(f.balance()).eq(100000);
    expect(Object.keys(f.db.movements)).length(0);
  });
  it('requires warehouse at confirmation, but allows its omission in a draft', async () => {
    const draft = await sales.create(
      input([{ productId: ids.product, quantity: '1' }]),
      f.actor,
    );
    const before = clone(f.db);
    await rejects(confirm(draft, f.actor), 409);
    expect(f.db).deep.eq(before);
  });
  for (const quantities of [['11'], ['6', '6']])
    it('rolls back insufficient cumulative stock: ' + quantities, async () => {
      const draft = await sales.create(
        input(
          quantities.map((quantity) => ({
            productId: ids.product,
            quantity,
            warehouseId: ids.warehouse,
          })),
        ),
        f.actor,
      );
      const before = clone(f.db);
      await rejects(confirm(draft, f.actor), 409);
      expect(f.db).deep.eq(before);
    });
  it('preserves historical prices and snapshots across catalog changes', async () => {
    const draft = await sales.create(input(), f.actor);
    Object.assign(f.products[ids.product], {
      name: 'Changed',
      sku: 'NEW',
      price: '99.0000',
    });
    f.customer.name = 'Changed customer';
    const done = await confirm(draft, f.actor);
    expect(done.total).eq(draft.total);
    expect(done.entity).deep.eq(draft.entity);
    expect(done.lines[0].snapshot).deep.eq(draft.lines[0].snapshot);
    await cancel(done, f.actor);
    expect(f.balance()).eq(100000);
  });
  for (const operation of ['update', 'confirm', 'cancel'])
    it('rejects stale revision for ' + operation, async () => {
      const draft = await sales.create(input(), f.actor);
      const body =
        operation === 'update'
          ? { ...input(), expectedRevision: 9 }
          : { expectedRevision: 9 };
      const before = clone(f.db);
      await rejects(sales[operation](draft._id, body, f.actor), 409);
      expect(f.db).deep.eq(before);
    });
  it('updates drafts only, increments revision, recalculates and refreshes draft snapshots', async () => {
    const draft = await sales.create(input(), f.actor);
    f.products[ids.product].name = 'Edited';
    const updated = await sales.update(
      draft._id,
      {
        ...input([
          {
            productId: ids.product,
            quantity: '3',
            unitPrice: '4',
            warehouseId: ids.warehouse,
          },
        ]),
        expectedRevision: 0,
      },
      f.actor,
    );
    expect(updated).include({
      revision: 1,
      number: draft.number,
      total: '12.0000',
    });
    expect(updated.lines[0].snapshot.name).eq('Edited');
    const done = await confirm(updated, f.actor);
    await rejects(
      sales.update(done._id, { ...input(), expectedRevision: 2 }, f.actor),
      409,
    );
  });
  it('lost response/retries by a different actor remain 409 without extra stock or audit', async () => {
    const draft = await sales.create(input(), f.actor),
      other = { ...f.actor, id: ids.other };
    const done = await confirm(draft, f.actor),
      before = clone(f.db);
    await rejects(confirm(draft, other), 409);
    await rejects(confirm(done, other), 409);
    expect(f.db).deep.eq(before);
    const cancelled = await cancel(done, other),
      after = clone(f.db);
    await rejects(cancel(cancelled, f.actor), 409);
    await rejects(confirm(cancelled, f.actor), 409);
    await rejects(
      sales.update(cancelled._id, { ...input(), expectedRevision: 2 }, f.actor),
      409,
    );
    expect(f.db).deep.eq(after);
  });
  for (const mutation of [
    'unit',
    'type',
    'tracking',
    'deleted',
    'inactive',
    'warehouse',
    'overflow',
  ])
    it('rejects incompatible reversal atomically: ' + mutation, async () => {
      const done = await confirm(await sales.create(input(), f.actor), f.actor);
      if (mutation === 'unit') f.products[ids.product].unit = 'box';
      if (mutation === 'type') f.products[ids.product].type = 'SERVICE';
      if (mutation === 'tracking')
        f.products[ids.product].trackInventory = false;
      if (['deleted', 'inactive'].includes(mutation))
        f.products[ids.product].status = mutation;
      if (mutation === 'warehouse')
        f.warehouses[ids.warehouse].status = 'inactive';
      if (mutation === 'overflow')
        f.db.balances[ids.product + ':' + ids.warehouse] = MAX_UNITS;
      const before = clone(f.db);
      await rejects(cancel(done, f.actor), 409);
      expect(f.db).deep.eq(before);
    });
  it('zero current balance does not block a sales reversal, which is an ENTRY', async () => {
    const done = await confirm(await sales.create(input(), f.actor), f.actor);
    f.db.balances[ids.product + ':' + ids.warehouse] = 0;
    await cancel(done, f.actor);
    expect(f.balance()).eq(20000);
  });
  for (const field of [
    'documentId',
    'lineId',
    'productId',
    'quantity',
    'direction',
    'warehouse',
    'missing',
    'reversed',
  ])
    it('rejects mismatched original movement: ' + field, async () => {
      const done = await confirm(await sales.create(input(), f.actor), f.actor);
      const original = f.db.movements[done.lines[0].exitMovementId];
      if (['documentId', 'lineId'].includes(field))
        original.origin[field] = ids.other;
      if (field === 'productId') original.productId = ids.other;
      if (field === 'quantity') original.quantityUnits++;
      if (field === 'direction') original.type = 'ENTRY';
      if (field === 'warehouse') original.sourceWarehouseId = ids.second;
      if (field === 'missing') delete f.db.movements[original._id];
      if (field === 'reversed')
        inventoryRepo.reversal.resolves({ _id: ids.other });
      const before = clone(f.db);
      await rejects(cancel(done, f.actor), 409);
      expect(f.db).deep.eq(before);
    });
  for (const action of ['create', 'update', 'confirm', 'cancel'])
    it('rolls back every write when audit fails during ' + action, async () => {
      let row;
      if (action !== 'create') row = await sales.create(input(), f.actor);
      if (action === 'cancel') row = await confirm(row, f.actor);
      const before = clone(f.db);
      audit.append.rejects(new Error('audit failure'));
      try {
        if (action === 'create') await sales.create(input(), f.actor);
        else if (action === 'update')
          await sales.update(
            row._id,
            { ...input(), expectedRevision: row.revision },
            f.actor,
          );
        else
          await sales[action](
            row._id,
            { expectedRevision: row.revision },
            f.actor,
          );
        throw new Error('Expected failure');
      } catch (error) {
        expect(error.message).eq('audit failure');
      }
      expect(f.db).deep.eq(before);
    });
  it('rolls back balance changes when the movement insert fails', async () => {
    const row = await sales.create(input(), f.actor),
      before = clone(f.db);
    inventoryRepo.append.rejects(new Error('ledger failure'));
    try {
      await confirm(row, f.actor);
      throw new Error('Expected failure');
    } catch (error) {
      expect(error.message).eq('ledger failure');
    }
    expect(f.db).deep.eq(before);
  });
  for (const pair of ['confirm-confirm', 'confirm-cancel', 'update-confirm'])
    it('serializes simulated competing commands: ' + pair, async () => {
      const row = await sales.create(input(), f.actor);
      const results = await Promise.allSettled(
        pair
          .split('-')
          .map((action, i) =>
            sales[action](
              row._id,
              { ...(action === 'update' ? input() : {}), expectedRevision: 0 },
              { ...f.actor, id: i ? ids.other : ids.actor },
            ),
          ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).length(1);
      expect(results.find((r) => r.status === 'rejected').reason.statusCode).eq(
        409,
      );
      expect(f.db.documents[row._id].revision).eq(1);
    });
  it('allows only one of two simulated sales to consume the last stock', async () => {
    f.db.balances[ids.product + ':' + ids.warehouse] = 20000;
    const a = await sales.create(input(), f.actor),
      b = await sales.create(input(), f.actor);
    const results = await Promise.allSettled([
      confirm(a, f.actor),
      confirm(b, { ...f.actor, id: ids.other }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).length(1);
    expect(results.find((r) => r.status === 'rejected').reason.statusCode).eq(
      409,
    );
    expect(f.balance()).eq(0);
    expect(Object.values(f.db.movements)).length(1);
  });
  it('requires an active session and never opens a nested transaction', async () => {
    for (const session of [undefined, {}, { inTransaction: () => false }]) {
      try {
        await inventory.moveInTransaction({}, ids.actor, session);
        throw new Error('Expected failure');
      } catch (error) {
        expect(error.message).eq('Inventory requires an active transaction');
      }
    }
    const nested = sinon.spy(inventoryRepo, 'transaction');
    await confirm(await sales.create(input(), f.actor), f.actor);
    expect(nested.called).eq(false);
    expect(mongoose.connection.transaction.callCount).eq(2);
  });
  it('declares global partial unique origins and one reversal per original', () => {
    const indexes = InventoryMovement.schema.indexes();
    expect(
      indexes.some(
        ([key, opt]) =>
          key['origin.documentId'] &&
          key['origin.lineId'] &&
          key['origin.action'] &&
          opt.unique &&
          opt.partialFilterExpression,
      ),
    ).eq(true);
    expect(
      indexes.some(
        ([key, opt]) =>
          key.reversalOf && opt.unique && opt.partialFilterExpression,
      ),
    ).eq(true);
  });
});
