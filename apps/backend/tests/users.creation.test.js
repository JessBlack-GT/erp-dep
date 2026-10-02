const assert = require('node:assert/strict');
const sinon = require('sinon');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../src/modules/users/users.model');
const admin = require('../src/security/administration');
const rbac = require('../src/security/rbac');
const service = require('../src/modules/users/users.service');
const email = require('../src/shared/services/email');
const { config } = require('../src/config/environment');
const { logger } = require('../src/shared/utils/logger');
const actor = { id: '507f1f77bcf86cd799439011', role: 'admin', permissions: rbac.PERMISSIONS, sessionVersion: 0 };
const payload = { email: 'new@example.com', firstName: 'Jesus', lastName: 'Garcia', password: 'private-password-123', role: 'user', phone: '5555555555' };

describe('POST /api/v1/users creation diagnostics and welcome (mocked I/O)', () => {
  let app, save, send, transaction, logs;
  beforeEach(() => {
    logs = [];
    for (const level of ['info', 'warn', 'error']) sinon.stub(logger, level).callsFake((...args) => logs.push(args));
    sinon.stub(jwt, 'verify').returns({ id: actor.id, sv: 0 });
    sinon.stub(rbac, 'resolveAccess').resolves(actor);
    transaction = sinon.stub(admin, 'transaction').callsFake(async (_actor, _permission, work) => work({}, actor));
    sinon.stub(admin, 'assignable').resolves({ name: 'user' });
    save = sinon.stub(User.prototype, 'save').callsFake(async function () { return this; });
    send = sinon.stub(email, 'sendEmail').resolves({ id: 'mock-email' });
    app = express();
    app.use(express.json());
    app.use('/api/v1/users', require('../src/modules/users/users.routes'));
  });
  afterEach(() => sinon.restore());
  const post = (app, body = payload) => request(app).post('/api/v1/users').set('Authorization', 'Bearer mock-token').send(body);
  const failures = () => logs.filter(([label]) => label === 'users.create stage_failed').map(([, data]) => data);

  it('creates with the existing 201 envelope and no password; sends once after save and commit', async () => {
    let committed = false;
    transaction.callsFake(async (_a, _p, work) => { const dto = await work({}, actor); committed = true; return dto; });
    send.callsFake(async (message) => {
      assert.equal(committed, true);
      assert.equal(save.calledOnce, true);
      assert.equal(message.to, payload.email);
      assert.equal(message.from, undefined);
      assert.ok(!JSON.stringify(message).includes(payload.password));
    });
    const result = await post(app);
    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
    assert.equal(result.body.data.email, payload.email);
    assert.equal(result.body.data.password, undefined);
    assert.equal(send.callCount, 1);
  });
  it('does not send twice when MongoDB retries the callback', async () => {
    transaction.callsFake(async (_a, _p, work) => { await work({}, actor); return work({}, actor); });
    assert.equal((await post(app)).status, 201);
    assert.equal(save.callCount, 2);
    assert.equal(send.callCount, 1);
  });
  it('duplicate unique index returns the same 409 without sending', async () => {
    save.rejects(Object.assign(new Error('private duplicate'), { code: 11000 }));
    const result = await post(app);
    assert.equal(result.status, 409);
    assert.equal(result.body.error, 'Conflicto con un registro existente');
    assert.equal(send.called, false);
    assert.equal(failures()[0].stage, 'user_save');
  });
  it('validates data and rejects frontend-controlled sender', async () => {
    for (const body of [{ ...payload, password: 'short' }, { ...payload, from: 'attacker@example.com' }]) {
      assert.equal((await post(app, body)).status, 400);
    }
    assert.equal(save.called, false);
    assert.equal(send.called, false);
    assert.equal(failures()[0].stage, 'validation');
  });
  it('rejects missing authentication without saving', async () => {
    assert.equal((await request(app).post('/api/v1/users').send(payload)).status, 401);
    assert.equal(save.called, false);
  });
  it('rejects missing permissions without saving', async () => {
    rbac.resolveAccess.resolves({ ...actor, permissions: [] });
    assert.equal((await post(app)).status, 403);
    assert.equal(save.called, false);
  });
  it('logs MongoDB failure during authorization with unchanged 503', async () => {
    rbac.resolveAccess.rejects(Object.assign(new Error('private database'), { name: 'MongoNetworkError' }));
    assert.equal((await post(app)).status, 503);
    assert.equal(failures()[0].stage, 'database_lookup');
    assert.equal(save.called, false);
  });
  it('logs role lookup failure and never sends', async () => {
    admin.assignable.rejects(new Error('database unavailable'));
    assert.equal((await post(app)).status, 500);
    assert.equal(failures()[0].stage, 'database_lookup');
    assert.equal(send.called, false);
  });
  it('save failure never sends welcome', async () => {
    save.rejects(new Error('save failure'));
    assert.equal((await post(app)).status, 500);
    assert.equal(failures()[0].stage, 'user_save');
    assert.equal(send.called, false);
  });
  it('commit failure after save never sends welcome', async () => {
    transaction.callsFake(async (_a, _p, work) => { await work({}, actor); throw new Error('commit failure'); });
    assert.equal((await post(app)).status, 500);
    assert.equal(save.calledOnce, true);
    assert.equal(send.called, false);
    assert.equal(failures()[0].stage, 'database_commit');
  });
  for (const method of ['genSalt', 'hash']) {
    it(`real pre-save hook labels ${method} failure as password_hash`, async () => {
      save.restore();
      sinon.stub(bcrypt, method).rejects(new Error('hash failure'));
      const insert = sinon.stub(User.collection, 'insertOne').resolves({ acknowledged: true });
      assert.equal((await post(app)).status, 500);
      assert.equal(failures()[0].stage, 'password_hash');
      assert.equal(insert.called, false);
      assert.equal(send.called, false);
    });
  }
  it('real save hook hashes before mocked MongoDB insertion', async () => {
    save.restore();
    sinon.stub(bcrypt, 'genSalt').resolves('mock-salt');
    sinon.stub(bcrypt, 'hash').resolves('mock-hash');
    const insert = sinon.stub(User.collection, 'insertOne').callsFake(async (doc) => {
      assert.equal(doc.password, 'mock-hash');
      assert.equal(send.called, false);
      return { acknowledged: true, insertedId: doc._id };
    });
    assert.equal((await post(app)).status, 201);
    assert.equal(insert.calledOnce, true);
    assert.equal(send.calledOnce, true);
  });
  for (const code of ['EMAIL_PROVIDER_ERROR', 'EMAIL_SEND_FAILED', 'EMAIL_TIMEOUT']) {
    it(`${code} preserves committed user and normal creation response`, async () => {
      send.rejects(Object.assign(new Error('provider private detail'), { code, httpStatus: 403 }));
      assert.equal((await post(app)).status, 201);
      assert.equal(save.calledOnce, true);
      assert.equal(send.calledOnce, true);
      assert.equal(failures()[0].stage, 'welcome_email_send');
      assert.equal(failures()[0].errorCode, code);
    });
  }
  for (const secret of [payload.password, 're_private_api_key_123456', 'eyJtoken.secret.signature', 'mongodb+srv://user:password@private/db']) {
    it(`redacts sensitive error properties (${['password', 'API key', 'token', 'MongoDB URI'][[payload.password, 're_private_api_key_123456', 'eyJtoken.secret.signature', 'mongodb+srv://user:password@private/db'].indexOf(secret)]})`, async () => {
      send.rejects(Object.assign(new Error(secret), { name: secret, code: secret, providerCode: secret, providerMessage: secret, stack: secret }));
      assert.equal((await post(app)).status, 201);
      assert.ok(!JSON.stringify(logs).includes(secret));
      assert.deepEqual(Object.keys(failures()[0]).sort(), ['stage', 'errorName', 'errorCode', 'httpStatus', 'providerCode', 'providerMessage', 'durationMs'].sort());
    });
  }
  it('real transport uses EMAIL_FROM and mocked network after save', async () => {
    send.restore();
    const previous = { resendApiKey: config.resendApiKey, emailFrom: config.emailFrom };
    Object.assign(config, { resendApiKey: 'mock-only', emailFrom: 'ERP <server@example.com>' });
    const fetch = sinon.stub(globalThis, 'fetch').callsFake(async (_url, options) => {
      assert.equal(save.calledOnce, true);
      assert.equal(JSON.parse(options.body).from, config.emailFrom);
      return { ok: true, json: async () => ({ id: 'mock-email' }) };
    });
    try { assert.equal((await post(app)).status, 201); assert.equal(fetch.calledOnce, true); }
    finally { Object.assign(config, previous); }
  });
  for (const failure of ['provider', 'network', 'timeout']) {
    it(`real transport ${failure} failure cannot roll back the account`, async () => {
      send.restore();
      const previous = { resendApiKey: config.resendApiKey, emailFrom: config.emailFrom };
      Object.assign(config, { resendApiKey: 'mock-only', emailFrom: 'server@example.com' });
      const clock = failure === 'timeout' ? sinon.useFakeTimers() : null;
      const fetch = sinon.stub(globalThis, 'fetch');
      if (failure === 'provider') fetch.resolves({ ok: false, status: 403, text: async () => JSON.stringify({ name: 'validation_error', message: 'private provider detail' }) });
      if (failure === 'network') fetch.rejects(new TypeError('private network detail'));
      if (failure === 'timeout') fetch.callsFake((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })));
      try {
        const pending = service.create(payload, actor);
        if (clock) await clock.tickAsync(10001);
        const result = await pending;
        assert.equal(result.email, payload.email);
        assert.equal(save.calledOnce, true);
        assert.equal(fetch.calledOnce, true);
        assert.equal(failures()[0].errorCode, { provider: 'EMAIL_PROVIDER_ERROR', network: 'EMAIL_SEND_FAILED', timeout: 'EMAIL_TIMEOUT' }[failure]);
      } finally { Object.assign(config, previous); }
    });
  }
});
