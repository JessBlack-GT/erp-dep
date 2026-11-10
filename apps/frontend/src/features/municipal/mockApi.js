/**
 * MuniERP IA — API simulada para el prototipo de interfaz. SIN RED y con datos 100 % SINTÉTICOS.
 * Respeta las formas de respuesta del contrato municipal-v1 (draft.1). Se sustituirá por
 * `municipalApi` (apiClient del ERP con base /api/municipal/v1) cuando Codex monte la API (C-01).
 * La autorización real vive en el servidor; este mock no la simula.
 */

export const MOCK_PERMISSIONS = Object.freeze([
  'municipal.dependencies.read', 'municipal.memberships.read', 'municipal.citizens.read', 'municipal.requests.create',
  'municipal.requests.read', 'municipal.requests.assign', 'municipal.requests.cancel', 'municipal.requests.grant',
  'municipal.requests.readConfidential', 'municipal.documents.read', 'municipal.indicators.read',
]);

const DEPENDENCIES = [
  { code: 'OBP', name: 'Obras Públicas', status: 'ACTIVA' },
  { code: 'TES', name: 'Tesorería', status: 'ACTIVA' },
  { code: 'AGP', name: 'Agua Potable', status: 'ACTIVA' },
  { code: 'RCI', name: 'Registro Civil', status: 'ACTIVA' },
];

const CITIZENS = [
  { id: '000000000000000000000190', fullName: 'Ciudadano Sintético 001' },
  { id: '000000000000000000000191', fullName: 'Ciudadano Sintético 002' },
];

function seedRequests() {
  return [
    { folio: 'SJH-OBP-SOL-2026-000001', type: 'SOL', status: 'EN_TRAMITE', ownerDependency: 'OBP', assignedDependencies: [], confidentiality: 'PUBLICA', channel: 'PRESENCIAL', subject: 'Reparación de luminaria (dato de prueba)', createdAt: '2026-10-05T16:00:00.000Z' },
    { folio: 'SJH-OBP-SOL-2026-000002', type: 'SOL', status: 'REGISTRADA', ownerDependency: 'OBP', assignedDependencies: [], confidentiality: 'PUBLICA', channel: 'TELEFONO', subject: 'Bache en calle de prueba', createdAt: '2026-10-20T15:00:00.000Z' },
    { folio: 'SJH-TES-SOL-2026-000001', type: 'SOL', status: 'CERRADA', ownerDependency: 'TES', assignedDependencies: [], confidentiality: 'PUBLICA', channel: 'PRESENCIAL', subject: 'Aclaración de recibo (dato de prueba)', createdAt: '2026-10-02T17:00:00.000Z' },
  ];
}

export function createMockMunicipalApi({ delayMs = 0 } = {}) {
  const requests = seedRequests();
  const byKey = new Map();
  const seq = {};
  const wait = (v) => new Promise((resolve) => setTimeout(() => resolve(v), delayMs));

  return {
    isMock: true,
    // Permisos = matriz real de SUPERVISOR_MUNICIPAL (una prueba de paridad lo verifica contra el backend).
    myMemberships: () => wait([{ id: 'mock', municipality: { code: 'SJH', name: 'San Juan Huactzinco' }, role: 'SUPERVISOR_MUNICIPAL', dependencies: ['PRE'], permissions: [...MOCK_PERMISSIONS] }]),
    listDependencies: () => wait(DEPENDENCIES.map((d) => ({ ...d }))),
    searchCitizens: () => wait(CITIZENS.map((c) => ({ ...c }))),
    listRequests: ({ status } = {}) => wait({ items: requests.filter((r) => !status || r.status === status).map((r) => ({ ...r })), pagination: { page: 1, limit: 20, total: requests.length, pages: 1 } }),
    getIndicators: () => {
      const byStatus = { REGISTRADA: 0, EN_TRAMITE: 0, EN_ESPERA_CIUDADANO: 0, CERRADA: 0, CANCELADA: 0 };
      requests.forEach((r) => { byStatus[r.status] += 1; });
      const open = byStatus.REGISTRADA + byStatus.EN_TRAMITE + byStatus.EN_ESPERA_CIUDADANO;
      // Coherente con el contrato: sin concluidas no hay promedio; con concluidas se usa un valor
      // SINTÉTICO fijo (la API real lo calcula en domain/indicators.js).
      return wait({ total: requests.length, open, closedInPeriod: byStatus.CERRADA, overdueOpen: 0, avgResolutionDays: byStatus.CERRADA ? 4 : null, byStatus, byDependency: {}, byChannel: {} });
    },
    createRequest: (body, idempotencyKey) => {
      if (!idempotencyKey) return Promise.reject(Object.assign(new Error('Idempotency-Key obligatoria'), { status: 400 }));
      if (byKey.has(idempotencyKey)) return wait({ status: 200, data: { ...byKey.get(idempotencyKey) } });
      seq[body.ownerDependency] = (seq[body.ownerDependency] || requests.filter((r) => r.ownerDependency === body.ownerDependency).length) + 1;
      const created = {
        folio: `SJH-${body.ownerDependency}-SOL-2026-${String(seq[body.ownerDependency]).padStart(6, '0')}`,
        type: 'SOL', status: 'REGISTRADA', ownerDependency: body.ownerDependency, assignedDependencies: [],
        confidentiality: body.confidentiality || 'PUBLICA', channel: body.channel, subject: body.subject.trim(), createdAt: new Date().toISOString(),
      };
      requests.unshift(created);
      byKey.set(idempotencyKey, created);
      return wait({ status: 201, data: { ...created } });
    },
    getRequest: (folio) => {
      const r = requests.find((x) => x.folio === folio);
      if (!r) return Promise.reject(Object.assign(new Error('No encontrado'), { status: 404, code: 'NOT_FOUND' }));
      return wait({ data: { ...r, description: '', citizen: { id: CITIZENS[0].id, fullName: CITIZENS[0].fullName }, assignedUserId: null, version: 0, history: [] } });
    },
    getRequestHistory: (folio) => {
      const r = requests.find((x) => x.folio === folio);
      if (!r) return Promise.reject(Object.assign(new Error('No encontrado'), { status: 404, code: 'NOT_FOUND' }));
      return wait([{ at: r.createdAt, actorId: '000000000000000000000209', action: 'REGISTRAR', fromStatus: null, toStatus: 'REGISTRADA' }]);
    },
    listDocuments: () => wait([]),
    listMemberships: () => wait([]),
    // La persona del mock básico es SUPERVISOR_MUNICIPAL, que no tiene municipal.audit.read: igual que el servidor, 403.
    listAuditEvents: () => Promise.reject(Object.assign(new Error('Sin permisos municipales suficientes'), { status: 403, code: 'FORBIDDEN' })),
    transitionRequest: () => Promise.reject(Object.assign(new Error('La API simulada básica no registra transiciones'), { status: 403, code: 'FORBIDDEN' })),
    downloadDocument: () => Promise.reject(Object.assign(new Error('No encontrado'), { status: 404, code: 'NOT_FOUND' })),
    getReceipt: (folio) => {
      const r = requests.find((x) => x.folio === folio);
      if (!r) return Promise.reject(Object.assign(new Error('No encontrado'), { status: 404 }));
      const dep = DEPENDENCIES.find((d) => d.code === r.ownerDependency);
      return wait({ folio: r.folio, municipality: 'San Juan Huactzinco', dependency: dep ? dep.name : r.ownerDependency, subject: r.subject, status: r.status, channel: r.channel, registeredAt: r.createdAt, instructions: 'Conserve este folio para consultar el estado de su solicitud en ventanilla.' });
    },
  };
}
