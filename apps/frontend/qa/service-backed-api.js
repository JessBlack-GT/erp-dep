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
import { inspectPrivateDocument } from '../src/features/municipal/privateDocument';

export const SERVICE_BACKED_LABEL =
  'API simulada en el navegador: servicio municipal real con almacén en memoria y datos sintéticos (sin HTTP, sin JWT, sin MongoDB).';

const PDF = (text) => {
  const bytes = new TextEncoder().encode(`%PDF-1.4\n% ${text}\n`);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
};

// Igual que http/errors.js: los 5xx (salvo 503) se reducen a «Error interno»; los 4xx conservan mensaje y campos.
const toApiError = (e) => {
  // Errores del propio cliente (p. ej. el lector privado C-21: DOCUMENT_INTEGRITY) pasan sin cambios.
  if (e && e.name === 'PrivateDocumentError') return e;
  const status = (e && e.statusCode) || 500;
  if (status >= 500 && status !== 503) return Object.assign(new Error('Error interno'), { status: 500, code: 'INTERNAL_ERROR' });
  return Object.assign(new Error(e && e.message ? e.message : 'Error'), { status, code: (e && e.code) || 'VALIDATION_ERROR', fields: Array.isArray(e && e.fields) ? e.fields.map(String) : undefined });
};

/**
 * Crea un "mundo" sintético sembrado con expedientes, historial y documentos mediante el propio servicio.
 * @param {{ save?: (result: { bytes: Uint8Array, headers: object, info: { mimeType: string, filename: string } }, doc: object) => void }} options
 *   `save` recibe el contenido YA VERIFICADO por el lector privado (C-21); nunca el exportador comercial.
 */
