'use strict';
/**
 * Suite de contrato contra el almacén EN MEMORIA (F1-05 paso 2).
 * Fija la semántica del puerto; NO certifica MongoDB (los casos L3 quedan pendientes y los L2 son
 * aproximaciones). Sin red ni base de datos; datos sintéticos.
 */
const { defineRepositoryContract } = require('./repository-contract/define');
const { contractSeed } = require('./repository-contract/seed');
const { createMemoryStore } = require('../../src/modules/municipal/mocks/in-memory-store');
const { createMemoryStorage } = require('../../src/modules/municipal/storage/memory-storage');

defineRepositoryContract({
  label: 'memoria (no certifica MongoDB)',
  kind: 'memory',
  createEnv: async () => ({ store: createMemoryStore(contractSeed()), storage: createMemoryStorage() }),
});
