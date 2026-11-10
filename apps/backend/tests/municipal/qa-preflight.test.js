'use strict';
/** F1-05 paso 3 — preflight de solo lectura de munierp_qa con DOBLES (ninguna conexión real). */
const assert = require('assert');
const { planPreflight, runPreflight, PREFLIGHT_CONFIRMATION, READ_ONLY_COMMANDS, maskHost } = require('../../src/modules/municipal/persistence/mongo/preflight');
const { main } = require('../../src/modules/municipal/persistence/mongo/preflight-cli');

const NOW = new Date('2026-11-10T20:00:00Z');
const ENV = {
  NODE_ENV: 'test', MUNICIPAL_STORE: 'mongo', MUNICIPAL_QA_DATABASE: 'munierp_qa',
  MUNICIPAL_QA_URI: 'mongodb+srv://usuario:secreto@qa-cluster.example.net/munierp_qa?retryWrites=true',
  MUNICIPAL_QA_AUTHORIZED: '2026-11-10|Responsable QA municipal|munierp_qa',
};
const GOOD_PRIVS = [{ resource: { db: 'munierp_qa', collection: '' }, actions: ['find', 'insert', 'update', 'listCollections', 'listIndexes', 'createCollection', 'createIndex'] }];

/** Doble de conexión que registra cada comando y rechaza cualquiera que no sea de lectura. */
function fakeConnection({ hello = { setName: 'rs-qa', isWritablePrimary: true }, version = '7.0.12', privileges = GOOD_PRIVS, collections = [], dbName = 'munierp_qa' } = {}) {
  const issued = [];
  const guard = (cmd) => { const name = Object.keys(cmd)[0]; issued.push(name); if (!READ_ONLY_COMMANDS.includes(name)) throw new Error('comando no permitido: ' + name); };
  let closed = false;
  return {
    issued,
    get closed() { return closed; },
    connect: async () => ({
      db: {
        databaseName: dbName,
        command: async (cmd) => { guard(cmd); return { authInfo: { authenticatedUsers: [{ user: 'munierp_app', db: 'admin' }], authenticatedUserRoles: [{ role: 'munierpQaApp', db: 'admin' }], authenticatedUserPrivileges: privileges } }; },
        listCollections: (filter, opts) => { guard({ listCollections: 1 }); assert.strictEqual(opts.nameOnly, true); return { toArray: async () => collections.map((name) => ({ name })) }; },
        collection: () => { throw new Error('el preflight no debe abrir colecciones'); },
      },
      admin: { command: async (cmd) => { guard(cmd); return cmd.hello ? hello : { version }; } },
      close: async () => { closed = true; },
    }),
  };
}

describe('F1-05 paso 3 — preflight de solo lectura munierp_qa (dobles)', () => {
  it('modo plan: no se conecta, aplica la guardia y no expone credenciales', () => {
    const p = planPreflight(ENV, { now: NOW });
    assert.strictEqual(p.connected, false);
    assert.strictEqual(p.guard.allowed, true);
    assert.strictEqual(p.uriDatabase, 'munierp_qa');
    assert.ok(!JSON.stringify(p).includes('secreto') && !JSON.stringify(p).includes('usuario:'));
    assert.strictEqual(maskHost(ENV.MUNICIPAL_QA_URI), 'qa-***.example.net');
  });

  it('sin autorización o sin confirmación no llama a connect()', async () => {
    let calls = 0;
    const connect = async () => { calls += 1; throw new Error('no debería conectar'); };
    const a = await runPreflight({ env: { ...ENV, MUNICIPAL_QA_AUTHORIZED: '' }, connect, confirmation: PREFLIGHT_CONFIRMATION, now: NOW });
    const b = await runPreflight({ env: ENV, connect, confirmation: 'si', now: NOW });
    const c = await runPreflight({ env: { ...ENV, M07_QA_AUTHORIZED: ENV.MUNICIPAL_QA_AUTHORIZED }, connect, confirmation: PREFLIGHT_CONFIRMATION, now: NOW });
    assert.strictEqual(calls, 0);
    for (const r of [a, b, c]) { assert.strictEqual(r.ok, false); assert.strictEqual(r.connected, false); }
  });

  it('entorno correcto: solo comandos de lectura, cierra la conexión y aprueba', async () => {
    const fake = fakeConnection({ collections: ['municipal_requests'] });
    const r = await runPreflight({ env: ENV, connect: fake.connect, confirmation: PREFLIGHT_CONFIRMATION, now: NOW });
    assert.strictEqual(r.ok, true, JSON.stringify(r.results));
    assert.deepStrictEqual([...new Set(fake.issued)].sort(), ['buildInfo', 'connectionStatus', 'hello', 'listCollections']);
    assert.strictEqual(fake.closed, true);
    assert.ok(!JSON.stringify(r).includes('munierp_app'), 'usuario enmascarado');
  });

  for (const [name, opts, failing] of [
    ['topología standalone', { hello: { isWritablePrimary: true } }, 'topología transaccional'],
    ['servidor antiguo', { version: '4.2.1' }, 'versión del servidor >= 5.0'],
    ['otra base efectiva', { dbName: 'erp_sales_test' }, 'nombre efectivo de la base'],
    ['privilegio destructivo', { privileges: [{ resource: { db: 'munierp_qa', collection: '' }, actions: [...GOOD_PRIVS[0].actions, 'remove', 'dropCollection'] }] }, 'sin privilegios destructivos'],
    ['privilegios sobre erp_sales_test', { privileges: [...GOOD_PRIVS, { resource: { db: 'erp_sales_test', collection: '' }, actions: ['find'] }] }, 'sin privilegios fuera de munierp_qa'],
    ['privilegio de clúster', { privileges: [...GOOD_PRIVS, { resource: { cluster: true }, actions: ['serverStatus'] }] }, 'sin privilegios fuera de munierp_qa'],
    ['faltan privilegios mínimos', { privileges: [{ resource: { db: 'munierp_qa', collection: '' }, actions: ['find'] }] }, 'privilegios mínimos presentes'],
    ['base no exclusiva', { collections: ['municipal_requests', 'sales'] }, 'base exclusiva del módulo municipal'],
  ]) {
    it(`rechaza: ${name}`, async () => {
      const fake = fakeConnection(opts);
      const r = await runPreflight({ env: ENV, connect: fake.connect, confirmation: PREFLIGHT_CONFIRMATION, now: NOW });
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.results.find((x) => x.check === failing).ok, false, JSON.stringify(r.results));
      assert.strictEqual(fake.closed, true);
    });
  }

  it('el CLI sin --connect solo planifica (código 0) y no requiere el controlador', async () => {
    const write = process.stdout.write;
    let printed = '';
    process.stdout.write = (s) => { printed += s; return true; };
    try { assert.strictEqual(await main([], ENV), 0); } finally { process.stdout.write = write; }
    const out = JSON.parse(printed);
    assert.strictEqual(out.mode, 'plan');
    assert.strictEqual(out.connected, false);
  });
});
