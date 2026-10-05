/* eslint-env es2020 */
const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const service = require('../src/modules/commercial/commercial.service');
const repo = require('../src/modules/commercial/commercial.repository');
const Document = require('../src/modules/commercial/commercial.model');
const { Counter } = require('../src/modules/commercial/numbering');
const auditRepo = require('../src/modules/audit/audit.repository');
const Audit = require('../src/modules/audit/audit.model');
const User = require('../src/modules/users/users.model');
const Role = require('../src/modules/roles/roles.model');
const rbac = require('../src/security/rbac');
const inventory = require('../src/modules/inventory/inventory.service');
const id = '507f1f77bcf86cd799439011';
const productId = '507f1f77bcf86cd799439012';
const entityId = '507f1f77bcf86cd799439013';
const actor = { id, sessionVersion: 0 };
const clone = value => JSON.parse(JSON.stringify(value));
const input = (extra = {}) => ({
  type: 'SALE', date: '2026-10-04', currency: 'USD', entityId,
  lines: [{ productId, quantity: '2', discountRate: '10', taxRate: '7.5' }], ...extra,
});
async function rejects(promise, status) {
  try { await promise; } catch (error) { expect(error.statusCode).to.equal(status); return error; }
  throw new Error('Expected rejection');
}

describe('Commercial internal lifecycle with real authorization and simulated atomic storage', () => {
  let db, product, entity, user, role, activeSession;
  beforeEach(() => {
    db = { documents: {}, counters: {}, audits: [] };
    product = { _id: productId, name: 'Original', sku: 'SKU-1', type: 'SERVICE', unit: 'hour', trackInventory: false, price: '10.0000', cost: '3.0000', currency: 'USD' };
    entity = { _id: entityId, name: 'Original entity' };
    user = { _id: id, role: 'admin', status: 'active', sessionVersion: 0 };
    role = null;
    sinon.stub(mongoose.connection, 'transaction').callsFake(async work => {
      const previous = clone(db);
      activeSession = { transaction: true, inTransaction: () => true };
      try { return await work(activeSession); }
      catch (error) { db = previous; throw error; }
    });
    sinon.stub(User, 'findOneAndUpdate').callsFake((filter, change, options) => {
      expect(options.session).to.equal(activeSession);
      return { select: async () => user?.status === 'active' ? user : null };
    });
    sinon.stub(Role, 'findOneAndUpdate').callsFake(async (filter, change, options) => {
      expect(options.session).to.equal(activeSession);
      return role;
    });
    sinon.stub(User, 'findById').returns({ select: () => ({ lean: async () => user }) });
    sinon.stub(Role, 'findOne').returns({ lean: async () => role });
    sinon.stub(repo, 'product').callsFake(async (key, session) => {
      expect(session).to.equal(activeSession);
      return key === productId ? clone(product) : null;
    });
    sinon.stub(repo, 'entity').callsFake(async (kind, key, session) => {
      expect(session).to.equal(activeSession);
      return String(key) === entityId ? clone(entity) : null;
    });
    sinon.stub(Counter, 'findOneAndUpdate').callsFake(async (filter, change, options) => {
      expect(options.session).to.equal(activeSession);
      const value = (db.counters[filter._id] || 0) + change.$inc.value;
      db.counters[filter._id] = value;
      return { value };
    });
    sinon.stub(repo, 'create').callsFake(async (data, session) => {
      expect(session).to.equal(activeSession);
      const model = new Document(data);
      await model.validate();
      const row = clone(model.toObject());
      db.documents[row._id] = row;
      return clone(row);
    });
    sinon.stub(repo, 'lock').callsFake(async (key, session) => {
      expect(session).to.equal(activeSession);
      return db.documents[key] ? clone(db.documents[key]) : null;
    });
    sinon.stub(repo, 'get').callsFake(async key => db.documents[key] ? clone(db.documents[key]) : null);
    sinon.stub(repo, 'update').callsFake(async (key, status, data, session) => {
      expect(session).to.equal(activeSession);
      if (db.documents[key]?.status !== status) return null;
      const model = new Document({ ...db.documents[key], ...data });
      await model.validate();
      db.documents[key] = clone(model.toObject());
      return clone(db.documents[key]);
    });
    sinon.stub(auditRepo, 'append').callsFake(async (data, session) => {
      expect(session).to.equal(activeSession);
      const event = new Audit(data);
      await event.validate();
      db.audits.push(clone(data));
      return event;
    });
    sinon.spy(inventory, 'move');
  });
  afterEach(() => sinon.restore());
  it('creates a draft with computed totals, a number, identities and a minimal audit record', async () => {
    const row = await service.createDraft(input(), actor);
    expect(row).to.include({ number: 'SALE-000001', sequence: 1, status: 'draft', subtotal: '20.0000', discount: '2.0000', tax: '1.3500', total: '19.3500', createdBy: id });
    expect(row.entity).to.deep.equal({ kind: 'customer', id: entityId, name: 'Original entity' });
    expect(row.lines[0].snapshot).to.deep.equal({ name: 'Original', sku: 'SKU-1', type: 'SERVICE', unit: 'hour', trackInventory: false });
    expect(db.audits).to.deep.equal([{ actorId: id, module: 'commercial', entity: 'CommercialDocument', entityId: row._id, action: 'create', result: 'success' }]);
    expect(inventory.move.called).to.equal(false);
  });
  it('uses supplier and catalog cost for purchase foundations', async () => {
    const row = await service.createDraft(input({ type: 'PURCHASE' }), actor);
    expect(row.number).to.equal('PURCHASE-000001');
    expect(row.entity.kind).to.equal('supplier');
    expect(row.lines[0].unitPrice).to.equal('3.0000');
  });
  it('supports an explicit negotiated price including zero', async () => {
    const row = await service.createDraft(input({ lines: [{ productId, quantity: '1', unitPrice: '0' }] }), actor);
    expect(row.total).to.equal('0.0000');
  });
  it('updates only a draft, keeps its identity and number, and recomputes totals', async () => {
    const old = await service.createDraft(input(), actor);
    const row = await service.updateDraft(old._id, input({ lines: [{ productId, quantity: '3', unitPrice: '5' }] }), actor);
    expect(row).to.include({ number: old.number, total: '15.0000', createdBy: id });
    expect(db.counters.SALE).to.equal(1);
    expect(db.audits[1].action).to.equal('update');
  });
  it('confirms with original snapshot and price despite later catalog edits', async () => {
    const draft = await service.createDraft(input(), actor);
    product.name = 'Changed'; product.price = '500.0000'; entity.name = 'Changed entity';
    const confirmed = await service.confirm(draft._id, actor);
    expect(confirmed.status).to.equal('confirmed');
    expect(confirmed.lines).to.deep.equal(draft.lines);
    expect(confirmed.total).to.equal(draft.total);
    expect(confirmed.entity.name).to.equal('Original entity');
    expect(confirmed.confirmedBy).to.equal(id);
    expect(confirmed.confirmedAt).to.be.a('string');
    expect(db.audits[1].action).to.equal('confirm');
    expect((await service.getById(draft._id, actor)).lines[0].snapshot.name).to.equal('Original');
  });
  for (const confirmed of [false, true]) {
    it('cancels ' + (confirmed ? 'confirmed' : 'draft') + ' without implicit stock effects', async () => {
      const row = await service.createDraft(input(), actor);
      if (confirmed) await service.confirm(row._id, actor);
      const cancelled = await service.cancel(row._id, actor);
      expect(cancelled.status).to.equal('cancelled');
      expect(cancelled.cancelledBy).to.equal(id);
      expect(cancelled.lines).to.deep.equal(row.lines);
      expect(db.audits[db.audits.length - 1].action).to.equal('cancel');
      expect(inventory.move.called).to.equal(false);
      await rejects(service.confirm(row._id, actor), 409);
      await rejects(service.cancel(row._id, actor), 409);
      await rejects(service.updateDraft(row._id, input(), actor), 409);
    });
  }
  it('confirmed documents cannot be edited or confirmed twice', async () => {
    const row = await service.createDraft(input(), actor);
    await service.confirm(row._id, actor);
    await rejects(service.updateDraft(row._id, input(), actor), 409);
    await rejects(service.confirm(row._id, actor), 409);
  });
  it('drafts with tracked goods never move inventory; confirmation requires a warehouse', async () => {
    product.type = 'PRODUCT'; product.trackInventory = true; product.unit = 'unit';
    const row = await service.createDraft(input(), actor);
    await rejects(service.confirm(row._id, actor), 409);
    expect(db.documents[row._id].status).to.equal('draft');
    expect(db.audits.length).to.equal(1);
    await service.cancel(row._id, actor);
    expect(inventory.move.called).to.equal(false);
  });
  it('an imported confirmed stock document cannot be cancelled without controlled reversal', async () => {
    product.type = 'PRODUCT'; product.trackInventory = true;
    const row = await service.createDraft(input(), actor);
    db.documents[row._id].status = 'confirmed';
    await rejects(service.cancel(row._id, actor), 409);
    expect(db.documents[row._id].status).to.equal('confirmed');
  });
  for (const field of ['type', 'trackInventory', 'unit'])
    it('rechecks changed catalog eligibility on confirmation: ' + field, async () => {
      const row = await service.createDraft(input(), actor);
      product[field] = field === 'type' ? 'PRODUCT' : field === 'unit' ? 'day' : true;
      await rejects(service.confirm(row._id, actor), 409);
      expect(db.documents[row._id].status).to.equal('draft');
    });
  for (const kind of ['entity', 'product']) {
    it('rejects a missing/inactive/deleted ' + kind + ' in drafts and confirmation', async () => {
      const row = await service.createDraft(input(), actor);
      repo[kind].resolves(null);
      await rejects(service.createDraft(input(), actor), 404);
      await rejects(service.confirm(row._id, actor), 404);
      expect(db.documents[row._id].status).to.equal('draft');
    });
  }
  for (const fields of [
    { lines: [] }, { entityId: 'bad' }, { type: 'QUOTE' }, { date: '2026-02-30' },
    { currency: 'US' }, { type: ['SALE'] }, { status: 'confirmed' }, { total: '0.0000' },
    { number: 'SALE-000001' }, { createdBy: productId }, { password: 'fixture' },
    { lines: [{ productId, quantity: '-1' }] }, { lines: [{ productId, quantity: '0' }] },
    { lines: [{ productId, quantity: '1', unitPrice: '-1' }] },
    { lines: [{ productId, quantity: '1', discountRate: '101' }] },
    { lines: [{ productId, quantity: '1', taxRate: '-1' }] },
    { lines: [{ productId, quantity: '1', snapshot: { name: 'Forged' } }] },
  ]) {
    it('rejects invalid or server-owned input ' + JSON.stringify(fields), async () => {
      await rejects(service.createDraft(input(fields), actor), 400);
      expect(repo.create.called).to.equal(false);
      expect(Counter.findOneAndUpdate.called).to.equal(false);
    });
  }
  it('rejects mismatched currency and missing default price instead of inventing conversion or price', async () => {
    product.currency = 'EUR';
    await rejects(service.createDraft(input(), actor), 400);
    product.currency = 'USD'; delete product.price;
    await rejects(service.createDraft(input(), actor), 400);
  });
  it('preserves the existing SERVICE inventory restrictions', async () => {
    product.trackInventory = true;
    await rejects(service.createDraft(input(), actor), 400);
  });
  for (const operation of ['create', 'update', 'confirm', 'cancel']) {
    it('rolls back document and numbering if audit fails during ' + operation, async () => {
      let row;
      if (operation !== 'create') row = await service.createDraft(input(), actor);
      const before = clone(db);
      auditRepo.append.rejects(new Error('simulated audit failure'));
      const run = operation === 'create' ? service.createDraft(input(), actor)
        : operation === 'update' ? service.updateDraft(row._id, input(), actor)
          : service[operation](row._id, actor);
      let error;
      try { await run; } catch (caught) { error = caught; }
      expect(error.message).to.equal('simulated audit failure');
      expect(db).to.deep.equal(before);
    });
  }
  it('classifies a duplicate document number as conflict without leaking storage details', async () => {
    repo.create.rejects(Object.assign(new Error('private index data'), { code: 11000, keyValue: { number: 'SALE-000001' } }));
    const error = await rejects(service.createDraft(input(), actor), 409);
    expect(error.message).not.to.include('private');
    expect(db.counters).to.deep.equal({});
    expect(mongoose.connection.transaction.callCount).to.equal(1);
  });
  it('retries a first-counter insertion race in a new transaction', async () => {
    Counter.findOneAndUpdate.onFirstCall().rejects(Object.assign(new Error('race'), { code: 11000, keyValue: { _id: 'SALE' } }));
    const row = await service.createDraft(input(), actor);
    expect(row.number).to.equal('SALE-000001');
    expect(mongoose.connection.transaction.callCount).to.equal(2);
    expect(db.audits.length).to.equal(1);
  });
  it('bounds retries if numbering remains unavailable', async () => {
    Counter.findOneAndUpdate.rejects(Object.assign(new Error('race'), { code: 11000, keyValue: { _id: 'SALE' } }));
    await rejects(service.createDraft(input(), actor), 409);
    expect(mongoose.connection.transaction.callCount).to.equal(3);
  });
  for (const action of ['read', 'create', 'update', 'confirm', 'cancel']) {
    it('enforces the specific persisted permission for ' + action, async () => {
      const row = await service.createDraft(input(), actor);
      role = { name: 'qa_commercial', status: 'active', permissions: [] };
      const invoke = () => action === 'read' ? service.getById(row._id, actor)
        : action === 'create' ? service.createDraft(input(), actor)
          : action === 'update' ? service.updateDraft(row._id, input(), actor)
            : service[action](row._id, actor);
      await rejects(invoke(), 403);
      role.permissions = ['commercial.' + action];
      expect(await invoke()).to.have.property('_id');
    });
  }
  it('rejects forged grants, missing users, inactive roles and revoked session versions', async () => {
    user.role = 'user';
    await rejects(service.createDraft(input(), { ...actor, isSuperadmin: true, permissions: rbac.PERMISSIONS }), 403);
    user.role = 'admin'; role = { name: 'admin', status: 'inactive', permissions: rbac.PERMISSIONS };
    await rejects(service.createDraft(input(), actor), 403);
    role = null; user.sessionVersion = 1;
    await rejects(service.createDraft(input(), actor), 401);
    await rejects(service.getById(id, actor), 401);
    user = null;
    await rejects(service.createDraft(input(), actor), 401);
    await rejects(service.createDraft(input(), null), 401);
  });
  it('does not broaden non-administrator default roles', () => {
    for (const name of ['manager', 'sales', 'purchasing', 'warehouse', 'finance', 'hr', 'auditor', 'user'])
      expect(rbac.ROLE_PERMISSIONS[name].some(p => p.startsWith('commercial.'))).to.equal(false);
  });
  it('returns not found for missing documents', async () => {
    await rejects(service.getById(id, actor), 404);
    await rejects(service.confirm(id, actor), 404);
  });
});
