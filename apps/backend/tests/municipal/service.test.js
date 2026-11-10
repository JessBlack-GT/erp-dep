'use strict';
/*
 * Pruebas de la capa de aplicación municipal con almacén EN MEMORIA y datos sintéticos.
 * Nivel "H-mock": verifican reglas de negocio y autorización; NO sustituyen las pruebas R
 * (Atlas QA) ni E2E, que siguen pendientes.
 */
const assert = require('assert');
const { scenario, rejects } = require('./helpers');
const access = require('../../src/modules/municipal/policy/access');
const { matches } = require('../../src/modules/municipal/mocks/filter-match');
const { computeIndicators } = require('../../src/modules/municipal/domain/indicators');

const PDF64 = Buffer.from('%PDF-1.4\n% documento sintetico\n').toString('base64');
const DAY = 86400000;

/** Siembra un conjunto variado de expedientes y devuelve sus folios por etiqueta. */
async function seed(s) {
  const f = {};
  const mk = async (label, user, dep, extra) => {
    f[label] = (await s.service.createRequest(s.ctx(user), 'SJH', s.body(dep, extra), s.key())).data.folio;
  };
  await mk('obp1', 'u_op_obp', 'OBP');
  await mk('obp2', 'u_tit_obp', 'OBP', { channel: 'TELEFONO' });
  await mk('tes1', 'u_op_tes', 'TES');
  await mk('dif_conf', 'u_tit_dif', 'DIF', { confidentiality: 'CONFIDENCIAL' });
  await mk('vent_obp', 'u_vent', 'OBP');
  await mk('vent_tes', 'u_vent', 'TES');
  s.zzzFolio = (await s.service.createRequest(s.ctx('u_zzz_tit_obp', 'ZZZ'), 'ZZZ', { ...s.body('OBP'), citizenId: s.citizen(11) }, s.key())).data.folio;
  return f;
}

describe('RQ01 — folio único', () => {
  it('dos solicitudes distintas no comparten folio; secuencia consecutiva por dependencia', async () => {
    const s = scenario();
    const results = await Promise.all(Array.from({ length: 50 }, () => s.service.createRequest(s.ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key())));
    const folios = results.map((r) => r.data.folio);
    assert.strictEqual(new Set(folios).size, 50);
    assert.deepStrictEqual(folios.map((x) => Number(x.slice(-6))).sort((a, b) => a - b), Array.from({ length: 50 }, (_, i) => i + 1));
    const tes = await s.service.createRequest(s.ctx('u_op_tes'), 'SJH', s.body('TES'), s.key());
    assert.strictEqual(tes.data.folio, 'SJH-TES-SOL-2026-000001');
  });

  it('reintento con misma Idempotency-Key devuelve el mismo folio; otro cuerpo → 409 (MT-33/34)', async () => {
    const s = scenario();
    const first = await s.service.createRequest(s.ctx('u_vent'), 'SJH', s.body('OBP'), 'reintento-0001');
    const again = await s.service.createRequest(s.ctx('u_vent'), 'SJH', s.body('OBP'), 'reintento-0001');
    assert.strictEqual(first.status, 201);
    assert.strictEqual(again.status, 200);
    assert.strictEqual(again.data.folio, first.data.folio);
    assert.strictEqual(s.store.testing.allRequests().length, 1);
    await rejects(() => s.service.createRequest(s.ctx('u_vent'), 'SJH', s.body('TES'), 'reintento-0001'), 409, 'CONFLICT');
  });

  it('si la escritura falla, el contador no avanza y no hay huecos (MT-32)', async () => {
    const s = scenario();
    s.store.testing.failNextRequestInsert();
    await assert.rejects(() => s.service.createRequest(s.ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key()));
    assert.strictEqual(s.store.testing.counter('SJH:OBP:SOL:2026'), 0);
    const ok = await s.service.createRequest(s.ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key());
    assert.strictEqual(ok.data.folio, 'SJH-OBP-SOL-2026-000001');
  });

  it('el cambio de año reinicia la secuencia y no colisiona (MT-35)', async () => {
    const s = scenario({ now: new Date('2027-01-01T05:00:00Z') }); // 31-dic-2026 23:00 en México
    const a = await s.service.createRequest(s.ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key());
    s.setNow(new Date('2027-01-01T07:00:00Z'));
    const b = await s.service.createRequest(s.ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key());
    assert.strictEqual(a.data.folio, 'SJH-OBP-SOL-2026-000001');
    assert.strictEqual(b.data.folio, 'SJH-OBP-SOL-2027-000001');
  });

  it('cancelar conserva el folio y no se reutiliza (MT-36)', async () => {
    const s = scenario();
    const a = (await s.service.createRequest(s.ctx('u_tit_obp'), 'SJH', s.body('OBP'), s.key())).data;
    const c = await s.service.transition(s.ctx('u_tit_obp'), 'SJH', a.folio, { action: 'CANCELAR', version: 0, note: 'Duplicada por error' });
    assert.strictEqual(c.status, 'CANCELADA');
    assert.strictEqual(c.folio, a.folio);
    const b = (await s.service.createRequest(s.ctx('u_tit_obp'), 'SJH', s.body('OBP'), s.key())).data;
    assert.strictEqual(b.folio, 'SJH-OBP-SOL-2026-000002');
  });

  it('el servidor no acepta folio ni municipio desde el cliente (MT-18)', async () => {
    const s = scenario();
    await rejects(() => s.service.createRequest(s.ctx('u_vent'), 'SJH', { ...s.body('OBP'), folio: 'SJH-OBP-SOL-2026-999999' }, s.key()), 400);
    await rejects(() => s.service.createRequest(s.ctx('u_vent'), 'SJH', { ...s.body('OBP'), municipalityId: 'x' }, s.key()), 400);
    assert.strictEqual(s.store.testing.allRequests().length, 0);
  });
});

