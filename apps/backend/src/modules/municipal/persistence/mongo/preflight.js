// @ts-check
'use strict';
/**
 * Preflight de SOLO LECTURA para la base QA municipal `munierp_qa` (C-05). No se conecta por sí mismo:
 *
 *  - `planPreflight(env)` es puro: aplica la guardia de QA y describe qué se comprobaría, sin red.
 *  - `runPreflight({ env, connect, confirmation })` solo llama a `connect()` (inyectado) si la guardia
 *    autoriza Y la confirmación literal es `PREFLIGHT_CONFIRMATION`. Con la conexión emite únicamente
 *    comandos de lectura: hello, buildInfo, connectionStatus{showPrivileges} y listCollections(nameOnly).
 *    Nunca crea, modifica ni borra nada.
 *
 * Resultado: evidencia JSON sin secretos (la URI no se incluye; solo el host enmascarado).
 */
const { checkQaPersistence, REQUIRED_DB, databaseInUri } = require('../qa-guard');

const PREFLIGHT_CONFIRMATION = 'solo-lectura:munierp_qa';
/** Comandos permitidos (todos de lectura). Cualquier otro uso del doble/cliente es un error de diseño. */
const READ_ONLY_COMMANDS = Object.freeze(['hello', 'buildInfo', 'connectionStatus', 'listCollections']);
/** Acciones que el usuario de la aplicación necesita sobre munierp_qa. */
const REQUIRED_ACTIONS = Object.freeze(['find', 'insert', 'update', 'listCollections', 'listIndexes']);
/** Acciones necesarias solo para instalar (setup-plan); se recomiendan en un usuario separado. */
const SETUP_ACTIONS = Object.freeze(['createCollection', 'createIndex']);
/** Acciones prohibidas: el módulo no borra (bitácora de solo inserción, GridFS sin borrado). */
const FORBIDDEN_ACTIONS = Object.freeze(['remove', 'dropCollection', 'dropDatabase', 'dropIndex', 'renameCollectionSameDB', 'collMod', 'convertToCapped', 'compact', 'anyAction']);
const MIN_SERVER = [5, 0];

const maskHost = (uri) => {
  const m = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri || '');
  if (!m) return null;
  return m[1].split(',').map((h) => h.replace(/^([^.:]{0,3})[^.:]*/, '$1***')).join(',');
};

/** Pura: no usa red. */
function planPreflight(env, { now = new Date() } = {}) {
  const verdict = checkQaPersistence(env, { now });
  return {
    mode: 'plan',
    connected: false,
    guard: verdict,
    database: REQUIRED_DB,
    host: maskHost(env.MUNICIPAL_QA_URI),
    uriDatabase: env.MUNICIPAL_QA_URI ? databaseInUri(env.MUNICIPAL_QA_URI) : null,
    wouldRun: READ_ONLY_COMMANDS,
    checks: [
      'nombre efectivo de la base = munierp_qa',
      `servidor >= ${MIN_SERVER.join('.')}`,
      'topología con transacciones (réplica con setName o mongos)',
      `privilegios mínimos: ${REQUIRED_ACTIONS.join(', ')}; instalación aparte: ${SETUP_ACTIONS.join(', ')}`,
      `sin privilegios destructivos: ${FORBIDDEN_ACTIONS.join(', ')}`,
      'sin privilegios sobre otras bases (p. ej. erp_sales_test) ni de clúster',
      'base exclusiva: solo colecciones municipal_* (o vacía)',
    ],
  };
}

const versionAtLeast = (v, min) => {
  const parts = String(v || '0').split('.').map(Number);
  for (let i = 0; i < min.length; i += 1) { if ((parts[i] || 0) > min[i]) return true; if ((parts[i] || 0) < min[i]) return false; }
  return true;
};

/**
 * @param {{ env: Record<string,string|undefined>, connect: () => Promise<{ db: any, admin: any, close: () => Promise<void> }>, confirmation?: string, now?: Date }} args
 */
