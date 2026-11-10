/* eslint-env node, es2020 */
/**
 * Compila el arnés de QA municipal (API simulada) en un directorio indicado.
 * Uso: node qa/build-municipal-harness.cjs <outdir>
 * Misma configuración de esbuild que scripts/web.cjs (alias react-native → react-native-web).
 * No modifica scripts/web.cjs ni dist/; no incluye URL de API real.
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outdir = path.resolve(process.argv[2] || path.join(root, 'qa', 'dist-municipal'));

async function main() {
  fs.mkdirSync(outdir, { recursive: true });
  fs.writeFileSync(
    path.join(outdir, 'index.html'),
    '<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MuniERP · QA (API simulada)</title><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}</style></head><body><div id="root"></div><script src="./app.js"></script></body></html>',
  );
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['qa/municipal-harness.web.jsx'],
    bundle: true,
    outfile: path.join(outdir, 'app.js'),
    platform: 'browser',
    alias: { 'react-native': 'react-native-web' },
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    loader: { '.js': 'jsx', '.png': 'dataurl', '.ttf': 'dataurl' },
    define: {
      global: 'globalThis',
      __DEV__: 'false',
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.PUBLIC_API_BASE_URL': JSON.stringify('http://127.0.0.1:9/api/v1-qa-no-network'),
      'process.env.EXPO_PUBLIC_API_BASE_URL': JSON.stringify('http://127.0.0.1:9/api/v1-qa-no-network'),
    },
    minify: false,
    logLevel: 'warning',
  });
  console.log('Arnés municipal QA: ' + outdir);
}
main().catch((e) => { console.error('Arnés municipal QA: FALLÓ', e.message); process.exitCode = 1; });
