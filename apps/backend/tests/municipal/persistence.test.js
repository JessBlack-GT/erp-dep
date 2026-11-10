'use strict';
/** F1-05: forma del puerto, guardia de QA y compatibilidad del servicio con el puerto asíncrono. */
const assert = require('assert');
const { assertRepositoryPort, allOperations, PORT_OPERATIONS } = require('../../src/modules/municipal/persistence/repository-port');
const { checkQaPersistence, databaseInUri } = require('../../src/modules/municipal/persistence/qa-guard');
const { createMemoryStore } = require('../../src/modules/municipal/mocks/in-memory-store');
const { createMemoryStorage } = require('../../src/modules/municipal/storage/memory-storage');
const { createMunicipalService } = require('../../src/modules/municipal/application/municipal.service');
const { scenario, rejects } = require('./helpers');

const NOW = new Date('2026-11-10T12:00:00Z');
const OK_ENV = {
  NODE_ENV: 'test', MUNICIPAL_STORE: 'mongo', MUNICIPAL_QA_DATABASE: 'munierp_qa',
  MUNICIPAL_QA_URI: 'mongodb+srv://qa-cluster.example.net/munierp_qa?retryWrites=true',
  MUNICIPAL_QA_AUTHORIZED: '2026-11-10|Responsable QA municipal|munierp_qa',
};

describe('F1-05 paso 1 — puerto asíncrono', () => {
  it('el almacén en memoria implementa todas las operaciones y devuelve promesas', async () => {
    const store = assertRepositoryPort(createMemoryStore({ municipalities: [{ id: 'm1', code: 'SJH' }] }));
    for (const op of Object.values(PORT_OPERATIONS).flat().filter((o) => o !== 'transaction')) {
      const r = (() => { try { return store[op]('m1', 0, {}); } catch (e) { return e; } })();
      assert.ok(r && typeof r.then === 'function', `${op} debe devolver una promesa`);
      await r.catch(() => {});
    }
    assert.strictEqual(typeof store.newId(), 'string');
  });

  it('el servicio rechaza un almacén que no cumple el puerto', () => {
    assert.throws(() => createMunicipalService({ store: { municipalityByCode() {} }, storage: createMemoryStorage() }), /no implementa el puerto/);
    assert.ok(allOperations().includes('updateDocumentStatus'));
  });

  it('el servicio funciona con un almacén que responde de forma diferida (como la red)', async () => {
    const s = scenario();
    const slow = {};
    for (const op of allOperations()) {
      if (op === 'newId') slow.newId = () => s.store.newId();
      else if (op === 'transaction') slow.transaction = (fn) => s.store.transaction(fn);
      else slow[op] = async (...a) => { await new Promise((r) => setImmediate(r)); return s.store[op](...a); };
    }
    const service = createMunicipalService({ store: slow, storage: createMemoryStorage(), clock: s.clock });
    const r = await service.createRequest(s.ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key());
    assert.strictEqual(r.status, 201);
    assert.strictEqual((await service.getRequest(s.ctx('u_op_obp'), 'SJH', r.data.folio)).folio, r.data.folio);
  });

  it('cada escritura de negocio y su bitácora se confirman juntas: un fallo de bitácora deja todo intacto', async () => {
    const s = scenario();
    const down = new Error('bitácora no disponible');
    s.store.testing.failNext('appendAudit', down);
    await assert.rejects(() => s.service.createCitizen(s.ctx('u_vent'), 'SJH', { fullName: 'Ciudadano Sintético Nuevo', locality: 'Prueba' }), (e) => e === down);
    assert.ok(!(await s.store.citizens(s.munId('SJH'))).some((c) => c.fullName === 'Ciudadano Sintético Nuevo'));
    s.store.testing.failNext('appendAudit', down);
    await assert.rejects(() => s.service.createRequest(s.ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key()), (e) => e === down);
    assert.strictEqual(s.store.testing.allRequests().length, 0);
    assert.strictEqual(s.store.testing.counter('SJH:OBP:SOL:2026'), 0);
  });

  it('documento: si el binario falla queda PENDIENTE, no se lista ni se descarga ni deja bitácora de alta', async () => {
    const s = scenario();
    const r = await s.service.createRequest(s.ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key());
    const failing = { put: async () => { throw new Error('almacenamiento no disponible'); }, get: async () => Buffer.alloc(0) };
    const service = createMunicipalService({ store: s.store, storage: failing, clock: s.clock });
    const PDF64 = Buffer.from('%PDF-1.4\n% sintetico\n').toString('base64');
    await assert.rejects(() => service.uploadDocument(s.ctx('u_op_obp'), 'SJH', r.data.folio, { filename: 'a.pdf', mimeType: 'application/pdf', contentBase64: PDF64 }), /almacenamiento no disponible/);
    const docs = s.store.testing.documents();
    assert.strictEqual(docs.length, 1);
    assert.strictEqual(docs[0].status, 'PENDIENTE');
    assert.deepStrictEqual(await s.service.listDocuments(s.ctx('u_op_obp'), 'SJH', r.data.folio), []);
    await rejects(() => s.service.downloadDocument(s.ctx('u_op_obp'), 'SJH', r.data.folio, docs[0].id), 404, 'NOT_FOUND');
    assert.ok(!s.store.testing.auditEvents().some((e) => e.action === 'DOCUMENT_UPLOADED'));
  });

  it('dos revocaciones simultáneas de la misma concesión: una 204 lógica y la otra 404', async () => {
    const s = scenario();
    const r = await s.service.createRequest(s.ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key());
    const g = await s.service.createGrant(s.ctx('u_tit_obp'), 'SJH', r.data.folio, { granteeUserId: s.fx.USERS.u_op_tes, level: 'READ' });
    const results = await Promise.allSettled([1, 2].map(() => s.service.revokeGrant(s.ctx('u_tit_obp'), 'SJH', r.data.folio, g.id)));
    assert.strictEqual(results.filter((x) => x.status === 'fulfilled').length, 1);
    assert.strictEqual(results.find((x) => x.status === 'rejected').reason.statusCode, 404);
    assert.strictEqual(s.store.testing.auditEvents().filter((e) => e.action === 'GRANT_REVOKED').length, 1);
  });
});

