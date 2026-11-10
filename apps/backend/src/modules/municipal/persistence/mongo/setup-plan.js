// @ts-check
'use strict';
/**
 * Plan de instalación de colecciones e índices municipales — DECLARATIVO.
 *
 *  - `planSetup()` es puro: devuelve los pasos (crear colección con validador, crear índices).
 *  - `verifySetup(db)` es de SOLO LECTURA (`listCollections`, `listIndexes`): compara lo existente con
 *    el plan. Sirve para el caso L3 RC-29 y para el preflight.
 *  - `applySetup(db, opts)` solo crea (nunca borra ni modifica). Exige la guardia de QA autorizada y la
 *    confirmación literal `municipal_qa_aplicar=munierp_qa`. En F1-05 paso 3 NO se invoca contra
 *    ninguna base real (C-05 pendiente); solo se prueba con dobles.
 */
const { collectionNames, INDEXES, VALIDATORS } = require('./collections');
const { checkQaPersistence } = require('../qa-guard');

const CONFIRMATION = 'municipal_qa_aplicar=munierp_qa';

/** @param {{ prefix?: string }} [options] */
function planSetup({ prefix = 'municipal_' } = {}) {
  const names = collectionNames(prefix);
  const steps = [];
  for (const logical of Object.keys(INDEXES)) {
    if (logical === 'files') continue;
    steps.push({ op: 'createCollection', collection: names[logical], options: { validator: VALIDATORS[logical], validationLevel: 'strict', validationAction: 'error' } });
  }
  for (const [logical, indexes] of Object.entries(INDEXES)) {
    for (const ix of indexes) {
      const collection = ix.on ? `${names.files}.${ix.on.split('.').pop()}` : names[logical];
      const { on, ...spec } = ix;
      steps.push({ op: 'createIndex', collection, index: spec });
    }
  }
  return steps;
}

const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Solo lectura. @param {any} db @param {{ prefix?: string }} [options] */
async function verifySetup(db, { prefix = 'municipal_' } = {}) {
  const steps = planSetup({ prefix });
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const problems = [];
  for (const s of steps.filter((x) => x.op === 'createCollection')) if (!existing.has(s.collection)) problems.push(`falta la colección ${s.collection}`);
  const byCollection = {};
  for (const s of steps.filter((x) => x.op === 'createIndex')) {
    if (!existing.has(s.collection) && !s.collection.endsWith('.files')) continue;
    byCollection[s.collection] = byCollection[s.collection] || (await db.collection(s.collection).listIndexes().toArray().catch(() => []));
    const found = byCollection[s.collection].find((i) => i.name === s.index.name);
    if (!found) { problems.push(`falta el índice ${s.collection}.${s.index.name}`); continue; }
    if (!sameKey(found.key, s.index.key)) problems.push(`clave distinta en ${s.collection}.${s.index.name}`);
    if (!!found.unique !== !!s.index.unique) problems.push(`unicidad distinta en ${s.collection}.${s.index.name}`);
    if (s.index.partialFilterExpression && !sameKey(found.partialFilterExpression, s.index.partialFilterExpression)) problems.push(`filtro parcial distinto en ${s.collection}.${s.index.name}`);
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Solo crea. Lanza si la guardia no autoriza, si falta la confirmación o si la base no es munierp_qa.
 * @param {any} db @param {{ env: Record<string,string|undefined>, confirmation: string, prefix?: string, now?: Date }} opts
 */
async function applySetup(db, { env, confirmation, prefix = 'municipal_', now = new Date() }) {
  const verdict = checkQaPersistence(env, { now });
  if (!verdict.allowed) throw Object.assign(new Error('Instalación no autorizada: ' + verdict.reasons.join('; ')), { code: 'QA_NOT_AUTHORIZED' });
  if (confirmation !== CONFIRMATION) throw Object.assign(new Error(`Falta la confirmación literal "${CONFIRMATION}"`), { code: 'QA_NOT_CONFIRMED' });
  if (db.databaseName !== 'munierp_qa') throw Object.assign(new Error('La base efectiva no es munierp_qa'), { code: 'QA_WRONG_DATABASE' });
  const done = [];
  for (const step of planSetup({ prefix })) {
    if (step.op === 'createCollection') {
      const exists = (await db.listCollections({ name: step.collection }, { nameOnly: true }).toArray()).length > 0;
      if (!exists) await db.createCollection(step.collection, step.options);
    } else {
      await db.collection(step.collection).createIndex(step.index.key, { ...step.index });
    }
    done.push(`${step.op} ${step.collection}${step.index ? '.' + step.index.name : ''}`);
  }
  return done;
}

module.exports = { planSetup, verifySetup, applySetup, CONFIRMATION };
