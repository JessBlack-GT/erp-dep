/**
 * ============================================
 * ERP-SYSTEM - Middleware de Autenticación
 * ============================================
 */

const jwt = require('jsonwebtoken');
const { config } = require('../config/environment');
const { logger } = require('../shared/utils/logger');

function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No se proporcionó token de autenticación',
        message: 'Se requiere autenticación para acceder a este recurso',
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || [],
    };
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token expirado');
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        message: 'Su sesión ha expirado. Inicie sesión de nuevo.',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Token inválido');
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
        message: 'Credenciales no válidas',
      });
    }
    logger.error('Error en authenticateToken:', error.message);
    return res.status(500).json({ success: false, error: 'Error de autenticación' });
  }
}

function authenticateOptional(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) { req.user = null; return next(); }
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role, permissions: decoded.permissions || [] };
    req.token = token;
  } catch (error) { req.user = null; }
  next();
}

module.exports = { authenticateToken, authenticateOptional };
