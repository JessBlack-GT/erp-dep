/* eslint-env node */
/** Servidor estático mínimo (solo QA, 127.0.0.1) para el arnés compilado. Uso: node static-server.cjs <dir> <port> */
const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = path.resolve(process.argv[2]);
const port = Number(process.argv[3] || 4178);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };
http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // Directorios (incluida la raíz y /demo/) sirven su index.html.
  const file = path.join(dir, name.endsWith('/') ? name + 'index.html' : name);
  if (!file.startsWith(dir + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`MuniERP (API simulada) en http://127.0.0.1:${port}/`));
