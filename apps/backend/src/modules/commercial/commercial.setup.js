const Document = require('./commercial.model');
const { Counter } = require('./numbering');
const Audit = require('../audit/audit.model');

// Invoke once during deployment before enabling a future commercial entry point.
// Explicit creation also works when automatic index creation is disabled.
module.exports = async function initializeCommercialStorage() {
  for (const Model of [Counter, Document, Audit]) {
    await Model.createCollection();
    await Model.createIndexes();
  }
};
