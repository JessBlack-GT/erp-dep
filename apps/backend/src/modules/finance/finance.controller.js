/**
 * ERP-SYSTEM - Controlador de finance
 * Estado: Estructura preparada - Pendiente de implementacion
 */
const { asyncHandler } = require('../../middleware/errorHandler');
exports.getfinance = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.createfinance = asyncHandler(async (req, res) => { res.status(201).json({ success: true, message: 'Pendiente' }); });
exports.getfinanceById = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.updatefinance = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.deletefinance = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
