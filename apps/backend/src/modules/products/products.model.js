/**
 * ERP-SYSTEM - Modelo de products
 */
const mongoose = require('mongoose');
const productsSchema = new mongoose.Schema({}, { timestamps: true });
module.exports = mongoose.model('products', productsSchema);
