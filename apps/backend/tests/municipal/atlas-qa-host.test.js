'use strict';

const assert = require('node:assert/strict');
const { openAtlasQa, CONFIRMATION } = require('../../scripts/municipal-atlas-qa.cjs');
const { createFakeMongo } = require('./support/fake-mongo');
const { planSetup } = require('../../src/modules/municipal/persistence/mongo/setup-plan');
const fx = require('../../src/modules/municipal/mocks/fixtures');

const env = () => ({
  NODE_ENV: 'test',
  MUNICIPAL_STORE: 'mongo',
  MUNICIPAL_QA_DATABASE: 'munierp_qa',
  MUNICIPAL_QA_AUTHORIZED: '2026-01-01|operador-qa|munierp_qa',
  MUNICIPAL_QA_PERSIST_CONFIRM: CONFIRMATION,
  MUNICIPAL_QA_URI: 'mongodb+srv://munierp_qa_app:fake@qa.example.mongodb.net/munierp_qa?authSource=admin',
});
const seed = () => ({ municipalities: fx.MUNICIPALITIES, dependencies: fx.buildDependencies(), memberships: fx.buildMemberships(new Date()) });

function setup({ broadUpdate = false, installRights = false, chunksIndex = true } = {}) {
  const fake = createFakeMongo();
  const counts = { created: 0, connected: 0, closed: 0 };
  const plan = planSetup();
  const indexes = [
    ...plan.filter((s) => s.op === 'createIndex'),
    { collection: 'municipal_files.files', index: { key: { filename: 1, uploadDate: 1 } } },
    ...(chunksIndex ? [{ collection: 'municipal_files.chunks', index: { key: { files_id: 1, n: 1 }, unique: true } }] : []),
  ];
  const names = new Set([...plan.map((s) => s.collection), 'municipal_files.chunks']);
  const db = {
    ...fake.db,
    listCollections: () => ({ toArray: async () => [...names].map((name) => ({ name })) }),
    collection: (name) => ({
      ...fake.db.collection(name),
      listIndexes: () => ({ toArray: async () => indexes.filter((s) => s.collection === name).map((s) => s.index) }),
    }),
    command: async () => ({ authInfo: {
      authenticatedUsers: [{ user: 'munierp_qa_app', db: 'admin' }],
      authenticatedUserRoles: [{ role: 'munierp_qa_app', db: 'admin' }],
      authenticatedUserPrivileges: [
        { resource: { db: 'munierp_qa', collection: '' }, actions: ['find', 'insert', 'listCollections', 'listIndexes', ...(installRights ? ['createIndex'] : [])] },
        { resource: { db: 'munierp_qa', collection: broadUpdate ? '' : 'municipal_memberships' }, actions: ['update'] },
      ],
    } }),
  };
  const driver = {
    MongoClient: function () {
      counts.created += 1;
      return {
        ...fake.client,
        connect: async () => { counts.connected += 1; },
        close: async () => { counts.closed += 1; },
        db: (name) => name === 'admin'
          ? { command: async (cmd) => cmd.hello ? { setName: 'qa' } : { version: '8.0.39' } }
          : db,
      };
    },
    GridFSBucket: function () { return fake.bucket; },
  };
  return { fake, counts, driver, db };
}

describe('Anfitrión Atlas QA (doble, no se conecta a un clúster)', () => {
  it('rechaza producción, falta de confirmación, URI sin base o usuario equivocado antes de cargar el cliente', async () => {
    const { counts, driver } = setup();
    const valid = env();
    const cases = [
      { ...valid, NODE_ENV: 'production' },
      { ...valid, MUNICIPAL_QA_PERSIST_CONFIRM: '' },
      { ...valid, MUNICIPAL_QA_URI: valid.MUNICIPAL_QA_URI.replace('/munierp_qa', '/') },
      { ...valid, MUNICIPAL_QA_URI: valid.MUNICIPAL_QA_URI.replace('munierp_qa_app:', 'munierp_qa_setup:') },
      { ...valid, MUNICIPAL_QA_URI: valid.MUNICIPAL_QA_URI + '&tls=false' },
    ];
    for (const bad of cases) await assert.rejects(openAtlasQa({ env: bad, seed: seed(), driver }));
    assert.equal(counts.created, 0);
  });

  it('no siembra si hay permiso de modificar bitácora, permiso DDL o índices GridFS incompletos', async () => {
    for (const options of [{ broadUpdate: true }, { installRights: true }, { chunksIndex: false }]) {
      const { counts, driver, fake } = setup(options);
      await assert.rejects(openAtlasQa({ env: env(), seed: seed(), driver }));
      assert.equal(counts.closed, 1);
      assert.equal(fake.stats.transactions, 0);
      assert.equal(fake.raw('municipalities').length, 0);
    }
  });

  it('no reescribe una membresía inactiva ni duplica el catálogo al abrir de nuevo', async () => {
    const { fake, driver, counts } = setup();
    const initial = seed();
    const first = await openAtlasQa({ env: env(), seed: initial, driver });
    assert.equal(first.inserted, initial.municipalities.length + initial.dependencies.length + initial.memberships.length);
    await first.close();

    fake.seed('memberships', [{ ...initial.memberships[0], status: 'INACTIVA' }]);
    const second = await openAtlasQa({ env: env(), seed: seed(), driver });
    assert.equal(second.inserted, 0);
    assert.equal(fake.raw('memberships').find((m) => m._id === initial.memberships[0].id).status, 'INACTIVA');
    await second.close();
    assert.equal(counts.closed, 2);
  });

  it('no conserva altas parciales si hay una colisión de identidad en los catálogos', async () => {
    const { fake, driver } = setup();
    const initial = seed();
    fake.seed('dependencies', [{ ...initial.dependencies[0], code: 'AQX' }]);
    await assert.rejects(openAtlasQa({ env: env(), seed: initial, driver }), /Conflicto de identidad/);
    assert.equal(fake.raw('municipalities').length, 0);
  });
});
