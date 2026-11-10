'use strict';
/**
 * Entorno de la suite de contrato contra MongoDB REAL. Solo se usa si la guardia de QA autoriza
 * (repository-contract.mongo.test.js); en F1-05 paso 3 NUNCA se ha ejecutado (C-05 pendiente).
 *
 * Cada caso usa un prefijo propio `municipal_c<ejecución>_<n>_` dentro de munierp_qa: crea sus
 * colecciones e índices con applySetup (solo creación), siembra datos SINTÉTICOS y no borra nada.
 * Las colecciones de cada ejecución quedan identificadas por el prefijo para que el responsable de QA
 * decida su retiro manualmente. Atlas compartido (M0) limita el número de colecciones: ejecutar por
 * áreas con `--grep` o en un clúster dedicado.
 */
const { contractSeed } = require('./seed');
const { createMongoStore } = require('../../../src/modules/municipal/persistence/mongo/mongo-store');
const { createTransactionRunner } = require('../../../src/modules/municipal/persistence/mongo/transaction-runner');
const { createGridFsStorage } = require('../../../src/modules/municipal/persistence/mongo/gridfs-storage');
const { applySetup } = require('../../../src/modules/municipal/persistence/mongo/setup-plan');
const { collectionNames } = require('../../../src/modules/municipal/persistence/mongo/collections');

function createMongoContractEnvFactory({ env = process.env } = {}) {
  // Carga diferida: el controlador solo se requiere si la guardia ya autorizó.
  // eslint-disable-next-line global-require
  const { MongoClient, GridFSBucket } = require('mongoose').mongo; // controlador incluido en mongoose (sin nuevas dependencias)
  const runId = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  let client;
  let n = 0;
  const metrics = [];
  return {
    metrics,
    async open() {
      client = new MongoClient(env.MUNICIPAL_QA_URI, { retryWrites: true });
      await client.connect();
    },
    async close() { if (client) await client.close(); },
    createEnv: async () => {
      n += 1;
      const prefix = `municipal_c${runId}_${n}_`;
      const db = client.db('munierp_qa');
      await applySetup(db, { env, confirmation: env.MUNICIPAL_QA_APPLY_CONFIRM, prefix });
      const names = collectionNames(prefix);
      const seed = contractSeed();
      for (const logical of ['municipalities', 'dependencies', 'citizens', 'memberships']) {
        const docs = seed[logical].map(({ id, ...rest }) => ({ _id: id, ...rest }));
        if (docs.length) await db.collection(names[logical]).insertMany(docs);
      }
      const bucket = new GridFSBucket(db, { bucketName: names.files });
      return {
        store: createMongoStore({ db, runTransaction: createTransactionRunner(client), prefix }),
        storage: createGridFsStorage({ bucket }),
        mongo: {
          db, prefix, names, client, bucket,
          /** Segunda conexión independiente (RC-35); el caso la cierra. */
          newClient: async () => { const c = new MongoClient(env.MUNICIPAL_QA_URI, { readPreference: 'primary' }); await c.connect(); return c; },
          /** Mediciones para la evidencia (sin datos personales). */
          record: (caseId, values) => metrics.push({ caseId, prefix, at: new Date().toISOString(), ...values }),
        },
      };
    },
  };
}

module.exports = { createMongoContractEnvFactory };
