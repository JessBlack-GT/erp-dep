/**
 * ERP-SYSTEM - Modelo de ai
 */
const mongoose = require('mongoose');
const aiSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('ai', aiSchema);