async function runPreflight({ env, connect, confirmation, now = new Date() }) {
  const plan = planPreflight(env, { now });
  const evidence = { ...plan, mode: 'preflight', date: now.toISOString(), results: [], ok: false };
  if (!plan.guard.allowed) { evidence.results.push({ check: 'guardia de QA', ok: false, detail: plan.guard.reasons }); return evidence; }
  if (confirmation !== PREFLIGHT_CONFIRMATION) { evidence.results.push({ check: 'confirmación', ok: false, detail: `se requiere "${PREFLIGHT_CONFIRMATION}"` }); return evidence; }

  const conn = await connect();
  evidence.connected = true;
  const add = (check, ok, detail) => evidence.results.push({ check, ok, detail });
  try {
    add('nombre efectivo de la base', conn.db.databaseName === REQUIRED_DB, conn.db.databaseName);
    const hello = await conn.admin.command({ hello: 1 });
    const transactional = !!hello.setName || hello.msg === 'isdbgrid';
    add('topología transaccional', transactional, hello.setName ? `réplica ${hello.setName}` : hello.msg === 'isdbgrid' ? 'mongos' : 'standalone (sin transacciones)');
    const build = await conn.admin.command({ buildInfo: 1 });
    add(`versión del servidor >= ${MIN_SERVER.join('.')}`, versionAtLeast(build.version, MIN_SERVER), build.version);

    const status = await conn.db.command({ connectionStatus: 1, showPrivileges: true });
    const info = status.authInfo || {};
    const privileges = info.authenticatedUserPrivileges || [];
    const onDb = (p) => p.resource && p.resource.db === REQUIRED_DB;
    const actionsOnDb = new Set(privileges.filter(onDb).flatMap((p) => p.actions));
    const missing = REQUIRED_ACTIONS.filter((a) => !actionsOnDb.has(a));
    add('privilegios mínimos presentes', missing.length === 0, missing.length ? `faltan: ${missing.join(', ')}` : REQUIRED_ACTIONS.join(', '));
    const forbidden = [...new Set(privileges.flatMap((p) => p.actions))].filter((a) => FORBIDDEN_ACTIONS.includes(a));
    add('sin privilegios destructivos', forbidden.length === 0, forbidden.join(', ') || 'ninguno');
    const foreign = privileges.filter((p) => p.resource && (p.resource.cluster || p.resource.anyResource || (p.resource.db !== REQUIRED_DB && p.resource.db !== undefined)));
    add('sin privilegios fuera de munierp_qa', foreign.length === 0, foreign.map((p) => JSON.stringify(p.resource)).join(' ') || 'ninguno');
    add('instalación (createCollection/createIndex)', SETUP_ACTIONS.every((a) => actionsOnDb.has(a)), 'informativo: preferible en un usuario de instalación separado');
    evidence.users = (info.authenticatedUsers || []).map((u) => ({ db: u.db, user: u.user ? `${String(u.user).slice(0, 2)}***` : null }));
    evidence.roles = (info.authenticatedUserRoles || []).map((r) => `${r.role}@${r.db}`);

    const collections = (await conn.db.listCollections({}, { nameOnly: true, authorizedCollections: true }).toArray()).map((c) => c.name);
    const foreignCollections = collections.filter((n) => !n.startsWith('municipal_') && !n.startsWith('system.'));
    add('base exclusiva del módulo municipal', foreignCollections.length === 0, foreignCollections.length ? `colecciones ajenas: ${foreignCollections.join(', ')}` : `${collections.length} colecciones municipal_*`);
    evidence.collections = collections;
  } finally {
    await conn.close();
  }
  evidence.ok = evidence.results.filter((r) => !/informativo/.test(String(r.detail))).every((r) => r.ok);
  return evidence;
}

module.exports = { planPreflight, runPreflight, PREFLIGHT_CONFIRMATION, READ_ONLY_COMMANDS, REQUIRED_ACTIONS, SETUP_ACTIONS, FORBIDDEN_ACTIONS, maskHost };
