'use strict';
/**
 * Suite de contrato contra MongoDB REAL — PREPARADA, NO EJECUTADA (C-05 pendiente).
 *
 * Solo se registra si la guardia de QA autoriza (persistence/qa-guard.js: munierp_qa exclusiva,
 * autorización propia distinta de M07, URI de QA, NODE_ENV≠production) Y se aporta la confirmación
 * de instalación `MUNICIPAL_QA_APPLY_CONFIRM` (setup-plan.js). Sin ambas, mocha la informa como
 * pendiente y no se requiere el controlador ni se abre ninguna conexión.
 * Procedimiento completo: docs/munierp/15-F1-05-ADAPTADOR-MONGODB.md §6.
 */
const { checkQaPersistence } = require('../../src/modules/municipal/persistence/qa-guard');
const { CONFIRMATION } = require('../../src/modules/municipal/persistence/mongo/setup-plan');
const { defineRepositoryContract } = require('./repository-contract/define');

const verdict = checkQaPersistence(process.env);
const confirmed = process.env.MUNICIPAL_QA_APPLY_CONFIRM === CONFIRMATION;

if (!verdict.allowed || !confirmed) {
  describe('Contrato del repositorio municipal — MongoDB real (preparado, no ejecutado)', () => {
    const reasons = [...verdict.reasons, ...(confirmed ? [] : ['falta MUNICIPAL_QA_APPLY_CONFIRM'])];
    it(`omitido por la guardia de QA: ${reasons.join('; ')}`);
  });
} else {
  const { createMongoContractEnvFactory } = require('./repository-contract/mongo-env');
  const factory = createMongoContractEnvFactory();
  describe('MongoDB real munierp_qa (autorizado)', () => {
    before(async function () { this.timeout(60000); await factory.open(); });
    after(async () => {
      if (process.env.MUNICIPAL_QA_EVIDENCE_DIR) {
        const fs = require('fs');
        fs.mkdirSync(process.env.MUNICIPAL_QA_EVIDENCE_DIR, { recursive: true });
        fs.writeFileSync(require('path').join(process.env.MUNICIPAL_QA_EVIDENCE_DIR, 'l3-mediciones.json'), JSON.stringify(factory.metrics, null, 2));
      }
      await factory.close();
    });
    defineRepositoryContract({ label: 'MongoDB real munierp_qa', kind: 'mongo', createEnv: factory.createEnv });
  });
}
