'use strict';
/**
 * Suite de contrato contra el ADAPTADOR MongoDB (persistence/mongo) montado sobre un DOBLE del
 * controlador (support/fake-mongo.js). Verifica la lógica del adaptador —filtros por municipio,
 * actualizaciones condicionadas, $push del historial, $inc de folios, traducción de E11000 y de
 * conflictos transitorios, GridFS sin sobrescritura— con los mismos casos L1/L2 que la memoria.
 *
 * NO certifica MongoDB: transacciones, índices, aislamiento persistente y GridFS reales solo se
 * aprueban con los casos L3 contra munierp_qa autorizada (C-05). Los L3 quedan pendientes aquí.
 */
const { defineRepositoryContract } = require('./repository-contract/define');
const { contractSeed } = require('./repository-contract/seed');
const { createFakeMongo } = require('./support/fake-mongo');
const { createMongoStore } = require('../../src/modules/municipal/persistence/mongo/mongo-store');
const { createTransactionRunner } = require('../../src/modules/municipal/persistence/mongo/transaction-runner');
const { createGridFsStorage } = require('../../src/modules/municipal/persistence/mongo/gridfs-storage');

function createEnv(resultShape) {
  return async () => {
    const fake = createFakeMongo({ resultShape });
    const seed = contractSeed();
    for (const logical of ['municipalities', 'dependencies', 'citizens', 'memberships', 'grants']) fake.seed(logical, seed[logical]);
    let seq = 0xa00000;
    const store = createMongoStore({ db: fake.db, runTransaction: createTransactionRunner(fake.client), newId: () => (seq++).toString(16).padStart(24, '0') });
    return { store, storage: createGridFsStorage({ bucket: fake.bucket }) };
  };
}

defineRepositoryContract({ label: 'adaptador MongoDB sobre doble del controlador v6 (no certifica MongoDB)', kind: 'mongo-double', createEnv: createEnv('v6') });
defineRepositoryContract({ label: 'adaptador MongoDB sobre doble del controlador v5 (no certifica MongoDB)', kind: 'mongo-double', createEnv: createEnv('v5') });
