// @ts-check
'use strict';
/**
 * Respuestas de error del contrato municipal-v1: { success: false, error, code }.
 * Nunca se exponen trazas, mensajes de base de datos ni detalles de autenticación.
 */
const CODE_BY_STATUS = Object.freeze({
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  500: 'INTERNAL_ERROR',
  501: 'NOT_IMPLEMENTED',
  503: 'AUTHORIZATION_UNAVAILABLE',
});
const KNOWN_CODES = new Set([...Object.values(CODE_BY_STATUS), 'MUNICIPAL_MEMBERSHIP_REQUIRED', 'INVALID_TRANSITION']);

class HttpError extends Error {
  /** @param {number} statusCode @param {string} code @param {string} message @param {string[]} [fields] */
  constructor(statusCode, code, message, fields) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    if (fields) this.fields = fields;
  }
}

/** Normaliza cualquier error a { status, body } sin filtrar detalles internos. */
function toErrorResponse(err) {
  // Errores de body-parser (JSON mal formado, cuerpo demasiado grande).
  if (err && err.type === 'entity.too.large') return { status: 413, body: { success: false, error: 'Cuerpo demasiado grande', code: 'PAYLOAD_TOO_LARGE' } };
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError))
    return { status: 400, body: { success: false, error: 'JSON inválido', code: 'VALIDATION_ERROR' } };
  const status = err && Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  if (status >= 500 && status !== 501 && status !== 503) return { status: 500, body: { success: false, error: 'Error interno', code: 'INTERNAL_ERROR' } };
  const code = err && KNOWN_CODES.has(err.code) ? err.code : CODE_BY_STATUS[status] || 'VALIDATION_ERROR';
  const body = { success: false, error: String(err.message || 'Error'), code };
  if (Array.isArray(err.fields) && err.fields.length) body.fields = err.fields.map(String);
  return { status, body };
}

/**
 * Las respuestas 401/503 provienen del middleware central del ERP (authenticateToken /
 * requireCurrentUser), que no incluye `code`. Este envoltorio añade el código del contrato a
 * cualquier error JSON sin `code`, sin modificar el middleware central.
 */
function ensureErrorCode(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (body && body.success === false && !body.code) {
      const status = res.statusCode;
      const normalized = { success: false, error: body.error || 'Error', code: CODE_BY_STATUS[status] || 'VALIDATION_ERROR' };
      return json(normalized);
    }
    return json(body);
  };
  next();
}

module.exports = { HttpError, toErrorResponse, ensureErrorCode, CODE_BY_STATUS };
