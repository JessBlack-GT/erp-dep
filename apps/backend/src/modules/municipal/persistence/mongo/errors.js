// @ts-check
'use strict';
/**
 * Traducción de errores del controlador de MongoDB a los códigos del puerto (persistence/repository-port.js).
 *
 * Regla clave: DENTRO de una transacción, los errores con etiqueta `TransientTransactionError` o
 * `UnknownTransactionCommitResult` se devuelven SIN envolver, para que `session.withTransaction` del
 * controlador pueda reintentar. Solo al salir de la transacción, si siguen fallando, se convierten en
 * `TRANSIENT_CONFLICT` (el servicio responde 409 «reintente» donde el contrato lo prevé).
 */
const { UNIQUE_INDEX_ERRORS } = require('./collections');

const RETRYABLE_LABELS = ['TransientTransactionError', 'UnknownTransactionCommitResult'];
const NETWORK_NAMES = ['MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoServerSelectionError', 'MongoTopologyClosedError'];

const hasLabel = (e, label) =>
  !!e && ((typeof e.hasErrorLabel === 'function' && e.hasErrorLabel(label)) || (Array.isArray(e.errorLabels) && e.errorLabels.includes(label)) || (e.errorLabelSet instanceof Set && e.errorLabelSet.has(label)));

const isRetryable = (e) => RETRYABLE_LABELS.some((l) => hasLabel(e, l));

function domainError(code, message, cause) {
  return Object.assign(new Error(message), { code, cause });
}

/** Nombre del índice de un E11000 (campo `index` del servidor o el texto «index: <nombre>»). */
function duplicateIndexName(e) {
  if (e.errInfo && e.errInfo.index) return e.errInfo.index;
  const m = /index: ([A-Za-z0-9_.$-]+)/.exec(String(e.message || ''));
  return m ? m[1] : null;
}

/**
 * @param {any} e
 * @param {{ inTransaction?: boolean }} [opts]
 */
function mapMongoError(e, { inTransaction = false } = {}) {
  if (!e || typeof e !== 'object') return e;
  if (typeof e.code === 'string') return e; // ya es un error del dominio/puerto
  if (inTransaction && isRetryable(e)) return e;
  if (e.code === 11000 || e.code === 11001) {
    const index = duplicateIndexName(e);
    return domainError((index && UNIQUE_INDEX_ERRORS[index]) || 'DUPLICATE_KEY', `Clave duplicada${index ? ' (' + index + ')' : ''}`, e);
  }
  if (isRetryable(e) || e.code === 112 /* WriteConflict */) return domainError('TRANSIENT_CONFLICT', 'Conflicto de concurrencia; reintente', e);
  if (NETWORK_NAMES.includes(e.name)) return domainError('PERSISTENCE_UNAVAILABLE', 'Base de datos no disponible', e);
  if (e.code === 121 /* DocumentValidationFailure */) return domainError('VALIDATION_FAILED', 'Documento rechazado por el validador de la colección', e);
  if (e.code === 13 /* Unauthorized */) return domainError('PERSISTENCE_FORBIDDEN', 'Operación no permitida al usuario de la base', e);
  return e;
}

module.exports = { mapMongoError, isRetryable, hasLabel, RETRYABLE_LABELS };
