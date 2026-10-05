const crypto = require('crypto');
const repo = require('./inventory.repository');
const v = require('./inventory.validation');
const {
  NotFoundError,
  ConflictError,
  ValidationError,
} = require('../../shared/errors/appErrors');
function present(value) {
  const row = value.toObject ? value.toObject() : { ...value };
  if (row.quantityUnits !== undefined) {
    row.quantity = v.decimal(row.quantityUnits);
    if (row.warehouseId) row.available = row.quantity;
    delete row.quantityUnits;
  }
  delete row.requestHash;
  delete row.__v;
  return row;
}
class InventoryService {
  async list(kind, query) {
    const options = v.query(query, kind);
    const { rows, total } = await repo.list(kind, options);
    return {
      data: rows.map(present),
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit),
      },
    };
  }
  async createWarehouse(data, actor) {
    return present(
      await repo.createWarehouse({
        ...v.warehouse(data),
        createdBy: v.id(actor),
        updatedBy: actor,
      }),
    );
  }
  async updateWarehouse(id, data, actor) {
    const row = await repo.updateWarehouse(v.id(id), {
      ...v.warehouse(data, true),
      updatedBy: v.id(actor),
    });
    if (!row) throw new NotFoundError('Almacén no encontrado');
    return present(row);
  }
  async move(data, actor) {
    // Validate the public allowlist before entering the internal command API.
    v.movement(data);
    v.id(actor);
    return repo.transaction((session) =>
      this.moveInTransaction({ movement: data }, actor, session),
    );
  }
  async moveInTransaction(command, actor, session) {
    if (!session?.inTransaction?.())
      throw new Error('Inventory requires an active transaction');
    v.object(command, ['movement', 'origin', 'reversalOf', 'expectedUnit']);
    const { movement: data, origin, reversalOf, expectedUnit } = command;
    const clean = v.movement(data);
    v.id(actor);
    if (origin) {
      v.object(origin, ['documentId', 'lineId', 'action']);
      if (
        !['confirm', 'cancel'].includes(origin.action) ||
        clean.type !== (origin.action === 'confirm' ? 'EXIT' : 'ENTRY')
      )
        throw new ValidationError('Origen comercial inválido');
      clean.origin = {
        documentId: v.id(origin.documentId),
        lineId: v.id(origin.lineId),
        action: origin.action,
      };
      if ((origin.action === 'cancel') !== !!reversalOf)
        throw new ValidationError('Referencia inversa inválida');
      if (reversalOf) clean.reversalOf = v.id(reversalOf);
    } else if (reversalOf !== undefined || expectedUnit !== undefined) {
      throw new ValidationError('Referencia comercial requerida');
    }
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(clean))
      .digest('hex');
    const previous = origin
      ? await repo.byOrigin(clean.origin, session)
      : await repo.replay(actor, clean.idempotencyKey, session);
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new ConflictError('Clave de idempotencia usada con otros datos');
      if (origin) throw new ConflictError('Movimiento comercial ya aplicado');
      return { data: present(previous), replayed: true };
    }
    const product = await repo.product(clean.productId, session);
    if (
      origin &&
      (!product ||
        product.status !== 'active' ||
        product.type !== 'PRODUCT' ||
        !product.trackInventory ||
        product.unit !== expectedUnit)
    )
      throw new ConflictError(
        'Producto incompatible con el movimiento comercial',
      );
    if (!product || product.status === 'deleted')
      throw new NotFoundError('Producto no encontrado');
    if (
      product.type !== 'PRODUCT' ||
      !product.trackInventory ||
      product.status !== 'active'
    )
      throw new ValidationError('Producto no elegible para inventario');
    for (const id of [
      clean.sourceWarehouseId,
      clean.destinationWarehouseId,
    ].filter(Boolean)) {
      const warehouse = await repo.warehouse(id, session);
      if (origin && (!warehouse || warehouse.status !== 'active'))
        throw new ConflictError(
          'Almacén incompatible con el movimiento comercial',
        );
      if (!warehouse) throw new NotFoundError('Almacén no encontrado');
      if (warehouse.status !== 'active')
        throw new ValidationError('Almacén inactivo');
    }
    const magnitude = Math.abs(clean.quantityUnits);
    // Sequential operations inside one transaction: both legs and ledger commit together.
    if (clean.sourceWarehouseId)
      await repo.change(
        clean.productId,
        clean.sourceWarehouseId,
        -magnitude,
        session,
      );
    if (clean.destinationWarehouseId)
      await repo.change(
        clean.productId,
        clean.destinationWarehouseId,
        magnitude,
        session,
      );
    const row = await repo.append(
      { ...clean, requestHash, createdBy: actor },
      session,
    );
    return { data: present(row), replayed: false };
  }
}
module.exports = new InventoryService();
