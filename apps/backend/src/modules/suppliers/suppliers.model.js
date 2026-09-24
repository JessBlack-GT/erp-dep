const mongoose = require('mongoose');
const { lengths } = require('./suppliers.validation');
const fields = Object.fromEntries(
  Object.entries(lengths).map(([key, maxlength]) => [
    key,
    { type: String, trim: true, maxlength },
  ]),
);
fields.name.required = true;
fields.type.enum = ['natural', 'legal'];
fields.type.default = 'legal';
fields.email.lowercase = true;
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
schema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
schema.index(
  { taxCountry: 1, taxType: 1, taxId: 1 },
  { unique: true, partialFilterExpression: { taxId: { $type: 'string' } } },
);
schema.index({ status: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.model('Supplier', schema, 'suppliers');
