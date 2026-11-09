// @ts-check
'use strict';
/**
 * Validación de parámetros de ruta, consulta y cabeceras según municipal-v1.
 * Todo parámetro desconocido en la consulta se rechaza (400) para no aceptar filtros silenciosos.
 */
const { HttpError } = require('./errors');
const { FOLIO_PATTERN } = require('../domain/folio');
const { STATUSES } = require('../domain/request-state');

const MUN = /^[A-Z]{3}$/;
const DEP = /^[A-Z]{3}$/;
const OBJECT_ID = /^[a-f0-9]{24}$/;
const IDEMPOTENCY = /^[A-Za-z0-9_-]{8,100}$/;

const bad = (message, field) => new HttpError(400, 'VALIDATION_ERROR', message, [field]);

function mun(value) {
  if (typeof value !== 'string' || !MUN.test(value)) throw bad('Código de municipio inválido', 'mun');
  return value;
}
/** Folio con formato inválido → 404 (no se distingue de inexistente). */
function folio(value) {
  if (typeof value !== 'string' || !FOLIO_PATTERN.test(value)) throw new HttpError(404, 'NOT_FOUND', 'No encontrado');
  return value;
}
/** Identificador con formato inválido → 404 por la misma política de no revelación. */
function objectIdOr404(value) {
  if (typeof value !== 'string' || !OBJECT_ID.test(value)) throw new HttpError(404, 'NOT_FOUND', 'No encontrado');
  return value;
}

/**
 * @param {Record<string, any>} query
 * @param {Record<string, (v: string, name: string) => any>} spec
 */
function parseQuery(query, spec) {
  const out = {};
  for (const [name, raw] of Object.entries(query || {})) {
    if (!(name in spec)) throw bad(`Parámetro no permitido: ${name}`, name);
    if (Array.isArray(raw) || typeof raw !== 'string') throw bad(`Parámetro repetido o inválido: ${name}`, name);
    out[name] = spec[name](raw, name);
  }
  return out;
}

const q = {
  page: (v, n) => int(v, n, 1, 100000),
  limit: (v, n) => int(v, n, 1, 100),
  slaDays: (v, n) => int(v, n, 1, 365),
  status: (v, n) => { if (!STATUSES.includes(v)) throw bad('Estado inválido', n); return v; },
  activeStatus: (v, n) => { if (!['ACTIVA', 'INACTIVA'].includes(v)) throw bad('Estado inválido', n); return v; },
  dependency: (v, n) => { if (!DEP.test(v)) throw bad('Dependencia inválida', n); return v; },
  bool: (v, n) => { if (v !== 'true' && v !== 'false') throw bad('Booleano inválido', n); return v === 'true'; },
  dateTime: (v, n) => {
    const d = new Date(v);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(v) || Number.isNaN(d.getTime())) throw bad('Fecha-hora ISO 8601 inválida', n);
    return d;
  },
  search: (v, n) => { if (v.length < 3 || v.length > 80) throw bad('Búsqueda de 3 a 80 caracteres', n); return v; },
  objectId: (v, n) => { if (!OBJECT_ID.test(v)) throw bad('Identificador inválido', n); return v; },
  folio: (v, n) => { if (!FOLIO_PATTERN.test(v)) throw bad('Folio inválido', n); return v; },
};

function int(v, name, min, max) {
  if (!/^\d+$/.test(v)) throw bad(`${name} debe ser entero`, name);
  const n = Number(v);
  if (n < min || n > max) throw bad(`${name} fuera de rango (${min}–${max})`, name);
  return n;
}

function idempotencyKey(req) {
  const v = req.get('Idempotency-Key');
  if (!v || !IDEMPOTENCY.test(v)) throw bad('Idempotency-Key obligatoria e inválida', 'Idempotency-Key');
  return v;
}

/** If-Match: versión entera, con o sin comillas (ETag débil o fuerte). */
function ifMatchVersion(req) {
  const raw = req.get('If-Match');
  const m = raw ? /^(?:W\/)?"?(\d{1,9})"?$/.exec(raw.trim()) : null;
  if (!m) throw bad('If-Match obligatorio con la versión vigente', 'If-Match');
  return Number(m[1]);
}

module.exports = { mun, folio, objectIdOr404, parseQuery, q, idempotencyKey, ifMatchVersion };
