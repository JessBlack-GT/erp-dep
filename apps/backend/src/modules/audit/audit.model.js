/**
 * ERP-SYSTEM - Modelo de audit
 */
const mongoose = require('mongoose');
const auditSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  action: { type: String, enum: ['create', 'update', 'confirm', 'cancel'], required: true, immutable: true },
  module: { type: String, enum: ['commercial'], required: true, immutable: true },
  entity: { type: String, enum: ['CommercialDocument'], required: true, immutable: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  result: { type: String, enum: ['success', 'failure'], required: true, immutable: true },
}, { timestamps: true, strict: 'throw' });
auditSchema.index({ entityId: 1, createdAt: 1 });
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete'])
  auditSchema.pre(operation, function () { throw new Error('Audit records are immutable'); });
auditSchema.pre('save', function () {
  if (!this.isNew) throw new Error('Audit records are immutable');
});
module.exports = mongoose.model('audit', auditSchema);
