/**
 * ERP-SYSTEM - Modelo de human-resources
 */
const mongoose = require('mongoose');
const human-resourcesSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('human-resources', human-resourcesSchema);
