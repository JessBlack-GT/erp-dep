// @ts-check
'use strict';
/**
 * Validación estricta de cargas útiles según contracts/municipal-v1.openapi.yaml.
 * Rechaza campos desconocidos y campos que solo el servidor puede fijar (MT-18).
 */
const SERVER_OWNED = Object.freeze(['municipalityId', 'folio', 'createdBy', 'history', 'status', 'version', '_id', 'id', 'assignedUserId', 'assignedDependencyIds', 'sha256', 'storageKey', 'uploadedBy']);
const CHANNELS = Object.freeze(['PRESENCIAL', 'TELEFONO', 'WEB_FUNCIONARIO']);
const CONFIDENTIALITY = Object.freeze(['PUBLICA', 'RESERVADA', 'CONFIDENCIAL']);
const REQUEST_TYPES = Object.freeze(['SOL']);
const DEP = /^[A-Z]{3}$/;
const OBJECT_ID = /^[a-f0-9]{24}$/;
/** Patrones que no deben almacenarse en Fase 1 (CURP / RFC de persona física). */
const SENSITIVE_IDS = [/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/i, /\b[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}\b/i];

class ValidationError extends Error {
  /** @param {string} message @param {string[]} [fields] */
  constructor(message, fields = []) {
    super(message);
    this.code = 'VALIDATION_ERROR';
    this.statusCode = 400;
    this.fields = fields;
  }
}

/** @param {unknown} body @param {string[]} allowed @param {string[]} required */
function shape(body, allowed, required) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Cuerpo inválido');
  const keys = Object.keys(body);
  const owned = keys.filter((k) => SERVER_OWNED.includes(k));
  if (owned.length) throw new ValidationError('Campos administrados por el servidor', owned);
  const unknown = keys.filter((k) => !allowed.includes(k));
  if (unknown.length) throw new ValidationError('Campos no permitidos', unknown);
  const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === '');
  if (missing.length) throw new ValidationError('Campos obligatorios', missing);
  return /** @type {Record<string, any>} */ (body);
}

function text(value, field, min, max, optional = false) {
  if (value === undefined && optional) return undefined;
  if (typeof value !== 'string') throw new ValidationError('Texto inválido', [field]);
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (clean.length < min || clean.length > max) throw new ValidationError(`Longitud de ${field} fuera de rango`, [field]);
  if (SENSITIVE_IDS.some((re) => re.test(clean)))
    throw new ValidationError('No capture CURP ni RFC en Fase 1', [field]);
  return clean;
}

/** @param {unknown} body */
function validateRequestCreate(body) {
  const b = shape(body, ['type', 'ownerDependency', 'subject', 'description', 'citizenId', 'confidentiality', 'channel'], ['type', 'ownerDependency', 'subject', 'citizenId', 'channel']);
  if (!REQUEST_TYPES.includes(b.type)) throw new ValidationError('Tipo inválido', ['type']);
  if (!DEP.test(b.ownerDependency)) throw new ValidationError('Dependencia inválida', ['ownerDependency']);
  if (!OBJECT_ID.test(b.citizenId)) throw new ValidationError('Ciudadano inválido', ['citizenId']);
  if (!CHANNELS.includes(b.channel)) throw new ValidationError('Canal inválido', ['channel']);
  const confidentiality = b.confidentiality === undefined ? 'PUBLICA' : b.confidentiality;
  if (!CONFIDENTIALITY.includes(confidentiality)) throw new ValidationError('Confidencialidad inválida', ['confidentiality']);
  return {
    type: b.type,
    ownerDependency: b.ownerDependency,
    subject: text(b.subject, 'subject', 5, 200),
    description: text(b.description, 'description', 0, 5000, true),
    citizenId: b.citizenId,
    confidentiality,
    channel: b.channel,
  };
}

