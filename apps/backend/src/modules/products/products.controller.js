/**
 * ERP-SYSTEM - Controlador de products
 * Estado: Estructura preparada - Pendiente de implementacion
 */
const { asyncHandler } = require('../../middleware/errorHandler');
exports.getproducts = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.createproducts = asyncHandler(async (req, res) => { res.status(201).json({ success: true, message: 'Pendiente' }); });
exports.getproductsById = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.updateproducts = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.deleteproducts = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
