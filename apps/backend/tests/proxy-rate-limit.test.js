const assert = require('node:assert/strict');
const { describe, it, beforeEach, afterEach } = require('mocha');
const { execFileSync, spawnSync } = require('node:child_process');
const sinon = require('sinon');
const request = require('supertest');
const mongoose = require('mongoose');
const { config } = require('../src/config/environment');
const auth = require('../src/modules/auth/auth.service');
const email = require('../src/shared/services/email');
const User = require('../src/modules/users/users.model');
const Token = require('../src/modules/auth/password-reset-token.model');
const { logger } = require('../src/shared/utils/logger');

describe('Render trust proxy and actual application rate limits', () => {
  const paths = ['../src/app', '../src/routes', '../src/modules/auth/auth.routes', '../src/middleware/rateLimiter'].map(
    require.resolve,
  );
  let saved, hops, max;
  beforeEach(() => {
    hops = config.trustProxyHops;
    max = process.env.RATE_LIMIT_MAX;
    saved = paths.map((path) => require.cache[path]);
    paths.forEach((path) => delete require.cache[path]);
    sinon.stub(logger, 'info');
  });
  afterEach(() => {
    config.trustProxyHops = hops;
    if (max === undefined) delete process.env.RATE_LIMIT_MAX;
    else process.env.RATE_LIMIT_MAX = max;
    paths.forEach((path, index) => {
      if (saved[index]) require.cache[path] = saved[index];
      else delete require.cache[path];
    });
    sinon.restore();
  });

  function appWith(hops, limit = '1000') {
    config.trustProxyHops = hops;
    process.env.RATE_LIMIT_MAX = limit;
    return require('../src/app');
  }

  for (const hops of [0, 1, 2]) {
    it(`limits actual login to five attempts using Express IP with ${hops} proxy hops`, async () => {
      const app = appWith(hops);
      const login = sinon.stub(auth, 'login').resolves({ user: {} });
      sinon.stub(console, 'error');
      const forwarded = (spoof, client) => hops === 2
        ? `${spoof}, ${client}, 192.0.2.1` : `${spoof}, ${client}`;
      const attempt = (i, client = '203.0.113.51') => request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', forwarded(`198.51.100.${i}`, client))
        .send({ email: 'qa@example.com', password: 'invalid-password' });
      for (let i = 1; i <= 5; i++) await attempt(i).expect(200);
      const blocked = await attempt(6).expect(429);
      assert.equal(blocked.body.error, 'Demasiados intentos de inicio de sesión');
      assert.ok(blocked.headers['retry-after']);
      await attempt(7, '203.0.113.52').expect(hops ? 200 : 429);
      assert.equal(login.callCount, hops ? 6 : 5);
      // Login exhaustion must not consume recovery's independent allowance.
      sinon.stub(auth, 'forgotPassword').resolves({ success: true });
      await request(app).post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', forwarded('198.51.100.1', '203.0.113.51'))
        .send({ email: 'qa@example.com' }).expect(200);
    });
  }

  it('defaults to one hop on Render and no trust locally; validates explicit overrides', () => {
    const script =
      "process.stdout.write(String(require('./src/config/environment').config.trustProxyHops))";
    function env(render, override) {
      const value = { ...process.env, NODE_ENV: 'test', RENDER: render };
      delete value.TRUST_PROXY_HOPS;
      if (override !== undefined) value.TRUST_PROXY_HOPS = override;
      return value;
    }
    for (const [render, override, expected] of [
      ['true', undefined, '1'],
      ['false', undefined, '0'],
      ['true', '0', '0'],
      ['false', '1', '1'],
      ['true', '2', '2'],
    ]) {
      assert.equal(
        execFileSync(process.execPath, ['-e', script], {
          cwd: require('path').resolve(__dirname, '..'),
          env: env(render, override),
          encoding: 'utf8',
        }),
        expected,
      );
    }
    for (const value of ['true', '-1', '1.5', '6', '', 'garbage']) {
      const result = spawnSync(process.execPath, ['-e', script], {
        cwd: require('path').resolve(__dirname, '..'),
        env: env('true', value),
        encoding: 'utf8',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /TRUST_PROXY_HOPS debe ser un entero/);
    }
  });

  it('keeps the global limit active and independent for forwarded clients', async () => {
    const app = appWith(1, '2');
    const errors = sinon.stub(console, 'error');
    assert.equal(app.get('trust proxy'), 1);
    for (let i = 0; i < 2; i++) {
      await request(app).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.10').expect(200);
    }
    await request(app).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.10').expect(429);
    await request(app).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.11').expect(200);
    assert.equal(errors.called, false);
  });

  it('enforces five recovery requests per client and ignores spoofed leftmost addresses', async () => {
    const app = appWith(1);
    const errors = sinon.stub(console, 'error');
    const forgot = sinon.stub(auth, 'forgotPassword').resolves({ success: true });
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .set('X-Forwarded-For', `198.51.100.${i + 1}, 203.0.113.20`)
        .send({ email: 'person@example.com' })
        .expect(200);
    }
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', '198.51.100.99, 203.0.113.20')
      .send({ email: 'person@example.com' })
      .expect(429);
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', '203.0.113.21')
      .send({ email: 'person@example.com' })
      .expect(200);
    assert.equal(forgot.callCount, 6);
    assert.equal(errors.called, false);
    assert.ok(logger.info.args.some(([line]) => line.endsWith('IP: 203.0.113.20')));
  });

  it('does not trust forwarded headers during direct local access', async () => {
    const app = appWith(0, '1');
    const errors = sinon.stub(console, 'error');
    assert.equal(app.get('trust proxy'), false);
    await request(app).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.30').expect(200);
    await request(app).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.31').expect(429);
    // Detection remains enabled for a genuinely untrusted forwarded header.
    assert.ok(errors.args.some(([error]) => error.code === 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR'));
  });

  it('reaches the real recovery service and email transport behind the proxy without validation errors', async () => {
    const app = appWith(1);
    const errors = sinon.stub(console, 'error');
    const warnings = sinon.stub(logger, 'warn');
    const id = new mongoose.Types.ObjectId();
    sinon
      .stub(User, 'findOne')
      .resolves({ _id: id, email: 'person@example.com', status: 'active' });
    sinon.stub(User, 'findOneAndUpdate').resolves({ _id: id, status: 'active' });
    sinon.stub(mongoose.connection, 'transaction').callsFake(async (work) => work({}));
    sinon.stub(Token, 'updateMany').resolves({ modifiedCount: 0 });
    sinon.stub(Token, 'create').resolves([]);
    const send = sinon.stub(email, 'sendEmail').resolves({ id: 'mock-message' });
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', '203.0.113.40')
      .send({ email: 'person@example.com' })
      .expect(200);
    assert.equal(send.callCount, 1);
    assert.equal(send.firstCall.args[0].to, 'person@example.com');
    assert.equal(errors.called, false);
    assert.equal(warnings.called, false);
  });
});
