/**
 * ERP-SYSTEM - Modelo de notifications
 */
const mongoose = require('mongoose');
const notificationsSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('notifications', notificationsSchema);
