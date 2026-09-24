const mongoose = require('mongoose');
const { lengths } = require('./products.validation');
const fields = Object.fromEntries(
  Object.entries(lengths).map(([key, maxlength]) => [
    key,
    { type: String, trim: true, maxlength },
  ]),
);
fields.name.required = true;
fields.sku.required = true;
fields.type.enum = ['PRODUCT', 'SERVICE'];
fields.type.default = 'PRODUCT';
fields.unit.default = 'unit';
fields.trackInventory = { type: Boolean, default: false };
fields.status = {
  type: String,
  enum: ['active', 'inactive', 'deleted'],
  default: 'active',
};
fields.createdBy = { type: mongoose.Schema.Types.ObjectId, ref: 'User' };
fields.updatedBy = { type: mongoose.Schema.Types.ObjectId, ref: 'User' };
const schema = new mongoose.Schema(fields, {
  timestamps: true,
  strict: 'throw',
});
schema.index({ sku: 1 }, { unique: true });
schema.index(
  { barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } },
);
schema.index({ status: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('Product', schema, 'products');
