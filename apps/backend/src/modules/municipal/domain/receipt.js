// @ts-check
'use strict';
/**
 * Acuse de solicitud para el canal presencial (ADR-12, RQ06). Contiene solo lo necesario para que
 * el ciudadano dé seguimiento: nunca datos de contacto, descripción ni documentos.
 */
const STATUS_LABELS = Object.freeze({
  REGISTRADA: 'Registrada',
  EN_TRAMITE: 'En trámite',
  EN_ESPERA_CIUDADANO: 'En espera de información del ciudadano',
  CERRADA: 'Concluida',
  CANCELADA: 'Cancelada',
});

/**
 * @param {{ folio: string, subject: string, status: string, ownerDependencyId: string, channel: string, createdAt: Date }} request
 * @param {{ municipalityName: string, dependencyName: string }} names
 */
function buildReceipt(request, names) {
  return {
    folio: request.folio,
    municipality: names.municipalityName,
    dependency: names.dependencyName,
    subject: request.subject,
    status: request.status,
    statusLabel: STATUS_LABELS[request.status] || request.status,
    channel: request.channel,
    registeredAt: request.createdAt.toISOString(),
    instructions: 'Conserve este folio para consultar el estado de su solicitud en ventanilla.',
  };
}

module.exports = { STATUS_LABELS, buildReceipt };
