// @ts-check
'use strict';
/**
 * Guardia previa a CUALQUIER prueba persistente del módulo municipal (F1-05, docs/munierp/12 §10).
 * Función pura sobre variables de entorno: no abre conexiones, no importa mongoose y no lee archivos.
 *
 * Condiciones (todas obligatorias):
 *  1. `MUNICIPAL_STORE=mongo` (elección explícita; por defecto el módulo usa memoria).
 *  2. `MUNICIPAL_QA_DATABASE=munierp_qa` (base exclusiva del módulo municipal).
 *  3. `MUNICIPAL_QA_URI` presente; si la URI nombra base, debe ser `munierp_qa`.
 *  4. `MUNICIPAL_QA_AUTHORIZED=AAAA-MM-DD|responsable|munierp_qa` con fecha válida no futura.
 *  5. La autorización y la base NO se comparten con otros módulos (p. ej. M03 o M07/Ventas):
 *     otra variable `*_QA_DATABASE` con el mismo valor, o una `*AUTHORIZ*` con el mismo texto, la invalida.
 *  6. `NODE_ENV` distinto de `production`.
 */
const REQUIRED_DB = 'munierp_qa';
const AUTH_FORMAT = /^(\d{4}-\d{2}-\d{2})\|([^|]{3,80})\|([a-z0-9_]+)$/;

/** @param {string} uri */
function databaseInUri(uri) {
  const m = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri);
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}

/**
 * @param {Record<string, string|undefined>} env
 * @param {{ now?: Date }} [options]
 * @returns {{ allowed: boolean, reasons: string[] }}
 */
function checkQaPersistence(env, { now = new Date() } = {}) {
  const reasons = [];
  if (env.NODE_ENV === 'production') reasons.push('NODE_ENV=production');
  if (env.MUNICIPAL_STORE !== 'mongo') reasons.push('MUNICIPAL_STORE no es "mongo" (se usa memoria)');
  if (env.MUNICIPAL_QA_DATABASE !== REQUIRED_DB) reasons.push(`MUNICIPAL_QA_DATABASE debe ser "${REQUIRED_DB}"`);

  const uri = env.MUNICIPAL_QA_URI || '';
  if (!uri) reasons.push('MUNICIPAL_QA_URI ausente');
  else {
    const db = databaseInUri(uri);
    if (db && db !== REQUIRED_DB) reasons.push('La URI apunta a otra base');
  }

  const auth = env.MUNICIPAL_QA_AUTHORIZED || '';
  const parsed = AUTH_FORMAT.exec(auth);
  if (!parsed) reasons.push('MUNICIPAL_QA_AUTHORIZED ausente o sin formato AAAA-MM-DD|responsable|munierp_qa');
  else {
    const date = new Date(`${parsed[1]}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== parsed[1]) reasons.push('Fecha de autorización inválida');
    else if (date.getTime() > now.getTime()) reasons.push('Fecha de autorización futura');
    if (parsed[3] !== REQUIRED_DB) reasons.push('La autorización no corresponde a munierp_qa');
  }

  for (const [key, value] of Object.entries(env)) {
    if (!value || key.startsWith('MUNICIPAL_')) continue;
    if (/_QA_DATABASE$/.test(key) && value === env.MUNICIPAL_QA_DATABASE) reasons.push(`La base se comparte con ${key}`);
    if (/AUTHORI[SZ]/.test(key) && auth && value === auth) reasons.push(`La autorización se reutiliza de ${key}`);
  }
  return { allowed: reasons.length === 0, reasons };
}

module.exports = { checkQaPersistence, REQUIRED_DB, databaseInUri };
