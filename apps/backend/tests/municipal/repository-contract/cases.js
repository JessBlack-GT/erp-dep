'use strict';
/**
 * Casos del contrato del repositorio municipal (F1-05 paso 2). Cada caso declara su NIVEL:
 *
 *  - L1 «semántica»: comportamiento observable del puerto. Se verifica en memoria y DEBE pasar igual
 *    contra MongoDB. Que pase en memoria no certifica MongoDB: solo fija la semántica esperada.
 *  - L2 «aproximación»: concurrencia. En memoria pasa porque el almacén serializa; contra MongoDB
 *    ejercita índices únicos y transacciones reales. El resultado en memoria NO es evidencia de Mongo.
 *  - L3 «solo MongoDB»: requiere índices, transacciones multi-documento, GridFS o topología reales.
 *    En memoria queda PENDIENTE (no se ejecuta ni se declara aprobado).
 *
 * `run(env)` recibe: { store, storage, faults, seed } — `faults` viene de faults.js y funciona con
 * cualquier implementación del puerto.
 */
const assert = require('assert');
const { requestDoc, auditEvent, A, B, OBP_A, NOW, fx } = require('./seed');
const { allOperations } = require('../../../src/modules/municipal/persistence/repository-port');

const code = async (promise) => {
  try { await promise; } catch (e) { return e.code || e.message; }
  return 'SIN_ERROR';
};
const deferred = () => { let resolve; const p = new Promise((r) => { resolve = r; }); return { p, resolve }; };

