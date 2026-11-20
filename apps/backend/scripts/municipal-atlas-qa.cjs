'use strict';

const { checkQaPersistence, REQUIRED_DB, databaseInUri } = require('../src/modules/municipal/persistence/qa-guard');
const { runPreflight, PREFLIGHT_CONFIRMATION } = require('../src/modules/municipal/persistence/mongo/preflight');
const { createMongoPersistence } = require('../src/modules/municipal/persistence/mongo');
const { createTransactionRunner } = require('../src/modules/municipal/persistence/mongo/transaction-runner');
const { verifySetup } = require('../src/modules/municipal/persistence/mongo/setup-plan');
const { collectionNames } = require('../src/modules/municipal/persistence/mongo/collections');

const CONFIRMATION = 'solo-datos-sinteticos:munierp_qa';
const EXPECTED_USER = 'munierp_qa_app';
const NAMES = collectionNames();
const fail = (reason) => Object.assign(new Error(reason), { qaSafe: true });

function assertQaConfig(env) {
  const guard = checkQaPersistence(env);
  if (!guard.allowed) throw fail(guard.reasons.join(', '));
  if (env.MUNICIPAL_QA_PERSIST_CONFIRM !== CONFIRMATION) throw fail('Falta confirmar la escritura de datos sintéticos en munierp_qa');
  const uri = new URL(env.MUNICIPAL_QA_URI);
  if (uri.protocol !== 'mongodb+srv:' || !uri.hostname.endsWith('.mongodb.net') ||
      uri.username !== EXPECTED_USER || uri.searchParams.get('authSource') !== 'admin' ||
      databaseInUri(env.MUNICIPAL_QA_URI) !== REQUIRED_DB ||
      [...uri.searchParams.keys()].some((key) => key !== 'authSource')) {
    throw fail('Se requiere una URI de Atlas con munierp_qa_app, la base munierp_qa y authSource=admin');
  }
}

async function checkAppGrant(db) {
  const { authInfo } = await db.command({ connectionStatus: 1, showPrivileges: true });
  const users = authInfo.authenticatedUsers || [];
  const roles = authInfo.authenticatedUserRoles || [];
  if (users.length !== 1 || users[0].user !== EXPECTED_USER || users[0].db !== 'admin' ||
      roles.length !== 1 || roles[0].role !== EXPECTED_USER || roles[0].db !== 'admin') {
    throw fail('La conexión no usa exclusivamente el usuario y rol de aplicación municipal');
  }
  for (const { resource, actions } of authInfo.authenticatedUserPrivileges || []) {
    if (!resource || resource.db !== REQUIRED_DB || resource.anyResource || resource.cluster) {
      throw fail('La conexión tiene privilegios fuera de munierp_qa');
    }
    if (actions.includes('createCollection') || actions.includes('createIndex')) {
      throw fail('El usuario de la app conserva permisos de instalación');
    }
    if ((resource.collection === '' || resource.collection == null || resource.collection === NAMES.audit) &&
        (actions.includes('update') || actions.includes('remove'))) {
      throw fail('El usuario de la app puede modificar la bitácora');
    }
  }
}

async function checkInstalledSchema(db) {
  const result = await verifySetup(db);
  if (!result.ok) throw fail('Falta completar la estructura: ' + result.problems.join(', '));
  for (const { suffix, keys, unique } of [
    { suffix: 'files', keys: { filename: 1, uploadDate: 1 }, unique: false },
    { suffix: 'chunks', keys: { files_id: 1, n: 1 }, unique: true },
  ]) {
    const indexes = await db.collection(NAMES.files + '.' + suffix).listIndexes().toArray();
    if (!indexes.some((index) => JSON.stringify(index.key) === JSON.stringify(keys) && !!index.unique === unique)) {
      throw fail('Falta un índice de GridFS en ' + suffix + '; el usuario de app no lo creará');
    }
  }
}

async function seedMissingFixtures({ db, runTransaction, seed }) {
  const identity = {
    municipalities: ['code'],
    dependencies: ['municipalityId', 'code'],
    memberships: ['municipalityId', 'userId'],
  };
  return runTransaction(async (session) => {
    let inserted = 0;
    for (const [logical, fields] of Object.entries(identity)) {
      const collection = db.collection(NAMES[logical]);
      for (const { id, ...doc } of seed[logical]) {
        const found = await collection.findOne({ _id: id }, { session });
        if (found) {
          if (fields.some((field) => found[field] !== doc[field])) throw fail('Conflicto de identidad en el catálogo sintético ' + logical);
          continue;
        }
        await collection.insertOne({ _id: id, ...doc }, { session });
        inserted += 1;
      }
    }
    return inserted;
  });
}

async function openAtlasQa({ env, seed, driver } = {}) {
  assertQaConfig(env);
  const { MongoClient, GridFSBucket } = driver || require('mongoose').mongo;
  const client = new MongoClient(env.MUNICIPAL_QA_URI, {
    appName: 'munierp-persistencia-qa', serverSelectionTimeoutMS: 10000,
  });
  try {
    const inspected = await runPreflight({ env, confirmation: PREFLIGHT_CONFIRMATION, connect: async () => {
      await client.connect();
      // El propietario de esta conexión es openAtlasQa, no el preflight de solo lectura.
      return { db: client.db(REQUIRED_DB), admin: client.db('admin'), close: async () => {} };
    } });
    if (!inspected.ok) {
      const failures = inspected.results.filter((r) => !r.ok && !String(r.detail).includes('informativo'));
      throw fail('Preflight municipal no válido: ' + failures.map((r) => r.check).join(', '));
    }

    const db = client.db(REQUIRED_DB);
    await checkAppGrant(db);
    await checkInstalledSchema(db);
    const { store, storage } = createMongoPersistence({
      client, env, bucketFactory: (db, options) => new GridFSBucket(db, options),
    });
    const inserted = await seedMissingFixtures({ db, runTransaction: createTransactionRunner(client), seed });
    return {
      store, storage, inserted,
      isReady: async () => (await db.command({ ping: 1, maxTimeMS: 2000 })).ok === 1,
      close: () => client.close(),
    };
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

module.exports = { openAtlasQa, assertQaConfig, checkAppGrant, checkInstalledSchema, seedMissingFixtures, CONFIRMATION };