describe('RQ05 / RQ03 — acceso no autorizado', () => {
  it('superadmin y admin del ERP sin membresía → 403 MUNICIPAL_MEMBERSHIP_REQUIRED (MT-04)', async () => {
    const s = scenario();
    await seed(s);
    for (const [user, role] of [['u_super_erp', 'superadmin'], ['u_admin_erp', 'admin']]) {
      await rejects(() => s.service.listRequests(s.ctx(user, 'SJH', role), 'SJH'), 403, 'MUNICIPAL_MEMBERSHIP_REQUIRED');
      await rejects(() => s.service.indicators(s.ctx(user, 'SJH', role), 'SJH', { from: new Date('2026-01-01'), to: new Date('2027-01-01') }), 403, 'MUNICIPAL_MEMBERSHIP_REQUIRED');
    }
  });

  it('usuario auto-registrado (token válido, sin membresía) → 403 (MT-05)', async () => {
    const s = scenario();
    await rejects(() => s.service.createRequest(s.ctx('u_reg'), 'SJH', s.body('OBP'), s.key()), 403, 'MUNICIPAL_MEMBERSHIP_REQUIRED');
  });

  it('membresía vencida → 403 (MT-06)', async () => {
    const s = scenario();
    await rejects(() => s.service.listRequests(s.ctx('u_expired'), 'SJH'), 403, 'MUNICIPAL_MEMBERSHIP_REQUIRED');
  });

  it('ADMIN_MUNICIPAL no lee expedientes; AUDITOR no escribe (MT-11/12)', async () => {
    const s = scenario();
    const f = await seed(s);
    await rejects(() => s.service.getRequest(s.ctx('u_admin_mun'), 'SJH', f.obp1), 403, 'FORBIDDEN');
    await rejects(() => s.service.transition(s.ctx('u_aud'), 'SJH', f.obp1, { action: 'TURNAR', version: 0, toDependencies: ['TES'] }), 403);
  });

  it('operador solo registra en su dependencia', async () => {
    const s = scenario();
    await rejects(() => s.service.createRequest(s.ctx('u_op_tes'), 'SJH', s.body('OBP'), s.key()), 403, 'FORBIDDEN');
  });
});

