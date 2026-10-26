// @ts-check
'use strict';
/**
 * Ciclo de vida y seguimiento de solicitudes (RQ02). Cada acción produce una entrada de historial
 * inmutable con actor, fecha y estados de origen/destino. Función pura: no muta la solicitud.
 */
const STATUSES = Object.freeze(['REGISTRADA', 'EN_TRAMITE', 'EN_ESPERA_CIUDADANO', 'CERRADA', 'CANCELADA']);

/** acción → { permiso, desde: estados válidos, hacia: estado resultante (null = sin cambio) } */
const ACTIONS = Object.freeze({
  TURNAR: { permission: 'municipal.requests.assign', from: ['REGISTRADA', 'EN_TRAMITE'], to: 'EN_TRAMITE' },
  ASIGNAR: { permission: 'municipal.requests.assignUser', from: ['REGISTRADA', 'EN_TRAMITE', 'EN_ESPERA_CIUDADANO'], to: null },
  ESPERAR_CIUDADANO: { permission: 'municipal.requests.update', from: ['EN_TRAMITE'], to: 'EN_ESPERA_CIUDADANO' },
  REANUDAR: { permission: 'municipal.requests.update', from: ['EN_ESPERA_CIUDADANO'], to: 'EN_TRAMITE' },
  CERRAR: { permission: 'municipal.requests.close', from: ['EN_TRAMITE', 'EN_ESPERA_CIUDADANO'], to: 'CERRADA' },
  CANCELAR: { permission: 'municipal.requests.cancel', from: ['REGISTRADA', 'EN_TRAMITE', 'EN_ESPERA_CIUDADANO'], to: 'CANCELADA' },
});

class TransitionError extends Error {
  /** @param {string} message @param {'VALIDATION_ERROR'|'INVALID_TRANSITION'|'CONFLICT'} code */
  constructor(message, code) {
    super(message);
    this.code = code;
    this.statusCode = code === 'VALIDATION_ERROR' ? 400 : 409;
  }
}

/**
 * @param {{ status: string, version: number, ownerDependencyId: string, assignedDependencyIds?: string[],
 *   assignedUserId?: string|null, history?: object[] }} request
 * @param {{ action: string, version: number, toDependencies?: string[], assignedUserId?: string, note?: string }} input
 * @param {{ actorId: string, at: Date, validDependencyIds: string[] }} env
 */
function applyTransition(request, input, env) {
  const rule = ACTIONS[input && input.action];
  if (!rule) throw new TransitionError('Acción no reconocida', 'VALIDATION_ERROR');
  if (!env || typeof env.actorId !== 'string' || !env.actorId || !(env.at instanceof Date))
    throw new TypeError('Actor y fecha son obligatorios');
  if (input.version !== request.version) throw new TransitionError('La solicitud cambió; recargue', 'CONFLICT');
  if (!rule.from.includes(request.status))
    throw new TransitionError(`No se puede ${input.action} desde ${request.status}`, 'INVALID_TRANSITION');

  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (['CERRAR', 'CANCELAR'].includes(input.action) && note.length < 5)
    throw new TransitionError('La nota es obligatoria (mínimo 5 caracteres)', 'VALIDATION_ERROR');
  if (note.length > 2000) throw new TransitionError('Nota demasiado larga', 'VALIDATION_ERROR');

  const next = {
    assignedDependencyIds: [...(request.assignedDependencyIds || [])],
    assignedUserId: request.assignedUserId || null,
  };
  /** @type {Record<string, any>} */
  const entry = { at: new Date(env.at.getTime()), actorId: env.actorId, action: input.action, fromStatus: request.status };

  if (input.action === 'TURNAR') {
    const deps = input.toDependencies;
    if (!Array.isArray(deps) || deps.length < 1 || deps.length > 10 || new Set(deps).size !== deps.length)
      throw new TransitionError('Indique de 1 a 10 dependencias distintas', 'VALIDATION_ERROR');
    if (deps.some((d) => !env.validDependencyIds.includes(d)))
      throw new TransitionError('Dependencia inexistente o de otro municipio', 'VALIDATION_ERROR');
    next.assignedDependencyIds = deps.filter((d) => d !== request.ownerDependencyId);
    next.assignedUserId = input.assignedUserId || null;
    entry.toDependencyIds = [...deps];
  }
  if (input.action === 'ASIGNAR') {
    if (typeof input.assignedUserId !== 'string' || !input.assignedUserId)
      throw new TransitionError('Indique el usuario responsable', 'VALIDATION_ERROR');
    next.assignedUserId = input.assignedUserId;
  }
  if (next.assignedUserId) entry.assignedUserId = next.assignedUserId;

  const toStatus =
    rule.to || (input.action === 'ASIGNAR' && request.status === 'REGISTRADA' ? 'EN_TRAMITE' : request.status);
  entry.toStatus = toStatus;
  if (note) entry.note = note;

  return {
    status: toStatus,
    version: request.version + 1,
    assignedDependencyIds: next.assignedDependencyIds,
    assignedUserId: next.assignedUserId,
    history: [...(request.history || []), Object.freeze(entry)],
    entry: Object.freeze({ ...entry }),
  };
}

/** Entrada inicial al registrar (RQ02: también el registro conserva actor, fecha y estado). */
function registrationEntry(actorId, at) {
  return Object.freeze({ at: new Date(at.getTime()), actorId, action: 'REGISTRAR', fromStatus: null, toStatus: 'REGISTRADA' });
}

module.exports = { STATUSES, ACTIONS, TransitionError, applyTransition, registrationEntry };
