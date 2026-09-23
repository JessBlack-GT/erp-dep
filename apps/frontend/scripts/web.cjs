const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const buildOnly = process.argv.includes('--build');
async function main() {
  const outdir = path.join(root, 'dist');
  fs.mkdirSync(outdir, { recursive: true });
  fs.writeFileSync(path.join(outdir, 'index.html'), '<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ERP · Clientes</title><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  const options = {
    absWorkingDir: root, entryPoints: ['src/web.jsx'], bundle: true,
    outfile: path.join(outdir, 'app.js'), platform: 'browser',
    alias: { 'react-native': 'react-native-web' },
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    loader: { '.js': 'jsx', '.png': 'dataurl', '.ttf': 'dataurl' },
    define: { global: 'globalThis', __DEV__: String(!buildOnly), 'process.env.NODE_ENV': JSON.stringify(buildOnly ? 'production' : 'development'), 'process.env.PUBLIC_API_BASE_URL': JSON.stringify(process.env.PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1') },
    minify: buildOnly,
  };
  if (buildOnly) { await esbuild.build(options); console.log('Web build: SUCCESS'); return; }
  const ctx = await esbuild.context(options);
  await ctx.watch();
  await ctx.serve({ host: '127.0.0.1', port: 8081, servedir: outdir });
  console.log('Frontend development: http://localhost:8081');
  process.on('SIGINT', async () => { await ctx.dispose(); process.exit(0); });
}
main().catch(() => { console.error('Web build: FAILED'); process.exitCode = 1; });
