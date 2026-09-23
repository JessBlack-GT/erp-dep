/**
 * ERP-SYSTEM - Controlador de reports
 * Estado: Estructura preparada - Pendiente de implementacion
 */
const { asyncHandler } = require('../../middleware/errorHandler');
exports.getreports = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.createreports = asyncHandler(async (req, res) => { res.status(201).json({ success: true, message: 'Pendiente' }); });
exports.getreportsById = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.updatereports = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.deletereports = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
