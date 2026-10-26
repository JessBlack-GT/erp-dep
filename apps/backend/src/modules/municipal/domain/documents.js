// @ts-check
'use strict';
/**
 * Documentos privados del expediente (ADR-10, RQ05): validación de subida y cabeceras de descarga.
 * El tipo se verifica por la firma binaria, no por la extensión ni por el MIME declarado.
 */
const crypto = require('crypto');

const MAX_BYTES = 5 * 1024 * 1024;
const SIGNATURES = Object.freeze({
  'application/pdf': { ext: 'pdf', test: (b) => b.length >= 5 && b.subarray(0, 5).toString('latin1') === '%PDF-' },
  'image/png': { ext: 'png', test: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { ext: 'jpg', test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
});

class DocumentError extends Error {
  /** @param {string} message @param {number} [statusCode] */
  constructor(message, statusCode = 400) {
    super(message);
    this.code = statusCode === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR';
    this.statusCode = statusCode;
  }
}

/** Nombre seguro: sin rutas, sin caracteres de control, longitud acotada, extensión real. */
function sanitizeFilename(name, ext) {
  const base = String(name || 'documento')
    .split(/[\\/]/)
    .pop()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .trim()
    .slice(0, 80) || 'documento';
  return `${base}.${ext}`;
}

/**
 * @param {{ filename?: unknown, mimeType?: unknown, contentBase64?: unknown, confidentiality?: unknown }} body
 */
function validateUpload(body) {
  if (!body || typeof body !== 'object') throw new DocumentError('Cuerpo inválido');
  const allowed = ['filename', 'mimeType', 'contentBase64', 'confidentiality'];
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length) throw new DocumentError('Campos no permitidos: ' + extra.join(', '));
  const { filename, mimeType, contentBase64 } = body;
  const confidentiality = body.confidentiality === undefined ? 'PUBLICA' : body.confidentiality;
  if (!['PUBLICA', 'RESERVADA', 'CONFIDENCIAL'].includes(/** @type {string} */ (confidentiality)))
    throw new DocumentError('Confidencialidad inválida');
  if (typeof mimeType !== 'string' || !(mimeType in SIGNATURES)) throw new DocumentError('Formato no permitido (PDF, PNG o JPEG)');
  if (typeof contentBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64) || contentBase64.length % 4 !== 0)
    throw new DocumentError('Contenido base64 inválido');
  if (contentBase64.length > Math.ceil(MAX_BYTES / 3) * 4) throw new DocumentError('Archivo mayor a 5 MB', 413);
  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.length === 0) throw new DocumentError('Archivo vacío');
  if (buffer.length > MAX_BYTES) throw new DocumentError('Archivo mayor a 5 MB', 413);
  const sig = SIGNATURES[mimeType];
  if (!sig.test(buffer)) throw new DocumentError('El contenido no corresponde al formato declarado');
  return {
    buffer,
    filename: sanitizeFilename(filename, sig.ext),
    mimeType,
    size: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    confidentiality: /** @type {string} */ (confidentiality),
  };
}

/** Cabeceras obligatorias de descarga autorizada (nunca inline, nunca en caché). */
function downloadHeaders(doc) {
  const ascii = doc.filename.replace(/[^A-Za-z0-9._-]/g, '_');
  return {
    'Content-Type': doc.mimeType,
    'Content-Length': String(doc.size),
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
}

/** Clave de almacenamiento opaca: no deriva del nombre ni del folio. */
function newStorageKey() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { MAX_BYTES, DocumentError, sanitizeFilename, validateUpload, downloadHeaders, newStorageKey };