describe('RQ03 — aislamiento de expedientes', () => {
  it('otro municipio: sin membresía en SJH → 403; folio de ZZZ desde SJH → 404 (MT-13/14)', async () => {
    const s = scenario();
    await seed(s);
    await rejects(() => s.service.listRequests(s.ctx('u_zzz_tit_obp', 'SJH'), 'SJH'), 403);
    await rejects(() => s.service.getRequest(s.ctx('u_tit_obp'), 'SJH', s.zzzFolio), 404, 'NOT_FOUND');
  });

  it('otra dependencia → 404 indistinguible y evento ACCESS_DENIED sin contenido (MT-15/52)', async () => {
    const s = scenario();
    const f = await seed(s);
    const err = await rejects(() => s.service.getRequest(s.ctx('u_op_tes'), 'SJH', f.obp1), 404, 'NOT_FOUND');
    const missing = await rejects(() => s.service.getRequest(s.ctx('u_op_tes'), 'SJH', 'SJH-OBP-SOL-2026-000777'), 404, 'NOT_FOUND');
    assert.strictEqual(err.message, missing.message);
    const denied = s.store.testing.auditEvents().filter((e) => e.action === 'ACCESS_DENIED');
    assert.strictEqual(denied.length, 1, 'solo el expediente existente genera evento');
    assert.strictEqual(denied[0].folio, f.obp1);
    assert.ok(!('subject' in denied[0]) && !('description' in denied[0]));
  });

  it('el filtro del cliente no amplía el alcance (MT-16) y el listado es exacto (MT-17)', async () => {
    const s = scenario();
    const f = await seed(s);
    assert.strictEqual((await s.service.listRequests(s.ctx('u_op_tes'), 'SJH', { dependency: 'OBP' })).items.length, 0);
    const tit = (await s.service.listRequests(s.ctx('u_tit_obp'), 'SJH')).items.map((r) => r.folio).sort();
    assert.deepStrictEqual(tit, [f.obp1, f.obp2, f.vent_obp].sort());
    const vent = (await s.service.listRequests(s.ctx('u_vent'), 'SJH')).items.map((r) => r.folio).sort();
    assert.deepStrictEqual(vent, [f.vent_obp, f.vent_tes].sort());
  });

  it('CONFIDENCIAL: supervisor con readConfidential lo ve; consulta de otra dependencia no (MT-19)', async () => {
    const s = scenario();
    const f = await seed(s);
    assert.ok((await s.service.listRequests(s.ctx('u_sup'), 'SJH')).items.some((r) => r.folio === f.dif_conf));
    await rejects(() => s.service.getRequest(s.ctx('u_tit_obp'), 'SJH', f.dif_conf), 404);
    const aud = (await s.service.listRequests(s.ctx('u_aud'), 'SJH')).items;
    assert.ok(!aud.some((r) => r.folio === f.dif_conf), 'auditor sin readConfidential no ve confidenciales');
  });

  it('auditor recibe solo metadatos (sin asunto, descripción ni ciudadano)', async () => {
    const s = scenario();
    const f = await seed(s);
    const r = (await s.service.getRequest(s.ctx('u_aud'), 'SJH', f.obp1));
    assert.ok(r.folio && r.status);
    for (const k of ['subject', 'description', 'citizenId', 'history', 'createdBy']) assert.ok(!(k in r), k);
  });

  it('concesión READ: acceso mientras vigente, 404 al revocar; nunca escritura (MT-19b)', async () => {
    const s = scenario();
    const f = await seed(s);
    const req = s.store.testing.allRequests().find((r) => r.folio === f.obp1);
    s.grant({ id: 'g1', requestId: req.id, municipalityId: s.munId('SJH'), granteeUserId: s.fx.USERS.u_op_tes, level: 'READ' });
    assert.strictEqual((await s.service.getRequest(s.ctx('u_op_tes'), 'SJH', f.obp1)).folio, f.obp1);
    await rejects(() => s.service.uploadDocument(s.ctx('u_op_tes'), 'SJH', f.obp1, { filename: 'a.pdf', mimeType: 'application/pdf', contentBase64: PDF64 }), 403);
    s.store.testing.revokeGrant('g1', s.clock());
    await rejects(() => s.service.getRequest(s.ctx('u_op_tes'), 'SJH', f.obp1), 404);
  });

  it('concesión vencida no da acceso ni por regla ni por filtro', async () => {
    const s = scenario();
    const f = await seed(s);
    const req = s.store.testing.allRequests().find((r) => r.folio === f.obp1);
    s.grant({ id: 'g2', requestId: req.id, municipalityId: s.munId('SJH'), granteeDependencyId: s.dependencies.find((d) => d.code === 'TES').id, level: 'READ', expiresAt: new Date(s.clock().getTime() + DAY) });
    assert.strictEqual((await s.service.getRequest(s.ctx('u_op_tes'), 'SJH', f.obp1)).folio, f.obp1);
    s.advance(2 * DAY);
    await rejects(() => s.service.getRequest(s.ctx('u_op_tes'), 'SJH', f.obp1), 404);
    assert.ok(!(await s.service.listRequests(s.ctx('u_op_tes'), 'SJH')).items.some((r) => r.folio === f.obp1));
  });

  it('un expediente concluido no admite escrituras aunque el rol tenga el permiso', async () => {
    const s = scenario();
    const f = await seed(s);
    await s.service.transition(s.ctx('u_tit_obp'), 'SJH', f.obp2, { action: 'CANCELAR', version: 0, note: 'Duplicada por error' });
    const req = s.store.testing.allRequests().find((r) => r.folio === f.obp2);
    for (const p of ['municipal.documents.upload', 'municipal.requests.update', 'municipal.requests.assign'])
      assert.strictEqual(access.canWriteRequest(s.ctx('u_tit_obp'), req, p), false, p);
    await rejects(() => s.service.uploadDocument(s.ctx('u_tit_obp'), 'SJH', f.obp2, { filename: 'a.pdf', mimeType: 'application/pdf', contentBase64: PDF64 }), 409, 'INVALID_TRANSITION');
  });

  it('invariante: el filtro Mongo selecciona exactamente lo que permite canReadRequest', async () => {
    const s = scenario();
    await seed(s);
    const all = s.store.testing.allRequests();
    for (const user of Object.keys(s.fx.USERS))
      for (const mun of ['SJH', 'ZZZ']) {
        const ctx = s.ctx(user, mun);
        const filter = access.buildRequestScopeFilter(ctx, access.activeGrantRequestIds(ctx));
        const byFilter = all.filter((r) => matches(r, filter)).map((r) => r.id).sort();
        const byRule = all.filter((r) => access.canReadRequest(ctx, r)).map((r) => r.id).sort();
        assert.deepStrictEqual(byFilter, byRule, `${user}@${mun}`);
      }
  });
});