/** @param {unknown} body */
function validateCitizenCreate(body) {
  const b = shape(body, ['fullName', 'email', 'phone', 'locality'], ['fullName']);
  const out = { fullName: text(b.fullName, 'fullName', 3, 200) };
  if (b.email !== undefined) {
    if (typeof b.email !== 'string' || b.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email))
      throw new ValidationError('Correo inválido', ['email']);
    out.email = b.email.trim().toLowerCase();
  }
  if (b.phone !== undefined) {
    if (typeof b.phone !== 'string' || !/^[0-9 +()-]{7,20}$/.test(b.phone)) throw new ValidationError('Teléfono inválido', ['phone']);
    out.phone = b.phone.trim();
  }
  if (b.locality !== undefined) out.locality = text(b.locality, 'locality', 1, 120);
  return out;
}

/** @param {unknown} key */
function validateIdempotencyKey(key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(key))
    throw new ValidationError('Idempotency-Key obligatoria e inválida', ['Idempotency-Key']);
  return key;
}

/** @param {unknown} body  RequestUpdate: solo asunto, descripción y confidencialidad. */
function validateRequestUpdate(body) {
  const b = shape(body, ['subject', 'description', 'confidentiality'], []);
  if (!Object.keys(b).length) throw new ValidationError('Indique al menos un campo');
  const out = {};
  if (b.subject !== undefined) out.subject = text(b.subject, 'subject', 5, 200);
  if (b.description !== undefined) out.description = text(b.description, 'description', 0, 5000);
  if (b.confidentiality !== undefined) {
    if (!CONFIDENTIALITY.includes(b.confidentiality)) throw new ValidationError('Confidencialidad inválida', ['confidentiality']);
    out.confidentiality = b.confidentiality;
  }
  return out;
}

/** @param {unknown} body  Transition: forma estricta; las reglas de estado viven en request-state. */
function validateTransitionInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Cuerpo inválido');
  const allowed = ['action', 'version', 'toDependencies', 'assignedUserId', 'note'];
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) throw new ValidationError('Campos no permitidos', unknown);
  const b = /** @type {Record<string, any>} */ (body);
  if (!Number.isInteger(b.version) || b.version < 0) throw new ValidationError('version obligatoria (entero ≥ 0)', ['version']);
  if (b.toDependencies !== undefined && (!Array.isArray(b.toDependencies) || b.toDependencies.some((d) => !DEP.test(d))))
    throw new ValidationError('Dependencias inválidas', ['toDependencies']);
  if (b.assignedUserId !== undefined && !OBJECT_ID.test(b.assignedUserId)) throw new ValidationError('Usuario inválido', ['assignedUserId']);
  if (b.note !== undefined && typeof b.note !== 'string') throw new ValidationError('Nota inválida', ['note']);
  return b;
}

/**
 * @param {unknown} body  GrantCreate: exactamente un destinatario (usuario o dependencia).
 * @param {Date} now
 */
function validateGrantCreate(body, now) {
  const b = shape(body, ['granteeUserId', 'granteeDependency', 'level', 'expiresAt'], ['level']);
  if (!['READ', 'CONTRIBUTE'].includes(b.level)) throw new ValidationError('Nivel inválido', ['level']);
  const hasUser = b.granteeUserId !== undefined;
  const hasDep = b.granteeDependency !== undefined;
  if (hasUser === hasDep) throw new ValidationError('Indique un usuario o una dependencia (solo uno)', ['granteeUserId', 'granteeDependency']);
  if (hasUser && !OBJECT_ID.test(b.granteeUserId)) throw new ValidationError('Usuario inválido', ['granteeUserId']);
  if (hasDep && !DEP.test(b.granteeDependency)) throw new ValidationError('Dependencia inválida', ['granteeDependency']);
  let expiresAt = null;
  if (b.expiresAt !== undefined) {
    expiresAt = typeof b.expiresAt === 'string' ? new Date(b.expiresAt) : new Date(NaN);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) throw new ValidationError('expiresAt debe ser una fecha futura', ['expiresAt']);
  }
  return { granteeUserId: hasUser ? b.granteeUserId : null, granteeDependency: hasDep ? b.granteeDependency : null, level: b.level, expiresAt };
}

module.exports = { SERVER_OWNED, CHANNELS, CONFIDENTIALITY, REQUEST_TYPES, ValidationError, validateRequestCreate, validateCitizenCreate, validateIdempotencyKey, validateRequestUpdate, validateTransitionInput, validateGrantCreate, OBJECT_ID, DEP };
