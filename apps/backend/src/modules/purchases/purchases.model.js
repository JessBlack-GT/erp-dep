/**
 * ERP-SYSTEM - Modelo de purchases
 */
const mongoose = require('mongoose');
const purchasesSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('purchases', purchasesSchema);
