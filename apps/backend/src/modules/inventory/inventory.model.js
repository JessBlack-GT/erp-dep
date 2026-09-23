/**
 * ERP-SYSTEM - Modelo de inventory
 */
const mongoose = require('mongoose');
const inventorySchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('inventory', inventorySchema);