describe('RQ02 — asignación e historial', () => {
  it('turnar, asignar y cerrar conservan actor, fecha y estado; la dependencia turnada gana acceso (MT-42)', async () => {
    const s = scenario();
    const a = (await s.service.createRequest(s.ctx('u_op_obp'), 'SJH', s.body('OBP'), s.key())).data;
    s.advance(DAY);
    await s.service.transition(s.ctx('u_tit_obp'), 'SJH', a.folio, { action: 'TURNAR', version: 0, toDependencies: ['OBP', 'TES'] });
    assert.strictEqual((await s.service.getRequest(s.ctx('u_op_tes'), 'SJH', a.folio)).folio, a.folio);
    s.advance(DAY);
    await s.service.transition(s.ctx('u_tit_obp'), 'SJH', a.folio, { action: 'ASIGNAR', version: 1, assignedUserId: s.fx.USERS.u_op_obp });
    s.advance(DAY);
    await s.service.transition(s.ctx('u_tit_obp'), 'SJH', a.folio, { action: 'CERRAR', version: 2, note: 'Atendida y verificada' });
    const h = (await s.service.getHistory(s.ctx('u_tit_obp'), 'SJH', a.folio));
    assert.deepStrictEqual(h.map((e) => [e.action, e.fromStatus, e.toStatus, e.actorId]), [
      ['REGISTRAR', null, 'REGISTRADA', s.fx.USERS.u_op_obp],
      ['TURNAR', 'REGISTRADA', 'EN_TRAMITE', s.fx.USERS.u_tit_obp],
      ['ASIGNAR', 'EN_TRAMITE', 'EN_TRAMITE', s.fx.USERS.u_tit_obp],
      ['CERRAR', 'EN_TRAMITE', 'CERRADA', s.fx.USERS.u_tit_obp],
    ]);
    const times = h.map((e) => new Date(e.at).getTime());
    assert.deepStrictEqual(times, [...times].sort((x, y) => x - y));
    assert.strictEqual(new Set(times).size, 4);
    const events = s.store.testing.auditEvents().filter((e) => e.folio === a.folio && e.result === 'success');
    assert.strictEqual(events.length, 4, 'un evento de bitácora por escritura (MT-50)');
  });

  it('operador no puede turnar (MT-43); dos escrituras con la misma versión → la segunda 409 (MT-44)', async () => {
    const s = scenario();
    const a = (await s.service.createRequest(s.ctx('u_tit_obp'), 'SJH', s.body('OBP'), s.key())).data;
    await rejects(() => s.service.transition(s.ctx('u_op_obp'), 'SJH', a.folio, { action: 'TURNAR', version: 0, toDependencies: ['TES'] }), 403);
    await s.service.transition(s.ctx('u_tit_obp'), 'SJH', a.folio, { action: 'ASIGNAR', version: 0, assignedUserId: s.fx.USERS.u_op_obp });
    await rejects(() => s.service.transition(s.ctx('u_tit_obp'), 'SJH', a.folio, { action: 'ASIGNAR', version: 0, assignedUserId: s.fx.USERS.u_tit_obp }), 409, 'CONFLICT');
  });

  it('expediente concluido no admite cambios (MT-41)', async () => {
    const s = scenario();
    const a = (await s.service.createRequest(s.ctx('u_tit_obp'), 'SJH', s.body('OBP'), s.key())).data;
    await s.service.transition(s.ctx('u_tit_obp'), 'SJH', a.folio, { action: 'CANCELAR', version: 0, note: 'Solicitud retirada' });
    await rejects(() => s.service.transition(s.ctx('u_tit_obp'), 'SJH', a.folio, { action: 'REANUDAR', version: 1 }), 409, 'INVALID_TRANSITION');
  });
});

