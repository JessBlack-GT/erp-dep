'use strict';
/**
 * Inyección de fallos INDEPENDIENTE de la implementación: envuelve cualquier almacén que cumpla el
 * puerto (memoria hoy, MongoDB mañana) sin pedirle ganchos de prueba. El fallo se lanza dentro de la
 * operación indicada; si ocurre dentro de `transaction`, debe deshacer todo lo anterior.
 */
const { allOperations } = require('../../../src/modules/municipal/persistence/repository-port');

function withFaults(base) {
  const pending = new Map();
  const wrap = (target) => {
    const out = {};
    for (const op of allOperations()) {
      if (op === 'newId') { out.newId = () => target.newId(); continue; }
      if (op === 'transaction') { out.transaction = (fn) => target.transaction((tx) => fn(wrap(tx))); continue; }
      out[op] = async (...args) => {
        if (pending.has(op)) {
          const error = pending.get(op);
          pending.delete(op);
          throw error;
        }
        return target[op](...args);
      };
    }
    return out;
  };
  return {
    store: wrap(base),
    /** El siguiente uso de `op` lanza `error` (por defecto, un fallo de escritura genérico). */
    failNext(op, error = Object.assign(new Error('Fallo de persistencia simulado'), { code: 'SIMULATED_WRITE_FAILURE' })) {
      pending.set(op, error);
      return error;
    },
  };
}

module.exports = { withFaults };
