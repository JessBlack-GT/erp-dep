'use strict';
/**
 * F1-05 paso 3 — pruebas UNITARIAS del adaptador MongoDB con dobles controlados (sin base de datos).
 * Verifican la lógica del adaptador; NO aprueban transacciones, índices, aislamiento persistente ni
 * GridFS reales (casos L3 pendientes contra munierp_qa, C-05).
 */
const assert = require('assert');
const { createFakeMongo, labelled } = require('./support/fake-mongo');
const { createMongoStore, WRITE_INVENTORY } = require('../../src/modules/municipal/persistence/mongo/mongo-store');
const { createTransactionRunner, DEFAULT_TRANSACTION_OPTIONS } = require('../../src/modules/municipal/persistence/mongo/transaction-runner');
const { createGridFsStorage } = require('../../src/modules/municipal/persistence/mongo/gridfs-storage');
const { mapMongoError } = require('../../src/modules/municipal/persistence/mongo/errors');
const { INDEXES, UNIQUE_INDEX_ERRORS, collectionNames, MUNICIPAL_SCOPED } = require('../../src/modules/municipal/persistence/mongo/collections');
const { planSetup, verifySetup, applySetup, CONFIRMATION } = require('../../src/modules/municipal/persistence/mongo/setup-plan');
const { createMongoPersistence } = require('../../src/modules/municipal/persistence/mongo');
const { allOperations, UNSCOPED_OPERATIONS, assertRepositoryPort } = require('../../src/modules/municipal/persistence/repository-port');
const { createMunicipalService } = require('../../src/modules/municipal/application/municipal.service');
const { contractSeed, requestDoc, A, B, NOW, fx } = require('./repository-contract/seed');
const { scenario } = require('./helpers');

const code = async (p) => { try { await p; } catch (e) { return e.code; } return 'SIN_ERROR'; };

function setup(options = {}) {
  const fake = createFakeMongo(options);
  const seed = contractSeed();
  for (const logical of ['municipalities', 'dependencies', 'citizens', 'memberships', 'grants']) fake.seed(logical, seed[logical]);
  let seq = 0xb00000;
  const store = createMongoStore({ db: fake.db, runTransaction: createTransactionRunner(fake.client), newId: () => (seq++).toString(16).padStart(24, '0'), clock: () => NOW });
  return { fake, store };
}

