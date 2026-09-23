/**
 * ERP-SYSTEM - Controlador de sales
 * Estado: Estructura preparada - Pendiente de implementacion
 */
const { asyncHandler } = require('../../middleware/errorHandler');
exports.getsales = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.createsales = asyncHandler(async (req, res) => { res.status(201).json({ success: true, message: 'Pendiente' }); });
exports.getsalesById = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.updatesales = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.deletesales = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
