const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/users.model');
const emailService = require('../src/shared/services/email');
const { config } = require('../src/config/environment');
const { logger } = require('../src/shared/utils/logger');
describe('Authentication needed by the M03 entry flow', () => {
  let previousApiKey;
  beforeEach(() => {
    previousApiKey = config.resendApiKey;
  });
  afterEach(() => {
    config.resendApiKey = previousApiKey;
    sinon.restore();
  });
  it('rejects malformed login without database access', async () => {
    const find = sinon.spy(User, 'findOne');
    await request(app).post('/api/v1/auth/login').send({}).expect(400);
    expect(find.called).to.equal(false);
  });
  it('rejects inactive users without issuing tokens', async () => {
    sinon.stub(User, 'findOne').returns({ select: sinon.stub().resolves({ status: 'inactive' }) });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'qa@example.com', password: 'fictional' })
      .expect(401);
    expect(res.body).not.to.have.property('data');
  });
  it('does not grant a public registrant privileged roles or return password hashes', async () => {
    sinon.stub(User, 'findOne').resolves(null);
    const save = sinon.stub(User.prototype, 'save').callsFake(async function () {
      return this;
    });
    const sendEmail = sinon.stub(emailService, 'sendEmail').resolves({ id: 'welcome-id' });
    const password = require('crypto').randomBytes(20).toString('hex');
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'qa@example.com',
        password,
        firstName: 'QA',
        lastName: 'M03',
        role: 'super_admin',
        permissions: ['customers.delete'],
        from: 'attacker@example.com',
      })
      .expect(201);
    expect(res.body.data.role).to.equal('user');
    expect(res.body.data.permissions).to.deep.equal([]);
    expect(res.body.data).not.to.have.property('password');
    sinon.assert.callOrder(save, sendEmail);
    expect(sendEmail.calledOnce).to.equal(true);
    const message = sendEmail.firstCall.args[0];
    expect(message.to).to.equal('qa@example.com');
    expect(message.subject).to.equal('Bienvenido a YJ Nexo ERP');
    expect(message.text).to.include('Hola, QA M03.');
    expect(message.html).to.include('Hola, QA M03.');
    for (const welcomeText of [
      'Tu cuenta ha sido creada correctamente en YJ Nexo ERP.',
      'Ya puedes ingresar al sistema y comenzar a utilizarlo.',
      'Bienvenido a YJ Nexo ERP.',
    ]) {
      expect(message.text).to.include(welcomeText);
      expect(message.html).to.include(welcomeText);
    }
    expect(JSON.stringify(message)).not.to.include(password);
    expect(JSON.stringify(message)).not.to.match(/token|jwt|bearer/i);
    expect(message).not.to.have.property('from');
  });

  it('returns HTTP 201 and logs only safe diagnostics when the welcome email fails', async () => {
    sinon.stub(User, 'findOne').resolves(null);
    const save = sinon.stub(User.prototype, 'save').callsFake(async function () {
      return this;
    });
    const apiKey = 're_test_welcome_key';
    const password = 'WelcomePassword-NotForLogs';
    const token = 'a'.repeat(64);
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature';
    config.resendApiKey = apiKey;
    sinon.stub(emailService, 'sendEmail').rejects(
      Object.assign(new Error(`provider ${apiKey} ${password} ${token} ${jwt}`), {
        code: 'EMAIL_PROVIDER_ERROR',
        stage: 'resend_response',
        httpStatus: 422,
        providerCode: 'validation_error',
        providerMessage: `Invalid payload ${apiKey} password=${password} token=${token} ${jwt} mongodb://db-user:db-password@db.example/erp qa@example.com`,
      }),
    );
    const warn = sinon.stub(logger, 'warn');

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'qa@example.com',
        password,
        firstName: 'Ada',
        lastName: 'Lovelace',
      })
      .expect(201);

    expect(save.calledOnce).to.equal(true);
    expect(res.body.success).to.equal(true);
    expect(res.body.data.email).to.equal('qa@example.com');
    expect(warn.calledOnce).to.equal(true);
    expect(warn.firstCall.args[1]).to.include({
      stage: 'resend_response',
      errorCode: 'EMAIL_PROVIDER_ERROR',
      httpStatus: 422,
      providerCode: 'validation_error',
    });
    expect(warn.firstCall.args[1].durationMs).to.be.a('number');
    const logged = JSON.stringify(warn.args);
    for (const secret of [apiKey, password, token, jwt, 'db-password', 'qa@example.com']) {
      expect(logged).not.to.include(secret);
    }
  });
});