describe('F1-05 paso 3 — adaptador MongoDB (dobles controlados; no certifica MongoDB)', () => {
  it('implementa el puerto completo y no expone borrados', () => {
    const { store } = setup();
    assertRepositoryPort(store);
    for (const op of Object.keys(store)) assert.ok(!/^(delete|remove|drop|purge|clear)/i.test(op), op);
  });

  describe('operaciones sin ámbito válido', () => {
    it('toda operación con municipio ausente falla con MISSING_MUNICIPALITY ANTES de llamar al controlador', async () => {
      const { fake, store } = setup();
      const probes = {
        dependencies: () => store.dependencies(undefined), insertDependency: () => store.insertDependency({ id: 'x' }),
        updateDependency: () => store.updateDependency('', 'x', {}), membership: () => store.membership(null, 'x'),
        membershipsIn: () => store.membershipsIn(), insertMembership: () => store.insertMembership({ id: 'x' }),
        updateMembership: () => store.updateMembership(undefined, 'x', 0, {}), citizens: () => store.citizens(),
        citizen: () => store.citizen(undefined, 'x'), insertCitizen: () => store.insertCitizen({ id: 'x' }),
        insertRequest: () => store.insertRequest({ id: 'x' }), requestByIdempotency: () => store.requestByIdempotency(undefined, 'u', 'k'),
        findRequests: () => store.findRequests({ folio: 'x' }), existsByFolio: () => store.existsByFolio('', 'x'),
        updateRequest: () => store.updateRequest(undefined, 'x', 0, {}), insertDocument: () => store.insertDocument({ id: 'x' }),
        updateDocumentStatus: () => store.updateDocumentStatus(undefined, 'x', 'VIGENTE'), documentsOf: () => store.documentsOf(undefined, 'r'),
        pendingDocuments: () => store.pendingDocuments(undefined, NOW), addGrant: () => store.addGrant({ id: 'x' }),
        grant: () => store.grant(undefined, 'x'), revokeGrant: () => store.revokeGrant(undefined, 'x', NOW),
        grantsFor: () => store.grantsFor(), appendAudit: () => store.appendAudit({ action: 'X' }), auditEvents: () => store.auditEvents(),
      };
      const scoped = allOperations().filter((op) => !UNSCOPED_OPERATIONS.includes(op));
      assert.deepStrictEqual(Object.keys(probes).sort(), scoped.sort(), 'cada operación con ámbito tiene su prueba');
      for (const [op, probe] of Object.entries(probes)) assert.strictEqual(await code(probe()), 'MISSING_MUNICIPALITY', op);
      assert.strictEqual(fake.calls.length, 0, 'ninguna llamada al controlador');
    });

    it('un filtro con municipio solo dentro de $or no se acepta', async () => {
      const { fake, store } = setup();
      assert.strictEqual(await code(store.findRequests({ $or: [{ municipalityId: A }, { municipalityId: B }] })), 'MISSING_MUNICIPALITY');
      assert.strictEqual(fake.calls.length, 0);
    });
  });

  describe('aislamiento municipal', () => {
    it('cada llamada a una colección municipal filtra por el municipio recibido (salvo las excepciones del puerto)', async () => {
      const { fake, store } = setup();
      const saved = await store.insertRequest(requestDoc(store));
      fake.calls.length = 0;
      await store.dependencies(A); await store.membership(A, fx.oid(303)); await store.membershipsIn(A); await store.citizens(A);
      await store.citizen(A, fx.oid(400)); await store.requestByIdempotency(A, saved.createdBy, saved.idempotencyKey);
      await store.findRequests({ municipalityId: A }); await store.existsByFolio(A, saved.folio);
      await store.updateRequest(A, saved.id, 0, { version: 1, history: saved.history });
      await store.documentsOf(A, saved.id); await store.pendingDocuments(A, NOW); await store.grant(A, 'x');
      await store.revokeGrant(A, 'x', NOW); await store.grantsFor(A); await store.auditEvents(A);
      await store.updateDependency(A, fx.buildDependencies()[0].id, { name: 'Obras Públicas' });
      await store.updateMembership(A, fx.oid(303), 0, { role: 'TITULAR_DEPENDENCIA' });
      const municipal = new Set(MUNICIPAL_SCOPED.map((l) => collectionNames()[l]));
      const reads = fake.calls.filter((c) => municipal.has(c.collection) && c.filter);
      assert.ok(reads.length >= 17);
      for (const c of reads) assert.strictEqual(c.filter.municipalityId, A, `${c.op} ${c.collection} ${JSON.stringify(c.filter)}`);
    });

    it('membershipsOf (excepción documentada) filtra por usuario y nunca devuelve más de lo suyo', async () => {
      const { fake, store } = setup();
      const ms = await store.membershipsOf(fx.USERS.u_tit_obp);
      assert.ok(ms.length >= 1 && ms.every((m) => m.userId === fx.USERS.u_tit_obp));
      assert.deepStrictEqual(fake.calls.at(-1).filter, { userId: fx.USERS.u_tit_obp });
    });
  });

  describe('colisiones de índices', () => {
    it('cada índice único se traduce a su código del puerto; un índice desconocido a DUPLICATE_KEY', () => {
      for (const [index, expected] of Object.entries(UNIQUE_INDEX_ERRORS)) {
        const e = mapMongoError(Object.assign(new Error(`E11000 duplicate key error collection: munierp_qa.x index: ${index} dup key`), { code: 11000 }));
        assert.strictEqual(e.code, expected, index);
        assert.strictEqual(e.cause.code, 11000, 'conserva la causa');
      }
      assert.strictEqual(mapMongoError({ code: 11000, message: 'E11000 index: otro_indice dup key' }).code, 'DUPLICATE_KEY');
      assert.strictEqual(mapMongoError({ code: 11000, errInfo: { index: 'uniq_request_folio' }, message: '' }).code, 'DUPLICATE_FOLIO');
    });

    it('todo índice único declarado tiene traducción', () => {
      const unique = Object.values(INDEXES).flat().filter((i) => i.unique).map((i) => i.name);
      assert.deepStrictEqual(unique.filter((n) => !UNIQUE_INDEX_ERRORS[n]), []);
    });

    it('idempotencia: índice único Y filtro con municipio + usuario + clave (las dos defensas)', async () => {
      const ix = INDEXES.requests.find((i) => i.name === 'uniq_request_idempotency');
      assert.deepStrictEqual(ix.key, { municipalityId: 1, createdBy: 1, idempotencyKey: 1 });
      assert.strictEqual(ix.unique, true);
      const { fake, store } = setup();
      await store.requestByIdempotency(A, 'u1', 'clave-001');
      assert.deepStrictEqual(fake.calls.at(-1).filter, { municipalityId: A, createdBy: 'u1', idempotencyKey: 'clave-001' });
      await store.insertRequest(requestDoc(store, { key: 'clave-002' }));
      await store.insertRequest(requestDoc(store, { municipalityId: B, code: 'ZZZ', key: 'clave-002' }));
      assert.strictEqual(fake.raw('requests').length, 2, 'misma clave del mismo usuario en otro municipio: permitida por el índice');
    });

    it('folio duplicado e idempotencia duplicada llegan al servicio con el código esperado', async () => {
      const { store } = setup();
      await store.insertRequest(requestDoc(store, { key: 'clave-001' }));
      assert.strictEqual(await code(store.insertRequest(requestDoc(store, { key: 'clave-002' }))), 'DUPLICATE_FOLIO');
      assert.strictEqual(await code(store.insertRequest(requestDoc(store, { sequence: 2, key: 'clave-001' }))), 'DUPLICATE_IDEMPOTENCY');
    });
  });

  describe('conflictos de revisión', () => {
    it('updateRequest: filtro con id + municipio + versión; versión distinta → STALE_VERSION sin escribir', async () => {
      const { fake, store } = setup();
      const saved = await store.insertRequest(requestDoc(store));
      fake.calls.length = 0;
      assert.strictEqual(await code(store.updateRequest(A, saved.id, 3, { version: 4, history: saved.history })), 'STALE_VERSION');
      assert.deepStrictEqual(fake.calls.map((c) => c.op), ['findOne']);
      assert.deepStrictEqual(fake.calls[0].filter, { _id: saved.id, municipalityId: A, version: 3 });
    });

    it('updateRequest añade solo las entradas nuevas con $push y no reescribe el historial', async () => {
      const { fake, store } = setup();
      const saved = await store.insertRequest(requestDoc(store));
      const entry = { at: NOW, actorId: fx.USERS.u_tit_obp, action: 'TURNAR', fromStatus: 'REGISTRADA', toStatus: 'EN_TRAMITE' };
      fake.calls.length = 0;
      const r = await store.updateRequest(A, saved.id, 0, { version: 1, status: 'EN_TRAMITE', history: [...saved.history, entry], municipalityId: B, folio: 'otro' });
      const upd = fake.calls.find((c) => c.op === 'findOneAndUpdate');
      assert.deepStrictEqual(Object.keys(upd.update).sort(), ['$push', '$set']);
      assert.strictEqual(upd.update.$push.history.$each.length, 1);
      assert.ok(!('history' in upd.update.$set) && !('municipalityId' in upd.update.$set) && !('folio' in upd.update.$set));
      assert.strictEqual(r.history.length, 2);
      assert.strictEqual(r.municipalityId, A);
    });

    it('historial alterado → HISTORY_REWRITE sin llamada de escritura', async () => {
      const { fake, store } = setup();
      const saved = await store.insertRequest(requestDoc(store));
      fake.calls.length = 0;
      assert.strictEqual(await code(store.updateRequest(A, saved.id, 0, { version: 1, history: [] })), 'HISTORY_REWRITE');
      assert.ok(!fake.calls.some((c) => c.op !== 'findOne'));
    });

    it('la escritura condicional detecta un cambio entre la lectura y la escritura (findOneAndUpdate nulo) → STALE_VERSION', async () => {
      const { fake, store } = setup();
      const saved = await store.insertRequest(requestDoc(store));
      // Simula otra escritura ganadora entre la lectura y la escritura: findOneAndUpdate sin coincidencia.
      const db = { collection: (n) => { const c = fake.db.collection(n); return { ...c, find: c.find, findOneAndUpdate: async () => null }; } };
      const racing = createMongoStore({ db, runTransaction: createTransactionRunner(fake.client) });
      assert.strictEqual(await code(racing.updateRequest(A, saved.id, 0, { version: 1, history: saved.history })), 'STALE_VERSION');
    });

    it('updateMembership: versión 0 admite documentos sin campo version; incrementa la versión', async () => {
      const { fake, store } = setup();
      fake.calls.length = 0;
      const r = await store.updateMembership(A, fx.oid(303), 0, { role: 'CONSULTA', version: 99 });
      assert.strictEqual(r.version, 1);
      assert.deepStrictEqual(fake.calls[0].filter.$or, [{ version: 0 }, { version: { $exists: false } }]);
      assert.strictEqual(await code(store.updateMembership(A, fx.oid(303), 0, {})), 'STALE_VERSION');
    });

    it('compatibilidad de forma de resultado: controlador v5 ({ value }) y v6 (documento)', async () => {
      for (const resultShape of ['v5', 'v6']) {
        const { store } = setup({ resultShape });
        assert.strictEqual(await store.nextSequence('SJH:OBP:SOL:2026'), 1, resultShape);
        assert.strictEqual(await store.nextSequence('SJH:OBP:SOL:2026'), 2, resultShape);
        assert.strictEqual((await store.updateMembership(A, fx.oid(303), 0, { role: 'CONSULTA' })).role, 'CONSULTA', resultShape);
      }
    });
  });

  describe('errores de transacción', () => {
    it('el ejecutor usa snapshot/majority/primary, devuelve el valor del callback y cierra la sesión', async () => {
      const { fake } = setup();
      const run = createTransactionRunner(fake.client);
      assert.strictEqual(await run(async () => 42), 42);
      assert.deepStrictEqual(fake.sessions[0].lastOptions, DEFAULT_TRANSACTION_OPTIONS);
      assert.strictEqual(fake.sessions[0].ended, true);
      await assert.rejects(() => run(async () => { throw new Error('x'); }));
      assert.strictEqual(fake.sessions[1].ended, true, 'cierra también si falla');
    });

    it('un error transitorio DENTRO de la transacción llega intacto al controlador, que reintenta y confirma', async () => {
      const { fake, store } = setup();
      fake.failNext('insertOne', () => labelled('WriteConflict', ['TransientTransactionError'], 112), { collection: 'requests' });
      const saved = await store.transaction(async (tx) => {
        const seq = await tx.nextSequence('SJH:OBP:SOL:2026');
        return tx.insertRequest(requestDoc(tx, { sequence: seq }));
      });
      assert.strictEqual(saved.folio, 'SJH-OBP-SOL-2026-000001', 'el reintento no consume otro folio');
      assert.strictEqual(fake.stats.retries, 1);
      assert.strictEqual(fake.raw('requests').length, 1);
    });

    it('transitorio persistente → TRANSIENT_CONFLICT al salir; nada confirmado', async () => {
      const fake = createFakeMongo({ maxRetries: 2 });
      fake.seed('municipalities', contractSeed().municipalities);
      const store = createMongoStore({ db: fake.db, runTransaction: createTransactionRunner(fake.client) });
      fake.failNext('insertOne', () => labelled('WriteConflict', ['TransientTransactionError'], 112), { collection: 'requests', times: 10 });
      assert.strictEqual(await code(store.transaction(async (tx) => {
        await tx.nextSequence('SJH:OBP:SOL:2026');
        await tx.insertRequest(requestDoc(tx));
      })), 'TRANSIENT_CONFLICT');
      assert.deepStrictEqual(fake.raw('counters'), [], 'el contador no avanzó');
    });

    it('UnknownTransactionCommitResult en el commit se reintenta', async () => {
      const { fake, store } = setup();
      fake.failNext('commitTransaction', () => labelled('commit incierto', ['UnknownTransactionCommitResult'], 50));
      await store.transaction(async (tx) => tx.appendAudit({ municipalityId: A, action: 'X', at: NOW, result: 'success' }));
      assert.strictEqual(fake.stats.retries, 1);
      assert.strictEqual(fake.raw('audit').length, 1, 'un solo evento tras el reintento');
    });

    it('error de negocio dentro de la transacción: aborta sin reintentar y se propaga tal cual', async () => {
      const { fake, store } = setup();
      const boom = new Error('regla');
      const err = await store.transaction(async (tx) => { await tx.appendAudit({ municipalityId: A, action: 'X', at: NOW, result: 'success' }); throw boom; }).catch((e) => e);
      assert.strictEqual(err, boom);
      assert.strictEqual(fake.stats.retries, 0);
      assert.deepStrictEqual(fake.raw('audit'), []);
    });
  });

  describe('fallos de lectura y escritura', () => {
    it('fallo de red en lectura → PERSISTENCE_UNAVAILABLE con causa; en escritura no deja nada', async () => {
      const { fake, store } = setup();
      fake.failNext('find', Object.assign(new Error('socket cerrado'), { name: 'MongoNetworkError' }), { collection: 'requests' });
      const e = await store.findRequests({ municipalityId: A }).catch((x) => x);
      assert.strictEqual(e.code, 'PERSISTENCE_UNAVAILABLE');
      assert.strictEqual(e.cause.name, 'MongoNetworkError');
      fake.failNext('insertOne', Object.assign(new Error('socket cerrado'), { name: 'MongoNetworkError' }), { collection: 'audit' });
      assert.strictEqual(await code(store.transaction(async (tx) => {
        await tx.insertRequest(requestDoc(tx));
        await tx.appendAudit({ municipalityId: A, action: 'REQUEST_CREATED', at: NOW, result: 'success' });
      })), 'PERSISTENCE_UNAVAILABLE');
      assert.deepStrictEqual(fake.raw('requests'), []);
    });

    it('validador de colección (121) y falta de privilegios (13) tienen códigos propios', () => {
      assert.strictEqual(mapMongoError({ code: 121, message: 'Document failed validation' }).code, 'VALIDATION_FAILED');
      assert.strictEqual(mapMongoError({ code: 13, message: 'not authorized' }).code, 'PERSISTENCE_FORBIDDEN');
      const plain = new TypeError('x');
      assert.strictEqual(mapMongoError(plain), plain, 'errores ajenos no se disfrazan');
    });
  });

  describe('membresías revocadas', () => {
    it('revocar: $set de estado con versión; la lectura posterior la devuelve INACTIVA', async () => {
      const { fake, store } = setup();
      await store.updateMembership(A, fx.oid(303), 0, { status: 'INACTIVA', updatedBy: fx.USERS.u_adm });
      const call = fake.calls.find((c) => c.op === 'findOneAndUpdate');
      assert.strictEqual(call.update.$set.status, 'INACTIVA');
      assert.strictEqual(call.update.$set.version, 1);
      assert.strictEqual((await store.membershipsOf(fx.USERS.u_tit_obp)).find((m) => m.id === fx.oid(303)).status, 'INACTIVA');
    });

    it('revokeGrant solo actúa si no estaba revocada (filtro revokedAt: null) y no cruza municipios', async () => {
      const { fake, store } = setup();
      const g = { id: store.newId(), requestId: 'r', municipalityId: A, granteeUserId: fx.USERS.u_op_tes, level: 'READ', revokedAt: null };
      await store.addGrant(g);
      assert.strictEqual(await store.revokeGrant(B, g.id, NOW), false);
      assert.strictEqual(await store.revokeGrant(A, g.id, NOW), true);
      assert.strictEqual(await store.revokeGrant(A, g.id, NOW), false);
      assert.deepStrictEqual(fake.calls.filter((c) => c.op === 'updateOne').map((c) => c.filter), [
        { _id: g.id, municipalityId: B, revokedAt: null }, { _id: g.id, municipalityId: A, revokedAt: null }, { _id: g.id, municipalityId: A, revokedAt: null },
      ]);
    });

    it('servicio sobre el adaptador: una membresía revocada deja de dar acceso en la siguiente petición', async () => {
      const s = scenario();
      const { fake, store } = setup();
      const service = createMunicipalService({ store, storage: createGridFsStorage({ bucket: fake.bucket }), clock: s.clock, userLookup: async (id) => ({ id }) });
      const ctx = async (user) => require('../../src/modules/municipal/policy/context').buildAccessContext({ erpAccess: { id: fx.USERS[user] }, memberships: await store.membershipsOf(fx.USERS[user]), grants: await store.grantsFor(A), municipalityId: A, now: s.clock() });
      const created = await service.createRequest(await ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key());
      assert.strictEqual(created.status, 201);
      await store.updateMembership(A, fx.oid(304), 0, { status: 'INACTIVA' });
      const err = await ctx('u_op_obp').then((c) => service.getRequest(c, 'SJH', created.data.folio)).catch((e) => e);
      assert.strictEqual(err.statusCode, 403);
    });
  });

  describe('documentos privados y PENDIENTE', () => {
    it('GridFS: no sobrescribe, rechaza claves no opacas y no ofrece borrado', async () => {
      const { fake } = setup();
      const storage = createGridFsStorage({ bucket: fake.bucket });
      const key = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
      await storage.put(key, Buffer.from('%PDF-1.4\n'));
      assert.strictEqual(await code(storage.put(key, Buffer.from('otro'))), 'DUPLICATE_STORAGE_KEY');
      assert.strictEqual((await storage.get(key)).toString(), '%PDF-1.4\n');
      assert.strictEqual(await code(storage.get('b1b2c3d4e5f60718293a4b5c6d7e8f90')), 'NOT_FOUND');
      assert.strictEqual(await code(storage.put('../SJH-OBP-SOL-2026-000001.pdf', Buffer.from('x'))), 'INVALID_STORAGE_KEY');
      assert.deepStrictEqual(Object.keys(storage).sort(), ['get', 'put']);
      assert.strictEqual(fake.files.get('file1').metadata.kind, 'municipal-private');
    });

    it('carrera de subida: el índice único de files.filename rechaza el segundo binario', async () => {
      const { fake } = setup();
      const key = 'c1b2c3d4e5f60718293a4b5c6d7e8f90';
      const storage = createGridFsStorage({ bucket: { ...fake.bucket, find: () => ({ limit: () => ({ toArray: async () => [] }) }) } });
      await storage.put(key, Buffer.from('uno'));
      assert.strictEqual(await code(storage.put(key, Buffer.from('dos'))), 'DUPLICATE_STORAGE_KEY');
    });

    it('servicio sobre el adaptador: fallo de GridFS deja PENDIENTE, invisible y conciliable; sin borrado', async () => {
      const s = scenario();
      const { fake, store } = setup();
      const storage = createGridFsStorage({ bucket: fake.bucket });
      const service = createMunicipalService({ store, storage, clock: s.clock });
      const { buildAccessContext } = require('../../src/modules/municipal/policy/context');
      const ctx = async () => buildAccessContext({ erpAccess: { id: fx.USERS.u_op_obp }, memberships: await store.membershipsOf(fx.USERS.u_op_obp), grants: [], municipalityId: A, now: s.clock() });
      const r = await service.createRequest(await ctx(), 'SJH', s.body('OBP'), s.key());
      fake.failNext('bucket.upload', new Error('GridFS no disponible'));
      const PDF64 = Buffer.from('%PDF-1.4\n% sintetico\n').toString('base64');
      const c = await ctx();
      await assert.rejects(() => service.uploadDocument(c, 'SJH', r.data.folio, { filename: 'a.pdf', mimeType: 'application/pdf', contentBase64: PDF64 }), /GridFS no disponible/);
      assert.deepStrictEqual(fake.raw('documents').map((d) => d.status), ['PENDIENTE']);
      assert.deepStrictEqual(await service.listDocuments(await ctx(), 'SJH', r.data.folio), []);
      const later = new Date(s.clock().getTime() + 1);
      assert.strictEqual((await store.pendingDocuments(A, later)).length, 1);
      const ok = await service.uploadDocument(await ctx(), 'SJH', r.data.folio, { filename: 'b.pdf', mimeType: 'application/pdf', contentBase64: PDF64 });
      const listed = await service.listDocuments(await ctx(), 'SJH', r.data.folio);
      assert.deepStrictEqual(listed.map((d) => d.id), [ok.id]);
      const out = await service.downloadDocument(await ctx(), 'SJH', r.data.folio, ok.id);
      assert.ok(out.buffer.toString('latin1').startsWith('%PDF-1.4'));
      assert.strictEqual(fake.raw('documents').length, 2, 'el PENDIENTE sigue registrado');
    });

    it('integridad: si el binario no coincide con el sha256 registrado, no se entrega y se audita', async () => {
      const s = scenario();
      const r = await s.service.createRequest(s.ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key());
      const PDF64 = Buffer.from('%PDF-1.4\n% sintetico\n').toString('base64');
      const up = await s.service.uploadDocument(s.ctx('u_op_obp'), 'SJH', r.data.folio, { filename: 'a.pdf', mimeType: 'application/pdf', contentBase64: PDF64 });
      const tampered = { put: async () => {}, get: async () => Buffer.from('%PDF-1.4\n% alterado\n') };
      const service = createMunicipalService({ store: s.store, storage: tampered, clock: s.clock });
      const err = await service.downloadDocument(s.ctx('u_op_obp'), 'SJH', r.data.folio, up.id).catch((e) => e);
      assert.strictEqual(err.statusCode, 500);
      const actions = s.store.testing.auditEvents().map((e) => e.action);
      assert.ok(actions.includes('DOCUMENT_INTEGRITY_FAILED'));
      assert.ok(!actions.includes('DOCUMENT_DOWNLOADED'));
    });
  });

  describe('composición con cliente inyectado', () => {
    const env = { NODE_ENV: 'test', MUNICIPAL_STORE: 'mongo', MUNICIPAL_QA_DATABASE: 'munierp_qa', MUNICIPAL_QA_URI: 'mongodb+srv://qa.example.net/munierp_qa', MUNICIPAL_QA_AUTHORIZED: '2026-11-10|Responsable QA municipal|munierp_qa' };
    const now = new Date('2026-11-10T20:00:00Z');
    it('sin guardia autorizada no compone nada (ni abre colecciones)', () => {
      const { fake } = setup();
      let touched = 0;
      const client = { db: () => { touched += 1; return fake.db; }, startSession: fake.client.startSession };
      assert.throws(() => createMongoPersistence({ client, env: {}, bucketFactory: () => fake.bucket, now }), (e) => e.code === 'QA_NOT_AUTHORIZED');
      assert.throws(() => createMongoPersistence({ client, env: { ...env, M07_QA_AUTHORIZED: env.MUNICIPAL_QA_AUTHORIZED }, bucketFactory: () => fake.bucket, now }), (e) => e.code === 'QA_NOT_AUTHORIZED');
      assert.strictEqual(touched, 0);
    });
    it('autorizada: usa munierp_qa, el bucket municipal_files y un almacén que cumple el puerto', async () => {
      const { fake } = setup();
      let bucketName;
      const p = createMongoPersistence({ client: fake.client, env, bucketFactory: (db, o) => { bucketName = o.bucketName; return fake.bucket; }, now });
      assert.strictEqual(bucketName, 'municipal_files');
      assertRepositoryPort(p.store);
      assert.strictEqual((await p.store.municipalityByCode('SJH')).code, 'SJH');
    });
  });

  describe('plan de instalación (sin crear nada)', () => {
    it('el plan declara colecciones con validador e índices; solo operaciones de creación', () => {
      const steps = planSetup();
      assert.ok(steps.every((s) => ['createCollection', 'createIndex'].includes(s.op)));
      assert.strictEqual(steps.filter((s) => s.op === 'createCollection').length, 9);
      assert.ok(steps.some((s) => s.collection === 'municipal_requests' && s.index && s.index.name === 'uniq_request_folio' && s.index.unique));
      assert.ok(steps.some((s) => s.collection === 'municipal_files.files' && s.index.name === 'uniq_file_storage_key'));
      assert.throws(() => planSetup({ prefix: 'ventas_' }), /municipal_/);
    });

    it('applySetup se niega sin guardia, sin confirmación o con otra base; con todo, solo crea', async () => {
      const calls = [];
      const db = {
        databaseName: 'munierp_qa',
        listCollections: () => ({ toArray: async () => [] }),
        createCollection: async (name) => { calls.push(['createCollection', name]); },
        collection: (name) => ({ createIndex: async (key, o) => { calls.push(['createIndex', name, o.name]); } }),
      };
      const env = { NODE_ENV: 'test', MUNICIPAL_STORE: 'mongo', MUNICIPAL_QA_DATABASE: 'munierp_qa', MUNICIPAL_QA_URI: 'mongodb+srv://qa.example.net/munierp_qa', MUNICIPAL_QA_AUTHORIZED: '2026-11-10|Responsable QA municipal|munierp_qa' };
      const now = new Date('2026-11-10T20:00:00Z');
      assert.strictEqual(await code(applySetup(db, { env: {}, confirmation: CONFIRMATION, now })), 'QA_NOT_AUTHORIZED');
      assert.strictEqual(await code(applySetup(db, { env, confirmation: 'si', now })), 'QA_NOT_CONFIRMED');
      assert.strictEqual(await code(applySetup({ ...db, databaseName: 'erp_sales_test' }, { env, confirmation: CONFIRMATION, now })), 'QA_WRONG_DATABASE');
      assert.strictEqual(calls.length, 0);
      await applySetup(db, { env, confirmation: CONFIRMATION, now });
      assert.ok(calls.length > 20 && calls.every(([op]) => op === 'createCollection' || op === 'createIndex'));
    });

    it('verifySetup (solo lectura) detecta índices faltantes o distintos', async () => {
      const steps = planSetup();
      const indexesBy = {};
      for (const s of steps.filter((x) => x.op === 'createIndex')) (indexesBy[s.collection] = indexesBy[s.collection] || []).push({ name: s.index.name, key: s.index.key, unique: s.index.unique, partialFilterExpression: s.index.partialFilterExpression });
      indexesBy.municipal_requests = indexesBy.municipal_requests.map((i) => (i.name === 'uniq_request_folio' ? { ...i, unique: false } : i));
      indexesBy.municipal_documents = indexesBy.municipal_documents.filter((i) => i.name !== 'uniq_document_storage_key');
      const db = {
        listCollections: () => ({ toArray: async () => steps.filter((s) => s.op === 'createCollection').map((s) => ({ name: s.collection })) }),
        collection: (name) => ({ listIndexes: () => ({ toArray: async () => indexesBy[name] || [] }) }),
      };
      const r = await verifySetup(db);
      assert.strictEqual(r.ok, false);
      assert.deepStrictEqual(r.problems.sort(), ['falta el índice municipal_documents.uniq_document_storage_key', 'unicidad distinta en municipal_requests.uniq_request_folio']);
    });

    it('el inventario de escrituras cubre todas las operaciones de escritura del puerto', () => {
      const writes = allOperations().filter((op) => /^(insert|update|add|revoke|append|next)/.test(op));
      assert.deepStrictEqual(writes.filter((op) => !WRITE_INVENTORY.some((w) => w.op === op)), []);
    });
  });
});
