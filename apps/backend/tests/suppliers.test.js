const { expect } = require('chai'),
  sinon = require('sinon'),
  request = require('supertest'),
  jwt = require('jsonwebtoken');
const app = require('../src/app'),
  repo = require('../src/modules/suppliers/suppliers.repository');
const User = require('../src/modules/users/users.model'),
  Role = require('../src/modules/roles/roles.model');
const id = '507f1f77bcf86cd799439011',
  item = { _id: id, name: 'QA Supplier', status: 'active', type: 'legal' };
const token = jwt.sign({ id, role: 'superadmin' }, process.env.JWT_SECRET);
const call = (method, path = '') =>
  request(app)
    [method]('/api/v1/suppliers' + path)
    .set('Authorization', 'Bearer ' + token);
describe('M04 functional HTTP with stubbed persistence', () => {
  beforeEach(() => {
    sinon
      .stub(User, 'findById')
      .returns({
        select: () => ({
          lean: async () => ({ _id: id, role: 'admin', status: 'active' }),
        }),
      });
    sinon.stub(Role, 'findOne').returns({ lean: async () => null });
    sinon.stub(repo, 'get').resolves(item);
    sinon.stub(repo, 'list').resolves({ rows: [item], total: 1 });
    sinon.stub(repo, 'email').resolves(null);
    sinon.stub(repo, 'fiscal').resolves(null);
    sinon
      .stub(repo, 'create')
      .callsFake(async (data) => ({ _id: id, ...data }));
    sinon
      .stub(repo, 'update')
      .callsFake(async (id, set) => ({ ...item, ...set }));
  });
  afterEach(() => sinon.restore());
  it('creates a basic supplier with only name and trusted audit fields', async () => {
    const r = await call('post').send({ name: '  Basic  ' }).expect(201);
    expect(r.body.data.name).to.equal('Basic');
    expect(repo.create.firstCall.args[0].createdBy).to.equal(id);
  });
  it('normalizes optional fields and omits blank unique values', async () => {
    await call('post')
      .send({
        name: 'QA',
        email: '',
        taxId: '',
        country: 'ca',
        currency: 'cad',
      })
      .expect(201);
    expect(repo.create.firstCall.args[0]).to.include({
      country: 'CA',
      currency: 'CAD',
    });
    expect(repo.create.firstCall.args[0]).not.to.have.property('email');
  });
  for (const [label, payload] of Object.entries({
    missing: {},
    blank: { name: ' ' },
    object: { name: {} },
    long: { name: 'x'.repeat(256) },
    email: { name: 'QA', email: 'bad' },
    phone: { name: 'QA', phone: 'x12' },
    url: { name: 'QA', website: 'javascript:alert(1)' },
    urlCredentials: {
      name: 'QA',
      website: 'https://USER:PASSWORD@example.com',
    },
    country: { name: 'QA', country: 'Mexico' },
    currency: { name: 'QA', currency: '1ab' },
    type: { name: 'QA', type: 'other' },
    fiscalContext: { name: 'QA', taxId: '123' },
    fiscalInjection: { name: 'QA', taxId: '$x' },
    massAssignment: { name: 'QA', createdBy: id },
    roleInjection: { name: 'QA', role: 'admin' },
    deleted: { name: 'QA', status: 'deleted' },
    operator: { name: 'QA', $set: { status: 'deleted' } },
  }))
    it('rejects ' + label, async () => {
      await call('post').send(payload).expect(400);
      expect(repo.create.called).to.equal(false);
    });
  it('lists paginated filtered suppliers', async () => {
    const r = await call(
      'get',
      '?page=2&limit=5&country=ca&category=Metal&type=legal&status=inactive&sortBy=name&sortOrder=asc',
    ).expect(200);
    expect(r.body.pagination).to.deep.equal({
      page: 2,
      limit: 5,
      total: 1,
      pages: 1,
    });
    expect(repo.list.firstCall.args[0]).to.include({
      page: 2,
      limit: 5,
      sortBy: 'name',
    });
    expect(repo.list.firstCall.args[0].filters).to.deep.equal({
      country: 'CA',
      category: 'Metal',
      type: 'legal',
      status: 'inactive',
    });
  });
  it('queries detail and searches relevant fields', async () => {
    await call('get', '/' + id).expect(200);
    await call('get', '/search?q=Metal').expect(200);
    expect(repo.list.firstCall.args[0].search).to.equal('Metal');
  });
  for (const query of [
    'page=0',
    'page=1.5',
    'limit=101',
    'sortBy=password',
    'sortOrder=other',
    'status=deleted',
    'type=bad',
    'country=AAA',
    'search[$ne]=x',
    'unknown=x',
    'category[$gt]=x',
  ])
    it('rejects query ' + query, async () => {
      await call('get', '?' + query).expect(400);
      expect(repo.list.called).to.equal(false);
    });
  it('rejects invalid ID and returns 404 for absent ID', async () => {
    await call('get', '/invalid').expect(400);
    repo.get.resolves(null);
    await call('get', '/' + id).expect(404);
  });
  it('updates and clears optional unique fields with unset', async () => {
    await call('patch', '/' + id)
      .send({ name: 'Changed', email: '' })
      .expect(200);
    expect(repo.update.firstCall.args[1]).to.include({
      name: 'Changed',
      updatedBy: id,
    });
    expect(repo.update.firstCall.args[2]).to.deep.equal({ email: 1 });
  });
  it('validates merged fiscal identity on partial updates', async () => {
    repo.get.resolves({
      ...item,
      taxId: '123',
      taxType: 'VAT',
      taxCountry: 'GB',
    });
    await call('patch', '/' + id)
      .send({ taxCountry: '' })
      .expect(400);
    expect(repo.update.called).to.equal(false);
  });
  it('activates/deactivates but forbids deletion through status', async () => {
    await call('patch', '/' + id + '/status')
      .send({ status: 'inactive' })
      .expect(200);
    await call('patch', '/' + id + '/status')
      .send({ status: 'deleted' })
      .expect(400);
    await call('patch', '/' + id + '/status')
      .send({ status: 'active', role: 'admin' })
      .expect(400);
  });
  it('soft deletes through status update only', async () => {
    await call('delete', '/' + id).expect(200);
    expect(repo.update.firstCall.args[1]).to.deep.equal({
      status: 'deleted',
      updatedBy: id,
    });
  });
  it('rejects duplicate emails case insensitively', async () => {
    repo.email.resolves({ _id: '507f1f77bcf86cd799439012' });
    await call('post')
      .send({ name: 'QA', email: 'QA@EXAMPLE.COM' })
      .expect(409);
    expect(repo.email.calledWith('qa@example.com')).to.equal(true);
  });
  it('rejects duplicate fiscal identities and checks updates', async () => {
    repo.fiscal.resolves({ _id: '507f1f77bcf86cd799439012' });
    await call('post')
      .send({ name: 'QA', taxId: '123', taxCountry: 'gb', taxType: 'vat' })
      .expect(409);
    await call('patch', '/' + id)
      .send({ taxId: '123', taxCountry: 'GB', taxType: 'VAT' })
      .expect(409);
  });
  it('permits unchanged own email', async () => {
    repo.email.resolves(item);
    await call('patch', '/' + id)
      .send({ email: 'qa@example.com' })
      .expect(200);
  });
  it('maps unique index races to 409', async () => {
    repo.create.rejects({ code: 11000 });
    await call('post').send({ name: 'QA' }).expect(409);
  });
  it('sanitizes unexpected persistence errors even in development', async () => {
    repo.list.rejects(new Error('PRIVATE_DB_DETAIL'));
    const r = await call('get').expect(500);
    expect(r.body).to.deep.equal({
      success: false,
      error: 'Error interno del servidor',
    });
  });
  it('handles update races as 404', async () => {
    repo.update.resolves(null);
    await call('patch', '/' + id)
      .send({ name: 'Changed' })
      .expect(404);
  });
});

describe('M04 repository query semantics', () => {
  afterEach(() => sinon.restore());
  it('escapes regex metacharacters and adds a stable ID tie breaker', async () => {
    const Model = require('../src/modules/suppliers/suppliers.model');
    const chain = {
      sort: sinon.stub().returnsThis(),
      skip: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis(),
      lean: sinon.stub().resolves([]),
    };
    const find = sinon.stub(Model, 'find').returns(chain);
    sinon.stub(Model, 'countDocuments').resolves(0);
    await repo.list({
      filters: { status: { $ne: 'deleted' } },
      page: 2,
      limit: 20,
      search: '.*',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    expect(find.firstCall.args[0].$or[0].name.$regex).to.equal('\\.\\*');
    expect(chain.sort.firstCall.args[0]).to.deep.equal({
      name: 'asc',
      _id: 'asc',
    });
    expect(chain.skip.calledWith(20)).to.equal(true);
  });
});