describe('RQ05 — documentos privados y descargas', () => {
  const upload = (s, user, folio, extra = {}) =>
    s.service.uploadDocument(s.ctx(user), 'SJH', folio, { filename: 'Oficio sintético.pdf', mimeType: 'application/pdf', contentBase64: PDF64, ...extra });

  it('descarga autorizada devuelve el contenido exacto con cabeceras privadas (MT-85)', async () => {
    const s = scenario();
    const f = await seed(s);
    const doc = await upload(s, 'u_op_obp', f.obp1);
    assert.ok(!('storageKey' in doc));
    const out = await s.service.downloadDocument(s.ctx('u_tit_obp'), 'SJH', f.obp1, doc.id);
    assert.strictEqual(out.buffer.toString('base64'), PDF64);
    assert.strictEqual(out.headers['Cache-Control'], 'no-store');
  });

  it('descarga desde otra dependencia, otro municipio o sin rol → 404/403 y queda en bitácora (MT-86)', async () => {
    const s = scenario();
    const f = await seed(s);
    const doc = await upload(s, 'u_op_obp', f.obp1);
    await rejects(() => s.service.downloadDocument(s.ctx('u_op_tes'), 'SJH', f.obp1, doc.id), 404);
    await rejects(() => s.service.downloadDocument(s.ctx('u_admin_erp', 'SJH', 'admin'), 'SJH', f.obp1, doc.id), 403);
    await rejects(() => s.service.downloadDocument(s.ctx('u_admin_mun'), 'SJH', f.obp1, doc.id), 403);
    await rejects(() => s.service.downloadDocument(s.ctx('u_tit_obp'), 'SJH', f.tes1, doc.id), 404, 'NOT_FOUND');
    const denied = s.store.testing.auditEvents().filter((e) => e.action === 'ACCESS_DENIED');
    assert.ok(denied.length >= 1);
    assert.ok(!s.store.testing.auditEvents().some((e) => JSON.stringify(e).includes(PDF64)));
  });

  it('documento CONFIDENCIAL en expediente público: se lista restringido y no se descarga (MT-87)', async () => {
    const s = scenario();
    const f = await seed(s);
    const doc = await upload(s, 'u_tit_obp', f.obp1, { confidentiality: 'CONFIDENCIAL' });
    const listedByConsulta = (await s.service.listDocuments(s.ctx('u_consulta_obp'), 'SJH', f.obp1));
    assert.deepStrictEqual(listedByConsulta, [{ id: doc.id, confidentiality: 'CONFIDENCIAL', restricted: true }]);
    await rejects(() => s.service.downloadDocument(s.ctx('u_consulta_obp'), 'SJH', f.obp1, doc.id), 404);
    assert.ok((await s.service.downloadDocument(s.ctx('u_tit_obp'), 'SJH', f.obp1, doc.id)).buffer.length > 0);
  });

  it('el documento nunca es menos restrictivo que su expediente (MT-88)', async () => {
    const s = scenario();
    const f = await seed(s);
    const doc = await upload(s, 'u_tit_dif', f.dif_conf, { confidentiality: 'PUBLICA' });
    assert.strictEqual(doc.confidentiality, 'CONFIDENCIAL');
  });
});

