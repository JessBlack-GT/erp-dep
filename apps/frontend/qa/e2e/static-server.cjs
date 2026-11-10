/* eslint-env node */
/** Servidor estático mínimo (solo QA, 127.0.0.1) para el arnés compilado. Uso: node static-server.cjs <dir> <port> */
const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = path.resolve(process.argv[2]);
const port = Number(process.argv[3] || 4178);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(dir, name === '/' ? 'index.html' : name);
  if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`QA estático en http://127.0.0.1:${port}`));