describe('F1-05 — guardia de persistencia QA (sin conexión)', () => {
  it('autoriza solo con todas las condiciones', () => {
    assert.deepStrictEqual(checkQaPersistence(OK_ENV, { now: NOW }), { allowed: true, reasons: [] });
  });
  it('por defecto (sin variables) rechaza: el módulo sigue en memoria', () => {
    const v = checkQaPersistence({}, { now: NOW });
    assert.strictEqual(v.allowed, false);
    assert.ok(v.reasons.length >= 4);
  });
  for (const [name, patch, pattern] of [
    ['producción', { NODE_ENV: 'production' }, /production/],
    ['otra base', { MUNICIPAL_QA_DATABASE: 'erp_sales_test' }, /munierp_qa/],
    ['URI a otra base', { MUNICIPAL_QA_URI: 'mongodb://h:27017/erp_sales_test' }, /otra base/],
    ['autorización sin formato', { MUNICIPAL_QA_AUTHORIZED: 'si' }, /formato/],
    ['autorización futura', { MUNICIPAL_QA_AUTHORIZED: '2026-12-01|Responsable QA|munierp_qa' }, /futura/],
    ['autorización de otra base', { MUNICIPAL_QA_AUTHORIZED: '2026-11-10|Responsable QA|erp_sales_test' }, /no corresponde/],
    ['base compartida con M03', { M03_QA_DATABASE: 'munierp_qa' }, /M03_QA_DATABASE/],
    ['autorización reutilizada de M07', { M07_QA_AUTHORIZED: OK_ENV.MUNICIPAL_QA_AUTHORIZED }, /M07_QA_AUTHORIZED/],
    ['almacén memoria', { MUNICIPAL_STORE: 'memory' }, /MUNICIPAL_STORE/],
  ]) {
    it(`rechaza: ${name}`, () => {
      const v = checkQaPersistence({ ...OK_ENV, ...patch }, { now: NOW });
      assert.strictEqual(v.allowed, false);
      assert.ok(v.reasons.some((r) => pattern.test(r)), v.reasons.join(' | '));
    });
  }
  it('lee la base de la URI sin revelar credenciales', () => {
    assert.strictEqual(databaseInUri('mongodb+srv://usuario:secreto@h.example.net/munierp_qa?x=1'), 'munierp_qa');
    assert.strictEqual(databaseInUri('mongodb://h:27017'), null);
  });
});
