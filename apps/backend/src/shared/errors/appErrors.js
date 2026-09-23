/**
 * ============================================
 * ERP-SYSTEM - Errores Personalizados del Sistema
 * ============================================
 * ============================================
 */

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

class DatabaseError extends AppError {
  constructor(message = 'Error de base de datos') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

module.exports = {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  DatabaseError,
};
