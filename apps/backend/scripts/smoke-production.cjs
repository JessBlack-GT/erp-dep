// Local production-mode HTTP smoke. No DB connection and no fixtures.
const crypto = require('crypto'),
  assert = require('assert/strict');
Object.assign(process.env, {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://db.example.invalid/application',
  MONGODB_DB_NAME: 'application',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
  CORS_ORIGIN_FRONTEND: 'https://web.example.invalid',
  TRUST_PROXY_HOPS: '1',
  RATE_LIMIT_MAX: '1',
});
delete process.env.M03_QA_DATABASE;
delete process.env.CORS_ORIGIN;
async function main() {
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  let checks = 0;
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const get = async (path, status, headers = {}) => {
      const r = await fetch(base + path, { headers });
      assert.equal(r.status, status);
      checks++;
      return r;
    };
    for (let i = 0; i < 4; i++) await get('/api/v1/health', 200);
    await get('/api/v1/ready', 503);
    const allowed = await get('/api/v1/health', 200, { Origin: process.env.CORS_ORIGIN_FRONTEND });
    assert.equal(
      allowed.headers.get('access-control-allow-origin'),
      process.env.CORS_ORIGIN_FRONTEND,
    );
    assert.ok(allowed.headers.get('x-content-type-options'));
    checks++;
    await get('/api/v1/health', 403, { Origin: 'http://localhost:8081' });
    await get('/api/v1/users', 401, { 'X-Forwarded-For': '192.0.2.1' });
    await get('/api/v1/users', 429, { 'X-Forwarded-For': '192.0.2.1' });
    await get('/api/v1/users', 401, { 'X-Forwarded-For': '192.0.2.2' });
    await get('/api/v1/ready', 503);
    console.log(
      JSON.stringify({
        productionSmoke: true,
        checks,
        databaseConnected: false,
        fixturesCreated: 0,
      }),
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch(() => {
  console.error('PRODUCTION_SMOKE_FAILED');
  process.exitCode = 1;
});
