/* eslint-env es2020 */
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const commercial = require('../../src/modules/commercial/commercial.repository');
const Document = require('../../src/modules/commercial/commercial.model');
const { Counter } = require('../../src/modules/commercial/numbering');
const inventory = require('../../src/modules/inventory/inventory.repository');
const {
  InventoryMovement,
  InventoryBalance,
} = require('../../src/modules/inventory/inventory.model');
const audit = require('../../src/modules/audit/audit.repository');
const User = require('../../src/modules/users/users.model');
const Role = require('../../src/modules/roles/roles.model');
const rbac = require('../../src/security/rbac');
const { ConflictError } = require('../../src/shared/errors/appErrors');
const clone = (value) => JSON.parse(JSON.stringify(value));
const ids = Object.fromEntries(
  [
    'actor',
    'other',
    'customer',
    'product',
    'service',
    'untracked',
    'warehouse',
    'second',
  ].map((key, i) => [key, (i + 1).toString(16).padStart(24, '0')]),
);
const input = (
  lines = [
    { productId: ids.product, quantity: '2', warehouseId: ids.warehouse },
  ],
) => ({
  date: '2026-10-04',
  currency: 'USD',
  entityId: ids.customer,
  lines,
});
async function rejects(promise, status) {
  try {
    await promise;
  } catch (error) {
    expect(error.statusCode).eq(status);
    return error;
  }
  throw new Error('Expected rejection');
}
// Serial, rollback-capable storage simulation. This is NOT proof of MongoDB concurrency.
function fixture() {
  const f = {
    actor: { id: ids.actor, sessionVersion: 0 },
    permissions: [...rbac.PERMISSIONS],
    userActive: true,
    roleActive: true,
    sessionVersion: 0,
    db: {
      documents: {},
      counters: {},
      balances: {},
      movements: {},
      audits: [],
    },
    products: {},
    warehouses: {},
    customer: { _id: ids.customer, name: 'Customer', status: 'active' },
  };
  for (const [key, type, trackInventory] of [
    ['product', 'PRODUCT', true],
    ['service', 'SERVICE', false],
    ['untracked', 'PRODUCT', false],
  ])
    f.products[ids[key]] = {
      _id: ids[key],
      name: key,
      sku: key.toUpperCase(),
      status: 'active',
      type,
      trackInventory,
      unit: 'unit',
      price: '10.0000',
      currency: 'USD',
    };
  for (const key of ['warehouse', 'second'])
    f.warehouses[ids[key]] = { _id: ids[key], status: 'active' };
  f.balance = (warehouse = ids.warehouse) =>
    f.db.balances[ids.product + ':' + warehouse] || 0;
  f.db.balances[ids.product + ':' + ids.warehouse] = 100000;
  f.db.balances[ids.product + ':' + ids.second] = 100000;
  let active,
    queue = Promise.resolve();
  const check = (session) => expect(session).eq(active);
  const user = (id) =>
    f.userActive
      ? {
        _id: id,
        role: 'sales',
        status: 'active',
        sessionVersion: f.sessionVersion,
      }
      : null;
  const role = () => ({
    name: 'sales',
    status: f.roleActive ? 'active' : 'inactive',
    permissions: f.permissions,
  });
  sinon
    .stub(User, 'findById')
    .callsFake((id) => ({ select: () => ({ lean: async () => user(id) }) }));
  sinon.stub(Role, 'findOne').returns({ lean: async () => role() });
  sinon.stub(User, 'findOneAndUpdate').callsFake((filter, update, options) => {
    check(options.session);
    return { select: async () => user(filter._id) };
  });
  sinon
    .stub(Role, 'findOneAndUpdate')
    .callsFake(async (filter, update, options) => {
      check(options.session);
      return role();
    });
  sinon.stub(mongoose.connection, 'transaction').callsFake((work) => {
    const run = queue.then(async () => {
      const before = clone(f.db);
      active = { inTransaction: () => true };
      try {
        return await work(active);
      } catch (error) {
        f.db = before;
        throw error;
      } finally {
        active = null;
      }
    });
    queue = run.catch(() => {});
    return run;
  });
  sinon.stub(commercial, 'entity').callsFake(async (kind, id, session) => {
    check(session);
    return String(id) === ids.customer && f.customer?.status === 'active'
      ? clone(f.customer)
      : null;
  });
  sinon.stub(commercial, 'product').callsFake(async (id, session) => {
    check(session);
    return f.products[id]?.status === 'active' ? clone(f.products[id]) : null;
  });
  sinon
    .stub(Counter, 'findOneAndUpdate')
    .callsFake(async (filter, update, options) => {
      check(options.session);
      return {
        value: (f.db.counters[filter._id] =
          (f.db.counters[filter._id] || 0) + 1),
      };
    });
  sinon.stub(commercial, 'create').callsFake(async (data, session) => {
    check(session);
    const row = new Document(data);
    await row.validate();
    f.db.documents[String(row._id)] = clone(row.toObject());
    return clone(row.toObject());
  });
  const get = (id, type) =>
    f.db.documents[id] && (!type || f.db.documents[id].type === type)
      ? clone(f.db.documents[id])
      : null;
  sinon.stub(commercial, 'get').callsFake(async (id, type) => get(id, type));
  sinon.stub(commercial, 'lock').callsFake(async (id, session, type) => {
    check(session);
    return get(id, type);
  });
  sinon
    .stub(commercial, 'update')
    .callsFake(async (id, status, data, session, type, revision) => {
      check(session);
      const old = get(id, type);
      if (!old || old.status !== status || (old.revision ?? 0) !== revision)
        return null;
      const row = new Document({ ...old, ...data });
      await row.validate();
      return (f.db.documents[id] = clone(row.toObject()));
    });
  sinon.stub(audit, 'append').callsFake(async (data, session) => {
    check(session);
    f.db.audits.push(clone(data));
    return data;
  });
  sinon.stub(inventory, 'product').callsFake(async (id, session) => {
    check(session);
    return f.products[id] ? clone(f.products[id]) : null;
  });
  sinon.stub(inventory, 'warehouse').callsFake(async (id, session) => {
    check(session);
    return f.warehouses[id] ? clone(f.warehouses[id]) : null;
  });
  // Exercise the real conditional balance repository, mocking only MongoDB model methods.
  sinon
    .stub(InventoryBalance, 'updateOne')
    .callsFake(async (filter, update, options) => {
      check(options.session);
    });
  sinon
    .stub(InventoryBalance, 'findOneAndUpdate')
    .callsFake(async (filter, update, options) => {
      check(options.session);
      const key = String(filter.productId) + ':' + String(filter.warehouseId);
      const value = f.db.balances[key] || 0;
      if (
        filter.quantityUnits.$gte !== undefined &&
        value < filter.quantityUnits.$gte
      )
        return null;
      if (
        filter.quantityUnits.$lte !== undefined &&
        value > filter.quantityUnits.$lte
      )
        return null;
      f.db.balances[key] = value + update.$inc.quantityUnits;
      return { quantityUnits: f.db.balances[key] };
    });
  const originMatch = (row, origin) =>
    row.origin &&
    ['documentId', 'lineId', 'action'].every(
      (key) => String(row.origin[key]) === String(origin[key]),
    );
  sinon.stub(inventory, 'byOrigin').callsFake(async (origin, session) => {
    check(session);
    return Object.values(f.db.movements).find((row) =>
      originMatch(row, origin),
    );
  });
  sinon.stub(inventory, 'replay').callsFake(async (actor, key, session) => {
    check(session);
    return Object.values(f.db.movements).find(
      (row) => row.createdBy === actor && row.idempotencyKey === key,
    );
  });
  sinon.stub(inventory, 'movement').callsFake(async (id, session) => {
    check(session);
    return f.db.movements[id] ? clone(f.db.movements[id]) : null;
  });
  sinon.stub(inventory, 'reversal').callsFake(async (id, session) => {
    check(session);
    return Object.values(f.db.movements).find(
      (row) => row.reversalOf === String(id),
    );
  });
  sinon.stub(inventory, 'append').callsFake(async (data, session) => {
    check(session);
    if (
      Object.values(f.db.movements).some(
        (row) => data.origin && originMatch(row, data.origin),
      )
    )
      throw new ConflictError();
    const row = new InventoryMovement(data);
    await row.validate();
    f.db.movements[String(row._id)] = clone(row.toObject());
    return row;
  });
  return f;
}
module.exports = { fixture, ids, input, rejects, clone };
