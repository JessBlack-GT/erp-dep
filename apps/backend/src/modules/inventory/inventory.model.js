const mongoose = require('mongoose');
const { MAX_UNITS } = require('./inventory.validation');
const ref = (model) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: model,
  required: true,
});
const options = { timestamps: true, strict: 'throw' };
const warehouse = new mongoose.Schema(
  {
    code: { type: String, required: true, maxlength: 80 },
    name: { type: String, required: true, maxlength: 255 },
    description: { type: String, maxlength: 2000 },
    location: { type: String, maxlength: 500 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: ref('User'),
    updatedBy: ref('User'),
  },
  options,
);
warehouse.index({ code: 1 }, { unique: true });
const balance = new mongoose.Schema(
  {
    productId: ref('Product'),
    warehouseId: ref('Warehouse'),
    quantityUnits: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_UNITS,
      validate: Number.isSafeInteger,
    },
  },
  options,
);
balance.index({ productId: 1, warehouseId: 1 }, { unique: true });
const movement = new mongoose.Schema(
  {
    productId: ref('Product'),
    type: {
      type: String,
      enum: ['ENTRY', 'EXIT', 'TRANSFER', 'ADJUSTMENT'],
      required: true,
    },
    quantityUnits: {
      type: Number,
      required: true,
      validate: Number.isSafeInteger,
    },
    sourceWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
    },
    destinationWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
    },
    reason: { type: String, required: true, maxlength: 500 },
    reference: { type: String, maxlength: 200 },
    notes: { type: String, maxlength: 2000 },
    createdBy: ref('User'),
    idempotencyKey: { type: String, required: true },
    requestHash: { type: String, required: true },
  },
  { ...options, timestamps: { createdAt: true, updatedAt: false } },
);
movement.index({ createdBy: 1, idempotencyKey: 1 }, { unique: true });
movement.index({ productId: 1, createdAt: -1, _id: -1 });
movement.index({ sourceWarehouseId: 1, createdAt: -1 });
movement.index({ destinationWarehouseId: 1, createdAt: -1 });
// Corrections are new audited adjustments. No application update/delete API.
for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]) {
  movement.pre(operation, function () {
    throw new Error('Applied movements are immutable');
  });
}
movement.pre('save', function () {
  if (!this.isNew) throw new Error('Applied movements are immutable');
});
module.exports = {
  Warehouse: mongoose.model('Warehouse', warehouse, 'warehouses'),
  InventoryBalance: mongoose.model(
    'InventoryBalance',
    balance,
    'inventoryBalances',
  ),
  InventoryMovement: mongoose.model(
    'InventoryMovement',
    movement,
    'inventoryMovements',
  ),
};
