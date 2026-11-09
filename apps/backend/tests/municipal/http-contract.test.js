'use strict';
/* F1-04 — Sincronía entre rutas implementadas y el contrato OpenAPI (requiere js-yaml; si falta, se omite). */
const assert = require('assert');
const { listRoutes, PENDING } = require('../../src/modules/municipal/http/municipal.router');
const { validator } = require('./http-helpers');

(validator ? describe : describe.skip)('F1-04 rutas ↔ OpenAPI', () => {
  const spec = validator ? validator.spec : null;
  const ops = spec
    ? Object.entries(spec.paths).flatMap(([path, item]) =>
        ['get', 'post', 'patch', 'delete'].filter((m) => item[m]).map((method) => ({ method, path, operationId: item[method].operationId, pending: item[method]['x-status'] === 'pending' })))
    : [];
  const key = (o) => `${o.method.toUpperCase()} ${o.path} ${o.operationId}`;

  it('cada operación del contrato tiene exactamente una ruta con el mismo método, ruta y operationId', () => {
    assert.deepStrictEqual(listRoutes().map(key).sort(), ops.map(key).sort());
    assert.strictEqual(ops.length, 24);
  });

  it('las operaciones pendientes coinciden (x-status: pending ↔ 501) y el resto está implementado', () => {
    const pendingInSpec = ops.filter((o) => o.pending).map((o) => o.operationId).sort();
    assert.deepStrictEqual(pendingInSpec, Object.keys(PENDING).sort());
    for (const r of listRoutes()) assert.strictEqual(r.implemented, !PENDING[r.operationId], r.operationId);
  });

  it('toda operación documenta 401 y 503 (identidad central) y las pendientes 501', () => {
    for (const [, item] of Object.entries(spec.paths))
      for (const m of ['get', 'post', 'patch', 'delete'])
        if (item[m]) {
          assert.ok(item[m].responses['401'] && item[m].responses['503'], item[m].operationId);
          if (item[m]['x-status'] === 'pending') assert.ok(item[m].responses['501'], item[m].operationId);
        }
  });
});
