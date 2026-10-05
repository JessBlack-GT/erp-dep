const mongoose = require('mongoose');
const { STATES, TYPES } = require('./commercial.validation');
const amount = () => ({ type: String, required: true, match: /^(0|[1-9]\d{0,11})\.\d{4}$/ });
const objectId = ref => ({ type: mongoose.Schema.Types.ObjectId, ref, required: true });
const rate = () => ({ ...amount(), validate: value => {
  try { require('../../shared/utils/money').rate(value); return true; }
  catch (_) { return false; }
} });
const snapshot = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 255 },
  sku: { type: String, required: true, maxlength: 80 },
  type: { type: String, enum: ['PRODUCT', 'SERVICE'], required: true },
  unit: { type: String, required: true, maxlength: 40 },
  trackInventory: { type: Boolean, required: true },
}, { _id: false, strict: 'throw' });
const line = new mongoose.Schema({
  productId: objectId('Product'),
  snapshot: { type: snapshot, required: true },
  quantity: { type: String, required: true, validate: value => {
    try { require('../inventory/inventory.validation').units(value); return true; }
    catch (_) { return false; }
  } },
  unitPrice: amount(), discountRate: rate(), taxRate: rate(),
  subtotal: amount(), discount: amount(), tax: amount(), total: amount(),
}, { strict: 'throw' });
const schema = new mongoose.Schema({
  number: { type: String, required: true, immutable: true },
  sequence: { type: Number, required: true, min: 1, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger, immutable: true },
  type: { type: String, enum: Object.keys(TYPES), required: true, immutable: true },
  status: { type: String, enum: STATES, required: true, default: 'draft' },
  date: { type: Date, required: true },
  currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
  entity: { type: new mongoose.Schema({
    kind: { type: String, enum: ['customer', 'supplier'], required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, maxlength: 255 },
  }, { _id: false, strict: 'throw' }), required: true },
  lines: { type: [line], required: true, validate: rows => rows.length > 0 && rows.length <= 200 },
  subtotal: amount(), discount: amount(), tax: amount(), total: amount(),
  createdBy: { ...objectId('User'), immutable: true },
  updatedBy: objectId('User'),
  confirmedAt: Date, confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: Date, cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, strict: 'throw' });
schema.index({ number: 1 }, { unique: true });
schema.index({ type: 1, sequence: 1 }, { unique: true });
schema.index({ type: 1, status: 1, date: -1, _id: -1 });
module.exports = mongoose.model('CommercialDocument', schema, 'commercialDocuments');
