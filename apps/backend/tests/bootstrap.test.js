const { expect } = require('chai');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const sinon = require('sinon');
const mongoose = require('mongoose');
const app = require('../src/app');
const { config } = require('../src/config/environment');

describe('Global application bootstrap', () => {
  afterEach(() => sinon.restore());
  it('serves documented liveness without claiming MongoDB readiness', async () => {
    const live = await request(app).get('/api/v1/health').expect(200);
    expect(live.body).to.include({ success: true, status: 'healthy' });
    expect(mongoose.connection.readyState).to.equal(0);
    await request(app).get('/api/v1/ready').expect(503);
  });
  it('protects role scaffolding and returns explicit 501 after authentication', async () => {
    await request(app).get('/api/v1/roles').expect(401);
    const token = jwt.sign({ id: 'qa-bootstrap', role: 'user' }, config.jwtSecret);
    const result = await request(app).get('/api/v1/roles').set('Authorization', `Bearer ${token}`).expect(501);
    expect(result.body.code).to.equal('ROLES_NOT_IMPLEMENTED');
  });
  it('protects auth profile and logout endpoints', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app).post('/api/v1/auth/logout').expect(401);
  });
  it('mounts the real customer router in the global application', async () => {
    await request(app).get('/api/v1/customers').expect(401);
    const repo = require('../src/modules/customers/customers.repository');
    sinon.stub(repo, 'findAll').resolves([]);
    const token = jwt.sign({ id: 'qa-bootstrap', role: 'user', permissions: ['customers.read'] }, config.jwtSecret);
    const result = await request(app).get('/api/v1/customers').set('Authorization', `Bearer ${token}`).expect(200);
    expect(result.body).to.deep.equal({ success: true, data: [] });
  });
});