export async function createServiceBackedWorld({ save, demo = false } = {}) {
  let now = new Date('2026-10-05T16:00:00Z');
  const clock = () => new Date(now.getTime());
  const tick = (hours = 3) => { now = new Date(now.getTime() + hours * 3600000); };
  const memberships = fx.buildMemberships(new Date('2026-10-01T15:00:00Z'));
  const store = createMemoryStore({ municipalities: fx.MUNICIPALITIES, dependencies: fx.buildDependencies(), citizens: fx.buildCitizens(), memberships });
  const service = createMunicipalService({ store, storage: createMemoryStorage(), clock, userLookup: async (id) => (Object.values(fx.USERS).includes(id) ? { id } : null) });
  const SJH = fx.MUNICIPALITIES[0].id;
  // Igual que la capa HTTP: membresías y concesiones se leen del puerto (asíncrono desde F1-05) en cada llamada.
  const ctx = async (userKey, munId = SJH) =>
    buildAccessContext({ erpAccess: { id: fx.USERS[userKey] }, memberships: await store.membershipsOf(fx.USERS[userKey]), grants: await store.grantsFor(munId), municipalityId: munId, now: clock() });
  let n = 0;
  const create = async (user, dep, subject, extra = {}, mun = 'SJH', munId = SJH, citizen = 0) => {
    tick(1);
    const r = await service.createRequest(await ctx(user, munId), mun, { type: 'SOL', ownerDependency: dep, subject, citizenId: fx.oid(400 + citizen), channel: 'PRESENCIAL', ...extra }, `seed-key-${++n}-qa`);
    return r.data;
  };
  const move = async (user, folio, body) => { tick(); return service.transition(await ctx(user), 'SJH', folio, body); };

  // R1: en trámite, asignado, con un documento público y uno confidencial.
  const r1 = await create('u_op_obp', 'OBP', 'Reparación de luminaria en calle sintética', { description: 'Luminaria apagada frente al número 10 (dato de prueba).' });
  await move('u_tit_obp', r1.folio, { action: 'TURNAR', version: 0, toDependencies: ['OBP'], note: 'Se atiende en Obras' });
  await move('u_tit_obp', r1.folio, { action: 'ASIGNAR', version: 1, assignedUserId: fx.USERS.u_op_obp });
  tick(); await service.uploadDocument(await ctx('u_op_obp'), 'SJH', r1.folio, { filename: 'Oficio de inspección.pdf', mimeType: 'application/pdf', contentBase64: PDF('oficio sintetico') });
  tick(); await service.uploadDocument(await ctx('u_tit_obp'), 'SJH', r1.folio, { filename: 'Dictamen interno.pdf', mimeType: 'application/pdf', contentBase64: PDF('dictamen sintetico'), confidentiality: 'CONFIDENCIAL' });
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
  // F1-14: un intento fuera de alcance registrado con IP y requestId SINTÉTICOS (la bitácora no debe mostrarlos).
  tick(); await service.getRequest(await ctx('u_op_tes'), 'SJH', r1.folio, { ip: '192.0.2.10', requestId: 'qa-seed-denegado' }).catch(() => {});

  const folios = { r1: r1.folio, r2: r2.folio, r3: r3.folio, r4: r4.folio, r5: r5.folio, z1: z1.folio };

  // Demostración (F1-15a): más expedientes en todos los estados, un documento de ejemplo no
  // confidencial y una alta de dependencia; todo con el servicio real (folios, historial,
  // indicadores y bitácora se generan solos y son coherentes). Las pruebas F1-13/F1-14 no lo usan.
  if (demo) {
    const r6 = await create('u_vent', 'OBP', 'Fuga de agua en vía pública (ejemplo)', { channel: 'PRESENCIAL' }, 'SJH', SJH, 1);
    await move('u_tit_obp', r6.folio, { action: 'TURNAR', version: 0, toDependencies: ['OBP'], note: 'Se envía cuadrilla' });
    await move('u_tit_obp', r6.folio, { action: 'ESPERAR_CIUDADANO', version: 1, note: 'Se solicita referencia del domicilio' });
    const r7 = await create('u_op_obp', 'OBP', 'Retiro de escombro (ejemplo)', { channel: 'TELEFONO' }, 'SJH', SJH, 2);
    await move('u_tit_obp', r7.folio, { action: 'TURNAR', version: 0, toDependencies: ['OBP'] });
    await move('u_tit_obp', r7.folio, { action: 'ASIGNAR', version: 1, assignedUserId: fx.USERS.u_op_obp });
    tick(); await service.uploadDocument(await ctx('u_op_obp'), 'SJH', r7.folio, { filename: 'Croquis de ubicación (ejemplo).pdf', mimeType: 'application/pdf', contentBase64: PDF('croquis de ejemplo') });
    const r8 = await create('u_tit_obp', 'OBP', 'Pintura de paso peatonal (ejemplo)', {}, 'SJH', SJH, 3);
    await move('u_tit_obp', r8.folio, { action: 'TURNAR', version: 0, toDependencies: ['OBP'] });
    await move('u_tit_obp', r8.folio, { action: 'CERRAR', version: 1, note: 'Trabajo concluido y verificado' });
    const r9 = await create('u_vent', 'DIF', 'Información de programas de apoyo (ejemplo)', { channel: 'PRESENCIAL' }, 'SJH', SJH, 4);
    const r10 = await create('u_vent', 'TES', 'Consulta de adeudo de predial (ejemplo)', { channel: 'TELEFONO' }, 'SJH', SJH, 5);
    tick(); await service.createDependency(await ctx('u_admin_mun'), 'SJH', { code: 'PCV', name: 'Protección Civil' }, { ip: '192.0.2.20', requestId: 'demo-seed' });
    Object.assign(folios, { r6: r6.folio, r7: r7.folio, r8: r8.folio, r9: r9.folio, r10: r10.folio });
  }

  function apiFor(persona, { latencyMs = 0, failFirst = null, tamperDocuments = false, mun = 'SJH' } = {}) {
    const failed = new Set();
    const wrap = (name, fn) => async (...args) => {
      if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs));
      if (failFirst && failFirst.includes(name) && !failed.has(name)) {
        failed.add(name);
        throw Object.assign(new Error('Red simulada'), { status: 0, code: 'NETWORK_ERROR' });
      }
      try { return await fn(...args); } catch (e) { throw toApiError(e); }
    };
    const munId = (fx.MUNICIPALITIES.find((m) => m.code === mun) || {}).id || SJH;
    const c = () => ctx(persona, munId);
    return {
      isMock: true,
      mockLabel: SERVICE_BACKED_LABEL,
      persona,
      myMemberships: wrap('myMemberships', () => service.myMemberships(fx.USERS[persona])),
      listDependencies: wrap('listDependencies', async (q = { status: 'ACTIVA' }) => service.listDependencies(await c(), mun, q)),
      createDependency: wrap('createDependency', async (body) => service.createDependency(await c(), mun, body, { ip: '127.0.0.1', requestId: 'qa-ui' })),
      updateDependency: wrap('updateDependency', async (code, body) => service.updateDependency(await c(), mun, code, body, { ip: '127.0.0.1', requestId: 'qa-ui' })),
      listMembershipPage: wrap('listMembershipPage', async (q = {}) => service.listMemberships(await c(), mun, q)),
      createMembership: wrap('createMembership', async (body) => service.createMembership(await c(), mun, body, { ip: '127.0.0.1', requestId: 'qa-ui' })),
      updateMembership: wrap('updateMembership', async (id, body) => service.updateMembership(await c(), mun, id, body, { ip: '127.0.0.1', requestId: 'qa-ui' })),
      searchCitizens: wrap('searchCitizens', async () => (await service.searchCitizens(await c(), mun, {})).items),
      createCitizen: wrap('createCitizen', async (body) => service.createCitizen(await c(), mun, body)),
      listMemberships: wrap('listMemberships', async (q = {}) => (await service.listMemberships(await c(), mun, q)).items),
      listRequests: wrap('listRequests', async (q = {}) => service.listRequests(await c(), mun, q)),
      getRequest: wrap('getRequest', async (folio) => ({ data: await service.getRequest(await c(), mun, folio, { ip: '127.0.0.1', requestId: 'qa-ui' }) })),
      getRequestHistory: wrap('getRequestHistory', async (folio) => service.getHistory(await c(), mun, folio)),
      listDocuments: wrap('listDocuments', async (folio) => service.listDocuments(await c(), mun, folio)),
      transitionRequest: wrap('transitionRequest', async (folio, body) => { tick(1); return service.transition(await c(), mun, folio, body, { ip: '127.0.0.1', requestId: 'qa-ui' }); }),
      getIndicators: wrap('getIndicators', async () => service.indicators(await c(), mun, { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-11-01T00:00:00Z') })),
      createRequest: wrap('createRequest', async (body, key) => { tick(1); return service.createRequest(await c(), mun, body, key, { ip: '127.0.0.1', requestId: 'qa-ui' }); }),
      // F1-14: el servicio aplica municipal.audit.read; `mun` permite probar el aislamiento (?mun=ZZZ).
      listAuditEvents: wrap('listAuditEvents', async (q = {}) => service.listAuditEvents(await c(), mun, {
        ...q, from: q.from ? new Date(q.from) : undefined, to: q.to ? new Date(q.to) : undefined,
      })),
      getReceipt: wrap('getReceipt', async (folio) => service.receipt(await c(), mun, folio)),
      downloadDocument: wrap('downloadDocument', async (folio, doc) => {
        const out = await service.downloadDocument(await c(), mun, folio, doc.id, { ip: '127.0.0.1', requestId: 'qa-ui' });
        // `tamperDocuments` (solo QA) simula contenido alterado en el transporte: el lector debe rechazarlo.
        const bytes = new Uint8Array(tamperDocuments ? Buffer.from('contenido-no-valido') : out.buffer);
        const info = inspectPrivateDocument(bytes, { contentType: out.headers['Content-Type'], doc, folio });
        if (save) save({ bytes, headers: out.headers, info }, doc);
        return { saved: true, filename: info.filename };
      }),
    };
  }

  return { apiFor, folios, store, service, fx, revoke: async (userKey) => {
    const m = (await store.membershipsOf(fx.USERS[userKey])).find((x) => x.municipalityId === SJH);
    if (m) await store.updateMembership(SJH, m.id, m.version || 0, { status: 'INACTIVA' });
  } };
}
