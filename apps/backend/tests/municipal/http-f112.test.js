'use strict';
/*
 * F1-12 — Dependencias y membresías vía HTTP sobre Express AISLADO.
 * Identidad central real del ERP (JWT + requireCurrentUser) y alta de membresías validada con
 * rbac.resolveAccess (simulado con sinon). Almacén EN MEMORIA y datos sintéticos: no es MongoDB.
 */
const assert = require('assert');
const request = require('supertest');
const { httpScenario, validator } = require('./http-helpers');

describe('F1-12 dependencias y membresías (HTTP aislado)', function () {
  this.timeout(20000);
  let s;
  let n = 0;
  beforeEach(() => { s = httpScenario(); });
  afterEach(() => s.restore());

  async function call(method, path, { user, headers = {}, body, query, operationId, expect } = {}) {
    let req = request(s.app)[method](s.BASE + path);
    if (user) req = req.set(s.auth(user));
    for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
    if (query) req = req.query(query);
    if (body !== undefined) req = req.send(body);
    const res = await req;
    if (expect !== undefined) assert.strictEqual(res.status, expect, `${method.toUpperCase()} ${path} → ${res.status} ${JSON.stringify(res.body)}`);
    if (res.status >= 400) assert.ok(res.body.code, `error sin code: ${JSON.stringify(res.body)}`);
    if (validator && operationId && (res.headers['content-type'] || '').includes('json')) validator.check(operationId, res.status, res.body);
    return res;
  }
  const mid = (k) => s.memberships.find((m) => m.userId === s.fx.USERS[k]).id;
  const newRequest = async (user, dep) =>
    (await call('post', '/municipalities/SJH/requests', { user, headers: { 'Idempotency-Key': `f112-key-${++n}-x` }, body: { type: 'SOL', ownerDependency: dep, subject: `Solicitud sintética ${dep}`, citizenId: s.fx.oid(400), channel: 'PRESENCIAL' }, expect: 201 })).body.data;

  describe('Autenticación y autorización por operación', () => {
    it('las 5 operaciones exigen identidad central (401) y membresía (403 para superadmin del ERP)', async () => {
      const ops = [
        ['post', '/municipalities/SJH/dependencies', { code: 'NUE', name: 'Nueva sintética' }],
        ['patch', '/municipalities/SJH/dependencies/OBP', { name: 'Obras' }],
        ['get', '/municipalities/SJH/memberships'],
        ['post', '/municipalities/SJH/memberships', { userId: s.fx.USERS.u_reg, role: 'CONSULTA', dependencies: ['OBP'] }],
        ['patch', `/municipalities/SJH/memberships/${mid('u_op_tes')}`, { status: 'INACTIVA' }],
      ];
      for (const [m, p, b] of ops) {
        await call(m, p, { body: b, expect: 401 });
        const r = await call(m, p, { user: 'u_super_erp', body: b, expect: 403 });
        assert.strictEqual(r.body.code, 'MUNICIPAL_MEMBERSHIP_REQUIRED');
      }
    });

    it('solo ADMIN_MUNICIPAL administra; titular, supervisor y auditor no', async () => {
      for (const user of ['u_tit_obp', 'u_sup', 'u_aud']) {
        await call('post', '/municipalities/SJH/dependencies', { user, body: { code: 'NUE', name: 'Nueva sintética' }, expect: 403 });
        await call('post', '/municipalities/SJH/memberships', { user, body: { userId: s.fx.USERS.u_reg, role: 'CONSULTA', dependencies: ['OBP'] }, expect: 403 });
        await call('patch', `/municipalities/SJH/memberships/${mid('u_op_tes')}`, { user, body: { status: 'INACTIVA' }, expect: 403 });
      }
      await call('get', '/municipalities/SJH/memberships', { user: 'u_op_obp', expect: 403 });
    });
  });

  describe('Dependencias', () => {
    it('alta 201 con contrato; duplicado 409; validaciones 400', async () => {
      const r = await call('post', '/municipalities/SJH/dependencies', { user: 'u_admin_mun', body: { code: 'ECO', name: 'Ecología (sintética)', parentCode: 'OBP' }, expect: 201, operationId: 'createDependency' });
      assert.deepStrictEqual(r.body.data, { code: 'ECO', name: 'Ecología (sintética)', parentCode: 'OBP', status: 'ACTIVA' });
      await call('post', '/municipalities/SJH/dependencies', { user: 'u_admin_mun', body: { code: 'ECO', name: 'Otra' }, expect: 409, operationId: 'createDependency' });
      for (const body of [{ code: 'eco', name: 'Minúsculas' }, { code: 'XYZ', name: 'Padre inexistente', parentCode: 'QQQ' }, { code: 'XYZ', name: 'Autorreferencia', parentCode: 'XYZ' }, { code: 'XYZ', name: 'x' }, { code: 'XYZ', name: 'Campo extra', status: 'ACTIVA' }, { name: 'Sin código' }])
        await call('post', '/municipalities/SJH/dependencies', { user: 'u_admin_mun', body, expect: 400, operationId: 'createDependency' });
      const list = await call('get', '/municipalities/SJH/dependencies', { user: 'u_op_obp', expect: 200 });
      assert.ok(list.body.data.some((d) => d.code === 'ECO'));
    });

    it('edición 200; código inmutable; inexistente o mal formado 404', async () => {
      const r = await call('patch', '/municipalities/SJH/dependencies/OBP', { user: 'u_admin_mun', body: { name: 'Obras Públicas y Servicios' }, expect: 200, operationId: 'updateDependency' });
      assert.strictEqual(r.body.data.name, 'Obras Públicas y Servicios');
      await call('patch', '/municipalities/SJH/dependencies/OBP', { user: 'u_admin_mun', body: { code: 'OBX' }, expect: 400 });
      await call('patch', '/municipalities/SJH/dependencies/OBP', { user: 'u_admin_mun', body: {}, expect: 400 });
      await call('patch', '/municipalities/SJH/dependencies/XYZ', { user: 'u_admin_mun', body: { name: 'No existe' }, expect: 404, operationId: 'updateDependency' });
      await call('patch', '/municipalities/SJH/dependencies/ob', { user: 'u_admin_mun', body: { name: 'Mal formado' }, expect: 404 });
    });

    it('no se desactiva con expedientes abiertos (409); concluidos sí; después no admite solicitudes ni membresías', async () => {
      const a = await newRequest('u_op_tes', 'TES');
      const r = await call('patch', '/municipalities/SJH/dependencies/TES', { user: 'u_admin_mun', body: { status: 'INACTIVA' }, expect: 409, operationId: 'updateDependency' });
      assert.match(r.body.error, /expediente/);
      await call('post', `/municipalities/SJH/requests/${a.folio}/transitions`, { user: 'u_sup', body: { action: 'CANCELAR', version: 0, note: 'Cancelada para prueba sintética' }, expect: 200 });
      await call('patch', '/municipalities/SJH/dependencies/TES', { user: 'u_admin_mun', body: { status: 'INACTIVA' }, expect: 200 });
      await call('post', '/municipalities/SJH/requests', { user: 'u_vent', headers: { 'Idempotency-Key': 'f112-inactive-dep' }, body: { type: 'SOL', ownerDependency: 'TES', subject: 'Dependencia inactiva', citizenId: s.fx.oid(400), channel: 'PRESENCIAL' }, expect: 400 });
      await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { userId: s.fx.USERS.u_reg, role: 'CONSULTA', dependencies: ['TES'] }, expect: 400 });
    });

    it('no se desactiva una dependencia con subordinadas activas', async () => {
      await call('post', '/municipalities/SJH/dependencies', { user: 'u_admin_mun', body: { code: 'ECO', name: 'Ecología (sintética)', parentCode: 'AGP' }, expect: 201 });
      await call('patch', '/municipalities/SJH/dependencies/AGP', { user: 'u_admin_mun', body: { status: 'INACTIVA' }, expect: 409 });
    });
  });

  describe('Membresías: listado y alcance', () => {
    it('ADMIN ve todas las de SJH (incluidas inactivas y vencidas) y nunca las de ZZZ', async () => {
      const r = await call('get', '/municipalities/SJH/memberships', { user: 'u_admin_mun', query: { limit: '100' }, expect: 200, operationId: 'listMemberships' });
      const expected = s.memberships.filter((m) => m.municipalityId === s.fx.MUNICIPALITIES[0].id).map((m) => m.id).sort();
      assert.deepStrictEqual(r.body.data.map((m) => m.id).sort(), expected);
      assert.ok(!r.body.data.some((m) => m.id === mid('u_zzz_tit_obp')));
      assert.strictEqual(r.body.data.find((m) => m.id === mid('u_expired')).effective, false);
    });

    it('TITULAR solo ve membresías que comparten su dependencia; filtros y validación de consulta', async () => {
      const r = await call('get', '/municipalities/SJH/memberships', { user: 'u_tit_dif', expect: 200, operationId: 'listMemberships' });
      assert.ok(r.body.data.length > 0 && r.body.data.every((m) => m.dependencies.includes('DIF')));
      const op = await call('get', '/municipalities/SJH/memberships', { user: 'u_admin_mun', query: { role: 'OPERADOR_DEPENDENCIA', dependency: 'TES' }, expect: 200 });
      assert.deepStrictEqual(op.body.data.map((m) => m.userId), [s.fx.USERS.u_op_tes]);
      await call('get', '/municipalities/SJH/memberships', { user: 'u_admin_mun', query: { role: 'JEFE' }, expect: 400 });
      await call('get', '/municipalities/SJH/memberships', { user: 'u_admin_mun', query: { userId: 'x' }, expect: 400 });
    });
  });

  describe('Membresías: alta', () => {
    it('201 para un usuario central activo; da acceso solo a sus dependencias', async () => {
      const t = await newRequest('u_op_tes', 'TES');
      const o = await newRequest('u_op_obp', 'OBP');
      await call('get', '/municipalities/SJH/requests', { user: 'u_reg', expect: 403 });
      const r = await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { userId: s.fx.USERS.u_reg, role: 'CONSULTA', dependencies: ['TES'] }, expect: 201, operationId: 'createMembership' });
      assert.deepStrictEqual([r.body.data.role, r.body.data.dependencies, r.body.data.effective], ['CONSULTA', ['TES'], true]);
      const list = await call('get', '/municipalities/SJH/requests', { user: 'u_reg', expect: 200 });
      assert.deepStrictEqual(list.body.data.map((x) => x.folio), [t.folio]);
      await call('get', `/municipalities/SJH/requests/${o.folio}`, { user: 'u_reg', expect: 404 });
      assert.ok(s.store.auditEvents().some((e) => e.action === 'MEMBERSHIP_CREATED' && e.requestId && e.ip));
    });

    it('rechazos: a sí mismo 403, ADMIN 400, sin dependencias 400, dependencia ajena 400, vigencia pasada 400, duplicada 409', async () => {
      const base = { userId: s.fx.USERS.u_reg, role: 'CONSULTA', dependencies: ['OBP'] };
      await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { ...base, userId: s.fx.USERS.u_admin_mun }, expect: 403 });
      await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { ...base, role: 'ADMIN_MUNICIPAL' }, expect: 400, operationId: 'createMembership' });
      await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { ...base, dependencies: [] }, expect: 400 });
      await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { ...base, dependencies: ['QQQ'] }, expect: 400 });
      await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { ...base, validTo: '2020-01-01T00:00:00Z' }, expect: 400 });
      await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { ...base, municipalityId: 'x' }, expect: 400 });
      await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { ...base, userId: s.fx.USERS.u_tit_obp }, expect: 409, operationId: 'createMembership' });
    });

    it('usuario inexistente o INACTIVO en la identidad central → 404; identidad caída → 503', async () => {
      await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { userId: s.fx.oid(777), role: 'CONSULTA', dependencies: ['OBP'] }, expect: 404, operationId: 'createMembership' });
      await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { userId: s.INACTIVE, role: 'CONSULTA', dependencies: ['OBP'] }, expect: 404 });
      s.failLookupFor(s.fx.USERS.u_reg);
      const r = await call('post', '/municipalities/SJH/memberships', { user: 'u_admin_mun', body: { userId: s.fx.USERS.u_reg, role: 'CONSULTA', dependencies: ['OBP'] }, expect: 503 });
      assert.strictEqual(r.body.code, 'AUTHORIZATION_UNAVAILABLE');
    });
  });

  describe('Membresías: modificación y revocación', () => {
    it('revocar (INACTIVA) corta el acceso en la siguiente petición; reactivar lo devuelve', async () => {
      const t = await newRequest('u_op_tes', 'TES');
      const path = `/municipalities/SJH/memberships/${mid('u_op_tes')}`;
      const r = await call('patch', path, { user: 'u_admin_mun', body: { status: 'INACTIVA' }, expect: 200, operationId: 'updateMembership' });
      assert.strictEqual(r.body.data.effective, false);
      const denied = await call('get', `/municipalities/SJH/requests/${t.folio}`, { user: 'u_op_tes', expect: 403 });
      assert.strictEqual(denied.body.code, 'MUNICIPAL_MEMBERSHIP_REQUIRED');
      assert.deepStrictEqual((await call('get', '/me/memberships', { user: 'u_op_tes', expect: 200 })).body.data, []);
      assert.ok(s.store.auditEvents().some((e) => e.action === 'MEMBERSHIP_REVOKED'));
      await call('patch', path, { user: 'u_admin_mun', body: { status: 'ACTIVA' }, expect: 200 });
      await call('get', `/municipalities/SJH/requests/${t.folio}`, { user: 'u_op_tes', expect: 200 });
    });

    it('cambiar dependencias mueve el alcance del expediente (entra OBP, sale TES)', async () => {
      const t = await newRequest('u_op_tes', 'TES');
      const o = await newRequest('u_op_obp', 'OBP');
      await call('patch', `/municipalities/SJH/memberships/${mid('u_op_tes')}`, { user: 'u_admin_mun', body: { dependencies: ['OBP'] }, expect: 200 });
      await call('get', `/municipalities/SJH/requests/${o.folio}`, { user: 'u_op_tes', expect: 200 });
      await call('get', `/municipalities/SJH/requests/${t.folio}`, { user: 'u_op_tes', expect: 404 });
    });

    it('vencimiento: validTo futuro corta el acceso cuando llega la fecha', async () => {
      const until = new Date(s.clock().getTime() + 2 * 86400000).toISOString();
      await call('patch', `/municipalities/SJH/memberships/${mid('u_op_tes')}`, { user: 'u_admin_mun', body: { validTo: until }, expect: 200 });
      await call('get', '/municipalities/SJH/requests', { user: 'u_op_tes', expect: 200 });
      s.advance(3 * 86400000);
      await call('get', '/municipalities/SJH/requests', { user: 'u_op_tes', expect: 403 });
    });

    it('rechazos: propia 403, otra ADMIN 403, otro municipio/inexistente/mal formado 404 idéntico, validaciones 400', async () => {
      await call('patch', `/municipalities/SJH/memberships/${mid('u_admin_mun')}`, { user: 'u_admin_mun', body: { status: 'INACTIVA' }, expect: 403 });
      const foreign = await call('patch', `/municipalities/SJH/memberships/${mid('u_zzz_tit_obp')}`, { user: 'u_admin_mun', body: { status: 'INACTIVA' }, expect: 404, operationId: 'updateMembership' });
      const missing = await call('patch', `/municipalities/SJH/memberships/${s.fx.oid(888)}`, { user: 'u_admin_mun', body: { status: 'INACTIVA' }, expect: 404 });
      const malformed = await call('patch', '/municipalities/SJH/memberships/no-es-id', { user: 'u_admin_mun', body: { status: 'INACTIVA' }, expect: 404 });
      assert.deepStrictEqual(foreign.body, missing.body);
      assert.deepStrictEqual(missing.body, malformed.body);
      const p = `/municipalities/SJH/memberships/${mid('u_op_tes')}`;
      await call('patch', p, { user: 'u_admin_mun', body: { role: 'ADMIN_MUNICIPAL' }, expect: 400 });
      await call('patch', p, { user: 'u_admin_mun', body: { dependencies: [] }, expect: 400 });
      await call('patch', p, { user: 'u_admin_mun', body: { validTo: '2020-01-01T00:00:00Z' }, expect: 400 });
      await call('patch', p, { user: 'u_admin_mun', body: { userId: s.fx.USERS.u_reg }, expect: 400 });
      await call('patch', p, { user: 'u_admin_mun', body: {}, expect: 400 });
      const ok = await call('patch', `/municipalities/SJH/memberships/${mid('u_vent')}`, { user: 'u_admin_mun', body: { role: 'SUPERVISOR_MUNICIPAL', dependencies: [] }, expect: 200, operationId: 'updateMembership' });
      assert.strictEqual(ok.body.data.role, 'SUPERVISOR_MUNICIPAL');
    });

    it('un ADMIN_MUNICIPAL no puede modificar otra membresía ADMIN (reservada a bootstrap)', async () => {
      s.store.insertMembership({ id: s.fx.oid(395), userId: s.fx.USERS.u_reg, municipalityId: s.fx.MUNICIPALITIES[0].id, role: 'ADMIN_MUNICIPAL', dependencyIds: [], status: 'ACTIVA', validFrom: new Date('2026-01-01T00:00:00Z'), validTo: null, version: 0 });
      await call('patch', `/municipalities/SJH/memberships/${s.fx.oid(395)}`, { user: 'u_admin_mun', body: { status: 'INACTIVA' }, expect: 403 });
    });
  });
});
