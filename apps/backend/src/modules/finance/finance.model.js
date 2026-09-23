/**
 * ERP-SYSTEM - Modelo de finance
 */
const mongoose = require('mongoose');
const financeSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('finance', financeSchema);
