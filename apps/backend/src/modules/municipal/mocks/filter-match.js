// @ts-check
'use strict';
/**
 * Evaluador mínimo de filtros estilo Mongo para el almacén en memoria y las pruebas de
 * equivalencia. Soporta igualdad (incluida pertenencia en arreglos), $in, $ne, $and y $or.
 * Cualquier otro operador lanza error, para no aparentar soporte que no existe.
 */
function valueMatches(actual, cond) {
  if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
    return Object.entries(cond).every(([op, v]) => {
      if (op === '$in') return Array.isArray(actual) ? actual.some((a) => v.includes(a)) : v.includes(actual);
      if (op === '$ne') return Array.isArray(actual) ? !actual.includes(v) : actual !== v;
      throw new Error('Operador no soportado en memoria: ' + op);
    });
  }
  if (Array.isArray(actual)) return actual.includes(cond);
  if (cond instanceof Date) return actual instanceof Date && actual.getTime() === cond.getTime();
  return actual === cond;
}

/** @param {Record<string, any>} doc @param {Record<string, any>|null} filter */
function matches(doc, filter) {
  if (!filter) return false;
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '$and') return cond.every((f) => matches(doc, f));
    if (key === '$or') return cond.some((f) => matches(doc, f));
    if (key.startsWith('$')) throw new Error('Operador no soportado en memoria: ' + key);
    const actual = key === '_id' ? doc.id : doc[key];
    return valueMatches(actual === undefined ? null : actual, cond);
  });
}

module.exports = { matches };
