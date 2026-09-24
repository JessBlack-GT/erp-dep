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
    const clean = v.movement(data);
    v.id(actor);
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(clean))
      .digest('hex');
    return repo.transaction(async (session) => {
      const previous = await repo.replay(actor, clean.idempotencyKey, session);
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new ConflictError(
            'Clave de idempotencia usada con otros datos',
          );
        return { data: present(previous), replayed: true };
      }
      const product = await repo.product(clean.productId, session);
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
    });
  }
}
module.exports = new InventoryService();
