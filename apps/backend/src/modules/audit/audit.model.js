/**
 * ERP-SYSTEM - Modelo de audit
 */
const mongoose = require('mongoose');
const auditSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('audit', auditSchema);