/** @type {Array<{ id: string, area: string, level: 'L1'|'L2'|'L3', title: string, run?: Function, verify?: string }>} */
const CASES = [
  /* ---------------------------- Creación y consulta ---------------------------- */
  { id: 'RC-01', area: 'Creación y consulta', level: 'L1', title: 'inserta un expediente y lo recupera por municipio + folio, idempotencia y existencia',
    async run({ store }) {
      const doc = requestDoc(store);
      const saved = await store.insertRequest(doc);
      assert.strictEqual(saved.folio, doc.folio);
      const [found] = await store.findRequests({ $and: [{ municipalityId: A }, { folio: doc.folio }] });
      assert.deepStrictEqual(found, saved);
      assert.deepStrictEqual(await store.requestByIdempotency(doc.createdBy, doc.idempotencyKey), saved);
      assert.strictEqual(await store.existsByFolio(A, doc.folio), true);
      assert.strictEqual(await store.existsByFolio(A, 'SJH-OBP-SOL-2026-999999'), false);
    } },
  { id: 'RC-02', area: 'Creación y consulta', level: 'L1', title: 'los objetos devueltos son copias: mutarlos no altera lo guardado',
    async run({ store }) {
      const saved = await store.insertRequest(requestDoc(store));
      saved.status = 'CERRADA';
      saved.history.push({ action: 'MANIPULADA' });
      const mun = await store.municipalityByCode('SJH');
      mun.name = 'Alterado';
      const [again] = await store.findRequests({ municipalityId: A });
      assert.strictEqual(again.status, 'REGISTRADA');
      assert.strictEqual(again.history.length, 1);
      assert.notStrictEqual((await store.municipalityByCode('SJH')).name, 'Alterado');
    } },
  { id: 'RC-03', area: 'Creación y consulta', level: 'L1', title: 'un patch no cambia identidad (id, municipio, folio, createdAt, createdBy)',
    async run({ store }) {
      const saved = await store.insertRequest(requestDoc(store));
      const updated = await store.updateRequest(saved.id, 0, {
        version: 1, municipalityId: B, folio: 'ZZZ-OBP-SOL-2026-000001', createdBy: 'otro', createdAt: new Date(0), history: saved.history,
      });
      for (const k of ['id', 'municipalityId', 'folio', 'createdBy']) assert.strictEqual(updated[k], saved[k], k);
      assert.strictEqual(updated.createdAt.getTime(), saved.createdAt.getTime());
      assert.strictEqual((await store.findRequests({ municipalityId: B })).length, 0);
    } },

  /* ----------------------------- Aislamiento municipal ----------------------------- */
  { id: 'RC-04', area: 'Aislamiento municipal', level: 'L1', title: 'toda consulta por colección exige municipio (MISSING_MUNICIPALITY)',
    async run({ store }) {
      assert.strictEqual(await code(store.findRequests({ folio: 'SJH-OBP-SOL-2026-000001' })), 'MISSING_MUNICIPALITY');
      assert.strictEqual(await code(store.findRequests({ $or: [{ municipalityId: A }] })), 'MISSING_MUNICIPALITY', '$or no fija municipio');
      assert.strictEqual(await code(store.findRequests(null)), 'MISSING_MUNICIPALITY');
      for (const op of ['dependencies', 'membershipsIn', 'citizens', 'grantsFor', 'auditEvents'])
        assert.strictEqual(await code(store[op](undefined)), 'MISSING_MUNICIPALITY', op);
      assert.strictEqual(await code(store.existsByFolio('', 'x')), 'MISSING_MUNICIPALITY');
      assert.strictEqual(await code(store.insertRequest({ ...requestDoc(store), municipalityId: undefined })), 'MISSING_MUNICIPALITY');
    } },
  { id: 'RC-05', area: 'Aislamiento municipal', level: 'L1', title: 'el mismo número de folio en otro municipio no se mezcla ni colisiona',
    async run({ store }) {
      await store.insertRequest(requestDoc(store, { municipalityId: A }));
      await store.insertRequest(requestDoc(store, { municipalityId: B, code: 'ZZZ' }));
      assert.deepStrictEqual((await store.findRequests({ municipalityId: A })).map((r) => r.folio), ['SJH-OBP-SOL-2026-000001']);
      assert.deepStrictEqual((await store.findRequests({ municipalityId: B })).map((r) => r.folio), ['ZZZ-OBP-SOL-2026-000001']);
      assert.strictEqual(await store.existsByFolio(B, 'SJH-OBP-SOL-2026-000001'), false);
      assert.strictEqual((await store.findRequests({ $and: [{ municipalityId: B }, { folio: 'SJH-OBP-SOL-2026-000001' }] })).length, 0);
    } },
  { id: 'RC-06', area: 'Aislamiento municipal', level: 'L1', title: 'bitácora, concesiones, ciudadanos, membresías y dependencias se leen por municipio',
    async run({ store }) {
      await store.appendAudit(auditEvent(A, 'X_A'));
      await store.appendAudit(auditEvent(B, 'X_B'));
      await store.addGrant({ id: store.newId(), requestId: 'r', municipalityId: B, granteeUserId: fx.USERS.u_tit_obp, level: 'READ', revokedAt: null });
      assert.deepStrictEqual((await store.auditEvents(A)).map((e) => e.action), ['X_A']);
      assert.strictEqual((await store.grantsFor(A)).length, 0);
      assert.ok((await store.citizens(A)).every((c) => c.municipalityId === A));
      assert.ok((await store.membershipsIn(B)).every((m) => m.municipalityId === B));
      assert.ok((await store.dependencies(B)).every((d) => d.municipalityId === B));
      assert.strictEqual(await store.citizen(B, fx.oid(400)), null, 'ciudadano de A no visible desde B');
    } },

  /* ---------------------------------- Folios ---------------------------------- */
  { id: 'RC-07', area: 'Folios únicos', level: 'L1', title: 'la secuencia es consecutiva por clave e independiente entre claves',
    async run({ store }) {
      assert.deepStrictEqual([await store.nextSequence('SJH:OBP:SOL:2026'), await store.nextSequence('SJH:OBP:SOL:2026')], [1, 2]);
      assert.strictEqual(await store.nextSequence('SJH:TES:SOL:2026'), 1);
      assert.strictEqual(await store.nextSequence('SJH:OBP:SOL:2027'), 1);
      assert.strictEqual(await store.nextSequence('ZZZ:OBP:SOL:2026'), 1);
    } },
  { id: 'RC-08', area: 'Folios únicos', level: 'L1', title: 'folio repetido en el mismo municipio → DUPLICATE_FOLIO sin escribir',
    async run({ store }) {
      await store.insertRequest(requestDoc(store));
      assert.strictEqual(await code(store.insertRequest(requestDoc(store))), 'DUPLICATE_FOLIO');
      assert.strictEqual((await store.findRequests({ municipalityId: A })).length, 1);
    } },
  { id: 'RC-09', area: 'Folios únicos', level: 'L1', title: 'Idempotency-Key repetida por el mismo usuario → DUPLICATE_IDEMPOTENCY; otro usuario puede usarla',
    async run({ store }) {
      await store.insertRequest(requestDoc(store, { key: 'k-1' }));
      assert.strictEqual(await code(store.insertRequest(requestDoc(store, { sequence: 2, key: 'k-1' }))), 'DUPLICATE_IDEMPOTENCY');
      await store.insertRequest(requestDoc(store, { sequence: 3, key: 'k-1', createdBy: fx.USERS.u_vent }));
      assert.strictEqual((await store.findRequests({ municipalityId: A })).length, 2);
    } },

  /* --------------------------- Colisiones y conflictos --------------------------- */
  { id: 'RC-10', area: 'Colisiones y conflictos', level: 'L1', title: 'membresía y dependencia duplicadas por municipio; el mismo código en otro municipio es válido',
    async run({ store }) {
      const dup = { id: store.newId(), userId: fx.USERS.u_tit_obp, municipalityId: A, role: 'CONSULTA', dependencyIds: [OBP_A], status: 'ACTIVA', version: 0 };
      assert.strictEqual(await code(store.insertMembership(dup)), 'DUPLICATE_MEMBERSHIP');
      await store.insertMembership({ ...dup, id: store.newId(), municipalityId: B, dependencyIds: [] });
      assert.strictEqual(await code(store.insertDependency({ id: store.newId(), municipalityId: A, code: 'OBP', name: 'x', status: 'ACTIVA' })), 'DUPLICATE_DEPENDENCY');
      await store.insertDependency({ id: store.newId(), municipalityId: B, code: 'TES', name: 'Tesorería (ficticio)', status: 'ACTIVA' });
      assert.ok((await store.dependencies(B)).some((d) => d.code === 'TES'));
    } },
  { id: 'RC-11', area: 'Colisiones y conflictos', level: 'L1', title: 'clave de almacenamiento duplicada → DUPLICATE_STORAGE_KEY',
    async run({ store }) {
      const doc = { id: store.newId(), municipalityId: A, requestId: 'r1', folio: 'f', storageKey: 'clave-opaca-1', status: 'PENDIENTE', confidentiality: 'PUBLICA' };
      await store.insertDocument(doc);
      assert.strictEqual(await code(store.insertDocument({ ...doc, id: store.newId() })), 'DUPLICATE_STORAGE_KEY');
    } },

  /* ------------------------------ Revisiones (versión) ------------------------------ */
  { id: 'RC-12', area: 'Actualización de revisiones', level: 'L1', title: 'expediente: versión correcta aplica; versión obsoleta → STALE_VERSION sin cambios',
    async run({ store }) {
      const saved = await store.insertRequest(requestDoc(store));
      await store.updateRequest(saved.id, 0, { status: 'EN_TRAMITE', version: 1, history: saved.history });
      assert.strictEqual(await code(store.updateRequest(saved.id, 0, { status: 'CANCELADA', version: 1, history: saved.history })), 'STALE_VERSION');
      const [now] = await store.findRequests({ municipalityId: A });
      assert.strictEqual(now.status, 'EN_TRAMITE');
      assert.strictEqual(now.version, 1);
    } },
  { id: 'RC-13', area: 'Actualización de revisiones', level: 'L1', title: 'membresía: el almacén incrementa la versión; versión obsoleta → STALE_VERSION',
    async run({ store }) {
      const id = fx.oid(303);
      const v1 = await store.updateMembership(id, 0, { role: 'CONSULTA' });
      assert.strictEqual(v1.version, 1);
      assert.strictEqual(await code(store.updateMembership(id, 0, { role: 'TITULAR_DEPENDENCIA' })), 'STALE_VERSION');
      assert.strictEqual((await store.membership(id)).role, 'CONSULTA');
      assert.strictEqual(await code(store.updateMembership('000000000000000000000fff', 0, {})), 'STALE_VERSION', 'inexistente');
    } },

  /* ------------------------------ Historial y auditoría ------------------------------ */
  { id: 'RC-14', area: 'Historial y auditoría', level: 'L1', title: 'el historial solo crece: acortarlo o reescribirlo → HISTORY_REWRITE',
    async run({ store }) {
      const saved = await store.insertRequest(requestDoc(store));
      const entry = { at: NOW, actorId: fx.USERS.u_tit_obp, action: 'TURNAR', fromStatus: 'REGISTRADA', toStatus: 'EN_TRAMITE' };
      await store.updateRequest(saved.id, 0, { version: 1, history: [...saved.history, entry] });
      assert.strictEqual(await code(store.updateRequest(saved.id, 1, { version: 2, history: [] })), 'HISTORY_REWRITE');
      assert.strictEqual(await code(store.updateRequest(saved.id, 1, { version: 2, history: [{ ...saved.history[0], actorId: 'falso' }, entry] })), 'HISTORY_REWRITE');
      const [now] = await store.findRequests({ municipalityId: A });
      assert.strictEqual(now.history.length, 2);
      assert.strictEqual(now.version, 1);
    } },
  { id: 'RC-15', area: 'Historial y auditoría', level: 'L1', title: 'bitácora de solo inserción: el puerto no expone modificar ni borrar; devuelve copias',
    async run({ store }) {
      await store.appendAudit(auditEvent(A, 'REQUEST_CREATED', { folio: 'SJH-OBP-SOL-2026-000001' }));
      const [e] = await store.auditEvents(A);
      e.action = 'MANIPULADO';
      assert.strictEqual((await store.auditEvents(A))[0].action, 'REQUEST_CREATED');
      const forbidden = allOperations().filter((op) => /^(update|delete|remove|clear)(Audit|Audits|AuditEvent)/i.test(op));
      assert.deepStrictEqual(forbidden, []);
      for (const op of ['updateAudit', 'deleteAudit', 'removeAuditEvent', 'clearAudit']) assert.strictEqual(typeof store[op], 'undefined', op);
    } },

  /* ----------------------------- Revocación de membresías ----------------------------- */
  { id: 'RC-16', area: 'Revocación de membresías', level: 'L1', title: 'revocar persiste estado y versión, se refleja en lecturas; revocar una concesión dos veces es idempotente',
    async run({ store }) {
      const id = fx.oid(303);
      await store.updateMembership(id, 0, { status: 'INACTIVA' });
      const ofUser = await store.membershipsOf(fx.USERS.u_tit_obp);
      assert.strictEqual(ofUser.find((m) => m.id === id).status, 'INACTIVA');
      assert.strictEqual(ofUser.find((m) => m.id === id).version, 1);
      const g = { id: store.newId(), requestId: 'r', municipalityId: A, granteeUserId: fx.USERS.u_op_tes, level: 'READ', revokedAt: null };
      await store.addGrant(g);
      assert.strictEqual(await store.revokeGrant(g.id, NOW), true);
      assert.strictEqual(await store.revokeGrant(g.id, NOW), false);
      assert.strictEqual((await store.grant(g.id)).revokedAt.getTime(), NOW.getTime());
      assert.strictEqual(await store.revokeGrant('000000000000000000000fff', NOW), false);
    } },

  /* ------------------------------- Documentos privados ------------------------------- */
  { id: 'RC-17', area: 'Documentos privados', level: 'L1', title: 'metadatos PENDIENTE → VIGENTE; solo metadatos en el repositorio y binario en el almacenamiento',
    async run({ store, storage }) {
      const doc = { id: store.newId(), municipalityId: A, requestId: 'r1', folio: 'SJH-OBP-SOL-2026-000001', filename: 'Oficio.pdf', mimeType: 'application/pdf', size: 9, sha256: 'x', storageKey: 'opaca-17', status: 'PENDIENTE', confidentiality: 'CONFIDENCIAL' };
      await store.insertDocument(doc);
      await storage.put('opaca-17', Buffer.from('%PDF-1.4\n'));
      const active = await store.updateDocumentStatus(doc.id, 'VIGENTE');
      assert.strictEqual(active.status, 'VIGENTE');
      const listed = await store.documentsOf('r1');
      assert.strictEqual(listed.length, 1);
      assert.ok(!('content' in listed[0]) && !('buffer' in listed[0]) && !('contentBase64' in listed[0]), 'sin binario en metadatos');
      assert.strictEqual((await storage.get('opaca-17')).toString(), '%PDF-1.4\n');
      assert.strictEqual((await store.documentsOf('otro')).length, 0);
      assert.strictEqual(await code(store.updateDocumentStatus('000000000000000000000fff', 'VIGENTE')), 'NOT_FOUND');
    } },
  { id: 'RC-18', area: 'Documentos privados', level: 'L1', title: 'el almacenamiento no sobrescribe claves ni entrega contenido inexistente',
    async run({ storage }) {
      await storage.put('opaca-18', Buffer.from('a'));
      await assert.rejects(() => storage.put('opaca-18', Buffer.from('b')));
      assert.strictEqual((await storage.get('opaca-18')).toString(), 'a');
      await assert.rejects(() => storage.get('no-existe'));
      assert.strictEqual(typeof storage.delete, 'undefined', 'sin operación de borrado');
    } },

  /* ----------------------------- Errores de persistencia ----------------------------- */
  { id: 'RC-19', area: 'Errores de persistencia', level: 'L1', title: 'fallo al insertar dentro de una transacción: el contador de folio retrocede y no queda bitácora',
    async run({ store, faults }) {
      const f = faults;
      const injected = f.failNext('insertRequest');
      const err = await f.store.transaction(async (tx) => {
        await tx.nextSequence('SJH:OBP:SOL:2026');
        await tx.appendAudit(auditEvent(A, 'PREVIO'));
        await tx.insertRequest(requestDoc(tx));
      }).catch((e) => e);
      assert.strictEqual(err, injected, 'el error original se propaga sin envolver');
      assert.strictEqual(await store.nextSequence('SJH:OBP:SOL:2026'), 1, 'sin huecos');
      assert.strictEqual((await store.auditEvents(A)).length, 0);
      assert.strictEqual((await store.findRequests({ municipalityId: A })).length, 0);
    } },
  { id: 'RC-20', area: 'Errores de persistencia', level: 'L1', title: 'fallo al escribir la bitácora: la escritura de negocio de la misma transacción no se confirma',
    async run({ store, faults }) {
      faults.failNext('appendAudit');
      await assert.rejects(() => faults.store.transaction(async (tx) => {
        await tx.insertRequest(requestDoc(tx));
        await tx.appendAudit(auditEvent(A, 'REQUEST_CREATED'));
      }));
      assert.strictEqual((await store.findRequests({ municipalityId: A })).length, 0);
    } },
  { id: 'RC-21', area: 'Errores de persistencia', level: 'L1', title: 'una excepción del código de aplicación dentro de la transacción deshace todas sus escrituras',
    async run({ store }) {
      const boom = new Error('regla de negocio');
      const err = await store.transaction(async (tx) => {
        await tx.insertDependency({ id: tx.newId(), municipalityId: A, code: 'NUE', name: 'Nueva', status: 'ACTIVA' });
        await tx.updateMembership(fx.oid(304), 0, { status: 'INACTIVA' });
        await tx.addGrant({ id: tx.newId(), requestId: 'r', municipalityId: A, level: 'READ', revokedAt: null });
        throw boom;
      }).catch((e) => e);
      assert.strictEqual(err, boom);
      assert.ok(!(await store.dependencies(A)).some((d) => d.code === 'NUE'));
      assert.strictEqual((await store.membership(fx.oid(304))).status, 'ACTIVA');
      assert.strictEqual((await store.grantsFor(A)).length, 0);
    } },

  /* ------------------------ Consistencia tras operaciones rechazadas ------------------------ */
  { id: 'RC-22', area: 'Consistencia tras rechazos', level: 'L1', title: 'STALE_VERSION dentro de la transacción descarta la bitácora previa y se puede reintentar',
    async run({ store }) {
      const saved = await store.insertRequest(requestDoc(store));
      const stale = await store.transaction(async (tx) => {
        await tx.appendAudit(auditEvent(A, 'REQUEST_TURNAR'));
        await tx.updateRequest(saved.id, 7, { version: 8, history: saved.history });
      }).catch((e) => e.code);
      assert.strictEqual(stale, 'STALE_VERSION');
      assert.strictEqual((await store.auditEvents(A)).length, 0);
      await store.transaction(async (tx) => {
        await tx.updateRequest(saved.id, 0, { version: 1, status: 'EN_TRAMITE', history: saved.history });
        await tx.appendAudit(auditEvent(A, 'REQUEST_TURNAR'));
      });
      assert.strictEqual((await store.auditEvents(A)).length, 1);
    } },
  { id: 'RC-23', area: 'Consistencia tras rechazos', level: 'L1', title: 'DUPLICATE_FOLIO en transacción no avanza el contador; el siguiente alta válida usa el número esperado',
    async run({ store }) {
      await store.insertRequest(requestDoc(store, { sequence: 1 }));
      const r = await store.transaction(async (tx) => {
        const seq = await tx.nextSequence('SJH:OBP:SOL:2026');
        await tx.insertRequest(requestDoc(tx, { sequence: seq })); // colisiona con el 000001 existente
      }).catch((e) => e.code);
      assert.strictEqual(r, 'DUPLICATE_FOLIO');
      assert.strictEqual(await store.nextSequence('SJH:OBP:SOL:2026'), 1, 'el contador no avanzó');
    } },
  { id: 'RC-24', area: 'Consistencia tras rechazos', level: 'L1', title: 'la transacción ve sus propias escrituras; fuera de ella no se ven hasta confirmar',
    async run({ store }) {
      const gate = deferred();
      const inside = deferred();
      const pending = store.transaction(async (tx) => {
        await tx.insertRequest(requestDoc(tx));
        assert.strictEqual((await tx.findRequests({ municipalityId: A })).length, 1, 'lectura propia');
        inside.resolve();
        await gate.p;
      });
      await inside.p;
      assert.strictEqual((await store.findRequests({ municipalityId: A })).length, 0, 'sin lectura sucia');
      gate.resolve();
      await pending;
      assert.strictEqual((await store.findRequests({ municipalityId: A })).length, 1);
    } },
  { id: 'RC-25', area: 'Consistencia tras rechazos', level: 'L1', title: 'operaciones rechazadas por validación del puerto no dejan escrituras parciales',
    async run({ store }) {
      const before = (await store.dependencies(A)).length;
      await assert.rejects(() => store.insertDependency({ id: store.newId(), municipalityId: A, code: 'OBP', name: 'dup', status: 'ACTIVA' }));
      await assert.rejects(() => store.updateDependency('000000000000000000000fff', { name: 'x' }));
      assert.strictEqual((await store.dependencies(A)).length, before);
    } },

  /* --------------------------- L2: concurrencia (aproximación) --------------------------- */
  { id: 'RC-26', area: 'Folios únicos', level: 'L2', title: '50 altas concurrentes obtienen 50 folios distintos y consecutivos',
    async run({ store }) {
      const created = await Promise.all(Array.from({ length: 50 }, (_, i) => store.transaction(async (tx) => {
        const seq = await tx.nextSequence('SJH:OBP:SOL:2026');
        return tx.insertRequest(requestDoc(tx, { sequence: seq, key: `conc-${i}` }));
      })));
      const folios = created.map((r) => r.folio).sort();
      assert.strictEqual(new Set(folios).size, 50);
      assert.strictEqual(folios[49], 'SJH-OBP-SOL-2026-000050');
    } },
  { id: 'RC-27', area: 'Colisiones y conflictos', level: 'L2', title: 'dos actualizaciones concurrentes con la misma versión: exactamente una gana',
    async run({ store }) {
      const saved = await store.insertRequest(requestDoc(store));
      const results = await Promise.allSettled(['EN_TRAMITE', 'CANCELADA'].map((status) => store.transaction(async (tx) => {
        await tx.updateRequest(saved.id, 0, { status, version: 1, history: saved.history });
        await tx.appendAudit(auditEvent(A, 'X'));
      })));
      assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.strictEqual(results.find((r) => r.status === 'rejected').reason.code, 'STALE_VERSION');
      assert.strictEqual((await store.auditEvents(A)).length, 1, 'solo la ganadora deja bitácora');
    } },
  { id: 'RC-28', area: 'Colisiones y conflictos', level: 'L2', title: 'misma Idempotency-Key en paralelo: un solo expediente',
    async run({ store }) {
      const results = await Promise.allSettled([1, 2, 3].map((i) => store.transaction(async (tx) => {
        const seq = await tx.nextSequence('SJH:OBP:SOL:2026');
        return tx.insertRequest(requestDoc(tx, { sequence: seq, key: 'misma-clave' }));
      })));
      assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.ok(results.filter((r) => r.status === 'rejected').every((r) => r.reason.code === 'DUPLICATE_IDEMPOTENCY'));
      assert.strictEqual(await store.nextSequence('SJH:OBP:SOL:2026'), 2, 'los perdedores no consumen folio');
    } },

  /* ------------------------------ L3: requieren MongoDB real ------------------------------ */
  { id: 'RC-29', area: 'Folios únicos', level: 'L3', title: 'índices únicos y compuestos creados según docs/munierp/12 §3 (listIndexes)',
    verify: 'Comparar listIndexes() de cada colección municipal_* con la tabla del diseño; unique/partial exactos.' },
  { id: 'RC-30', area: 'Errores de persistencia', level: 'L3', title: 'transacción multi-documento real: writeConcern majority, readConcern snapshot y reintento de TransientTransactionError',
    verify: 'Forzar conflicto de escritura entre dos sesiones (WriteConflict) y verificar reintento sin duplicar folio.' },
  { id: 'RC-31', area: 'Aislamiento municipal', level: 'L3', title: 'el arranque rechaza una topología sin réplica (standalone) y una base distinta de munierp_qa',
    verify: 'hello() sin setName → error de arranque; qa-guard rechaza otra base antes de conectar.' },
  { id: 'RC-32', area: 'Documentos privados', level: 'L3', title: 'GridFS: binario fuera de la transacción, PENDIENTE huérfano conciliable, sha256 verificado al leer',
    verify: 'Cortar la subida a GridFS tras insertar metadatos → queda PENDIENTE; la conciliación lo reporta sin borrar.' },
  { id: 'RC-33', area: 'Historial y auditoría', level: 'L3', title: 'el usuario de aplicación no puede modificar ni borrar municipal_audit_events (rol de Atlas)',
    verify: 'updateOne/deleteOne sobre la bitácora con el usuario de la app → error de autorización del servidor.' },
  { id: 'RC-34', area: 'Historial y auditoría', level: 'L3', title: 'historial con $push bajo concurrencia real y medición del tamaño del documento (límite 16 MB)',
    verify: 'Muchas transiciones concurrentes con versión; tamaño BSON medido frente al umbral de la decisión diferida.' },
  { id: 'RC-35', area: 'Revocación de membresías', level: 'L3', title: 'revocación visible en la siguiente petición con lecturas primary tras commit (sin caché)',
    verify: 'Revocar en una sesión y leer desde otra conexión inmediatamente: la membresía aparece INACTIVA.' },
];

const LEVEL_LABEL = {
  L1: 'L1 semántica',
  L2: 'L2 aproximación en memoria — no certifica MongoDB',
  L3: 'L3 requiere MongoDB real',
};

module.exports = { CASES, LEVEL_LABEL };
