'use strict';
/**
 * Registra la suite de contrato para una implementación del puerto.
 *
 * @param {{ label: string, kind: 'memory'|'mongo', createEnv: () => Promise<{ store: any, storage: any, close?: Function }> }} impl
 *
 * - L1 se ejecuta siempre.
 * - L2 se ejecuta; en `memory` el título advierte que es una aproximación sin valor de certificación.
 * - L3 se ejecuta solo con `kind: 'mongo'`; en memoria queda PENDIENTE (mocha lo cuenta como pending).
 */
const { CASES, LEVEL_LABEL } = require('./cases');
const { withFaults } = require('./faults');
const { assertRepositoryPort } = require('../../../src/modules/municipal/persistence/repository-port');

function defineRepositoryContract(impl) {
  describe(`Contrato del repositorio municipal — ${impl.label}`, () => {
    const areas = [...new Set(CASES.map((c) => c.area))];
    for (const area of areas) {
      describe(area, () => {
        for (const c of CASES.filter((x) => x.area === area)) {
          const title = `${c.id} [${LEVEL_LABEL[c.level]}] ${c.title}`;
          if (c.level === 'L3' && impl.kind !== 'mongo') { it(`${title} — pendiente: ${c.verify}`); continue; }
          it(title, async () => {
            const env = await impl.createEnv();
            try {
              assertRepositoryPort(env.store);
              const faults = withFaults(env.store);
              await c.run({ store: env.store, storage: env.storage, faults });
            } finally {
              if (env.close) await env.close();
            }
          });
        }
      });
    }
  });
}

module.exports = { defineRepositoryContract };
