'use strict';
/*
 * F1-04 — Pruebas HTTP de la API municipal sobre Express AISLADO.
 * Identidad central real del ERP (JWT + requireCurrentUser); resolveAccess simulado con sinon.
 * Almacén y almacenamiento EN MEMORIA, datos sintéticos: no son pruebas reales de MongoDB.
 */
const assert = require('assert');
const request = require('supertest');
const { httpScenario, validator } = require('./http-helpers');

const PDF64 = Buffer.from('%PDF-1.4\n% documento sintetico\n').toString('base64');
const DAY = 86400000;

describe('F1-04 HTTP municipal (Express aislado)', function () {
  this.timeout(20000);
  let s;
  let n = 0;
  beforeEach(() => { s = httpScenario(); });
  afterEach(() => s.restore());

  /** Petición + comprobaciones transversales: contrato, `code` en errores y X-Request-Id. */
  async function call(method, path, { user, headers = {}, body, query, operationId, expect } = {}) {
    let req = request(s.app)[method](s.BASE + path);
    if (user) req = req.set(s.auth(user));
    for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
    if (query) req = req.query(query);
    if (body !== undefined) req = req.send(body);
    const res = await req;
    if (expect !== undefined) assert.strictEqual(res.status, expect, `${method.toUpperCase()} ${path} → ${res.status} ${JSON.stringify(res.body)}`);
    assert.ok(res.headers['x-request-id'], 'X-Request-Id siempre presente');
    if (res.status >= 400) {
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.code, `error sin code: ${JSON.stringify(res.body)}`);
      assert.ok(!/Mongo|stack|private database/i.test(JSON.stringify(res.body)), 'no filtra detalles internos');
    }
    if (validator && operationId && res.status !== 204 && (res.headers['content-type'] || '').includes('json'))
      validator.check(operationId, res.status, res.body);
    return res;
  }
  const key = () => `http-key-${String(++n).padStart(5, '0')}`;
  const body = (dep, extra = {}) => ({ type: 'SOL', ownerDependency: dep, subject: `Solicitud sintética para ${dep}`, citizenId: s.fx.oid(400), channel: 'PRESENCIAL', ...extra });
  const create = async (user, dep, extra) =>
    (await call('post', '/municipalities/SJH/requests', { user, headers: { 'Idempotency-Key': key() }, body: body(dep, extra), operationId: 'createRequest', expect: 201 })).body.data;

  describe('Identidad central (401/503) — un token válido no basta', () => {
    it('sin token, token inválido, expirado o de refresco → 401 UNAUTHORIZED', async () => {
      await call('get', '/me/memberships', { expect: 401, operationId: 'listMyMemberships' });
      await call('get', '/me/memberships', { headers: { Authorization: 'Bearer no.es.jwt' }, expect: 401 });
      await call('get', '/me/memberships', { headers: { Authorization: `Bearer ${s.token('u_tit_obp', {}, { expiresIn: -10 })}` }, expect: 401 });
      const r = await call('get', '/me/memberships', { headers: { Authorization: `Bearer ${s.token('u_tit_obp', { kind: 'refresh' })}` }, expect: 401 });
      assert.strictEqual(r.body.code, 'UNAUTHORIZED');
    });

    it('usuario INACTIVO en el ERP con membresía municipal activa → 401', async () => {
      const r = await call('get', '/municipalities/SJH/requests', { user: s.INACTIVE, expect: 401 });
      assert.strictEqual(r.body.code, 'UNAUTHORIZED');
    });

    it('sesión revocada (sessionVersion distinto) → 401', async () => {
      await call('get', '/municipalities/SJH/requests', { user: s.REVOKED, expect: 401 });
    });

    it('base de autorización caída → 503 AUTHORIZATION_UNAVAILABLE, sin detalles', async () => {
      s.setDbDown(true);
      const r = await call('get', '/municipalities/SJH/requests', { user: 'u_tit_obp', expect: 503, operationId: 'listRequests' });
      assert.strictEqual(r.body.code, 'AUTHORIZATION_UNAVAILABLE');
    });

    it('claims falsificados en el JWT (superadmin, municipal.*) no conceden acceso', async () => {
      const forged = { Authorization: `Bearer ${s.token('u_reg', { role: 'superadmin', permissions: ['municipal.requests.read'], isSuperadmin: true })}` };
      const r = await call('get', '/municipalities/SJH/requests', { headers: forged, expect: 403 });
      assert.strictEqual(r.body.code, 'MUNICIPAL_MEMBERSHIP_REQUIRED');
    });

    it('identificador o rol enviados por el cliente no se usan: cabeceras ignoradas, query y cuerpo rechazados', async () => {
      const spoof = { 'X-User-Id': s.fx.USERS.u_tit_obp, 'X-Role': 'TITULAR_DEPENDENCIA', 'X-Municipal-Role': 'SUPERVISOR_MUNICIPAL' };
      await call('get', '/municipalities/SJH/requests', { user: 'u_reg', headers: spoof, expect: 403 });
      const q = await call('get', '/municipalities/SJH/requests', { user: 'u_tit_obp', query: { userId: s.fx.USERS.u_sup }, expect: 400 });
      assert.deepStrictEqual(q.body.fields, ['userId'], 'parámetros de identidad en la consulta se rechazan');
      const r = await call('post', '/municipalities/SJH/requests', { user: 'u_vent', headers: { 'Idempotency-Key': key() }, body: { ...body('OBP'), createdBy: s.fx.USERS.u_tit_obp }, expect: 400 });
      assert.deepStrictEqual(r.body.fields, ['createdBy']);
    });

    it('ruta inexistente: 401 sin token y 404 autenticado (no revela rutas)', async () => {
      await call('get', '/no-existe', { expect: 401 });
      await call('get', '/no-existe', { user: 'u_tit_obp', expect: 404 });
    });
  });

  describe('Membresía municipal', () => {
    it('superadmin y admin del ERP → 403 MUNICIPAL_MEMBERSHIP_REQUIRED en lectura, indicadores y bitácora', async () => {
      for (const user of ['u_super_erp', 'u_admin_erp']) {
        for (const p of ['/municipalities/SJH/requests', '/municipalities/SJH/audit-events', '/municipalities/SJH/dependencies']) {
          const r = await call('get', p, { user, expect: 403 });
          assert.strictEqual(r.body.code, 'MUNICIPAL_MEMBERSHIP_REQUIRED');
        }
        await call('get', '/municipalities/SJH/indicators', { user, query: { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z' }, expect: 403 });
      }
    });

    it('/me/memberships: vacío sin membresía o vencida; datos y permisos con membresía vigente', async () => {
      assert.deepStrictEqual((await call('get', '/me/memberships', { user: 'u_reg', expect: 200, operationId: 'listMyMemberships' })).body.data, []);
      assert.deepStrictEqual((await call('get', '/me/memberships', { user: 'u_expired', expect: 200 })).body.data, []);
      const [m] = (await call('get', '/me/memberships', { user: 'u_tit_obp', expect: 200, operationId: 'listMyMemberships' })).body.data;
      assert.deepStrictEqual(m.municipality, { code: 'SJH', name: 'San Juan Huactzinco' });
      assert.deepStrictEqual(m.dependencies, ['OBP']);
      assert.ok(m.permissions.includes('municipal.requests.read'));
    });

    it('municipio inexistente = sin membresía (403); código mal formado → 400', async () => {
      const r = await call('get', '/municipalities/QQQ/requests', { user: 'u_tit_obp', expect: 403 });
      assert.strictEqual(r.body.code, 'MUNICIPAL_MEMBERSHIP_REQUIRED');
      await call('get', '/municipalities/sjh/requests', { user: 'u_tit_obp', expect: 400 });
    });

    it('membresía vencida → 403', async () => {
      await call('get', '/municipalities/SJH/requests', { user: 'u_expired', expect: 403 });
    });
  });

  describe('Solicitudes y folios (RQ01)', () => {
    it('201 con folio, ETag y DTO del contrato sin campos internos', async () => {
      const res = await call('post', '/municipalities/SJH/requests', { user: 'u_op_obp', headers: { 'Idempotency-Key': key() }, body: body('OBP'), operationId: 'createRequest', expect: 201 });
      assert.match(res.body.data.folio, /^SJH-OBP-SOL-2026-000001$/);
      assert.strictEqual(res.headers.etag, '"0"');
      for (const k of ['municipalityId', 'ownerDependencyId', 'createdBy', 'idempotencyKey', 'payloadHash', 'citizenId', 'id'])
        assert.ok(!(k in res.body.data), k);
      assert.strictEqual(res.body.data.citizen.fullName, 'Ciudadano Sintético 001');
    });

    it('Idempotency-Key ausente → 400; reintento igual → 200 mismo folio; otro cuerpo → 409', async () => {
      await call('post', '/municipalities/SJH/requests', { user: 'u_vent', body: body('OBP'), expect: 400 });
      const h = { 'Idempotency-Key': 'reintento-http-0001' };
      const a = await call('post', '/municipalities/SJH/requests', { user: 'u_vent', headers: h, body: body('OBP'), expect: 201 });
      const b = await call('post', '/municipalities/SJH/requests', { user: 'u_vent', headers: h, body: body('OBP'), expect: 200, operationId: 'createRequest' });
      assert.strictEqual(b.body.data.folio, a.body.data.folio);
      const c = await call('post', '/municipalities/SJH/requests', { user: 'u_vent', headers: h, body: body('TES'), expect: 409, operationId: 'createRequest' });
      assert.strictEqual(c.body.code, 'CONFLICT');
      assert.strictEqual(s.store.allRequests().length, 1);
    });

    it('JSON mal formado → 400; campos del servidor → 400 con lista de campos', async () => {
      const r = await request(s.app).post(s.BASE + '/municipalities/SJH/requests').set(s.auth('u_vent')).set('Idempotency-Key', key()).set('Content-Type', 'application/json').send('{"type":');
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.body.code, 'VALIDATION_ERROR');
      const x = await call('post', '/municipalities/SJH/requests', { user: 'u_vent', headers: { 'Idempotency-Key': key() }, body: { ...body('OBP'), folio: 'SJH-OBP-SOL-2026-999999', status: 'CERRADA' }, expect: 400, operationId: 'createRequest' });
      assert.deepStrictEqual(x.body.fields.sort(), ['folio', 'status']);
    });

    it('concurrencia SIMULADA: 25 POST simultáneos → 25 folios distintos y consecutivos', async () => {
      const results = await Promise.all(Array.from({ length: 25 }, () =>
        request(s.app).post(s.BASE + '/municipalities/SJH/requests').set(s.auth('u_op_obp')).set('Idempotency-Key', key()).send(body('OBP'))));
      assert.ok(results.every((r) => r.status === 201));
      const seqs = results.map((r) => Number(r.body.data.folio.slice(-6))).sort((a, b) => a - b);
      assert.deepStrictEqual(seqs, Array.from({ length: 25 }, (_, i) => i + 1));
    });

    it('colisión de folio forzada → 409 CONFLICT y sin duplicado almacenado', async () => {
      await create('u_op_obp', 'OBP');
      s.store.setCounterForTest('SJH:OBP:SOL:2026', 0);
      const r = await call('post', '/municipalities/SJH/requests', { user: 'u_op_obp', headers: { 'Idempotency-Key': key() }, body: body('OBP'), expect: 409, operationId: 'createRequest' });
      assert.strictEqual(r.body.code, 'CONFLICT');
      assert.strictEqual(s.store.allRequests().filter((x) => x.folio === 'SJH-OBP-SOL-2026-000001').length, 1);
      assert.strictEqual(s.store.counter('SJH:OBP:SOL:2026'), 0, 'rollback del contador');
    });

    it('listado: paginación, filtros válidos y rechazo de parámetros desconocidos o fuera de rango', async () => {
      for (let i = 0; i < 3; i += 1) await create('u_op_obp', 'OBP');
      const r = await call('get', '/municipalities/SJH/requests', { user: 'u_tit_obp', query: { limit: '2', page: '2' }, expect: 200, operationId: 'listRequests' });
      assert.deepStrictEqual(r.body.pagination, { page: 2, limit: 2, total: 3, pages: 2 });
      assert.strictEqual(r.body.data.length, 1);
      assert.ok(r.body.data[0].subject);
      await call('get', '/municipalities/SJH/requests', { user: 'u_tit_obp', query: { limit: '0' }, expect: 400 });
      await call('get', '/municipalities/SJH/requests', { user: 'u_tit_obp', query: { municipalityId: 'x' }, expect: 400 });
      await call('get', '/municipalities/SJH/requests', { user: 'u_tit_obp', query: { status: 'ABIERTA' }, expect: 400 });
      const tes = await call('get', '/municipalities/SJH/requests', { user: 'u_op_tes', query: { dependency: 'OBP' }, expect: 200 });
      assert.deepStrictEqual(tes.body.data, [], 'el filtro del cliente no amplía el alcance');
    });
  });

  describe('Aislamiento (RQ03) — no revelación de existencia', () => {
    it('otra dependencia, folio inexistente y folio mal formado → 404 idéntico', async () => {
      const a = await create('u_op_obp', 'OBP');
      const other = await call('get', `/municipalities/SJH/requests/${a.folio}`, { user: 'u_op_tes', expect: 404, operationId: 'getRequest' });
      const missing = await call('get', '/municipalities/SJH/requests/SJH-OBP-SOL-2026-000777', { user: 'u_op_tes', expect: 404 });
      const malformed = await call('get', '/municipalities/SJH/requests/no-es-folio', { user: 'u_op_tes', expect: 404 });
      assert.deepStrictEqual(other.body, missing.body);
      assert.deepStrictEqual(missing.body, malformed.body);
      const denied = s.store.auditEvents().filter((e) => e.action === 'ACCESS_DENIED');
      assert.strictEqual(denied.length, 1);
      assert.strictEqual(denied[0].folio, a.folio);
      assert.ok(denied[0].requestId && denied[0].ip, 'la denegación registra requestId e IP');
    });

    it('entre municipios: ZZZ no entra a SJH (403) y un folio de ZZZ por SJH es 404', async () => {
      const z = (await call('post', '/municipalities/ZZZ/requests', { user: 'u_zzz_tit_obp', headers: { 'Idempotency-Key': key() }, body: { ...body('OBP'), citizenId: s.fx.oid(411) }, expect: 201 })).body.data;
      await call('get', '/municipalities/SJH/requests', { user: 'u_zzz_tit_obp', expect: 403 });
      await call('get', `/municipalities/SJH/requests/${z.folio}`, { user: 'u_tit_obp', expect: 404 });
      await call('get', `/municipalities/ZZZ/requests/${z.folio}`, { user: 'u_tit_obp', expect: 403 });
    });

    it('auditor recibe solo RequestSummary (sin asunto, ciudadano ni historial)', async () => {
      const a = await create('u_op_obp', 'OBP');
      const r = await call('get', `/municipalities/SJH/requests/${a.folio}`, { user: 'u_aud', expect: 200, operationId: 'getRequest' });
      for (const k of ['subject', 'description', 'citizen', 'history', 'version']) assert.ok(!(k in r.body.data), k);
      const list = await call('get', '/municipalities/SJH/requests', { user: 'u_aud', expect: 200, operationId: 'listRequests' });
      assert.ok(!('subject' in list.body.data[0]));
      await call('get', `/municipalities/SJH/requests/${a.folio}/history`, { user: 'u_aud', expect: 403 });
    });

    it('verificación de folio respeta el mismo alcance', async () => {
      const a = await create('u_op_obp', 'OBP');
      const r = await call('get', `/municipalities/SJH/folios/${a.folio}`, { user: 'u_tit_obp', expect: 200, operationId: 'verifyFolio' });
      assert.deepStrictEqual([r.body.data.year, r.body.data.sequence, r.body.data.ownerDependency], [2026, 1, 'OBP']);
      await call('get', `/municipalities/SJH/folios/${a.folio}`, { user: 'u_op_tes', expect: 404 });
    });
  });

  describe('Edición, transiciones e historial (RQ02)', () => {
    it('PATCH: sin If-Match 400, versión obsoleta 409, correcto 200 con historial EDITAR', async () => {
      const a = await create('u_op_obp', 'OBP');
      const path = `/municipalities/SJH/requests/${a.folio}`;
      await call('patch', path, { user: 'u_tit_obp', body: { subject: 'Asunto corregido sintético' }, expect: 400 });
      await call('patch', path, { user: 'u_tit_obp', headers: { 'If-Match': '"7"' }, body: { subject: 'Asunto corregido sintético' }, expect: 409, operationId: 'updateRequest' });
      const r = await call('patch', path, { user: 'u_tit_obp', headers: { 'If-Match': '"0"' }, body: { subject: 'Asunto corregido sintético' }, expect: 200, operationId: 'updateRequest' });
      assert.strictEqual(r.headers.etag, '"1"');
      const last = r.body.data.history[r.body.data.history.length - 1];
      assert.deepStrictEqual([last.action, last.fromStatus, last.toStatus, last.actorId], ['EDITAR', 'REGISTRADA', 'REGISTRADA', s.fx.USERS.u_tit_obp]);
      await call('patch', path, { user: 'u_tit_obp', headers: { 'If-Match': '"1"' }, body: { folio: 'X' }, expect: 400 });
    });

    it('PATCH de confidencialidad sin readConfidential → 403; operador no asignado → 403', async () => {
      const a = await create('u_op_obp', 'OBP');
      await call('patch', `/municipalities/SJH/requests/${a.folio}`, { user: 'u_op_obp', headers: { 'If-Match': '0' }, body: { subject: 'Cambio de operador no asignado' }, expect: 403 });
      await call('post', `/municipalities/SJH/requests/${a.folio}/transitions`, { user: 'u_tit_obp', body: { action: 'ASIGNAR', version: 0, assignedUserId: s.fx.USERS.u_op_obp }, expect: 200 });
      await call('patch', `/municipalities/SJH/requests/${a.folio}`, { user: 'u_op_obp', headers: { 'If-Match': '1' }, body: { confidentiality: 'PUBLICA' }, expect: 200 });
      await call('patch', `/municipalities/SJH/requests/${a.folio}`, { user: 'u_op_obp', headers: { 'If-Match': '2' }, body: { confidentiality: 'CONFIDENCIAL' }, expect: 403 });
    });

    it('transiciones: 200 válida, 409 inválida/obsoleta, 403 sin permiso, 400 forma incorrecta', async () => {
      const a = await create('u_op_obp', 'OBP');
      const t = (user, b, expect) => call('post', `/municipalities/SJH/requests/${a.folio}/transitions`, { user, body: b, expect, operationId: 'transitionRequest' });
      await t('u_op_obp', { action: 'TURNAR', version: 0, toDependencies: ['TES'] }, 403);
      await t('u_tit_obp', { action: 'TURNAR', version: 0 }, 400);
      await t('u_tit_obp', { action: 'TURNAR', version: 0, toDependencies: ['TES'], extra: 1 }, 400);
      await t('u_tit_obp', { action: 'VOLAR', version: 0 }, 400);
      const ok = await t('u_tit_obp', { action: 'TURNAR', version: 0, toDependencies: ['OBP', 'TES'] }, 200);
      assert.strictEqual(ok.headers.etag, '"1"');
      assert.deepStrictEqual(ok.body.data.assignedDependencies, ['TES']);
      const stale = await t('u_tit_obp', { action: 'ESPERAR_CIUDADANO', version: 0 }, 409);
      assert.strictEqual(stale.body.code, 'CONFLICT');
      await t('u_tit_obp', { action: 'CERRAR', version: 1, note: 'Atendida en sitio' }, 200);
      const invalid = await t('u_tit_obp', { action: 'REANUDAR', version: 2 }, 409);
      assert.strictEqual(invalid.body.code, 'INVALID_TRANSITION');
    });

    it('historial: actor, fecha y estados en cada cambio; la dependencia turnada gana lectura', async () => {
      const a = await create('u_op_obp', 'OBP');
      s.advance(DAY);
      await call('post', `/municipalities/SJH/requests/${a.folio}/transitions`, { user: 'u_tit_obp', body: { action: 'TURNAR', version: 0, toDependencies: ['TES'] }, expect: 200 });
      await call('get', `/municipalities/SJH/requests/${a.folio}`, { user: 'u_op_tes', expect: 200 });
      const h = await call('get', `/municipalities/SJH/requests/${a.folio}/history`, { user: 'u_tit_obp', expect: 200, operationId: 'getRequestHistory' });
      assert.deepStrictEqual(h.body.data.map((e) => [e.action, e.fromStatus, e.toStatus]), [['REGISTRAR', null, 'REGISTRADA'], ['TURNAR', 'REGISTRADA', 'EN_TRAMITE']]);
      assert.deepStrictEqual(h.body.data[1].toDependencies, ['TES']);
      assert.ok(h.body.data.every((e) => e.actorId && !Number.isNaN(Date.parse(e.at))));
    });

    it('acuse presencial sin datos de contacto (RQ06)', async () => {
      const a = await create('u_vent', 'AGP');
      const r = await call('get', `/municipalities/SJH/requests/${a.folio}/receipt`, { user: 'u_vent', expect: 200, operationId: 'getRequestReceipt' });
      assert.strictEqual(r.body.data.dependency, 'Agua Potable');
      for (const k of ['email', 'phone', 'citizen', 'description']) assert.ok(!(k in r.body.data), k);
    });
  });

  describe('Concesiones por expediente', () => {
    it('crear 201 → acceso; revocar 204 → 404; revocar de nuevo 404; validaciones 400', async () => {
      const a = await create('u_op_obp', 'OBP');
      const base = `/municipalities/SJH/requests/${a.folio}/grants`;
      await call('post', base, { user: 'u_tit_obp', body: { level: 'READ', granteeUserId: s.fx.USERS.u_reg }, expect: 400 });
      await call('post', base, { user: 'u_tit_obp', body: { level: 'READ', granteeUserId: s.fx.USERS.u_op_tes, granteeDependency: 'TES' }, expect: 400 });
      await call('post', base, { user: 'u_op_obp', body: { level: 'READ', granteeUserId: s.fx.USERS.u_op_tes }, expect: 403 });
      const g = await call('post', base, { user: 'u_tit_obp', body: { level: 'READ', granteeUserId: s.fx.USERS.u_op_tes }, expect: 201, operationId: 'createGrant' });
      await call('get', `/municipalities/SJH/requests/${a.folio}`, { user: 'u_op_tes', expect: 200 });
      const del = await request(s.app).delete(`${s.BASE}${base}/${g.body.data.id}`).set(s.auth('u_tit_obp'));
      assert.strictEqual(del.status, 204);
      assert.strictEqual(del.text, '');
      await call('get', `/municipalities/SJH/requests/${a.folio}`, { user: 'u_op_tes', expect: 404 });
      await call('delete', `${base}/${g.body.data.id}`, { user: 'u_tit_obp', expect: 404 });
      await call('delete', `${base}/no-es-id`, { user: 'u_tit_obp', expect: 404 });
    });
  });

  describe('Documentos privados (RQ05)', () => {
    const up = (user, folio, extra = {}, expect) => call('post', `/municipalities/SJH/requests/${folio}/documents`, { user, body: { filename: 'Oficio sintético.pdf', mimeType: 'application/pdf', contentBase64: PDF64, ...extra }, expect, operationId: 'uploadDocument' });

    it('subida 201 (sin storageKey); MIME falso 400; > 5 MB 413; expediente concluido 409', async () => {
      const a = await create('u_op_obp', 'OBP');
      const d = (await up('u_op_obp', a.folio, {}, 201)).body.data;
      assert.ok(!('storageKey' in d));
      await up('u_op_obp', a.folio, { contentBase64: Buffer.from('<script>').toString('base64') }, 400);
      const big = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(5 * 1024 * 1024)]).toString('base64');
      const r = await up('u_op_obp', a.folio, { contentBase64: big }, 413);
      assert.strictEqual(r.body.code, 'PAYLOAD_TOO_LARGE');
      await call('post', `/municipalities/SJH/requests/${a.folio}/transitions`, { user: 'u_tit_obp', body: { action: 'CANCELAR', version: 0, note: 'Cancelada por duplicado' }, expect: 200 });
      await up('u_tit_obp', a.folio, {}, 409);
    });

    it('descarga autorizada: bytes exactos y cabeceras privadas', async () => {
      const a = await create('u_op_obp', 'OBP');
      const d = (await up('u_op_obp', a.folio, {}, 201)).body.data;
      const r = await request(s.app).get(`${s.BASE}/municipalities/SJH/requests/${a.folio}/documents/${d.id}/content`).set(s.auth('u_tit_obp')).buffer(true).parse((res, cb) => { const c = []; res.on('data', (x) => c.push(x)); res.on('end', () => cb(null, Buffer.concat(c))); });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.toString('base64'), PDF64);
      assert.match(r.headers['content-disposition'], /^attachment;/);
      assert.strictEqual(r.headers['cache-control'], 'no-store');
      assert.strictEqual(r.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(r.headers['content-type'], 'application/pdf');
    });

    it('descarga no autorizada: otra dependencia 404, admin ERP 403, ADMIN_MUNICIPAL 403, id inexistente o mal formado 404', async () => {
      const a = await create('u_op_obp', 'OBP');
      const d = (await up('u_op_obp', a.folio, {}, 201)).body.data;
      const p = (id) => `/municipalities/SJH/requests/${a.folio}/documents/${id}/content`;
      await call('get', p(d.id), { user: 'u_op_tes', expect: 404 });
      await call('get', p(d.id), { user: 'u_admin_erp', expect: 403 });
      await call('get', p(d.id), { user: 'u_admin_mun', expect: 403 });
      await call('get', p(s.fx.oid(999)), { user: 'u_tit_obp', expect: 404 });
      await call('get', p('../../etc'), { user: 'u_tit_obp', expect: 404 });
      assert.ok(!JSON.stringify(s.store.auditEvents()).includes(PDF64), 'contenido nunca en bitácora');
    });

    it('documento CONFIDENCIAL listado como restringido para CONSULTA y no descargable', async () => {
      const a = await create('u_op_obp', 'OBP');
      const d = (await up('u_tit_obp', a.folio, { confidentiality: 'CONFIDENCIAL' }, 201)).body.data;
      const list = await call('get', `/municipalities/SJH/requests/${a.folio}/documents`, { user: 'u_consulta_obp', expect: 200, operationId: 'listDocuments' });
      assert.deepStrictEqual(list.body.data, [{ id: d.id, confidentiality: 'CONFIDENCIAL', restricted: true }]);
      await call('get', `/municipalities/SJH/requests/${a.folio}/documents/${d.id}/content`, { user: 'u_consulta_obp', expect: 404 });
    });
  });

  describe('Indicadores (RQ04), ciudadanos y bitácora', () => {
    it('indicadores: cifras exactas del alcance; parámetros obligatorios y rango', async () => {
      await create('u_op_obp', 'OBP');
      await create('u_op_obp', 'OBP', { channel: 'TELEFONO' });
      await create('u_op_tes', 'TES');
      const q = { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z' };
      const r = await call('get', '/municipalities/SJH/indicators', { user: 'u_tit_obp', query: q, expect: 200, operationId: 'getIndicators' });
      assert.strictEqual(r.body.data.total, 2);
      assert.deepStrictEqual(r.body.data.byDependency, { OBP: 2 });
      assert.deepStrictEqual(r.body.data.byChannel, { PRESENCIAL: 1, TELEFONO: 1, WEB_FUNCIONARIO: 0 });
      assert.strictEqual((await call('get', '/municipalities/SJH/indicators', { user: 'u_sup', query: q, expect: 200 })).body.data.total, 3);
      await call('get', '/municipalities/SJH/indicators', { user: 'u_tit_obp', query: { from: q.from }, expect: 400 });
      await call('get', '/municipalities/SJH/indicators', { user: 'u_tit_obp', query: { from: q.to, to: q.from }, expect: 400 });
      await call('get', '/municipalities/SJH/indicators', { user: 'u_tit_obp', query: { ...q, slaDays: '0' }, expect: 400 });
      await call('get', '/municipalities/SJH/indicators', { user: 'u_op_tes', query: q, expect: 403 });
    });

    it('ciudadanos: alta 201, CURP 400, búsqueda corta 400, alcance por dependencia', async () => {
      const c = await call('post', '/municipalities/SJH/citizens', { user: 'u_op_obp', body: { fullName: 'Ciudadana Sintética Nueva', email: 'nueva@example.org' }, expect: 201, operationId: 'createCitizen' });
      await call('post', '/municipalities/SJH/citizens', { user: 'u_op_obp', body: { fullName: 'GOMC800101HTLRRR09' }, expect: 400 });
      await call('get', '/municipalities/SJH/citizens', { user: 'u_op_obp', query: { q: 'ab' }, expect: 400 });
      const mine = await call('get', '/municipalities/SJH/citizens', { user: 'u_op_obp', query: { q: 'Nueva' }, expect: 200, operationId: 'searchCitizens' });
      assert.deepStrictEqual(mine.body.data.map((x) => x.id), [c.body.data.id]);
      const tes = await call('get', '/municipalities/SJH/citizens', { user: 'u_op_tes', query: { q: 'Nueva' }, expect: 200 });
      assert.deepStrictEqual(tes.body.data, []);
      await call('post', '/municipalities/SJH/citizens', { user: 'u_aud', body: { fullName: 'No debe crearse' }, expect: 403 });
    });

    it('bitácora: solo auditor; eventos con IP y X-Request-Id propagado', async () => {
      await call('post', '/municipalities/SJH/requests', { user: 'u_op_obp', headers: { 'Idempotency-Key': key(), 'X-Request-Id': 'trace-abc-12345' }, body: body('OBP'), expect: 201 });
      await call('get', '/municipalities/SJH/audit-events', { user: 'u_tit_obp', expect: 403 });
      const r = await call('get', '/municipalities/SJH/audit-events', { user: 'u_aud', expect: 200, operationId: 'listAuditEvents' });
      const created = r.body.data.find((e) => e.action === 'REQUEST_CREATED');
      assert.strictEqual(created.requestId, 'trace-abc-12345');
      assert.ok(created.ip);
      await call('get', '/municipalities/SJH/audit-events', { user: 'u_aud', query: { from: 'ayer' }, expect: 400 });
    });

    it('dependencias: lista ordenada con filtro de estado', async () => {
      const r = await call('get', '/municipalities/SJH/dependencies', { user: 'u_op_obp', query: { status: 'ACTIVA' }, expect: 200, operationId: 'listDependencies' });
      assert.deepStrictEqual(r.body.data.map((d) => d.code), ['AGP', 'DIF', 'OBP', 'PRE', 'RCI', 'SEC', 'SEG', 'TES']);
    });
  });

  describe('Operaciones pendientes (F1-12)', () => {
    it('responden 501 NOT_IMPLEMENTED solo tras autenticar; sin token 401', async () => {
      await call('post', '/municipalities/SJH/dependencies', { body: { code: 'NUE', name: 'Nueva' }, expect: 401 });
      const r = await call('post', '/municipalities/SJH/dependencies', { user: 'u_admin_mun', body: { code: 'NUE', name: 'Nueva' }, expect: 501, operationId: 'createDependency' });
      assert.strictEqual(r.body.code, 'NOT_IMPLEMENTED');
      await call('get', '/municipalities/SJH/memberships', { user: 'u_admin_mun', expect: 501, operationId: 'listMemberships' });
    });
  });
});
