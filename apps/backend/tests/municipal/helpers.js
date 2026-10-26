'use strict';
/** Escenario sintético compartido por las pruebas municipales. Sin red, sin base de datos. */
const fx = require('../../src/modules/municipal/mocks/fixtures');
const { createMemoryStore } = require('../../src/modules/municipal/mocks/in-memory-store');
const { createMemoryStorage } = require('../../src/modules/municipal/storage/memory-storage');
const { createMunicipalService } = require('../../src/modules/municipal/application/municipal.service');
const { buildAccessContext } = require('../../src/modules/municipal/policy/context');

const T0 = new Date('2026-10-01T15:00:00Z');

function scenario({ now = T0 } = {}) {
  let current = new Date(now.getTime());
  const clock = () => new Date(current.getTime());
  const dependencies = fx.buildDependencies();
  const memberships = fx.buildMemberships(now);
  const store = createMemoryStore({ municipalities: fx.MUNICIPALITIES, dependencies, citizens: fx.buildCitizens() });
  const storage = createMemoryStorage();
  const service = createMunicipalService({ store, storage, clock });
  const munId = (code) => fx.MUNICIPALITIES.find((m) => m.code === code).id;
  /** ctx como lo construiría la capa HTTP; `erpRole` se pasa para demostrar que se ignora. */
  const ctx = (userKey, mun = 'SJH', erpRole = 'user') =>
    buildAccessContext({
      erpAccess: { id: fx.USERS[userKey], role: erpRole, permissions: ['customers.read'], isSuperadmin: erpRole === 'superadmin' },
      memberships, grants: store.grantsFor(munId(mun)), municipalityId: munId(mun), now: clock(),
    });
  let k = 0;
  const key = () => `test-key-${String(++k).padStart(4, '0')}`;
  const citizen = (n = 0) => fx.oid(400 + n);
  const body = (dep, extra = {}) => ({ type: 'SOL', ownerDependency: dep, subject: `Solicitud sintética para ${dep}`, citizenId: citizen(), channel: 'PRESENCIAL', ...extra });
  return {
    fx, store, storage, service, memberships, dependencies, ctx, key, body, citizen, munId,
    advance: (ms) => { current = new Date(current.getTime() + ms); },
    setNow: (d) => { current = new Date(d.getTime()); },
    clock,
    grant: (g) => store.addGrant(g),
  };
}

/** Espera un error con statusCode/code concretos. */
async function rejects(fn, statusCode, code) {
  const assert = require('assert');
  let error;
  try { await fn(); } catch (e) { error = e; }
  assert.ok(error, `Se esperaba error ${statusCode}`);
  assert.strictEqual(error.statusCode, statusCode, `statusCode ${error.statusCode} (${error.code}: ${error.message})`);
  if (code) assert.strictEqual(error.code, code);
  return error;
}

module.exports = { scenario, rejects, T0 };
