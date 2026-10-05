/* eslint-env es2020 */
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
const adapter = require('./inventory.adapter');
const inventoryRepo = require('../inventory/inventory.repository');
const {
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
} = require('../../shared/errors/appErrors');

function actorIdentity(actor) {
  if (
    !actor ||
    typeof actor.id !== 'string' ||
    !/^[a-f\d]{24}$/i.test(actor.id)
  )
    throw new UnauthorizedError();
}
async function transact(actor, action, work, counterType) {
  actorIdentity(actor);
  // Retry first counter/balance insertion races; never swallow document/origin duplicates.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await authorization.transaction(
        actor,
        'commercial.' + action,
        work,
        undefined,
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          readPreference: 'primary',
        },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      if (counterType && error.keyValue?._id === counterType && attempt < 2)
        continue;
      if (
        error.keyPattern?.productId &&
        error.keyPattern?.warehouseId &&
        attempt < 2
      )
        continue;
      throw new ConflictError('Documento o numeración duplicados');
    }
  }
}
async function record(actor, action, document, session) {
  await audit.record(
    {
      actorId: actor.id,
      action,
      module: 'commercial',
      entity: 'CommercialDocument',
      entityId: String(document._id),
      result: 'success',
    },
    session,
  );
}
async function prepare(clean, session) {
  const kind = v.TYPES[clean.type];
  const entity = await repo.entity(kind, clean.entityId, session);
  if (!entity)
    throw new NotFoundError('Entidad comercial activa no encontrada');
  const lines = [];
  const products = new Map();
  for (const id of [
    ...new Set(clean.lines.map((line) => line.productId)),
  ].sort()) {
    const product = await repo.product(id, session);
    if (!product)
      throw new NotFoundError('Producto o servicio activo no encontrado');
    products.set(id, product);
  }
  for (const id of [
    ...new Set(clean.lines.map((line) => line.warehouseId).filter(Boolean)),
  ].sort()) {
    const warehouse = await inventoryRepo.warehouse(id, session);
    if (!warehouse || warehouse.status !== 'active')
      throw new ConflictError('Almacén incompatible');
  }
  for (const input of clean.lines) {
    const product = products.get(input.productId);
    if (!product)
      throw new NotFoundError('Producto o servicio activo no encontrado');
    catalog.domain(product);
    if (!['PRODUCT', 'SERVICE'].includes(product.type) || !product.unit)
      throw new ValidationError('Producto o servicio inválido');
    if (product.currency && product.currency !== clean.currency)
      throw new ValidationError(
        'Moneda distinta del catálogo; conversión no implementada',
      );
    if (
      input.warehouseId &&
      (clean.type !== 'SALE' ||
        product.type !== 'PRODUCT' ||
        !product.trackInventory)
    )
      throw new ValidationError('Almacén no aplicable a la línea');
    const unitPrice =
      input.unitPrice === undefined
        ? product[clean.type === 'PURCHASE' ? 'cost' : 'price']
        : input.unitPrice;
    lines.push({
      productId: input.productId,
      quantity: input.quantity,
      ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
      snapshot: {
        name: product.name,
        sku: product.sku,
        type: product.type,
        unit: product.unit,
        trackInventory: !!product.trackInventory,
      },
      ...money.calculateLine(
        quantity.units(input.quantity),
        unitPrice,
        input.discountRate,
        input.taxRate,
      ),
    });
  }
  return {
    date: clean.date,
    currency: clean.currency,
    entity: {
      kind,
      id: clean.entityId,
      name: entity.businessName || entity.name,
    },
    lines,
    ...money.totals(lines),
  };
}
async function locked(id, session, type) {
  const row = await repo.lock(id, session, type);
  if (!row || (type && row.type !== type))
    throw new NotFoundError('Documento no encontrado');
  return row;
}
function nextRevision(previous, options) {
  const revision = previous.revision ?? 0;
  if (
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    revision === Number.MAX_SAFE_INTEGER
  )
    throw new ConflictError('Revisión no disponible');
  if (
    options.type === 'SALE' &&
    (!Number.isSafeInteger(options.expectedRevision) ||
      options.expectedRevision < 0)
  )
    throw new ValidationError('expectedRevision es requerida');
  if (
    options.expectedRevision !== undefined &&
    options.expectedRevision !== revision
  )
    throw new ConflictError('Revisión obsoleta; vuelva a consultar la venta');
  return revision + 1;
}
async function authorizeRead(actor) {
  actorIdentity(actor);
  const fresh = await access.resolveAccess(actor.id);
  if (!fresh || (fresh.sessionVersion || 0) !== (actor.sessionVersion || 0))
    throw new UnauthorizedError();
  if (!access.hasPermission(fresh, 'commercial.read'))
    throw new ForbiddenError();
}
class CommercialService {
  async list(options, actor, type) {
    await authorizeRead(actor);
    return repo.list(options, v.type(type));
  }
  async getById(id, actor, type) {
    await authorizeRead(actor);
    const row = await repo.get(v.id(id), type);
    if (!row || (type && row.type !== type))
      throw new NotFoundError('Documento no encontrado');
    return { ...row, revision: row.revision ?? 0 };
  }
  async createDraft(data, actor) {
    const clean = v.input(data);
    return transact(
      actor,
      'create',
      async (session, fresh) => {
        const content = await prepare(clean, session);
        const sequence = await numbering.next(clean.type, session);
        const row = await repo.create(
          {
            ...content,
            ...sequence,
            type: clean.type,
            status: 'draft',
            revision: 0,
            createdBy: fresh.id,
            updatedBy: fresh.id,
          },
          session,
        );
        await record(fresh, 'create', row, session);
        return row;
      },
      clean.type,
    );
  }
  async updateDraft(id, data, actor, options = {}) {
    id = v.id(id);
    return transact(actor, 'update', async (session, fresh) => {
      const previous = await locked(id, session, options.type);
      if (previous.status !== 'draft')
        throw new ConflictError('Solo se modifican borradores');
      const revision = nextRevision(previous, options);
      const clean = v.input(data, previous.type);
      const content = await prepare(clean, session);
      const row = await repo.update(
        id,
        'draft',
        { ...content, revision, updatedBy: fresh.id },
        session,
        options.type,
        previous.revision ?? 0,
      );
      if (!row)
        throw new ConflictError('Documento modificado concurrentemente');
      await record(fresh, 'update', row, session);
      return row;
    });
  }
  async transition(id, action, actor, options = {}) {
    id = v.id(id);
    if (!['confirm', 'cancel'].includes(action))
      throw new ValidationError('Acción inválida');
    return transact(actor, action, async (session, fresh) => {
      const previous = await locked(id, session, options.type);
      const status = action === 'confirm' ? 'confirmed' : 'cancelled';
      v.transition(previous.status, status);
      const revision = nextRevision(previous, options);
      if (action === 'confirm') {
        // Revalidate eligibility without refreshing historical prices/names.
        if (
          !(await repo.entity(
            previous.entity.kind,
            previous.entity.id,
            session,
          ))
        )
          throw new NotFoundError('Entidad comercial activa no encontrada');
        for (const line of [...previous.lines].sort((a, b) =>
          String(a.productId).localeCompare(String(b.productId)),
        )) {
          const product = await repo.product(line.productId, session);
          if (!product && options.type === 'SALE')
            throw new ConflictError(
              'Producto incompatible; actualice el borrador',
            );
          if (!product)
            throw new NotFoundError('Producto o servicio activo no encontrado');
          if (
            product.type !== line.snapshot.type ||
            !!product.trackInventory !== line.snapshot.trackInventory ||
            product.unit !== line.snapshot.unit
          )
            throw new ConflictError(
              'Cambió la elegibilidad del producto; actualice el borrador',
            );
        }
      }
      const plan = inventory.plan(previous, action);
      let lines = previous.lines;
      if (previous.type === 'SALE' && plan.length) {
        lines = await (
          action === 'confirm'
            ? adapter.applySaleConfirmation
            : adapter.reverseSaleCancellation
        )(previous, fresh, session);
      } else inventory.requireImplemented(plan);
      const prefix = action === 'confirm' ? 'confirmed' : 'cancelled';
      const row = await repo.update(
        id,
        previous.status,
        {
          status,
          lines,
          revision,
          [prefix + 'At']: new Date(),
          [prefix + 'By']: fresh.id,
          updatedBy: fresh.id,
        },
        session,
        options.type,
        previous.revision ?? 0,
      );
      if (!row)
        throw new ConflictError('Documento modificado concurrentemente');
      await record(fresh, action, row, session);
      return row;
    });
  }
  confirm(id, actor, options) {
    return this.transition(id, 'confirm', actor, options);
  }
  cancel(id, actor, options) {
    return this.transition(id, 'cancel', actor, options);
  }
}
module.exports = new CommercialService();
