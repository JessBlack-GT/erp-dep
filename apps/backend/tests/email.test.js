const assert = require('node:assert/strict');
const sinon = require('sinon');
const { config } = require('../src/config/environment');
const { sendEmail } = require('../src/shared/services/email');

describe('Resend email transport (no real network)', () => {
  let request;
  let previous;
  const message = { to: 'recipient@example.com', subject: 'Test', text: 'Test message' };
  beforeEach(() => {
    previous = { resendApiKey: config.resendApiKey, emailFrom: config.emailFrom };
    config.resendApiKey = 'test-only-placeholder';
    config.emailFrom = 'ERP <sender@example.com>';
    request = sinon.stub(globalThis, 'fetch');
  });
  afterEach(() => {
    Object.assign(config, previous);
    sinon.restore();
  });

  it('sends HTTPS with server credentials and configured sender, returning only the id', async () => {
    request.resolves({ ok: true, json: async () => ({ id: 'email-id', extra: 'ignored' }) });
    assert.deepEqual(await sendEmail({ ...message, from: 'untrusted@example.com' }), {
      id: 'email-id',
    });
    const [url, options] = request.firstCall.args;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-only-placeholder');
    assert.deepEqual(JSON.parse(options.body), {
      ...message,
      to: [message.to],
      from: config.emailFrom,
    });
  });

  it('supports HTML and multiple recipients', async () => {
    request.resolves({ ok: true, json: async () => ({ id: 'html-id' }) });
    await sendEmail({
      to: [message.to, 'other@example.com'],
      subject: 'HTML',
      html: '<p>Hello</p>',
    });
    assert.equal(JSON.parse(request.firstCall.args[1].body).html, '<p>Hello</p>');
  });

  for (const field of ['resendApiKey', 'emailFrom']) {
    it(`rejects missing ${field} without network access`, async () => {
      config[field] = '';
      await assert.rejects(sendEmail(message), { code: 'EMAIL_NOT_CONFIGURED' });
      assert.equal(request.called, false);
    });
  }

  it('rejects invalid messages before contacting Resend', async () => {
    for (const invalid of [
      {},
      { ...message, to: [] },
      { ...message, subject: '' },
      { ...message, text: undefined },
      { ...message, html: {} },
    ]) {
      await assert.rejects(sendEmail(invalid), { code: 'EMAIL_INVALID_MESSAGE' });
    }
    assert.equal(request.called, false);
  });

  for (const status of [401, 403, 429, 500]) {
    it(`rejects HTTP ${status} without exposing the response body`, async () => {
      const json = sinon.stub().resolves({ message: 'sensitive provider details' });
      request.resolves({ ok: false, status, json });
      await assert.rejects(sendEmail(message), {
        code: 'EMAIL_PROVIDER_ERROR',
        message: 'Resend rechazó el envío de correo',
      });
      assert.equal(json.called, false);
      assert.equal(request.callCount, 1);
    });
  }

  it('does not report success for malformed responses', async () => {
    request.resolves({ ok: true, json: async () => ({}) });
    await assert.rejects(sendEmail(message), { code: 'EMAIL_PROVIDER_ERROR' });
    request.resolves({
      ok: true,
      json: async () => {
        throw Error('private response');
      },
    });
    await assert.rejects(sendEmail(message), { code: 'EMAIL_SEND_FAILED' });
  });

  it('sanitizes network failures and does not retry ambiguous sends', async () => {
    request.rejects(new Error('private transport details'));
    await assert.rejects(sendEmail(message), {
      code: 'EMAIL_SEND_FAILED',
      message: 'No se pudo completar el envío con Resend',
    });
    assert.equal(request.callCount, 1);
  });

  it('aborts a stalled send after 10 seconds', async () => {
    const clock = sinon.useFakeTimers();
    request.callsFake(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    );
    const result = assert.rejects(sendEmail(message), { code: 'EMAIL_TIMEOUT' });
    await clock.tickAsync(10000);
    await result;
    assert.equal(clock.countTimers(), 0);
  });
});
