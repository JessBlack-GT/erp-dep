/**
 * ERP-SYSTEM - Controlador de dashboard
 * Estado: Estructura preparada - Pendiente de implementacion
 */
const { asyncHandler } = require('../../middleware/errorHandler');
exports.getdashboard = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.createdashboard = asyncHandler(async (req, res) => { res.status(201).json({ success: true, message: 'Pendiente' }); });
exports.getdashboardById = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.updatedashboard = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.deletedashboard = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
