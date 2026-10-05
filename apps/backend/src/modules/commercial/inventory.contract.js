const { ConflictError, ValidationError } = require('../../shared/errors/appErrors');
const { TYPES, transition } = require('./commercial.validation');

// Pure descriptors only. Warehouses, movement receipts and a same-session adapter
// must be supplied by the future sales/purchasing orchestration. Never calls move().
function plan(document, action) {
  if (!Object.hasOwn(TYPES, document.type) || !['confirm', 'cancel'].includes(action))
    throw new ValidationError('Operación de inventario comercial inválida');
  transition(document.status, action === 'confirm' ? 'confirmed' : 'cancelled');
  if (action === 'cancel' && document.status === 'draft') return [];
  const direction = document.type === 'SALE' ? 'EXIT' : 'ENTRY';
  return document.lines.filter(line => line.snapshot.type === 'PRODUCT' && line.snapshot.trackInventory)
    .map(line => ({
      documentId: String(document._id), lineId: String(line._id),
      productId: String(line.productId), quantity: line.quantity,
      direction: action === 'confirm' ? direction : (direction === 'ENTRY' ? 'EXIT' : 'ENTRY'),
      action, requiresOriginalMovement: action === 'cancel',
      idempotencyKey: `commercial_${document._id}_${line._id}_${action}`,
    }));
}
function requireImplemented(plan) {
  if (plan.length)
    throw new ConflictError('La operación requiere el adaptador transaccional de inventario comercial pendiente');
}
module.exports = { plan, requireImplemented };
