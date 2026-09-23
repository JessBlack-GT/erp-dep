/**
 * ERP-SYSTEM - Modelo de settings
 */
const mongoose = require('mongoose');
const settingsSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('settings', settingsSchema);
