/**
 * ============================================
 * ERP-SYSTEM - Validadores Compartidos
 * ============================================
 * Utilidades de validación reutilizables.
 * ============================================
 */

/**
 * Valida que un campo no esté vacío
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nombre del campo
 * @returns {Object} Resultado de validación
 */
function validateRequired(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: `${fieldName} es requerido` };
  }
  return { valid: true };
}

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {Object} Resultado de validación
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Formato de email inválido' };
  }
  return { valid: true };
}

/**
 * Valida longitud de string
 * @param {string} value - Valor
 * @param {string} fieldName - Nombre del campo
 * @param {number} min - Longitud mínima
 * @param {number} max - Longitud máxima
 * @returns {Object} Resultado de validación
 */
function validateStringLength(value, fieldName, min = 1, max = 255) {
  if (value.length < min) {
    return { valid: false, error: `${fieldName} debe tener al menos ${min} caracteres` };
  }
  if (value.length > max) {
    return { valid: false, error: `${fieldName} debe tener máximo ${max} caracteres` };
  }
  return { valid: true };
}

/**
 * Valida que un ID sea un ObjectId válido de MongoDB
 * @param {string} id - ID a validar
 * @returns {Object} Resultado de validación
 */
function validateObjectId(id) {
  if (!id || typeof id !== 'string' || id.length !== 24) {
    return { valid: false, error: 'ID inválido' };
  }
  return { valid: true };
}

/**
 * Valida que un número sea positivo
 * @param {number} value - Valor
 * @param {string} fieldName - Nombre del campo
 * @returns {Object} Resultado de validación
 */
function validatePositiveNumber(value, fieldName) {
  if (typeof value !== 'number' || value <= 0 || isNaN(value)) {
    return { valid: false, error: `${fieldName} debe ser un número positivo` };
  }
  return { valid: true };
}

/**
 * Sanitiza un objeto eliminando campos sensibles
 * @param {Object} obj - Objeto a sanitizar
 * @param {string[]} sensitiveFields - Campos sensibles a eliminar
 * @returns {Object} Objeto sanitizado
 */
function sanitizeObject(obj, sensitiveFields = ['password', 'token', 'refreshToken']) {
  const sanitized = { ...obj };
  sensitiveFields.forEach((field) => delete sanitized[field]);
  return sanitized;
}

/**
 * Valida un objeto contra un esquema de campos requeridos
 * @param {Object} data - Datos a validar
 * @param {string[]} requiredFields - Campos requeridos
 * @returns {Object} Resultado de validación
 */
function validateObjectFields(data, requiredFields) {
  const missing = requiredFields.filter((field) => !(field in data) || data[field] === undefined || data[field] === null || data[field] === '');
  if (missing.length > 0) {
    return { valid: false, error: `Campos requeridos faltantes: ${missing.join(', ')}` };
  }
  return { valid: true };
}

module.exports = {
  validateRequired,
  validateEmail,
  validateStringLength,
  validateObjectId,
  validatePositiveNumber,
  sanitizeObject,
  validateObjectFields,
};
