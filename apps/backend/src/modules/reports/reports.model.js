/**
 * ERP-SYSTEM - Modelo de reports
 */
const mongoose = require('mongoose');
const reportsSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('reports', reportsSchema);
