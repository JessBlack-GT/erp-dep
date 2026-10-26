// @ts-check
'use strict';
/**
 * Folios municipales (ADR-07, RQ01): {MUN}-{DEP}-{TIPO}-{AAAA}-{NNNNNN}.
 * La secuencia se obtiene de un contador atómico por {municipio, dependencia, tipo, año} dentro de la
 * misma transacción que crea la solicitud (adaptador Mongo pendiente). Un folio nunca se reutiliza.
 */
const FOLIO_PATTERN = /^([A-Z]{3})-([A-Z]{3})-([A-Z]{3})-(\d{4})-(\d{6})$/;
const CODE = /^[A-Z]{3}$/;
const MAX_SEQUENCE = 999999;

/** Año calendario en la zona horaria del municipio (Tlaxcala: America/Mexico_City). */
function yearInMexico(date) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', year: 'numeric' }).format(date));
}

/** @param {{ municipality: string, dependency: string, type: string, year: number }} k */
function counterKey(k) {
  assertParts(k);
  return `${k.municipality}:${k.dependency}:${k.type}:${k.year}`;
}

/** @param {{ municipality: string, dependency: string, type: string, year: number, sequence: number }} f */
function formatFolio(f) {
  assertParts(f);
  if (!Number.isSafeInteger(f.sequence) || f.sequence < 1 || f.sequence > MAX_SEQUENCE)
    throw new RangeError('Secuencia de folio fuera de rango');
  return `${f.municipality}-${f.dependency}-${f.type}-${f.year}-${String(f.sequence).padStart(6, '0')}`;
}

/** @param {string} folio */
function parseFolio(folio) {
  const m = typeof folio === 'string' ? FOLIO_PATTERN.exec(folio) : null;
  if (!m) return null;
  const sequence = Number(m[5]);
  if (sequence < 1) return null;
  return { municipality: m[1], dependency: m[2], type: m[3], year: Number(m[4]), sequence };
}

function assertParts(k) {
  if (!k || !CODE.test(k.municipality) || !CODE.test(k.dependency) || !CODE.test(k.type))
    throw new TypeError('Código de municipio, dependencia o tipo inválido');
  if (!Number.isInteger(k.year) || k.year < 2000 || k.year > 9999) throw new TypeError('Año inválido');
}

module.exports = { FOLIO_PATTERN, MAX_SEQUENCE, counterKey, formatFolio, parseFolio, yearInMexico };
