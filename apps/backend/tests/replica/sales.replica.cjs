/* eslint-env node, es2020, mocha */
// Explicit opt-in suite. npm test runs simulated storage tests; this command must
// fail (not skip) without a dedicated test replica set URI.
// erp_sales_test is exclusively reserved for this suite: run one suite at a time.
// Use readWrite + dbAdmin scoped ONLY to erp_sales_test, never global roles.
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const sales = require('../../src/modules/sales/sales.service');
const inventory = require('../../src/modules/inventory/inventory.service');
const initialize = require('../../src/modules/sales/sales.setup');
const User = require('../../src/modules/users/users.model');
const Role = require('../../src/modules/roles/roles.model');
const Customer = require('../../src/modules/customers/customers.model');
const Product = require('../../src/modules/products/products.model');
const Document = require('../../src/modules/commercial/commercial.model');
const Audit = require('../../src/modules/audit/audit.model');
const auditRepo = require('../../src/modules/audit/audit.repository');
const {
  Warehouse,
  InventoryBalance,
  InventoryMovement,
} = require('../../src/modules/inventory/inventory.model');
const { PERMISSIONS } = require('../../src/security/rbac');

describe('Sales REAL MongoDB replica-set transactions (explicit command)', function () {
  this.timeout(30000);
  const dbName = 'erp_sales_test';
  let connectionAttempted = false;
  let cleanupRequired = false;
  function testDatabase() {
    const connection = mongoose.connection;
    const db = connection.db;
    if (
      connection.readyState !== 1 ||
      connection.name === 'yj_nexo_prod' ||
      db?.databaseName === 'yj_nexo_prod' ||
      connection.name !== dbName ||
      db?.databaseName !== 'erp_sales_test'
    )
      throw new Error('Unsafe database identity; no test or cleanup permitted');
    return db;
  }
  async function cleanTestDatabase() {
    // Validate the actual driver Db immediately before dropping that same Db.
    const db = testDatabase();
    try {
      await db.dropDatabase();
    } catch (_) {
      throw new Error('Cleanup of erp_sales_test failed; no other database was targeted');
    }
  }
  let actor, other, customer, product, warehouse;
  const input = () => ({
    date: '2026-10-04',
    currency: 'USD',
    entityId: String(customer._id),
    lines: [
      {
        productId: String(product._id),
        quantity: '2',
        warehouseId: String(warehouse._id),
      },
    ],
  });
  const confirm = (row, who = actor) =>
    sales.confirm(String(row._id), { expectedRevision: row.revision }, who);
  const cancel = (row, who = actor) =>
    sales.cancel(String(row._id), { expectedRevision: row.revision }, who);
  const balance = async () =>
    (
      await InventoryBalance.findOne({
        productId: product._id,
        warehouseId: warehouse._id,
      }).lean()
    ).quantityUnits;
  before(async () => {
    const uri = process.env.SALES_TEST_MONGODB_URI;
    if (!uri)
      throw new Error(
        'Required: SALES_TEST_MONGODB_URI for an isolated test replica set; real integration was not executed',
      );
    if (mongoose.connection.readyState !== 0)
      throw new Error('An existing connection cannot be reused for this suite');
    connectionAttempted = true;
    try {
      await mongoose.connect(uri, {
        dbName,
        serverSelectionTimeoutMS: 5000,
        autoIndex: false,
        autoCreate: false,
      });
    } catch (_) {
      throw new Error('Could not connect to the dedicated test replica set');
    }
    const db = testDatabase();
    let topology;
    try {
      // hello is topology discovery, not a read of another database's data.
      topology = await db.command({ hello: 1 });
    } catch (_) {
      throw new Error('Could not verify transaction-capable topology; tests were not started');
    }
    const sharded = topology.msg === 'isdbgrid';
    if (
      (!topology.setName && !sharded) ||
      !Number.isFinite(topology.logicalSessionTimeoutMinutes) ||
      !Number.isFinite(topology.maxWireVersion) ||
      topology.maxWireVersion < (sharded ? 8 : 7)
    )
      throw new Error('A transaction-capable replica set or Atlas deployment is required');
    // Fixed, dedicated database: remove leftovers only after identity/topology checks.
    await cleanTestDatabase();
    cleanupRequired = true;
    try {
      testDatabase();
      await initialize();
      for (const Model of [User, Role, Customer, Product]) {
        await Model.createCollection();
        await Model.createIndexes();
      }
    } catch (_) {
      throw new Error('Could not initialize test storage in erp_sales_test');
    }
  });
  beforeEach(async () => {
    testDatabase();
    const role = await Role.create({
      name: 'test_' + randomUUID().replace(/-/g, ''),
      permissions: PERMISSIONS,
      status: 'active',
    });
    const actors = [];
    for (let i = 0; i < 2; i++) {
      const user = await User.create({
        email: randomUUID() + '@example.test',
        password: randomUUID(),
        firstName: 'Test',
        lastName: 'Sales',
        role: role.name,
      });
      actors.push({ id: String(user._id), sessionVersion: 0 });
    }
    [actor, other] = actors;
    customer = await Customer.create({
      name: 'Customer',
      email: randomUUID() + '@example.test',
    });
    product = await Product.create({
      name: 'Stock',
      sku: randomUUID(),
      type: 'PRODUCT',
      unit: 'unit',
      trackInventory: true,
      price: '10.0000',
      currency: 'USD',
    });
    warehouse = await Warehouse.create({
      code: randomUUID(),
      name: 'Warehouse',
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    await inventory.move(
      {
        productId: String(product._id),
        type: 'ENTRY',
        quantity: '2',
        destinationWarehouseId: String(warehouse._id),
        reason: 'Test seed',
        idempotencyKey: randomUUID(),
      },
      actor.id,
    );
  });
  afterEach(() => sinon.restore());
  after(async () => {
    try {
      if (cleanupRequired) await cleanTestDatabase();
    } finally {
      if (connectionAttempted) {
        try {
          await mongoose.disconnect();
        } catch (_) {
          throw new Error('Could not close the test connection');
        }
      }
    }
  });
  it('commits an EXIT and exact inverse ENTRY, preserving the original', async () => {
    const draft = await sales.create(input(), actor),
      done = await confirm(draft);
    expect(await balance()).eq(0);
    const original = await InventoryMovement.findById(
      done.lines[0].exitMovementId,
    ).lean();
    const cancelled = await cancel(done),
      reverse = await InventoryMovement.findById(
        cancelled.lines[0].reversalMovementId,
      ).lean();
    expect(await balance()).eq(20000);
    expect(String(reverse.reversalOf)).eq(String(original._id));
    expect(String(reverse.destinationWarehouseId)).eq(
      String(original.sourceWarehouseId),
    );
    expect(await InventoryMovement.findById(original._id).lean()).deep.eq(
      original,
    );
    expect(await Audit.countDocuments({ entityId: draft._id })).eq(3);
  });
  for (const actions of [
    ['confirm', 'confirm'],
    ['confirm', 'cancel'],
    ['update', 'confirm'],
  ])
    it('serializes real competing ' + actions.join('/'), async () => {
      const draft = await sales.create(input(), actor);
      const results = await Promise.allSettled(
        actions.map((action, i) =>
          sales[action](
            String(draft._id),
            {
              ...(action === 'update' ? input() : {}),
              expectedRevision: 0,
            },
            i ? other : actor,
          ),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).length(1);
      expect(results.find((r) => r.status === 'rejected').reason.statusCode).eq(
        409,
      );
      const row = await Document.findById(draft._id).lean();
      expect(row.revision).eq(1);
      expect(await balance()).eq(row.status === 'confirmed' ? 0 : 20000);
      expect(await Audit.countDocuments({ entityId: draft._id })).eq(2);
    });
  it('only one real sale consumes the last stock', async () => {
    const a = await sales.create(input(), actor),
      b = await sales.create(input(), other);
    const results = await Promise.allSettled([confirm(a), confirm(b, other)]);
    expect(results.filter((r) => r.status === 'fulfilled')).length(1);
    expect(results.find((r) => r.status === 'rejected').reason.statusCode).eq(
      409,
    );
    expect(await balance()).eq(0);
    expect(
      await InventoryMovement.countDocuments({
        productId: product._id,
        type: 'EXIT',
      }),
    ).eq(1);
  });
  for (const action of ['confirm', 'cancel'])
    it(
      'really rolls back stock, ledger, revision and state on audit failure: ' +
        action,
      async () => {
        let row = await sales.create(input(), actor);
        if (action === 'cancel') row = await confirm(row);
        const before = await Document.findById(row._id).lean(),
          stock = await balance();
        const count = await InventoryMovement.countDocuments({
          productId: product._id,
        });
        sinon
          .stub(auditRepo, 'append')
          .rejects(new Error('Injected audit failure'));
        try {
          await sales[action](
            String(row._id),
            { expectedRevision: row.revision },
            actor,
          );
          throw new Error('Expected rejection');
        } catch (error) {
          expect(error.message).eq('Injected audit failure');
        }
        expect(await Document.findById(row._id).lean()).deep.eq(before);
        expect(await balance()).eq(stock);
        expect(
          await InventoryMovement.countDocuments({ productId: product._id }),
        ).eq(count);
      },
    );
  it('enforces global origin/reversal unique indexes across actors in real storage', async () => {
    const done = await confirm(await sales.create(input(), actor));
    const exit = await InventoryMovement.findById(
      done.lines[0].exitMovementId,
    ).lean();
    async function duplicate(data) {
      try {
        await InventoryMovement.collection.insertOne(data);
        throw new Error('Expected duplicate');
      } catch (error) {
        expect(error.code).eq(11000);
      }
    }
    await duplicate({
      ...exit,
      _id: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(other.id),
      idempotencyKey: randomUUID(),
    });
    const cancelled = await cancel(done);
    const reverse = await InventoryMovement.findById(
      cancelled.lines[0].reversalMovementId,
    ).lean();
    await duplicate({
      ...reverse,
      _id: new mongoose.Types.ObjectId(),
      origin: { ...reverse.origin, lineId: new mongoose.Types.ObjectId() },
      createdBy: new mongoose.Types.ObjectId(other.id),
      idempotencyKey: randomUUID(),
    });
  });
  it('lost responses and concurrent cancellations cannot repeat inventory', async () => {
    const draft = await sales.create(input(), actor),
      done = await confirm(draft);
    const retry = await Promise.allSettled([confirm(draft, other)]);
    expect(retry[0].reason.statusCode).eq(409);
    const results = await Promise.allSettled([
      cancel(done),
      cancel(done, other),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).length(1);
    expect(results.find((r) => r.status === 'rejected').reason.statusCode).eq(
      409,
    );
    expect(await balance()).eq(20000);
    expect(
      await InventoryMovement.countDocuments({ 'origin.documentId': done._id }),
    ).eq(2);
  });
});
