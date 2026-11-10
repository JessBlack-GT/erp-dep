'use strict';
/*
 * F1-14 — GET /audit-events y revisión de integridad (F1-05) vía HTTP sobre Express AISLADO.
 * Identidad central real del ERP (JWT + requireCurrentUser); almacén EN MEMORIA y datos sintéticos.
 * No es MongoDB ni una integración desplegada.
 */
const assert = require('assert');
const request = require('supertest');
const { httpScenario, validator } = require('./http-helpers');

describe('F1-14 bitácora y F1-05 integridad (HTTP aislado)', function () {
  this.timeout(20000);
  let s;
  let n = 0;
  beforeEach(() => { s = httpScenario(); });
  afterEach(() => s.restore());

  async function call(method, path, { user, body, query, headers = {}, operationId, expect } = {}) {
    let req = request(s.app)[method](s.BASE + path);
    if (user) req = req.set(s.auth(user));
    for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
    if (query) req = req.query(query);
    if (body !== undefined) req = req.send(body);
    const res = await req;
    if (expect !== undefined) assert.strictEqual(res.status, expect, `${method.toUpperCase()} ${path} → ${res.status} ${JSON.stringify(res.body)}`);
    if (validator && operationId && (res.headers['content-type'] || '').includes('json')) validator.check(operationId, res.status, res.body);
    return res;
  }
  const create = (user, mun = 'SJH', key = `f114-clave-${++n}-qa`, dep = 'OBP', citizen = 400) => call('post', `/municipalities/${mun}/requests`, {
    user, headers: { 'Idempotency-Key': key }, body: { type: 'SOL', ownerDependency: dep, subject: 'Solicitud sintética F1-14', citizenId: s.fx.oid(citizen), channel: 'PRESENCIAL' },
  });

  it('auditor: 200 conforme al contrato, solo su municipio, filtros y paginación', async () => {
    const a = await create('u_op_obp');
    await create('u_op_obp');
    await create('u_zzz_tit_obp', 'ZZZ', undefined, 'OBP', 411);
    const all = await call('get', '/municipalities/SJH/audit-events', { user: 'u_aud', operationId: 'listAuditEvents', expect: 200 });
    assert.ok(all.body.data.length >= 2);
    assert.ok(all.body.data.every((e) => !e.folio || e.folio.startsWith('SJH-')), 'sin eventos de otro municipio');
    const times = all.body.data.map((e) => e.at);
    assert.deepStrictEqual([...times].sort().reverse(), times, 'más recientes primero');
    const one = await call('get', '/municipalities/SJH/audit-events', { user: 'u_aud', query: { folio: a.body.data.folio }, operationId: 'listAuditEvents', expect: 200 });
    assert.ok(one.body.data.length >= 1 && one.body.data.every((e) => e.folio === a.body.data.folio));
    const p = await call('get', '/municipalities/SJH/audit-events', { user: 'u_aud', query: { limit: 1, page: 2 }, operationId: 'listAuditEvents', expect: 200 });
    assert.strictEqual(p.body.data.length, 1);
    assert.strictEqual(p.body.pagination.page, 2);
    await call('get', '/municipalities/SJH/audit-events', { user: 'u_aud', query: { folio: 'no-es-folio' }, operationId: 'listAuditEvents', expect: 400 });
  });

  it('política vigente: ADMIN_MUNICIPAL, titular y supervisor sin audit.read → 403; otro municipio → 403 de membresía; sin token → 401', async () => {
    for (const user of ['u_admin_mun', 'u_tit_obp', 'u_sup']) {
      const r = await call('get', '/municipalities/SJH/audit-events', { user, operationId: 'listAuditEvents', expect: 403 });
      assert.strictEqual(r.body.code, 'FORBIDDEN');
    }
    const z = await call('get', '/municipalities/ZZZ/audit-events', { user: 'u_aud', operationId: 'listAuditEvents', expect: 403 });
    assert.strictEqual(z.body.code, 'MUNICIPAL_MEMBERSHIP_REQUIRED');
    await call('get', '/municipalities/SJH/audit-events', { expect: 401 });
    for (const user of ['u_super_erp', 'u_admin_erp']) await call('get', '/municipalities/SJH/audit-events', { user, expect: 403 });
  });

  it('idempotencia por municipio vía HTTP: la misma clave del mismo usuario en dos municipios crea dos expedientes', async () => {
    const zzzObp = s.store.testing; // solo pruebas: membresía adicional del titular en ZZZ
    const dep = (await s.store.dependencies(s.fx.MUNICIPALITIES[1].id)).find((d) => d.code === 'OBP');
    zzzObp.insertMembership({ ...s.memberships.find((m) => m.userId === s.fx.USERS.u_tit_obp), id: s.fx.oid(392), municipalityId: s.fx.MUNICIPALITIES[1].id, dependencyIds: [dep.id], version: 0 });
    const sjh = await create('u_tit_obp', 'SJH', 'misma-clave-f114');
    const zzz = await create('u_tit_obp', 'ZZZ', 'misma-clave-f114', 'OBP', 411);
    assert.strictEqual(sjh.status, 201);
    assert.strictEqual(zzz.status, 201, 'antes de F1-05 paso 3 devolvía 200 con el expediente de SJH');
    assert.ok(sjh.body.data.folio.startsWith('SJH-') && zzz.body.data.folio.startsWith('ZZZ-'));
    const again = await create('u_tit_obp', 'SJH', 'misma-clave-f114');
    assert.strictEqual(again.status, 200);
    assert.strictEqual(again.body.data.folio, sjh.body.data.folio);
  });

  it('errores de persistencia no exponen detalles: 500 genérico sin mensaje del controlador ni valores de índice', async () => {
    const original = s.store.auditEvents;
    const cause = Object.assign(new Error('E11000 duplicate key error collection: munierp_qa.municipal_requests index: uniq_request_folio dup key: { folio: "SJH-OBP-SOL-2026-000001" }'), { code: 11000 });
    for (const thrown of [Object.assign(new Error('Clave duplicada (otro_indice)'), { code: 'DUPLICATE_KEY', cause }), cause, Object.assign(new Error('socket 10.0.0.5:27017 cerrado'), { code: 'PERSISTENCE_UNAVAILABLE', cause: { name: 'MongoNetworkError' } })]) {
      s.store.auditEvents = async () => { throw thrown; };
      const r = await call('get', '/municipalities/SJH/audit-events', { user: 'u_aud', expect: 500 });
      assert.deepStrictEqual(r.body, { success: false, error: 'Error interno', code: 'INTERNAL_ERROR' });
      assert.ok(!/E11000|dup key|SJH-OBP|10\.0\.0\.5|uniq_/.test(JSON.stringify(r.body) + JSON.stringify(r.headers)));
    }
    s.store.auditEvents = original;
  });
});
