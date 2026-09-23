/**
 * ERP-SYSTEM - Modelo de suppliers
 */
const mongoose = require('mongoose');
const suppliersSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('suppliers', suppliersSchema);
