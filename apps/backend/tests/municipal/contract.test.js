'use strict';
/*
 * Coherencia entre el contrato OpenAPI y el código de dominio municipal.
 * Usa js-yaml, presente en node_modules como dependencia transitiva de ESLint; si no está
 * instalado la suite se OMITE explícitamente (no se cuenta como aprobada).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let yaml = null;
try { yaml = require('js-yaml'); } catch (_) { /* omitida */ }

const CONTRACT = path.resolve(__dirname, '../../../../docs/munierp/contracts/municipal-v1.openapi.yaml');

(yaml ? describe : describe.skip)('Contrato municipal-v1 ↔ dominio', () => {
  const spec = yaml ? yaml.load(fs.readFileSync(CONTRACT, 'utf8')) : null;
  const schemas = spec ? spec.components.schemas : {};
  const ops = spec ? Object.values(spec.paths).flatMap((p) => ['get', 'post', 'patch', 'delete'].filter((m) => p[m]).map((m) => p[m])) : [];

  it('enums del contrato = constantes del dominio', () => {
    const { STATUSES, ACTIONS } = require('../../src/modules/municipal/domain/request-state');
    const { CHANNELS, CONFIDENTIALITY, REQUEST_TYPES } = require('../../src/modules/municipal/domain/validation');
    const { ROLES } = require('../../src/modules/municipal/policy/permissions');
    assert.deepStrictEqual(schemas.RequestStatus.enum, [...STATUSES]);
    assert.deepStrictEqual(schemas.Channel.enum, [...CHANNELS]);
    assert.deepStrictEqual(schemas.Confidentiality.enum, [...CONFIDENTIALITY]);
    assert.deepStrictEqual(schemas.RequestType.enum, [...REQUEST_TYPES]);
    assert.deepStrictEqual(schemas.MunicipalRole.enum, [...ROLES]);
    assert.deepStrictEqual(schemas.Transition.properties.action.enum, Object.keys(ACTIONS));
  });

  it('patrón de folio idéntico', () => {
    const { FOLIO_PATTERN } = require('../../src/modules/municipal/domain/folio');
    const contract = new RegExp(schemas.Folio.pattern);
    for (const f of ['SJH-OBP-SOL-2026-000042', 'SJH-OBP-SOL-26-000042', 'sjh-OBP-SOL-2026-000042'])
      assert.strictEqual(contract.test(f), FOLIO_PATTERN.test(f), f);
  });

  it('todo permiso citado existe en el catálogo y cada operación declara x-rq', () => {
    const { PERMISSIONS } = require('../../src/modules/municipal/policy/permissions');
    const { ACTIONS } = require('../../src/modules/municipal/domain/request-state');
    for (const op of ops) {
      assert.ok(Array.isArray(op['x-rq']) && op['x-rq'].length, op.operationId);
      if (op['x-permission']) assert.ok(PERMISSIONS.includes(op['x-permission']), op.operationId);
      for (const [action, permission] of Object.entries(op['x-permission-by-action'] || {}))
        assert.strictEqual(ACTIONS[action].permission, permission, action);
    }
    const covered = new Set(ops.flatMap((o) => o['x-rq']));
    assert.deepStrictEqual([...covered].sort(), ['RQ01', 'RQ02', 'RQ03', 'RQ04', 'RQ05', 'RQ06']);
  });

  it('el contrato no expone campos internos (storageKey, idempotencyKey, payloadHash)', () => {
    const text = JSON.stringify(schemas);
    for (const k of ['storageKey', 'idempotencyKey', 'payloadHash', 'sessionVersion', 'password']) assert.ok(!text.includes(k), k);
  });
});
