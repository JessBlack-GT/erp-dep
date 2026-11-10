'use strict';
/** Semilla SINTÉTICA común a todas las implementaciones (ninguna persona real). */
const fx = require('../../../src/modules/municipal/mocks/fixtures');

const NOW = new Date('2026-10-01T15:00:00Z');

function contractSeed() {
  return {
    municipalities: fx.MUNICIPALITIES.map((m) => ({ ...m })),
    dependencies: fx.buildDependencies(),
    citizens: fx.buildCitizens(),
    memberships: fx.buildMemberships(NOW).map((m) => ({ ...m, version: 0 })),
    grants: [],
  };
}

const A = fx.MUNICIPALITIES[0].id; // SJH
const B = fx.MUNICIPALITIES[1].id; // ZZZ (aislamiento)
const OBP_A = fx.buildDependencies().find((d) => d.code === 'OBP' && d.municipalityId === A).id;
const OBP_B = fx.buildDependencies().find((d) => d.code === 'OBP' && d.municipalityId === B).id;

let n = 0;
/** Expediente mínimo con la forma que escribe el servicio. */
function requestDoc(store, { municipalityId = A, sequence = 1, code = 'SJH', createdBy = fx.USERS.u_op_obp, key, ...extra } = {}) {
  n += 1;
  return {
    id: store.newId(), municipalityId, folio: `${code}-OBP-SOL-2026-${String(sequence).padStart(6, '0')}`,
    type: 'SOL', subject: 'Solicitud sintética de contrato', description: '', citizenId: fx.oid(400),
    ownerDependencyId: municipalityId === A ? OBP_A : OBP_B, assignedDependencyIds: [], assignedUserId: null,
    confidentiality: 'PUBLICA', channel: 'PRESENCIAL', status: 'REGISTRADA', version: 0,
    history: [{ at: NOW, actorId: createdBy, action: 'REGISTRAR', fromStatus: null, toStatus: 'REGISTRADA' }],
    createdBy, createdAt: NOW, updatedAt: NOW, idempotencyKey: key || `contract-key-${n}`, payloadHash: 'h', ...extra,
  };
}

const auditEvent = (municipalityId, action, extra = {}) => ({
  at: NOW, actorId: fx.USERS.u_op_obp, membershipId: null, municipalityId, action, entity: 'Request', result: 'success',
  ip: null, requestId: null, entityId: null, folio: null, ...extra,
});

module.exports = { contractSeed, requestDoc, auditEvent, A, B, OBP_A, OBP_B, NOW, fx };
