/**
 * ERP-SYSTEM - Modelo de human-resources
 */
const mongoose = require('mongoose');
const humanResourcesSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('human-resources', humanResourcesSchema);
