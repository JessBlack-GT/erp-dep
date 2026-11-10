// @ts-check
'use strict';
/**
 * Composición del adaptador MongoDB a partir de un cliente YA CONECTADO e inyectado.
 * No abre conexiones ni importa el controlador. Hoy solo admite el entorno QA autorizado
 * (`munierp_qa`, guardia de QA); el uso en producción y el montaje en el ERP dependen de C-01/C-05.
 */
const { checkQaPersistence, REQUIRED_DB } = require('../qa-guard');
const { createMongoStore } = require('./mongo-store');
const { createTransactionRunner } = require('./transaction-runner');
const { createGridFsStorage } = require('./gridfs-storage');
const { collectionNames } = require('./collections');

/**
 * @param {{ client: { db: (name: string) => any, startSession: Function }, env: Record<string,string|undefined>,
 *   bucketFactory: (db: any, options: { bucketName: string }) => any, prefix?: string, now?: Date }} deps
 */
function createMongoPersistence({ client, env, bucketFactory, prefix = 'municipal_', now = new Date() }) {
  const verdict = checkQaPersistence(env, { now });
  if (!verdict.allowed) throw Object.assign(new Error('Persistencia MongoDB no autorizada: ' + verdict.reasons.join('; ')), { code: 'QA_NOT_AUTHORIZED' });
  const db = client.db(REQUIRED_DB);
  if (db.databaseName !== REQUIRED_DB) throw Object.assign(new Error('La base efectiva no es munierp_qa'), { code: 'QA_WRONG_DATABASE' });
  return {
    store: createMongoStore({ db, runTransaction: createTransactionRunner(client), prefix }),
    storage: createGridFsStorage({ bucket: bucketFactory(db, { bucketName: collectionNames(prefix).files }) }),
  };
}

module.exports = { createMongoPersistence };
