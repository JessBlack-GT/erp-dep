/**
 * ============================================
 * ERP-SYSTEM - Middleware de Validación
 * ============================================
 */

const { validationResult } = require('express-validator');
const { logger } = require('../shared/utils/logger');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
      location: err.location,
    }));
    logger.warn('Validación fallida:', { path: req.path, errors: formattedErrors });
    return res.status(400).json({
      success: false,
      error: 'Error de validación',
      details: formattedErrors,
      message: 'Los datos proporcionados no son válidos',
    });
  }
  next();
}

function createValidationMiddleware(validationRules) {
  return [...validationRules, validateRequest];
}

module.exports = { validateRequest, createValidationMiddleware };
