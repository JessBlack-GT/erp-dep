#!/usr/bin/env node
'use strict';
/**
 * CLI del preflight de solo lectura de munierp_qa (docs/munierp/15 §6).
 *
 *   node src/modules/municipal/persistence/mongo/preflight-cli.js            → modo plan (sin red)
 *   node src/modules/municipal/persistence/mongo/preflight-cli.js --connect  → solo si la guardia
 *        autoriza y MUNICIPAL_QA_PREFLIGHT_CONFIRM=solo-lectura:munierp_qa; emite comandos de lectura.
 *   --out <archivo.json> guarda la evidencia (sin URI ni contraseñas).
 *
 * Por defecto NO se conecta. No lee archivos de credenciales: la URI llega por variable de entorno.
 */
const fs = require('fs');
const { planPreflight, runPreflight } = require('./preflight');

async function main(argv, env) {
  const connectRequested = argv.includes('--connect');
  const outIndex = argv.indexOf('--out');
  const out = outIndex >= 0 ? argv[outIndex + 1] : null;
  let evidence;
  if (!connectRequested) {
    evidence = planPreflight(env);
  } else {
    evidence = await runPreflight({
      env,
      confirmation: env.MUNICIPAL_QA_PREFLIGHT_CONFIRM,
      connect: async () => {
        // Carga diferida: solo tras pasar la guardia y la confirmación. Se usa el controlador que ya trae
        // mongoose (dependencia directa del ERP); no se añaden dependencias.
        // eslint-disable-next-line global-require
        const { MongoClient } = require('mongoose').mongo;
        const client = new MongoClient(env.MUNICIPAL_QA_URI, { appName: 'munierp-qa-preflight', readPreference: 'primary', retryWrites: false });
        await client.connect();
        return { db: client.db('munierp_qa'), admin: client.db('admin'), close: () => client.close() };
      },
    });
  }
  const text = JSON.stringify(evidence, null, 2);
  if (out) fs.writeFileSync(out, text + '\n');
  process.stdout.write(text + '\n');
  return evidence.mode === 'plan' ? 0 : evidence.ok ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2), process.env).then((code) => { process.exitCode = code; }, (e) => {
    process.stderr.write(`Preflight interrumpido: ${e && e.message ? e.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/g, '<uri>') : e}\n`);
    process.exitCode = 2;
  });
}

module.exports = { main };
