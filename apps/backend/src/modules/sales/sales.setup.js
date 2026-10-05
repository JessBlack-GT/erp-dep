const mongoose = require('mongoose');
const initializeCommercial = require('../commercial/commercial.setup');
const {
  Warehouse,
  InventoryBalance,
  InventoryMovement,
} = require('../inventory/inventory.model');
module.exports = async function initializeSalesStorage() {
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid')
    throw new Error('Sales requires a transaction-capable MongoDB topology');
  await initializeCommercial();
  for (const Model of [Warehouse, InventoryBalance, InventoryMovement]) {
    await Model.createCollection();
    await Model.createIndexes();
  }
};
