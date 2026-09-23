// Explicit opt-in QA only: no production fallback, no secret output, cleanup by owned IDs.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const { validateQaEnvironment, classifyConnectionError } = require('./qa-environment.cjs');
const envPath = path.resolve(process.env.M03_ENV_FILE || path.join(__dirname, '../.env'));
async function main() {
  if (!fs.existsSync(envPath)) {
    console.log('MongoDB connection: FAILED');
    console.log('CONFIGURATION: LOCAL_ENV_MISSING; connection not attempted');
    process.exitCode = 2; return;
  }
  const env = require('dotenv').parse(fs.readFileSync(envPath));
  const check = validateQaEnvironment(env);
  if (!check.ok) {
    console.log('MongoDB connection: FAILED');
    console.log(`CONFIGURATION: ${check.reason}; connection not attempted`);
    process.exitCode = 2; return;
  }
  // Authorized development-only keys exist only in this process, never in tracked files.
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (!env[key] || /replace_with/.test(env[key])) {
      env[key] = crypto.randomBytes(48).toString('hex');
    }
  }
  Object.assign(process.env, env, { MONGODB_DB_NAME: check.dbName });
  const mongoose = require('mongoose');
  let server, Customer, User, connected = false;
  // Leave room for suffixes within documentNumber's 50-character schema limit.
  const marker = `QA_M03_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const email = `${marker.toLowerCase()}@example.com`;
  const password = crypto.randomBytes(32).toString('hex');
  const userId = new mongoose.Types.ObjectId();
  const ownedIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const results = [];
  try {
    const app = require('../src/app');
    await require('../src/config/database').connectDB();
    connected = true;
    Customer = require('../src/modules/customers/customers.model');
    User = require('../src/modules/users/users.model');
    await Customer.init();
    await User.create({ _id: userId, email, password, firstName: marker, lastName: 'QA', role: 'user', permissions: ['customers.read', 'customers.create', 'customers.update', 'customers.delete'] });
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    let token;
    async function http(label, method, endpoint, status, body, auth = token) {
      const headers = { 'Content-Type': 'application/json' };
      if (auth) headers.Authorization = `Bearer ${auth}`;
      const response = await fetch(base + endpoint, { method, headers, body: body ? JSON.stringify(body) : undefined });
      assert.equal(response.status, status, `${label}: HTTP unexpected`);
      const data = await response.json();
      assert.equal(data.success, status < 400);
      results.push({ operation: label, http: response.status, result: 'PASS' });
      console.log(`${label}: HTTP ${response.status} PASS`);
      return data.data;
    }
    token = (await http('LOGIN', 'POST', '/auth/login', 200, { email, password }, null)).accessToken;
    const created = [];
    for (let i = 0; i < 2; i++) {
      const item = await http(`CREATE_${i + 1}`, 'POST', '/customers', 201, { name: `${marker}_${i}`, email: `${i}_${email}`, documentNumber: `${marker}_${i}` });
      created.push(item);
      ownedIds[i] = new mongoose.Types.ObjectId(item._id);
      assert.equal((await Customer.findById(item._id)).name, `${marker}_${i}`);
    }
    const id = created[0]._id;
    assert.equal((await http('LIST', 'GET', `/customers?search=${marker}`, 200)).length, 2);
    assert.equal((await http('DETAIL', 'GET', `/customers/${id}`, 200)).email, created[0].email);
    await http('UPDATE', 'PATCH', `/customers/${id}`, 200, { name: `${marker}_edited` });
    assert.equal((await Customer.findById(id)).name, `${marker}_edited`);
    assert.equal((await http('READ_AFTER_UPDATE', 'GET', `/customers/${id}`, 200)).name, `${marker}_edited`);
    assert.equal((await http('SEARCH', 'GET', `/customers/search?q=${marker}`, 200)).length, 2);
    const page1 = await http('PAGE_1_LIMIT_1', 'GET', `/customers?search=${marker}&page=1&limit=1&sortBy=name&sortOrder=asc`, 200);
    const page2 = await http('PAGE_2_LIMIT_1', 'GET', `/customers?search=${marker}&page=2&limit=1&sortBy=name&sortOrder=asc`, 200);
    assert.notEqual(page1[0]._id, page2[0]._id);
    assert.equal((await http('PAGE_1_LIMIT_2', 'GET', `/customers?search=${marker}&page=1&limit=2`, 200)).length, 2);
    await http('STATUS', 'PATCH', `/customers/${id}/status`, 200, { status: 'inactive' });
    assert.equal((await Customer.findById(id)).status, 'inactive');
    assert.equal((await http('FILTER', 'GET', `/customers?search=${marker}&status=inactive`, 200)).length, 1);
    await http('INVALID_PAYLOAD', 'POST', '/customers', 400, { name: { invalid: true }, email: 'qa@example.com' });
    await http('MISSING_NAME', 'POST', '/customers', 400, { email: 'qa@example.com' });
    await http('INVALID_EMAIL', 'POST', '/customers', 400, { name: marker, email: 'invalid' });
    await http('MISSING_ID', 'GET', `/customers/${new mongoose.Types.ObjectId()}`, 404);
    await http('INVALID_ID', 'GET', '/customers/invalid-id', 400);
    await http('DUPLICATE', 'POST', '/customers', 409, { name: marker, email: created[0].email });
    await http('NO_TOKEN', 'GET', '/customers', 401, undefined, null);
    await http('INVALID_TOKEN', 'GET', '/customers', 401, undefined, 'invalid');
    const expired = require('jsonwebtoken').sign({ id: userId.toString() }, env.JWT_SECRET, { expiresIn: -1 });
    await http('EXPIRED_TOKEN', 'GET', '/customers', 401, undefined, expired);
    await http('SOFT_DELETE', 'DELETE', `/customers/${id}`, 200);
    assert.equal((await Customer.findById(id)).status, 'deleted');
    assert(!(await http('LIST_AFTER_DELETE', 'GET', `/customers?search=${marker}`, 200)).some(c => c._id === id));
  } catch (error) {
    if (!connected) console.log('MongoDB connection: FAILED');
    console.log(`QA failure category: ${classifyConnectionError(error)}`);
    process.exitCode = 1;
  } finally {
    try {
      if (connected && mongoose.connection.readyState === 1) {
        if (Customer) await Customer.deleteMany({ $or: [{ _id: { $in: ownedIds }, email: { $in: [`0_${email}`, `1_${email}`] } }, { email: { $in: [`0_${email}`, `1_${email}`] }, documentNumber: { $in: [`${marker}_0`, `${marker}_1`] } }] });
        if (User) await User.deleteOne({ _id: userId, email });
        console.log('QA cleanup: SUCCESS');
      }
    } catch (_) { console.log('QA cleanup: FAILED'); process.exitCode = 1; }
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    console.log(`QA HTTP checks passed: ${results.length}`);
  }
}
main().catch(() => { console.log('QA failure category: APPLICATION'); process.exitCode = 1; });
