'use strict';

// Proceso local de QA: memoria por defecto, o Atlas QA con --mongo y guardias explícitas.
const hosted = process.argv.includes('--render');
const useMongo = hosted || process.argv.includes('--mongo');
if (useMongo && process.env.NODE_ENV === 'production') {
  console.error('El anfitrión de QA no se puede ejecutar en producción');
  process.exit(1);
}
const { randomBytes } = require('node:crypto');
const { existsSync } = require('node:fs');
const path = require('node:path');
let cloud;
const directoryWeb = path.resolve(__dirname, '../../frontend/dist');
if (process.env.RENDER === 'true' && !hosted) {
  console.error('Render QA requiere el arranque explícito --render');
  process.exit(1);
}
if (hosted) {
  try { cloud = require('./municipal-render-config.cjs').readRenderQaConfig(process.env); }
  catch (error) {
    console.error('No se pudo configurar Render QA: ' + (error.qaSafe ? error.message : error.name));
    process.exit(1);
  }
  if (!['index.html', 'app.js'].every((file) => existsSync(path.join(directoryWeb, file)))) {
    console.error('No se encontró la compilación de la web de QA');
    process.exit(1);
  }
  process.env.MUNICIPAL_STORE = 'mongo';
  process.env.MUNICIPAL_QA_DATABASE = 'munierp_qa';
  process.env.MUNICIPAL_QA_PERSIST_CONFIRM = require('./municipal-atlas-qa.cjs').CONFIRMATION;
  delete process.env.MUNICIPAL_QA_USERS_JSON;
}
const password = hosted ? null : randomBytes(8).toString('hex');
Object.assign(process.env, {
  NODE_ENV: 'test',
  TRUST_PROXY_HOPS: hosted ? '1' : '0',
  JWT_SECRET: randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
  MONGODB_URI: '',
  CORS_ORIGIN: hosted ? cloud.origin : 'http://127.0.0.1:8081',
  CORS_ORIGIN_FRONTEND: hosted ? cloud.origin : 'http://localhost:8081',
  RATE_LIMIT_MAX: '100',
});

const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
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
].filter(([name]) => !hosted || cloud.profiles.includes(name)).map(([name, id, role = 'user']) => ({
  id, name, email: name + '@demo.test', role, sessionVersion: 0, roleActive: true,
  permissions: role === 'admin' ? [...rbac.ROLE_PERMISSIONS.admin] : ['customers.read'],
  syntheticMunicipalDemo: true,
  ...(useMongo ? { syntheticMunicipalPersistence: 'atlas-qa' } : {}),
  ...(hosted ? { syntheticMunicipalHosted: true } : {}),
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
if (hosted) {
  qaRoutes.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 12, skipSuccessfulRequests: true,
    standardHeaders: true, legacyHeaders: false, message: { success: false, error: 'Demasiados intentos de inicio de sesión' } }));
}
qaRoutes.post('/auth/login', (req, res) => {
  const user = profiles.find((u) => u.email === req.body?.email);
  if (!user || (hosted ? !cloud.matchesPassword(user.name, req.body?.password) : req.body?.password !== password)) {
    return unauthorized(res);
  }
  res.set('Cache-Control', 'no-store');
  return ok(res, { user, accessToken: token(user, 'access'), refreshToken: token(user, 'refresh') });
});
qaRoutes.post('/auth/refresh', (req, res) => {
  try {
    const claims = jwt.verify(req.body?.refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = directory.get(claims.id);
    if (claims.kind !== 'refresh' || !user || claims.sv !== user.sessionVersion) return unauthorized(res);
    return ok(res.set('Cache-Control', 'no-store'), { accessToken: token(user, 'access') });
  } catch {
    return unauthorized(res);
  }
});
qaRoutes.get('/auth/me', ...identity, (req, res) => ok(res, req.user));
qaRoutes.post('/auth/logout', ...identity, (req, res) => {
  if (hosted) directory.get(req.user.id).sessionVersion += 1;
  return ok(res, null);
});
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
const seed = {
  municipalities: fx.MUNICIPALITIES,
  dependencies: fx.buildDependencies(),
  citizens: fx.buildCitizens(),
  memberships,
};

async function main() {
  const persistence = useMongo
    ? await require('./municipal-atlas-qa.cjs').openAtlasQa({ env: process.env, seed })
    : { store: createMemoryStore(seed), storage: createMemoryStorage(), close: async () => {} };
  try {
    const { store, storage } = persistence;
    const service = createMunicipalService({ store, storage, userLookup: erpUserLookup() });
    const municipalRouter = createMunicipalRouter({ service, store, identity: erpIdentityMiddlewares() });
    const qaWeb = hosted ? { directory: directoryWeb, origin: cloud.origin, isReady: persistence.isReady } : undefined;
    const app = createApp({ municipalRouter, qaRoutes, qaWeb });
    const server = await new Promise((resolve, reject) => {
      const candidate = app.listen(hosted ? cloud.port : 4314, hosted ? '0.0.0.0' : '127.0.0.1', () => resolve(candidate));
      candidate.once('error', reject);
    });
    const stop = () => server.close(() => persistence.close().catch(() => { process.exitCode = 1; }));
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    console.log(hosted ? 'MuniERP · Render QA con Atlas · solo datos sintéticos' : useMongo
      ? 'MuniERP · QA con MongoDB en Atlas (munierp_qa) · HTTP local · solo datos sintéticos'
      : 'MuniERP · HTTP local con datos sintéticos: http://127.0.0.1:4314/api/municipal/v1');
    if (useMongo) console.log('Entradas nuevas del catálogo sintético: ' + persistence.inserted);
    console.log('Perfiles: ' + profiles.map((p) => p.email).join(', '));
    if (!hosted) console.log('Clave temporal de demostración: ' + password);
  } catch (error) {
    await persistence.close().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  // El controlador puede incluir detalles de la conexión; no imprimir el objeto ni el mensaje crudo.
  const known = ['EADDRINUSE', 'EACCES'].includes(error.code) ? error.code : null;
  const reason = error.qaSafe ? error.message : known || error.name || 'error no identificado';
  console.error('No se pudo iniciar MuniERP QA: ' + reason);
  process.exitCode = 1;
});
