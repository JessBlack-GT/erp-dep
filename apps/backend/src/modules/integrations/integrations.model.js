/**
 * ERP-SYSTEM - Modelo de integrations
 */
const mongoose = require('mongoose');
const integrationsSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('integrations', integrationsSchema);
