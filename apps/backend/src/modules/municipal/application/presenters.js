// @ts-check
'use strict';
/**
 * Presentadores: convierten documentos internos en los DTO del contrato municipal-v1.
 * Lista blanca explícita de campos: nada interno (IDs de dependencia, storageKey, idempotencyKey,
 * payloadHash, createdBy, municipalityId) sale por la API.
 */
const { permissionsOf } = require('../policy/permissions');

const iso = (d) => (d instanceof Date ? d.toISOString() : d == null ? undefined : new Date(d).toISOString());
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** @param {(id: string) => string|null} depCode */
function historyEntry(h, depCode) {
  return compact({
    at: iso(h.at),
    actorId: h.actorId,
    action: h.action,
    fromStatus: h.fromStatus ?? null,
    toStatus: h.toStatus,
    assignedUserId: h.assignedUserId || undefined,
    toDependencies: h.toDependencyIds ? h.toDependencyIds.map(depCode) : undefined,
    note: h.note || undefined,
    fields: h.fields ? [...h.fields] : undefined,
  });
}

/** @param {Record<string, any>} r @param {(id: string) => string|null} depCode */
function requestSummary(r, depCode) {
  return compact({
    folio: r.folio,
    type: r.type,
    status: r.status,
    ownerDependency: depCode(r.ownerDependencyId),
    assignedDependencies: (r.assignedDependencyIds || []).map(depCode),
    confidentiality: r.confidentiality,
    channel: r.channel,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  });
}

function citizen(c) {
  return c ? compact({ id: c.id, fullName: c.fullName, email: c.email, phone: c.phone, locality: c.locality }) : undefined;
}

/** @param {Record<string, any>} r @param {(id: string) => string|null} depCode @param {any} citizenDoc */
function requestFull(r, depCode, citizenDoc) {
  return compact({
    ...requestSummary(r, depCode),
    subject: r.subject,
    description: r.description,
    citizen: citizen(citizenDoc),
    assignedUserId: r.assignedUserId || null,
    version: r.version,
    history: (r.history || []).map((h) => historyEntry(h, depCode)),
  });
}

function dependency(d, parentCode) {
  return { code: d.code, name: d.name, parentCode: parentCode || null, status: d.status };
}

function document(d) {
  return compact({
    id: d.id, folio: d.folio, filename: d.filename, mimeType: d.mimeType, size: d.size, sha256: d.sha256,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy, uploadedAt: iso(d.uploadedAt),
  });
}

function myMembership(m, municipality, depCodes) {
  return {
    id: m.id,
    municipality: { code: municipality.code, name: municipality.name },
    role: m.role,
    dependencies: depCodes,
    permissions: permissionsOf(m.role),
    validTo: m.validTo ? iso(m.validTo) : null,
  };
}

function membership(m, depCodes, effective) {
  return {
    id: m.id,
    userId: m.userId,
    role: m.role,
    dependencies: depCodes,
    status: m.status,
    validFrom: iso(m.validFrom),
    validTo: m.validTo ? iso(m.validTo) : null,
    effective,
  };
}

function auditEvent(e) {
  return compact({
    at: iso(e.at), actorId: e.actorId, action: e.action, entity: e.entity, entityId: e.entityId || undefined,
    folio: e.folio || undefined, result: e.result, ip: e.ip || undefined, requestId: e.requestId || undefined,
  });
}

module.exports = { iso, historyEntry, requestSummary, requestFull, citizen, dependency, document, myMembership, membership, auditEvent };
