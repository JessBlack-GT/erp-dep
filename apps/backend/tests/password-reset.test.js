const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const sinon = require('sinon');
const request = require('supertest');
const app = require('../src/app');
const service = require('../src/modules/auth/auth.service');
const Token = require('../src/modules/auth/password-reset-token.model');
const User = require('../src/modules/users/users.model');
const email = require('../src/shared/services/email');
const { config } = require('../src/config/environment');
const { logger } = require('../src/shared/utils/logger');
const id = new mongoose.Types.ObjectId();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const freshPassword = () => crypto.randomBytes(20).toString('hex');

describe('Password recovery: isolated persistence and email', () => {
  let mail, create, invalidate, lock, update, claim, find, lookup, transaction, previous;
  beforeEach(() => {
    previous = {
      frontendAppUrl: config.frontendAppUrl,
      passwordResetTokenTtlMinutes: config.passwordResetTokenTtlMinutes,
      resendApiKey: config.resendApiKey,
      mongodbUri: config.mongodbUri,
      jwtSecret: config.jwtSecret,
      jwtRefreshSecret: config.jwtRefreshSecret,
      emailPass: config.emailPass,
    };
    config.frontendAppUrl = 'https://erp-dep.pages.dev';
    config.passwordResetTokenTtlMinutes = 15;
    config.resendApiKey = 'resend-test-secret';
    config.mongodbUri = 'mongodb://db-user:db-password@db.example/erp';
    config.jwtSecret = 'jwt-test-secret';
    config.jwtRefreshSecret = 'refresh-test-secret';
    config.emailPass = 'smtp-test-secret';
    sinon.stub(logger, 'warn');
    mail = sinon.stub(email, 'sendEmail').resolves({ id: 'mock-message' });
    lookup = sinon
      .stub(User, 'findOne')
      .resolves({ _id: id, email: 'person@example.com', status: 'active' });
    lock = sinon.stub(User, 'findOneAndUpdate').resolves({ _id: id, status: 'active' });
    update = sinon.stub(User, 'updateOne').resolves({ modifiedCount: 1 });
    create = sinon.stub(Token, 'create').resolves([]);
    invalidate = sinon.stub(Token, 'updateMany').resolves({ modifiedCount: 1 });
    claim = sinon.stub(Token, 'findOneAndUpdate').resolves({ userId: id });
    find = sinon.stub(Token, 'findOne').resolves({ userId: id });
    transaction = sinon
      .stub(mongoose.connection, 'transaction')
      .callsFake(async (work) => work({ testSession: true }));
  });
  afterEach(() => {
    Object.assign(config, previous);
    sinon.restore();
  });

  it('stores only SHA-256, invalidates old tokens and sends the exact frontend link', async () => {
    const started = Date.now();
    const result = await service.forgotPassword(' PERSON@EXAMPLE.COM ');
    assert.equal(result.success, true);
    assert.deepEqual(lookup.firstCall.args[0], { email: 'person@example.com', status: 'active' });
    const message = mail.firstCall.args[0];
    const link = message.text.match(/https:\/\/\S+/)[0];
    const url = new URL(link);
    const token = url.searchParams.get('token');
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(url.origin, 'https://erp-dep.pages.dev');
    assert.equal(url.pathname, '/reset-password');
    const saved = create.firstCall.args[0][0];
    assert.equal(saved.tokenHash, hash(token));
    assert.equal(JSON.stringify(saved).includes(token), false);
    assert.ok(saved.expiresAt.getTime() >= started + 15 * 60000);
    assert.ok(saved.expiresAt.getTime() <= Date.now() + 15 * 60000);
    assert.equal(message.to, 'person@example.com');
    assert.match(message.html, /Restablecer contraseña/);
    assert.match(message.html, /15 minutos/);
    sinon.assert.notCalled(logger.warn);
    assert.equal(result.token, undefined);
    sinon.assert.callOrder(lock, invalidate, create, mail);
    assert.deepEqual(create.firstCall.args[1].session, { testSession: true });
  });

  it('has identical responses for existing, missing and inactive accounts without sending to missing users', async () => {
    const known = await service.forgotPassword('person@example.com');
    lookup.resolves(null); // Query includes status: active, so inactive users are also excluded.
    const unknown = await service.forgotPassword('absent@example.com');
    assert.deepEqual(unknown, known);
    assert.equal(mail.callCount, 1);
  });

  it('does not create or send if the user becomes inactive during issuance', async () => {
    lock.resolves(null);
    assert.equal((await service.forgotPassword('person@example.com')).success, true);
    assert.equal(create.called, false);
    assert.equal(mail.called, false);
  });

  for (const status of [401, 403, 422, 429]) {
    it(`logs safe stage and provider diagnostics for Resend HTTP ${status}`, async () => {
      mail.rejects(
        Object.assign(new Error('Resend error'), {
          code: 'EMAIL_PROVIDER_ERROR',
          stage: 'resend_response',
          httpStatus: status,
          providerCode: 'validation_error',
          providerMessage: `Invalid API key resend-test-secret password=private-password token=${'b'.repeat(64)} https://erp-dep.pages.dev/reset-password?token=${'c'.repeat(64)} mongodb://db-user:db-password@db.example/erp`,
        }),
      );
      const result = await service.forgotPassword('person@example.com');
      assert.deepEqual(result, {
        success: true,
        message:
          'Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.',
      });
      assert.equal(invalidate.callCount, 2);
      const logged = logger.warn.firstCall.args[1];
      assert.equal(logged.stage, 'resend_response');
      assert.equal(logged.errorCode, 'EMAIL_PROVIDER_ERROR');
      assert.equal(logged.httpStatus, status);
      assert.equal(logged.providerCode, 'validation_error');
      assert.match(logged.providerMessage, /Invalid API key/);
      assert.equal(typeof logged.durationMs, 'number');
      const serialized = JSON.stringify(logger.warn.args);
      for (const secret of [
        'resend-test-secret',
        'private-password',
        'b'.repeat(64),
        'c'.repeat(64),
        'erp-dep.pages.dev/reset-password',
        'mongodb://db-user:db-password@db.example/erp',
        'person@example.com',
        'jwt-test-secret',
        'refresh-test-secret',
        'smtp-test-secret',
      ]) {
        assert.equal(serialized.includes(secret), false, `logged secret: ${secret}`);
      }
    });
  }

  it('logs MongoDB user lookup failures without exposing connection details', async () => {
    lookup.rejects(
      Object.assign(new Error('mongodb://db-user:db-password@db.example/erp'), { code: 11000 }),
    );
    assert.equal((await service.forgotPassword('person@example.com')).success, true);
    assert.equal(mail.called, false);
    assert.equal(logger.warn.firstCall.args[1].stage, 'user_lookup');
    assert.equal(logger.warn.firstCall.args[1].errorCode, 11000);
    assert.equal(JSON.stringify(logger.warn.args).includes('db-password'), false);
  });

  it('logs token creation failures separately from the transaction', async () => {
    create.rejects(new Error('private database detail'));
    assert.equal((await service.forgotPassword('person@example.com')).success, true);
    assert.equal(mail.called, false);
    assert.equal(logger.warn.firstCall.args[1].stage, 'token_creation');
    assert.equal(JSON.stringify(logger.warn.args).includes('private database detail'), false);
  });

  it('conceals database failure without sending', async () => {
    transaction.rejects(Error('private database detail'));
    assert.equal((await service.forgotPassword('person@example.com')).success, true);
    assert.equal(mail.called, false);
    assert.equal(logger.warn.firstCall.args[1].stage, 'transaction_start');
    assert.equal(typeof logger.warn.firstCall.args[1].durationMs, 'number');
    assert.equal(JSON.stringify(logger.warn.args).includes('private database detail'), false);
  });

  it('validates email before persistence or email', async () => {
    for (const value of [undefined, {}, '', 'invalid']) {
      await assert.rejects(service.forgotPassword(value), { statusCode: 400 });
    }
    assert.equal(lookup.called, false);
  });

  it('uses configurable expiry and rejects unsafe URL or invalid TTL without sending', async () => {
    config.passwordResetTokenTtlMinutes = 20;
    await service.forgotPassword('person@example.com');
    assert.match(mail.firstCall.args[0].text, /20 minutos/);
    mail.resetHistory();
    for (const ttl of [0, -1, NaN, 61, 1.5]) {
      config.passwordResetTokenTtlMinutes = ttl;
      await service.forgotPassword('person@example.com');
    }
    config.passwordResetTokenTtlMinutes = 15;
    config.frontendAppUrl = 'https://untrusted:secret@example.com';
    await service.forgotPassword('person@example.com');
    assert.equal(mail.called, false);
  });

  it('atomically consumes the token, bcrypt-hashes the new password and revokes sessions without JWT', async () => {
    const token = crypto.randomBytes(32).toString('hex');
    const password = freshPassword();
    const result = await service.resetPassword(token, password);
    assert.deepEqual(result, { success: true, message: 'Contraseña restablecida correctamente.' });
    assert.equal(find.firstCall.args[0].tokenHash, hash(token));
    assert.equal(claim.firstCall.args[0].usedAt, null);
    assert.ok(claim.firstCall.args[0].expiresAt.$gt instanceof Date);
    const changes = update.firstCall.args[1];
    assert.equal(changes.$inc.sessionVersion, 1);
    assert.equal(await bcrypt.compare(password, changes.$set.password), true);
    assert.equal(bcrypt.getRounds(changes.$set.password), 12);
    sinon.assert.callOrder(lock, claim, update, invalidate);
    for (const operation of [claim, update, invalidate]) {
      assert.deepEqual(operation.firstCall.args[2].session, { testSession: true });
    }
  });

  it('rejects absent, expired or used tokens using the same explicit expiry/unused filter', async () => {
    find.resolves(null);
    await assert.rejects(
      service.resetPassword(crypto.randomBytes(32).toString('hex'), freshPassword()),
      {
        statusCode: 400,
        message: 'El enlace de recuperación no es válido o ha expirado.',
      },
    );
    assert.equal(find.firstCall.args[0].usedAt, null);
    assert.ok(find.firstCall.args[0].expiresAt.$gt instanceof Date);
    assert.equal(update.called, false);
  });

  it('rejects reuse or expiration between precheck and atomic claim', async () => {
    claim.resolves(null);
    await assert.rejects(
      service.resetPassword(crypto.randomBytes(32).toString('hex'), freshPassword()),
      { statusCode: 400 },
    );
    assert.equal(update.called, false);
  });

  it('allows only one of two concurrent redemptions and rejects subsequent reuse', async () => {
    let used = false;
    let queue = Promise.resolve();
    transaction.callsFake((work) => {
      const next = queue.then(() => work({ testSession: true }));
      queue = next.catch(() => {});
      return next;
    });
    claim.callsFake(async () => {
      if (used) return null;
      used = true;
      return { userId: id };
    });
    const token = crypto.randomBytes(32).toString('hex');
    const results = await Promise.allSettled([
      service.resetPassword(token, freshPassword()),
      service.resetPassword(token, freshPassword()),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
    assert.equal(update.callCount, 1);
    await assert.rejects(service.resetPassword(token, freshPassword()), { statusCode: 400 });
    assert.equal(update.callCount, 1);
  });

  it('rejects access and refresh JWTs issued before the reset using existing sessionVersion checks', async () => {
    const jwt = require('jsonwebtoken');
    const priorRefresh = jwt.sign(
      { id: String(id), sv: 0, kind: 'refresh' },
      config.jwtRefreshSecret,
    );
    const priorAccess = jwt.sign({ id: String(id), sv: 0, kind: 'access' }, config.jwtSecret);
    let version = 0;
    update.callsFake(async (filter, change) => {
      version += change.$inc.sessionVersion;
      return { modifiedCount: 1 };
    });
    sinon.stub(User, 'findById').callsFake(() => ({
      select: () => {
        const user = {
          _id: id,
          email: 'person@example.com',
          status: 'active',
          role: 'user',
          sessionVersion: version,
        };
        return Object.assign(Promise.resolve(user), { lean: async () => user });
      },
    }));
    sinon
      .stub(require('../src/modules/roles/roles.model'), 'findOne')
      .returns({ lean: async () => null });
    await service.resetPassword(crypto.randomBytes(32).toString('hex'), freshPassword());
    await assert.rejects(service.refreshToken(priorRefresh), { statusCode: 401 });
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${priorAccess}`)
      .expect(401);
  });

  it('does not include recovery query values in the request logger, even in development', () => {
    const { requestLogger } = require('../src/middleware/requestLogger');
    const info = sinon.stub(logger, 'info');
    const token = crypto.randomBytes(32).toString('hex');
    requestLogger(
      {
        method: 'POST',
        originalUrl: `/api/v1/auth/reset-password?token=${token}`,
        path: '/api/v1/auth/reset-password',
        route: { path: '/reset-password' },
        body: { token },
        ip: 'local',
      },
      { statusCode: 400, on: (event, fn) => fn() },
      () => {},
    );
    assert.equal(JSON.stringify(info.args).includes(token), false);
  });

  it('rejects inactive users and rolls back when updating the password fails', async () => {
    lock.resolves(null);
    await assert.rejects(
      service.resetPassword(crypto.randomBytes(32).toString('hex'), freshPassword()),
      { statusCode: 400 },
    );
    assert.equal(claim.called, false);
    lock.resolves({ _id: id });
    update.resolves({ modifiedCount: 0 });
    await assert.rejects(
      service.resetPassword(crypto.randomBytes(32).toString('hex'), freshPassword()),
      { statusCode: 400 },
    );
    assert.equal(invalidate.called, false);
  });

  it('rejects malformed tokens and weak or overlong UTF-8 passwords', async () => {
    for (const token of [undefined, {}, '', 'short']) {
      await assert.rejects(service.resetPassword(token, freshPassword()), { statusCode: 400 });
    }
    for (const password of ['short', 'é'.repeat(37), undefined]) {
      await assert.rejects(
        service.resetPassword(crypto.randomBytes(32).toString('hex'), password),
        { statusCode: 400 },
      );
    }
    assert.equal(find.called, false);
  });

  it('defines a TTL expiry index and unique hash without a raw token field', () => {
    const indexes = Token.schema.indexes();
    assert.ok(
      indexes.some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0),
    );
    assert.ok(indexes.some(([keys, options]) => keys.tokenHash === 1 && options.unique));
    assert.equal(Token.schema.path('token'), undefined);
  });

  it('registers both public endpoints and limits recovery requests independently of the global limit', async () => {
    lookup.resolves(null);
    const first = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'unknown@example.com' })
      .expect(200);
    lookup.resolves({ _id: id, email: 'person@example.com' });
    const second = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'person@example.com' })
      .expect(200);
    assert.deepEqual(first.body, second.body);
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'person@example.com' })
        .expect(200);
    }
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'person@example.com' })
      .expect(429);
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'bad', password: 'bad' })
      .expect(400);
    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: crypto.randomBytes(32).toString('hex'),
        password: freshPassword(),
      })
      .expect(200);
    assert.deepEqual(Object.keys(reset.body).sort(), ['message', 'success']);
  });
});
