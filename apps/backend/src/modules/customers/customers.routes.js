/**
 * ============================================
 * ERP-SYSTEM - Rutas de Clientes
 * ============================================
 */

const express = require('express');
const router = express.Router();
const customersController = require('./customers.controller');
const { authenticateToken } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
const { validateRequest } = require('../../middleware/validateRequest');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Estadísticas
router.get('/stats', requirePermission('customers.read'), customersController.getCustomerStats);

// Búsqueda
router.get('/search', requirePermission('customers.read'), customersController.searchCustomers);

// Listar y crear
router.route('/')
  .get(requirePermission('customers.read'), customersController.getCustomers)
  .post(requirePermission('customers.create'), validateRequest, customersController.createCustomer);

// Obtener, actualizar y eliminar por ID
router.route('/:id')
  .get(requirePermission('customers.read'), customersController.getCustomerById)
  .patch(requirePermission('customers.update'), validateRequest, customersController.updateCustomer)
  .delete(requirePermission('customers.delete'), customersController.deleteCustomer);

// Cambiar estado
router.patch('/:id/status', requirePermission('customers.update'), validateRequest, customersController.changeCustomerStatus);

module.exports = router;
