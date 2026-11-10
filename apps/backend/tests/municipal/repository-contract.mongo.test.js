'use strict';
/**
 * Suite de contrato contra MongoDB — PREPARADA, NO EJECUTADA.
 *
 * No importa mongoose ni abre conexiones. Solo registraría los casos si:
 *  1. la guardia de QA autoriza (persistence/qa-guard.js: munierp_qa exclusiva, autorización propia
 *     distinta de la de M07, URI de QA, NODE_ENV≠production), y
 *  2. existe el adaptador `persistence/mongo-store.js` (F1-05 paso 3, aún no escrito).
 * Mientras tanto mocha la informa como pendiente.
 */
const path = require('path');
const fs = require('fs');
const { checkQaPersistence } = require('../../src/modules/municipal/persistence/qa-guard');

const verdict = checkQaPersistence(process.env);
const adapterPath = path.join(__dirname, '../../src/modules/municipal/persistence/mongo-store.js');

describe('Contrato del repositorio municipal — MongoDB (preparado, no ejecutado)', () => {
  if (!verdict.allowed) {
    it(`omitido por la guardia de QA: ${verdict.reasons.join('; ')}`);
    return;
  }
  if (!fs.existsSync(adapterPath)) {
    it('omitido: adaptador MongoDB pendiente (F1-05 paso 3)');
    return;
  }
  // Paso 3: const { createMongoStore } = require(adapterPath); defineRepositoryContract({ kind: 'mongo', ... })
  it('omitido: el registro de la suite Mongo se habilita junto con el adaptador');
});
