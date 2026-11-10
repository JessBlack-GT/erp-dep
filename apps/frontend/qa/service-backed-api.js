/**
 * MuniERP IA — API SIMULADA respaldada por el SERVICIO MUNICIPAL REAL (QA, F1-13).
 *
 * Ejecuta `createMunicipalService` del backend con su política de acceso, almacén EN MEMORIA y datos
 * SINTÉTICOS, dentro del navegador (arnés Playwright) o de Jest. No hay HTTP, JWT, Express ni MongoDB:
 * la identidad se fija con `persona` (equivale al `req.user.id` que dejaría la identidad central).
 * Así la autorización (membresía, dependencia, expediente, confidencialidad, revocación) es la del
 * servidor real, sin duplicarla en la interfaz.
 */
import fx from '../../backend/src/modules/municipal/mocks/fixtures';
import { createMemoryStore } from '../../backend/src/modules/municipal/mocks/in-memory-store';
import { createMemoryStorage } from '../../backend/src/modules/municipal/storage/memory-storage';
import { createMunicipalService } from '../../backend/src/modules/municipal/application/municipal.service';
import { buildAccessContext } from '../../backend/src/modules/municipal/policy/context';

export const SERVICE_BACKED_LABEL =
  'API simulada en el navegador: servicio municipal real con almacén en memoria y datos sintéticos (sin HTTP, sin JWT, sin MongoDB).';

const PDF = (text) => {
  const bytes = new TextEncoder().encode(`%PDF-1.4\n% ${text}\n`);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
};

const toApiError = (e) => Object.assign(new Error(e && e.message ? e.message : 'Error'), { status: (e && e.statusCode) || 500, code: (e && e.code) || 'INTERNAL_ERROR' });

/**
 * Crea un "mundo" sintético sembrado con expedientes, historial y documentos mediante el propio servicio.
 * @param {{ save?: (result: { buffer: any, headers: object }, filename: string) => void }} options
 */
