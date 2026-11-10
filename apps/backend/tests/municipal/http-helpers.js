'use strict';
/**
 * Escenario HTTP aislado para MuniERP: app Express propia con el router municipal y la identidad
 * CENTRAL REAL del ERP (authenticateToken + requireCurrentUser). Solo `rbac.resolveAccess` se
 * sustituye con sinon (igual que en las pruebas del ERP), porque consulta MongoDB.
 * Todo en memoria y con datos sintéticos: NADA de esto es una prueba real contra MongoDB.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'isolated-test-secret-not-for-deployment';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'isolated-refresh-secret-not-for-deployment';

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const sinon = require('sinon');
const rbac = require('../../src/security/rbac');
const fx = require('../../src/modules/municipal/mocks/fixtures');
const { createMemoryStore } = require('../../src/modules/municipal/mocks/in-memory-store');
const { createMemoryStorage } = require('../../src/modules/municipal/storage/memory-storage');
const { createIsolatedMunicipalApp } = require('../../src/modules/municipal/http/isolated-app');

const BASE = '/api/municipal/v1';
const T0 = new Date('2026-10-01T15:00:00Z');
const INACTIVE = fx.oid(215);
const REVOKED = fx.oid(216);

/** Acceso como lo devolvería resolveAccess del ERP. */
function erpAccess(id, role = 'user', sessionVersion = 0) {
  const isSuperadmin = role === 'superadmin';
  const access = { id, email: `${id}@example.org`, role, permissions: isSuperadmin ? [...rbac.PERMISSIONS] : role === 'admin' ? [...rbac.ROLE_PERMISSIONS.admin] : [], isSuperadmin, roleActive: true };
  Object.defineProperty(access, 'sessionVersion', { value: sessionVersion });
  return access;
}

function httpScenario({ now = T0 } = {}) {
  let current = new Date(now.getTime());
  const clock = () => new Date(current.getTime());
  const memberships = fx.buildMemberships(now);
  // Usuario INACTIVO en el ERP pero con membresía municipal activa: el ERP debe bloquearlo.
  memberships.push({ ...memberships.find((m) => m.role === 'TITULAR_DEPENDENCIA'), id: fx.oid(390), userId: INACTIVE });
  memberships.push({ ...memberships.find((m) => m.role === 'TITULAR_DEPENDENCIA'), id: fx.oid(391), userId: REVOKED });
  const store = createMemoryStore({ municipalities: fx.MUNICIPALITIES, dependencies: fx.buildDependencies(), citizens: fx.buildCitizens(), memberships });
  const storage = createMemoryStorage();
  const { app } = createIsolatedMunicipalApp({ store, storage, clock });

  const directory = new Map(Object.entries(fx.USERS).map(([key, id]) => [id, erpAccess(id, key === 'u_super_erp' ? 'superadmin' : key === 'u_admin_erp' ? 'admin' : 'user')]));
  directory.set(REVOKED, erpAccess(REVOKED, 'user', 3)); // sesión revocada: el token trae sv 0
  // INACTIVE no está en el directorio: resolveAccess devuelve null, como para status !== 'active'.
  let dbDown = false;
  const failFor = new Set();
  const stub = sinon.stub(rbac, 'resolveAccess').callsFake(async (id) => {
    if (dbDown || failFor.has(id)) throw Object.assign(new Error('private database detail'), { name: 'MongoNetworkError' });
    return directory.get(id) || null;
  });

  const token = (userKey, extra = {}, options = {}) => {
    const id = fx.USERS[userKey] || userKey;
    return jwt.sign({ id, sv: 0, kind: 'access', ...extra }, process.env.JWT_SECRET, { expiresIn: '15m', ...options });
  };
  const auth = (userKey, extra, options) => ({ Authorization: `Bearer ${token(userKey, extra, options)}` });

  return {
    app, store, storage, clock, memberships, fx, BASE, INACTIVE, REVOKED,
    token, auth,
    setDbDown: (v) => { dbDown = v; },
    /** Falla la consulta central solo para un usuario (p. ej. el destinatario de una membresía). */
    failLookupFor: (id) => failFor.add(id),
    advance: (ms) => { current = new Date(current.getTime() + ms); },
    restore: () => stub.restore(),
  };
}

/* ---- Validación de respuestas contra los esquemas del contrato (ajv 6 + js-yaml, transitivas de ESLint) ---- */
let validator = null;
try {
  const yaml = require('js-yaml');
  const Ajv = require('ajv');
  const spec = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../../../docs/munierp/contracts/municipal-v1.openapi.yaml'), 'utf8'));
  const ajv = new Ajv({ allErrors: true, nullable: true, unknownFormats: 'ignore', schemaId: 'auto' });
  ajv.addSchema({ $id: 'spec', components: spec.components }, 'spec');
  validator = {
    spec,
    /** Valida `body` contra el esquema de la respuesta `status` de la operación. */
    check(operationId, status, body) {
      const op = Object.values(spec.paths).flatMap((p) => Object.values(p)).find((o) => o && o.operationId === operationId);
      if (!op) throw new Error('Operación inexistente en el contrato: ' + operationId);
      let response = op.responses[String(status)];
      if (!response) throw new Error(`${operationId} no documenta la respuesta ${status}`);
      if (response.$ref) response = spec.components.responses[response.$ref.split('/').pop()];
      const media = response.content && response.content['application/json'];
      if (!media) return; // binario o sin cuerpo
      const schema = JSON.parse(JSON.stringify(media.schema).replace(/#\/components\//g, 'spec#/components/'));
      const ok = ajv.validate(schema, body);
      if (!ok) throw new Error(`${operationId} ${status} no cumple el contrato: ${ajv.errorsText(ajv.errors)}\n${JSON.stringify(body).slice(0, 400)}`);
    },
  };
} catch (_) {
  validator = null;
}

module.exports = { httpScenario, erpAccess, validator, BASE, T0, INACTIVE, REVOKED };
