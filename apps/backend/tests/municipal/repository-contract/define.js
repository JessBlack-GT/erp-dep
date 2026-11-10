'use strict';
/**
 * Registra la suite de contrato para una implementación del puerto.
 *
 * @param {{ label: string, kind: 'memory'|'mongo-double'|'mongo', createEnv: () => Promise<{ store: any, storage: any, mongo?: any, close?: Function }> }} impl
 *
 * - L1 se ejecuta siempre.
 * - L2 se ejecuta; fuera de `mongo` (memoria o doble del controlador) es una aproximación sin valor de
 *   certificación y el título lo indica.
 * - L3 se ejecuta solo con `kind: 'mongo'` (MongoDB real autorizado) y si el caso tiene `run`; en los
 *   demás casos queda PENDIENTE (mocha lo cuenta como pending).
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
          const label = c.level === 'L2' && impl.kind === 'mongo' ? 'L2 concurrencia en MongoDB real' : LEVEL_LABEL[c.level];
          const title = `${c.id} [${label}] ${c.title}`;
          if (c.level === 'L3' && (impl.kind !== 'mongo' || !c.run)) { it(`${title} — pendiente: ${c.verify}`); continue; }
          it(title, async () => {
            const env = await impl.createEnv();
            try {
              assertRepositoryPort(env.store);
              const faults = withFaults(env.store);
              await c.run({ store: env.store, storage: env.storage, faults, mongo: env.mongo });
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
