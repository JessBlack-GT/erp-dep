/**
 * ERP-SYSTEM - Controlador de suppliers
 * Estado: Estructura preparada - Pendiente de implementacion
 */
const { asyncHandler } = require('../../middleware/errorHandler');
exports.getsuppliers = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.createsuppliers = asyncHandler(async (req, res) => { res.status(201).json({ success: true, message: 'Pendiente' }); });
exports.getsuppliersById = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.updatesuppliers = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
exports.deletesuppliers = asyncHandler(async (req, res) => { res.json({ success: true, message: 'Pendiente' }); });
