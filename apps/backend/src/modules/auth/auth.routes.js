/**
 * ============================================
 * ERP-SYSTEM - Rutas de Autenticación
 * ============================================
 */

const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { validateRequest } = require('../../middleware/validateRequest');
const { validateRequired, validateEmail } = require('../../shared/validators/validators');

// Registro
router.post('/register', validateRequest, authController.register);

// Login y logout
router.post('/login', validateRequest, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refreshToken);

// Perfil del usuario autenticado
router.get('/me', authController.getMe);

module.exports = router;
