const { expect } = require('chai');
const sinon = require('sinon');
const crypto = require('crypto');
const { productionErrors } = require('../src/config/production');
const { config } = require('../src/config/environment');
const { corsOptions } = require('../src/config/cors');
function environment() {
  return {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://db.example.invalid/application',
    MONGODB_DB_NAME: 'application',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
    CORS_ORIGIN_FRONTEND: 'https://web.example.invalid',
    TRUST_PROXY_HOPS: '1',
  };
}
describe('Production hosting boundaries', () => {
  afterEach(() => sinon.restore());
  it('accepts explicit production environment without a local file', () =>
    expect(productionErrors(environment())).to.deep.equal([]));
  for (const key of [
    'MONGODB_URI',
    'MONGODB_DB_NAME',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CORS_ORIGIN_FRONTEND',
  ])
    it('rejects missing ' + key, () => {
      const env = environment();
      delete env[key];
      expect(productionErrors(env)).to.include(key);
    });
  it('rejects shared JWT keys', () => {
    const env = environment();
    env.JWT_REFRESH_SECRET = env.JWT_SECRET;
    expect(productionErrors(env)).to.include('JWT_REFRESH_SECRET');
  });
  it('rejects QA configuration in production', () =>
    expect(productionErrors({ ...environment(), M03_QA_DATABASE: 'anything' })).to.include(
      'MONGODB_DB_NAME',
    ));
  for (const origin of [
    '*',
    'http://web.example.invalid',
    'https://web.example.invalid/path',
    'https://localhost',
  ])
    it('rejects unsafe frontend origin ' + origin, () =>
      expect(productionErrors({ ...environment(), CORS_ORIGIN_FRONTEND: origin })).to.include(
        'CORS_ORIGIN_FRONTEND',
      ),
    );
  it('rejects insecure MongoDB TLS options', () =>
    expect(
      productionErrors({
        ...environment(),
        MONGODB_URI:
          'mongodb+srv://db.example.invalid/application?tlsAllowInvalidCertificates=true',
      }),
    ).to.include('MONGODB_URI'));
  it('rejects unlimited trust proxy', () =>
    expect(productionErrors({ ...environment(), TRUST_PROXY_HOPS: 'true' })).to.include(
      'TRUST_PROXY_HOPS',
    ));
  it('denies local origins in production but permits configured HTTPS origin', () => {
    sinon.stub(config, 'nodeEnv').value('production');
    sinon.stub(config, 'corsOrigin').value(undefined);
    sinon.stub(config, 'corsOriginFrontend').value('https://web.example.invalid');
    corsOptions.origin('http://localhost:8081', (error) => expect(error.statusCode).to.equal(403));
    corsOptions.origin('https://web.example.invalid', (error, allowed) => {
      expect(error).to.equal(null);
      expect(allowed).to.equal(true);
    });
  });
  it('sanitizes production validation response and logs', () => {
    sinon.stub(config, 'nodeEnv').value('production');
    const log = sinon.stub(require('../src/shared/utils/logger').logger, 'error');
    const payload = crypto.randomBytes(24).toString('hex');
    const res = { status: sinon.stub().returnsThis(), json: sinon.spy() };
    require('../src/middleware/errorHandler').errorHandler(
      { name: 'ValidationError', message: payload, errors: { password: payload } },
      { method: 'POST' },
      res,
      () => {},
    );
    expect(res.status.firstCall.args[0]).to.equal(400);
    expect(JSON.stringify(res.json.firstCall.args)).not.to.include(payload);
    expect(JSON.stringify(log.firstCall.args)).not.to.include(payload);
  });
});
