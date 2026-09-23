/**
 * ERP-SYSTEM - Controlador de purchases
 * Estado: Estructura preparada - Pendiente de implementacion
 */
const { asyncHandler } = require('../../middleware/errorHandler');
exports.getpurchases = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.createpurchases = asyncHandler(async (req, res) => { res.status(201).json({ success: true, message: 'Pendiente' }); });
exports.getpurchasesById = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.updatepurchases = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.deletepurchases = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
