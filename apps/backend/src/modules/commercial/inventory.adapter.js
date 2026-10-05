/* eslint-env es2020 */
const inventory = require('../inventory/inventory.service');
const repo = require('../inventory/inventory.repository');
const quantities = require('../inventory/inventory.validation');
const contract = require('./inventory.contract');
const { ConflictError } = require('../../shared/errors/appErrors');

function salePlan(document, action, session) {
  if (!session?.inTransaction?.())
    throw new Error('Adapter requires an active transaction');
  if (document.type !== 'SALE')
    throw new ConflictError('El adaptador requiere una venta');
  return contract
    .plan(document, action)
    .sort(
      (a, b) =>
        a.productId.localeCompare(b.productId) ||
        a.lineId.localeCompare(b.lineId),
    );
}
async function apply(document, action, actor, session) {
  const plan = salePlan(document, action, session);
  const lines = document.lines.map((line) => ({ ...line }));
  // Validate every receipt before writing any reversal. All reads share the session.
  const commands = [];
  for (const item of plan) {
    const line = lines.find((row) => String(row._id) === item.lineId);
    const origin = { documentId: item.documentId, lineId: item.lineId, action };
    let warehouseId = line.warehouseId;
    let quantity = item.quantity;
    let reversalOf;
    if (action === 'confirm') {
      if (!warehouseId)
        throw new ConflictError(
          'Seleccione almacén para cada línea con inventario',
        );
      if (line.exitMovementId || line.reversalMovementId)
        throw new ConflictError('El borrador contiene movimientos previos');
    } else {
      if (!line.exitMovementId || line.reversalMovementId)
        throw new ConflictError('Referencia original ausente o ya revertida');
      const original = await repo.movement(line.exitMovementId, session);
      if (
        !original ||
        original.type !== 'EXIT' ||
        original.reversalOf ||
        String(original.origin?.documentId) !== item.documentId ||
        String(original.origin?.lineId) !== item.lineId ||
        original.origin?.action !== 'confirm' ||
        String(original.productId) !== item.productId ||
        original.quantityUnits !== quantities.units(item.quantity) ||
        !original.sourceWarehouseId ||
        original.destinationWarehouseId ||
        String(original.sourceWarehouseId) !== String(line.warehouseId)
      )
        throw new ConflictError(
          'Movimiento original incompatible con la venta',
        );
      if (await repo.reversal(original._id, session))
        throw new ConflictError('Movimiento original ya revertido');
      warehouseId = original.sourceWarehouseId;
      quantity = quantities.decimal(original.quantityUnits);
      reversalOf = String(original._id);
    }
    commands.push({
      line,
      command: {
        movement: {
          productId: item.productId,
          type: item.direction,
          quantity,
          [action === 'confirm'
            ? 'sourceWarehouseId'
            : 'destinationWarehouseId']: String(warehouseId),
          reason:
            action === 'confirm'
              ? 'Confirmación de venta'
              : 'Cancelación de venta',
          reference: document.number,
          idempotencyKey: item.idempotencyKey,
        },
        origin,
        expectedUnit: line.snapshot.unit,
        ...(reversalOf ? { reversalOf } : {}),
      },
    });
  }
  // Stable warehouse locks coordinate deactivation; no parallel operations in a session.
  const warehouses = [
    ...new Set(
      commands.map(
        ({ command }) =>
          command.movement.sourceWarehouseId ||
          command.movement.destinationWarehouseId,
      ),
    ),
  ].sort();
  // Acquire all product locks before warehouse locks, matching manual inventory order.
  for (const productId of [
    ...new Set(plan.map((item) => item.productId)),
  ].sort())
    await repo.product(productId, session);
  for (const id of warehouses) {
    const warehouse = await repo.warehouse(id, session);
    if (!warehouse || warehouse.status !== 'active')
      throw new ConflictError('Almacén incompatible');
  }
  for (const { line, command } of commands) {
    const result = await inventory.moveInTransaction(
      command,
      actor.id,
      session,
    );
    line[action === 'confirm' ? 'exitMovementId' : 'reversalMovementId'] =
      result.data._id;
  }
  return lines;
}
module.exports = {
  applySaleConfirmation: (document, actor, session) =>
    apply(document, 'confirm', actor, session),
  reverseSaleCancellation: (document, actor, session) =>
    apply(document, 'cancel', actor, session),
};
