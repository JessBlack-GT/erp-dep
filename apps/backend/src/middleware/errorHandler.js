/**
 * ============================================
 * ERP-SYSTEM - Manejo Centralizado de Errores
 * ============================================
 */

const { logger } = require('../shared/utils/logger');
const { config } = require('../config/environment');

class AppError extends Error {
  constructor(message, statusCode, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado', resource = 'Resource') {
    super(message, 404, 'NOT_FOUND', { resource });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Acceso prohibido') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ValidationError extends AppError {
  constructor(message = 'Error de validación', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Recurso ya existe') {
    super(message, 409, 'CONFLICT');
  }
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const error = err.message || 'Error interno del servidor';
  const isProduction = config.nodeEnv === 'production';

  logger.error({ message: err.message, path: req.path, method: req.method, userId: req.user?.id, code: err.code });

  const errorResponse = {
    success: false,
    error: isProduction && statusCode === 500 ? 'Error interno del servidor' : error,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    ...(err.details && { details: err.details }),
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, error: 'Error de validación', details: err.errors || err.message, timestamp: new Date().toISOString() });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, error: 'ID inválido', message: 'El identificador proporcionado no es válido', timestamp: new Date().toISOString() });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'campo';
    return res.status(409).json({ success: false, error: `Ya existe un registro con ${field}`, timestamp: new Date().toISOString() });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: 'Token inválido', message: 'Inicie sesión de nuevo', timestamp: new Date().toISOString() });
  }

  res.status(statusCode).json(errorResponse);
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler, AppError, NotFoundError, UnauthorizedError, ForbiddenError, ValidationError, ConflictError };