describe('RQ04 — indicadores coinciden con los registros de prueba', () => {
  it('las cifras del servicio igualan el oráculo y el conteo manual, respetando el alcance (MT-74/75)', async () => {
    const s = scenario();
    const f = await seed(s);
    await s.service.transition(s.ctx('u_tit_obp'), 'SJH', f.obp1, { action: 'TURNAR', version: 0, toDependencies: ['OBP'] });
    s.advance(3 * DAY);
    await s.service.transition(s.ctx('u_tit_obp'), 'SJH', f.obp1, { action: 'CERRAR', version: 1, note: 'Atendida en sitio' });
    s.advance(20 * DAY);
    const period = { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-11-01T00:00:00Z') };

    const tit = (await s.service.indicators(s.ctx('u_tit_obp'), 'SJH', period));
    assert.strictEqual(tit.total, 3); // obp1, obp2, vent_obp
    assert.deepStrictEqual(tit.byDependency, { OBP: 3 });
    assert.strictEqual(tit.closedInPeriod, 1);
    assert.strictEqual(tit.avgResolutionDays, 3);
    assert.strictEqual(tit.overdueOpen, 2); // obp2 y vent_obp abiertas desde hace 23 días > 15
    assert.deepStrictEqual(tit.byChannel, { PRESENCIAL: 2, TELEFONO: 1, WEB_FUNCIONARIO: 0 });

    const sup = (await s.service.indicators(s.ctx('u_sup'), 'SJH', period));
    assert.strictEqual(sup.total, 6, 'supervisor ve los 6 de SJH (incluido el confidencial), nunca el de ZZZ');
    const dif = (await s.service.indicators(s.ctx('u_tit_dif'), 'SJH', period));
    assert.strictEqual(dif.total, 1, 'el titular de DIF no obtiene totales del municipio');
    await rejects(() => s.service.indicators(s.ctx('u_op_tes'), 'SJH', period), 403, 'FORBIDDEN');

    const visible = s.store.testing.allRequests().filter((r) => access.canReadRequest(s.ctx('u_sup'), r));
    const oracle = computeIndicators(visible, { ...period, now: s.clock() });
    assert.strictEqual(sup.total, oracle.total);
    assert.deepStrictEqual(sup.byStatus, oracle.byStatus);
  });
});

describe('RQ06 — canal presencial y acuse', () => {
  it('ventanilla registra en canal PRESENCIAL y obtiene acuse sin datos de contacto (MT-92)', async () => {
    const s = scenario();
    const a = (await s.service.createRequest(s.ctx('u_vent'), 'SJH', s.body('AGP'), s.key())).data;
    assert.strictEqual(a.channel, 'PRESENCIAL');
    const receipt = (await s.service.receipt(s.ctx('u_vent'), 'SJH', a.folio));
    assert.strictEqual(receipt.folio, a.folio);
    assert.strictEqual(receipt.dependency, 'Agua Potable');
    for (const k of ['citizenId', 'email', 'phone', 'description']) assert.ok(!(k in receipt), k);
  });
});
