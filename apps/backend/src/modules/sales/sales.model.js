/**
 * ERP-SYSTEM - Modelo de sales
 */
const mongoose = require('mongoose');
const salesSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('sales', salesSchema);
