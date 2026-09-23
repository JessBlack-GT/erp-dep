const { expect } = require('chai');
const { selectedDatabase, validateQaEnvironment, classifyConnectionError } = require('../scripts/qa-environment.cjs');
describe('Real QA runner safety gates', () => {
  it('loads backend .env from an absolute path rather than the shell working directory', () => {
    const sinon = require('sinon');
    const dotenv = require('dotenv');
    const envModule = require.resolve('../src/config/environment');
    const cached = require.cache[envModule];
    const loader = sinon.stub(dotenv, 'config').returns({ parsed: {} });
    try {
      delete require.cache[envModule];
      require(envModule);
      expect(loader.calledOnceWithExactly({ path: require('path').resolve(__dirname, '../.env') })).to.equal(true);
    } finally { loader.restore(); require.cache[envModule] = cached; }
  });
  const local = { NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/erp_qa', M03_QA_DATABASE: 'erp_qa' };
  it('respects the URI database instead of silently replacing it', () => {
    expect(selectedDatabase(local)).to.equal('erp_qa');
    expect(validateQaEnvironment(local).ok).to.equal(true);
  });
  it('requires confirmation of an explicit database override', () => {
    expect(validateQaEnvironment({ ...local, MONGODB_DB_NAME: 'other' }).ok).to.equal(false);
  });
  it('refuses production and unconfirmed environments', () => {
    expect(validateQaEnvironment({ ...local, NODE_ENV: 'production' }).ok).to.equal(false);
    expect(validateQaEnvironment({ ...local, M03_QA_DATABASE: undefined }).ok).to.equal(false);
    expect(validateQaEnvironment({ ...local, MONGODB_URI: 'mongodb://127.0.0.1/production', M03_QA_DATABASE: 'production' }).ok).to.equal(false);
  });
  it('classifies errors without returning connection details', () => {
    expect(classifyConnectionError({ code: 'ENOTFOUND' })).to.equal('DNS');
    expect(classifyConnectionError({ code: 18 })).to.equal('AUTHENTICATION');
    expect(classifyConnectionError({ message: 'TLS certificate failure' })).to.equal('TLS');
    expect(classifyConnectionError({ name: 'MongooseServerSelectionError' })).to.equal('NETWORK_OR_IP_ALLOWLIST_UNCONFIRMED');
  });
  it('rejects an unparseable URI even with a confirmed database override', () => {
    expect(validateQaEnvironment({ ...local, MONGODB_URI: 'mongodb://', MONGODB_DB_NAME: 'erp_qa' })).to.deep.equal({ ok: false, reason: 'URI_INVALID' });
  });
});