export async function createServiceBackedWorld({ save } = {}) {
  let now = new Date('2026-10-05T16:00:00Z');
  const clock = () => new Date(now.getTime());
  const tick = (hours = 3) => { now = new Date(now.getTime() + hours * 3600000); };
  const memberships = fx.buildMemberships(new Date('2026-10-01T15:00:00Z'));
  const store = createMemoryStore({ municipalities: fx.MUNICIPALITIES, dependencies: fx.buildDependencies(), citizens: fx.buildCitizens(), memberships });
  const service = createMunicipalService({ store, storage: createMemoryStorage(), clock, userLookup: async (id) => (Object.values(fx.USERS).includes(id) ? { id } : null) });
  const SJH = fx.MUNICIPALITIES[0].id;
  const ctx = (userKey, munId = SJH) =>
    buildAccessContext({ erpAccess: { id: fx.USERS[userKey] }, memberships: store.membershipsOf(fx.USERS[userKey]), grants: store.grantsFor(munId), municipalityId: munId, now: clock() });
  let n = 0;
  const create = async (user, dep, subject, extra = {}, mun = 'SJH', munId = SJH, citizen = 0) => {
    tick(1);
    const r = await service.createRequest(ctx(user, munId), mun, { type: 'SOL', ownerDependency: dep, subject, citizenId: fx.oid(400 + citizen), channel: 'PRESENCIAL', ...extra }, `seed-key-${++n}-qa`);
    return r.data;
  };
  const move = async (user, folio, body) => { tick(); return service.transition(ctx(user), 'SJH', folio, body); };

  // R1: en trámite, asignado, con un documento público y uno confidencial.
  const r1 = await create('u_op_obp', 'OBP', 'Reparación de luminaria en calle sintética', { description: 'Luminaria apagada frente al número 10 (dato de prueba).' });
  await move('u_tit_obp', r1.folio, { action: 'TURNAR', version: 0, toDependencies: ['OBP'], note: 'Se atiende en Obras' });
  await move('u_tit_obp', r1.folio, { action: 'ASIGNAR', version: 1, assignedUserId: fx.USERS.u_op_obp });
  tick(); await service.uploadDocument(ctx('u_op_obp'), 'SJH', r1.folio, { filename: 'Oficio de inspección.pdf', mimeType: 'application/pdf', contentBase64: PDF('oficio sintetico') });
  tick(); await service.uploadDocument(ctx('u_tit_obp'), 'SJH', r1.folio, { filename: 'Dictamen interno.pdf', mimeType: 'application/pdf', contentBase64: PDF('dictamen sintetico'), confidentiality: 'CONFIDENCIAL' });
  // R2: registrada, sin documentos.
  const r2 = await create('u_vent', 'OBP', 'Bache en calle de prueba', { channel: 'TELEFONO' });
  // R3: concluida con nota.
  const r3 = await create('u_tit_obp', 'OBP', 'Poda de árbol (prueba)');
  await move('u_tit_obp', r3.folio, { action: 'TURNAR', version: 0, toDependencies: ['OBP'] });
  await move('u_tit_obp', r3.folio, { action: 'CERRAR', version: 1, note: 'Atendida en sitio por cuadrilla' });
  // R4: Tesorería, cancelada por supervisión.
  const r4 = await create('u_op_tes', 'TES', 'Aclaración de recibo (prueba)');
  await move('u_sup', r4.folio, { action: 'CANCELAR', version: 0, note: 'Duplicada de otra solicitud' });
  // R5: DIF confidencial.
  const r5 = await create('u_tit_dif', 'DIF', 'Seguimiento confidencial (prueba)', { confidentiality: 'CONFIDENCIAL' });
  // Z1: otro municipio (aislamiento).
  const z1 = await create('u_zzz_tit_obp', 'OBP', 'Solicitud de otro municipio', {}, 'ZZZ', fx.MUNICIPALITIES[1].id, 11);

  const folios = { r1: r1.folio, r2: r2.folio, r3: r3.folio, r4: r4.folio, r5: r5.folio, z1: z1.folio };

  function apiFor(persona, { latencyMs = 0, failFirst = null } = {}) {
    const failed = new Set();
    const wrap = (name, fn) => async (...args) => {
      if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs));
      if (failFirst && failFirst.includes(name) && !failed.has(name)) {
        failed.add(name);
        throw Object.assign(new Error('Red simulada'), { status: 0, code: 'NETWORK_ERROR' });
      }
      try { return await fn(...args); } catch (e) { throw toApiError(e); }
    };
    const c = () => ctx(persona);
    return {
      isMock: true,
      mockLabel: SERVICE_BACKED_LABEL,
      persona,
      myMemberships: wrap('myMemberships', () => service.myMemberships(fx.USERS[persona])),
      listDependencies: wrap('listDependencies', () => service.listDependencies(c(), 'SJH', { status: 'ACTIVA' })),
      searchCitizens: wrap('searchCitizens', () => service.searchCitizens(c(), 'SJH', {}).items),
      listMemberships: wrap('listMemberships', (q = {}) => service.listMemberships(c(), 'SJH', q).items),
      listRequests: wrap('listRequests', (q = {}) => service.listRequests(c(), 'SJH', q)),
      getRequest: wrap('getRequest', (folio) => ({ data: service.getRequest(c(), 'SJH', folio, { ip: '127.0.0.1', requestId: 'qa-ui' }) })),
      getRequestHistory: wrap('getRequestHistory', (folio) => service.getHistory(c(), 'SJH', folio)),
      listDocuments: wrap('listDocuments', (folio) => service.listDocuments(c(), 'SJH', folio)),
      transitionRequest: wrap('transitionRequest', async (folio, body) => { tick(1); return service.transition(c(), 'SJH', folio, body, { ip: '127.0.0.1', requestId: 'qa-ui' }); }),
      getIndicators: wrap('getIndicators', () => service.indicators(c(), 'SJH', { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-11-01T00:00:00Z') })),
      createRequest: wrap('createRequest', (body, key) => { tick(1); return service.createRequest(c(), 'SJH', body, key, { ip: '127.0.0.1', requestId: 'qa-ui' }); }),
      getReceipt: wrap('getReceipt', (folio) => service.receipt(c(), 'SJH', folio)),
      downloadDocument: wrap('downloadDocument', async (folio, doc) => {
        const out = await service.downloadDocument(c(), 'SJH', folio, doc.id, { ip: '127.0.0.1', requestId: 'qa-ui' });
        if (save) save(out, doc.filename);
        return { saved: true };
      }),
    };
  }

  return { apiFor, folios, store, service, fx, revoke: (userKey) => {
    const m = store.membershipsOf(fx.USERS[userKey]).find((x) => x.municipalityId === SJH);
    if (m) store.updateMembership(m.id, m.version || 0, { status: 'INACTIVA' });
  } };
}
