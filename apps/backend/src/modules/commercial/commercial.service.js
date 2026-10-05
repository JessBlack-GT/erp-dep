const repo = require('./commercial.repository');
const v = require('./commercial.validation');
const numbering = require('./numbering');
const money = require('../../shared/utils/money');
const quantity = require('../inventory/inventory.validation');
const catalog = require('../products/products.validation');
const audit = require('../audit/audit.service');
const access = require('../../security/rbac');
const authorization = require('../../security/administration');
const inventory = require('./inventory.contract');
const { NotFoundError, ConflictError, ValidationError, UnauthorizedError, ForbiddenError } = require('../../shared/errors/appErrors');

function actorIdentity(actor) {
  if (!actor || typeof actor.id !== 'string' || !/^[a-f\d]{24}$/i.test(actor.id))
    throw new UnauthorizedError();
}
async function transact(actor, action, work, counterType) {
  actorIdentity(actor);
  // Retry only a concurrent first insert of this counter; never swallow document duplicates.
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await authorization.transaction(actor, 'commercial.' + action, work); }
    catch (error) {
      if (error.code !== 11000) throw error;
      if (counterType && error.keyValue?._id === counterType && attempt < 2) continue;
      throw new ConflictError('Documento o numeración duplicados');
    }
  }
}
async function record(actor, action, document, session) {
  await audit.record({
    actorId: actor.id, action, module: 'commercial', entity: 'CommercialDocument',
    entityId: String(document._id), result: 'success',
  }, session);
}
async function prepare(clean, session) {
  const kind = v.TYPES[clean.type];
  const entity = await repo.entity(kind, clean.entityId, session);
  if (!entity) throw new NotFoundError('Entidad comercial activa no encontrada');
  const lines = [];
  for (const input of clean.lines) {
    const product = await repo.product(input.productId, session);
    if (!product) throw new NotFoundError('Producto o servicio activo no encontrado');
    catalog.domain(product);
    if (!['PRODUCT', 'SERVICE'].includes(product.type) || !product.unit)
      throw new ValidationError('Producto o servicio inválido');
    if (product.currency && product.currency !== clean.currency)
      throw new ValidationError('Moneda distinta del catálogo; conversión no implementada');
    const unitPrice = input.unitPrice === undefined
      ? product[clean.type === 'PURCHASE' ? 'cost' : 'price'] : input.unitPrice;
    lines.push({
      productId: input.productId, quantity: input.quantity,
      snapshot: {
        name: product.name, sku: product.sku, type: product.type, unit: product.unit,
        trackInventory: !!product.trackInventory,
      },
      ...money.calculateLine(quantity.units(input.quantity), unitPrice, input.discountRate, input.taxRate),
    });
  }
  return {
    date: clean.date, currency: clean.currency,
    entity: { kind, id: clean.entityId, name: entity.businessName || entity.name },
    lines, ...money.totals(lines),
  };
}
async function locked(id, session) {
  const row = await repo.lock(id, session);
  if (!row) throw new NotFoundError('Documento no encontrado');
  return row;
}
class CommercialService {
  async getById(id, actor) {
    actorIdentity(actor);
    const fresh = await access.resolveAccess(actor.id);
    if (!fresh || (fresh.sessionVersion || 0) !== (actor.sessionVersion || 0)) throw new UnauthorizedError();
    if (!access.hasPermission(fresh, 'commercial.read')) throw new ForbiddenError();
    const row = await repo.get(v.id(id));
    if (!row) throw new NotFoundError('Documento no encontrado');
    return row;
  }
  async createDraft(data, actor) {
    const clean = v.input(data);
    return transact(actor, 'create', async (session, fresh) => {
      const content = await prepare(clean, session);
      const sequence = await numbering.next(clean.type, session);
      const row = await repo.create({
        ...content, ...sequence, type: clean.type, status: 'draft',
        createdBy: fresh.id, updatedBy: fresh.id,
      }, session);
      await record(fresh, 'create', row, session);
      return row;
    }, clean.type);
  }
  async updateDraft(id, data, actor) {
    id = v.id(id);
    return transact(actor, 'update', async (session, fresh) => {
      const previous = await locked(id, session);
      if (previous.status !== 'draft') throw new ConflictError('Solo se modifican borradores');
      const clean = v.input(data, previous.type);
      const content = await prepare(clean, session);
      const row = await repo.update(id, 'draft', { ...content, updatedBy: fresh.id }, session);
      if (!row) throw new ConflictError('Documento modificado concurrentemente');
      await record(fresh, 'update', row, session);
      return row;
    });
  }
  async transition(id, action, actor) {
    id = v.id(id);
    if (!['confirm', 'cancel'].includes(action)) throw new ValidationError('Acción inválida');
    return transact(actor, action, async (session, fresh) => {
      const previous = await locked(id, session);
      const status = action === 'confirm' ? 'confirmed' : 'cancelled';
      v.transition(previous.status, status);
      if (action === 'confirm') {
        // Revalidate eligibility without refreshing historical prices/names.
        if (!await repo.entity(previous.entity.kind, previous.entity.id, session))
          throw new NotFoundError('Entidad comercial activa no encontrada');
        for (const line of previous.lines) {
          const product = await repo.product(line.productId, session);
          if (!product) throw new NotFoundError('Producto o servicio activo no encontrado');
          if (product.type !== line.snapshot.type || !!product.trackInventory !== line.snapshot.trackInventory || product.unit !== line.snapshot.unit)
            throw new ConflictError('Cambió la elegibilidad del producto; actualice el borrador');
        }
      }
      inventory.requireImplemented(inventory.plan(previous, action));
      const prefix = action === 'confirm' ? 'confirmed' : 'cancelled';
      const row = await repo.update(id, previous.status, {
        status, [prefix + 'At']: new Date(), [prefix + 'By']: fresh.id, updatedBy: fresh.id,
      }, session);
      if (!row) throw new ConflictError('Documento modificado concurrentemente');
      await record(fresh, action, row, session);
      return row;
    });
  }
  confirm(id, actor) { return this.transition(id, 'confirm', actor); }
  cancel(id, actor) { return this.transition(id, 'cancel', actor); }
}
module.exports = new CommercialService();
