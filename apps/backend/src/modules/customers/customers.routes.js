/**
 * ============================================
 * ERP-SYSTEM - Rutas de Clientes
 * ============================================
 */

const express = require('express');
const router = express.Router();
const customersController = require('./customers.controller');
const { authenticateToken } = require('../../middleware/authenticate');
const { authorizeRoles } = require('../../middleware/authorize');
const { validateRequest } = require('../../middleware/validateRequest');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Estadísticas
router.get('/stats', customersController.getCustomerStats);

// Búsqueda
router.get('/search', customersController.searchCustomers);

// Listar y crear
router.route('/')
  .get(customersController.getCustomers)
  .post(validateRequest, customersController.createCustomer);

// Obtener, actualizar y eliminar por ID
router.route('/:id')
  .get(customersController.getCustomerById)
  .patch(validateRequest, customersController.updateCustomer)
  .delete(customersController.deleteCustomer);

// Cambiar estado
router.patch('/:id/status', validateRequest, customersController.changeCustomerStatus);

module.exports = router;
