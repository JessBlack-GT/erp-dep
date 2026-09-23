/**
 * ERP-SYSTEM - Modelo de dashboard
 */
const mongoose = require('mongoose');
const dashboardSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('dashboard', dashboardSchema);
