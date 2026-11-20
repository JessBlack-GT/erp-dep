'use strict';

// Ejecutar solo como proceso dedicado de demostración. No importa server.js ni conecta a MongoDB.
const { randomBytes } = require('node:crypto');
const password = randomBytes(8).toString('hex');
Object.assign(process.env, {
  NODE_ENV: 'test',
  TRUST_PROXY_HOPS: '0',
  JWT_SECRET: randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
  MONGODB_URI: '',
  CORS_ORIGIN: 'http://127.0.0.1:8081',
  CORS_ORIGIN_FRONTEND: 'http://localhost:8081',
  RATE_LIMIT_MAX: '100',
});

const express = require('express');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const rbac = require('../src/security/rbac');
const { authenticateToken } = require('../src/middleware/authenticate');
const { requireCurrentUser } = require('../src/middleware/authorize');
const { erpIdentityMiddlewares, erpUserLookup } = require('../src/modules/municipal/http/erp-identity');
const { createMunicipalRouter } = require('../src/modules/municipal/http/municipal.router');
const { createMunicipalService } = require('../src/modules/municipal/application/municipal.service');
const { createMemoryStore } = require('../src/modules/municipal/mocks/in-memory-store');
const { createMemoryStorage } = require('../src/modules/municipal/storage/memory-storage');
const fx = require('../src/modules/municipal/mocks/fixtures');

const profiles = [
  ['ventanilla', fx.USERS.u_vent], ['obras', fx.USERS.u_tit_obp], ['auditor', fx.USERS.u_aud],
  ['municipal', fx.USERS.u_admin_mun], ['comercial', fx.USERS.u_admin_erp, 'admin'],
  ['otro', fx.USERS.u_zzz_tit_obp], ['dosmunicipios', fx.USERS.u_sup],
].map(([name, id, role = 'user']) => ({
  id, name, email: name + '@demo.test', role, sessionVersion: 0, roleActive: true,
  permissions: role === 'admin' ? [...rbac.ROLE_PERMISSIONS.admin] : ['customers.read'],
  syntheticMunicipalDemo: true,
}));
const directory = new Map(profiles.map((user) => [user.id, user]));
// La sustitución solo vive en este proceso de QA. Se conservan los middlewares centrales.
rbac.resolveAccess = async (id) => directory.get(id) || null;
const token = (user, kind) => jwt.sign(
  { id: user.id, kind, sv: user.sessionVersion },
  kind === 'access' ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET,
  { expiresIn: kind === 'access' ? '15m' : '1h' },
);
const ok = (res, data) => res.json({ success: true, data });
const unauthorized = (res) => res.status(401).json({ success: false, error: 'Sesión de demostración no válida' });
const identity = [authenticateToken, requireCurrentUser];
const qaRoutes = express.Router();
qaRoutes.post('/auth/login', (req, res) => {
  const user = profiles.find((u) => u.email === req.body?.email);
  if (!user || req.body?.password !== password) return unauthorized(res);
  return ok(res, { user, accessToken: token(user, 'access'), refreshToken: token(user, 'refresh') });
});
qaRoutes.post('/auth/refresh', (req, res) => {
  try {
    const claims = jwt.verify(req.body?.refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = directory.get(claims.id);
    if (claims.kind !== 'refresh' || !user || claims.sv !== user.sessionVersion) return unauthorized(res);
    return ok(res, { accessToken: token(user, 'access') });
  } catch {
    return unauthorized(res);
  }
});
qaRoutes.get('/auth/me', ...identity, (req, res) => ok(res, req.user));
qaRoutes.post('/auth/logout', ...identity, (_req, res) => ok(res, null));
qaRoutes.get('/customers', ...identity, (_req, res) => res.json({
  success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
}));
qaRoutes.get('/customers/stats', ...identity, (_req, res) => ok(res, { total: 0, active: 0, inactive: 0 }));
qaRoutes.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/ready') return next();
  return res.status(404).json({ success: false, error: 'Ruta fuera del alcance del ensayo local' });
});

const memberships = fx.buildMemberships(new Date());
memberships.push({
  ...memberships.find((member) => member.userId === fx.USERS.u_zzz_tit_obp),
  userId: fx.USERS.u_sup,
  id: fx.oid(399),
});
const store = createMemoryStore({
  municipalities: fx.MUNICIPALITIES,
  dependencies: fx.buildDependencies(),
  citizens: fx.buildCitizens(),
  memberships,
});
const service = createMunicipalService({ store, storage: createMemoryStorage(), userLookup: erpUserLookup() });
const municipalRouter = createMunicipalRouter({ service, store, identity: erpIdentityMiddlewares() });
const app = createApp({ municipalRouter, qaRoutes });
app.listen(4314, '127.0.0.1', () => {
  console.log('MuniERP · HTTP local con datos sintéticos: http://127.0.0.1:4314/api/municipal/v1');
  console.log('Perfiles: ' + profiles.map((p) => p.email).join(', '));
  console.log('Clave temporal de demostración: ' + password);
});
