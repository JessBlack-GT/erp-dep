/**
 * ============================================
 * ERP-SYSTEM - Rutas de Usuarios
 * ============================================
 */

const express = require('express');
const router = express.Router();
const userController = require('./users.controller');
const { authenticateToken } = require('../../middleware/authenticate');
const { authorizeRoles } = require('../../middleware/authorize');
const { validateRequest } = require('../../middleware/validateRequest');

// Todas las rutas de usuarios requieren autenticación
router.use(authenticateToken);

router.route('/')
  .get(userController.getUsers)
  .post(validateRequest, userController.createUser);

router.route('/:id')
  .get(userController.getUserById)
  .patch(validateRequest, userController.updateUser)
  .delete(userController.deleteUser);

router.route('/profile/me')
  .get(userController.getProfile);

module.exports = router;
