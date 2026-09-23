/**
 * ============================================
 * ERP-SYSTEM - Controlador de Clientes
 * ============================================
 */

const customerService = require('./customers.service');
const { asyncHandler } = require('../../middleware/errorHandler');
const { validateRequest } = require('../../middleware/validateRequest');
const { validateFilters } = require('./customers.validation');
const { validateRequired, validateEmail } = require('../../shared/validators/validators');

/**
 * GET /api/v1/customers
 * Listar clientes con paginación, filtros y búsqueda
 */
exports.getCustomers = asyncHandler(async (req, res) => {
  const { page, limit, sortBy, sortOrder, search, status, type, city } = req.query;
  
  // Validar filtros
  const filterValidation = validateFilters(req.query);
  if (!filterValidation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Error de validación de filtros',
      details: filterValidation.errors,
    });
  }

  const filters = {};
  if (status) filters.status = status;
  if (type) filters.type = type;
  if (city) filters.city = city;

  const result = await customerService.getAll({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sortBy: sortBy || 'createdAt',
    sortOrder: sortOrder || 'desc',
    search: search || '',
    filters,
  });

  res.json({ success: true, data: result });
});

/**
 * POST /api/v1/customers
 * Crear un nuevo cliente
 */
exports.createCustomer = asyncHandler(async (req, res) => {
  // Validación manual de campos requeridos
  const nameResult = validateRequired(req.body.name, 'Nombre');
  if (!nameResult.valid) {
    return res.status(400).json({ success: false, error: nameResult.error });
  }

  const emailResult = validateEmail(req.body.email);
  if (!emailResult.valid) {
    return res.status(400).json({ success: false, error: emailResult.error });
  }

  const customer = await customerService.create(req.body);
  res.status(201).json({ 
    success: true, 
    data: customer, 
    message: 'Cliente creado exitosamente' 
  });
});

/**
 * GET /api/v1/customers/:id
 * Obtener un cliente por ID
 */
exports.getCustomerById = asyncHandler(async (req, res) => {
  const customer = await customerService.getById(req.params.id);
  res.json({ success: true, data: customer });
});

/**
 * PATCH /api/v1/customers/:id
 * Actualizar un cliente existente
 */
exports.updateCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.update(req.params.id, req.body);
  res.json({ success: true, data: customer });
});

/**
 * PATCH /api/v1/customers/:id/status
 * Cambiar el estado de un cliente
 */
exports.changeCustomerStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, error: 'Status es requerido' });
  }
  const customer = await customerService.changeStatus(req.params.id, status);
  res.json({ success: true, data: customer });
});

/**
 * DELETE /api/v1/customers/:id
 * Eliminar (soft delete) un cliente
 */
exports.deleteCustomer = asyncHandler(async (req, res) => {
  await customerService.delete(req.params.id);
  res.json({ success: true, message: 'Cliente eliminado' });
});

/**
 * GET /api/v1/customers/stats
 * Obtener estadísticas de clientes
 */
exports.getCustomerStats = asyncHandler(async (req, res) => {
  const stats = await customerService.getStats();
  res.json({ success: true, data: stats });
});

/**
 * GET /api/v1/customers/search
 * Buscar clientes por texto
 */
exports.searchCustomers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (typeof q !== 'string' || q.length < 2) {
    return res.status(400).json({ success: false, error: 'Busqueda debe tener al menos 2 caracteres' });
  }
  
  const results = await customerService.getAll({
    search: q,
    limit: 20,
  });
  
  res.json({ success: true, data: results });
});
