const mongoose = require('mongoose');
const { type } = require('./commercial.validation');
const { ConflictError } = require('../../shared/errors/appErrors');
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true, min: 1, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
}, { versionKey: false, strict: 'throw' });
const Counter = mongoose.models.CommercialCounter || mongoose.model('CommercialCounter', schema, 'commercialCounters');
async function next(documentType, session) {
  type(documentType);
  if (!session) throw new Error('Document numbering requires the document transaction');
  const row = await Counter.findOneAndUpdate(
    { _id: documentType, value: { $lt: Number.MAX_SAFE_INTEGER } },
    { $inc: { value: 1 } },
    { upsert: true, new: true, session, setDefaultsOnInsert: false },
  );
  if (!row || !Number.isSafeInteger(row.value) || row.value < 1)
    throw new ConflictError('Numeración no disponible');
  return { sequence: row.value, number: documentType + '-' + String(row.value).padStart(6, '0') };
}
module.exports = { Counter, next };
