/**
 * ============================================
 * ERP-SYSTEM - Rutas de Usuarios
 * ============================================
 */

const express = require('express');
const router = express.Router();
const userController = require('./users.controller');
const { authenticateToken } = require('../../middleware/authenticate');
const { requireSystemAdmin, requireCurrentUser } = require('../../middleware/authorize');
const { validateRequest } = require('../../middleware/validateRequest');

// Todas las rutas de usuarios requieren autenticación
router.use(authenticateToken);
router.get('/profile/me', requireCurrentUser, userController.getProfile);
router.use(requireSystemAdmin);

router.route('/')
  .get(userController.getUsers)
  .post(validateRequest, userController.createUser);

router.route('/:id')
  .get(userController.getUserById)
  .patch(validateRequest, userController.updateUser)
  .delete(userController.deleteUser);


module.exports = router;
