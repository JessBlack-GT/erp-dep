// @ts-check
'use strict';
/**
 * Ejecutor de transacciones sobre un `MongoClient` INYECTADO (este módulo no conecta).
 * Usa `session.withTransaction`, que reintenta `TransientTransactionError` y
 * `UnknownTransactionCommitResult` (por eso el callback debe ser repetible: el servicio solo escribe
 * en la base dentro de él). Devuelve el valor del callback con independencia de la versión del
 * controlador (en v5 `withTransaction` devuelve el resultado del comando, no el del callback).
 */
const DEFAULT_TRANSACTION_OPTIONS = Object.freeze({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  readPreference: 'primary',
});

/**
 * @param {{ startSession: (opts?: any) => any }} client
 * @param {{ transactionOptions?: any }} [options]
 */
function createTransactionRunner(client, { transactionOptions = DEFAULT_TRANSACTION_OPTIONS } = {}) {
  if (!client || typeof client.startSession !== 'function') throw new TypeError('Se requiere un cliente con startSession()');
  return async function runTransaction(fn) {
    const session = client.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await fn(session);
      }, transactionOptions);
      return result;
    } finally {
      await session.endSession();
    }
  };
}

module.exports = { createTransactionRunner, DEFAULT_TRANSACTION_OPTIONS };
