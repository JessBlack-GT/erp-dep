const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  assert = require('assert/strict'),
  mongoose = require('mongoose');
const {
  validateQaEnvironment,
  classifyConnectionError,
} = require('./qa-environment.cjs');
const matrix = {
  superadmin: [1, 1, 1, 1],
  admin: [1, 1, 1, 1],
  manager: [1, 1, 1, 0],
  sales: [1, 0, 0, 0],
  purchasing: [1, 1, 1, 0],
  warehouse: [1, 0, 0, 0],
  finance: [1, 0, 0, 0],
  hr: [0, 0, 0, 0],
  auditor: [1, 0, 0, 0],
  user: [0, 0, 0, 0],
};
async function main() {
  const file = path.resolve(
    process.env.M03_ENV_FILE || path.join(__dirname, '../.env'),
  );
  if (!fs.existsSync(file)) {
    console.log('M04 PREFLIGHT: LOCAL_ENV_MISSING');
    process.exitCode = 2;
    return;
  }
  const env = require('dotenv').parse(fs.readFileSync(file)),
    check = validateQaEnvironment(env);
  if (!check.ok) {
    console.log('M04 PREFLIGHT: ' + check.reason);
    process.exitCode = 2;
    return;
  }
  Object.assign(process.env, env, {
    MONGODB_DB_NAME: check.dbName,
    RATE_LIMIT_MAX: '1000',
  });
  const User = require('../src/modules/users/users.model'),
    Supplier = require('../src/modules/suppliers/suppliers.model');
  const marker =
    'QA_M04_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const userIds = [],
    supplierIds = [],
    results = [];
  let server,
    connected = false,
    created = 0,
    cleaned = 0,
    step = 'CONNECT';
  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: check.dbName,
      serverSelectionTimeoutMS: 10000,
    });
    connected = true;
    await Supplier.init();
    server = await new Promise((resolve) => {
      const s = require('../src/app').listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
    async function http(
      label,
      method,
      url,
      status,
      token,
      body,
      group = 'api',
    ) {
      step = label;
      const response = await fetch(base + url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (
        method === 'POST' &&
        url === '/suppliers' &&
        response.status === 201
      ) {
        supplierIds.push(new mongoose.Types.ObjectId(data.data._id));
        created++;
      }
      assert.equal(response.status, status, label);
      assert.equal(data.success, status < 400);
      results.push({ group, operation: label, http: status, result: 'PASS' });
      return data;
    }
    const tokens = {},
      users = {};
    for (const role of Object.keys(matrix)) {
      const id = new mongoose.Types.ObjectId(),
        password = crypto.randomBytes(32).toString('hex'),
        email = marker.toLowerCase() + '_' + role + '@example.com';
      userIds.push(id);
      users[role] = id;
      await User.create({
        _id: id,
        email,
        password,
        role,
        firstName: marker,
        lastName: 'QA',
      });
      created++;
      tokens[role] = (
        await http(
          'login:' + role,
          'POST',
          '/auth/login',
          200,
          null,
          { email, password },
          'rbac',
        )
      ).data.accessToken;
    }
    const token = tokens.admin;
    const a = (
      await http('create', 'POST', '/suppliers', 201, token, {
        name: marker,
        email: marker.toLowerCase() + '@example.com',
        taxId: marker.replace(/_/g, ''),
        taxType: 'VAT',
        taxCountry: 'GB',
        country: 'CA',
        category: 'QA Metal',
      })
    ).data;
    const b = (
      await http('create-basic', 'POST', '/suppliers', 201, token, {
        name: marker + ' second',
      })
    ).data;
    assert.equal((await Supplier.findById(a._id)).name, marker);
    const list = await http(
      'list',
      'GET',
      '/suppliers?search=' + marker,
      200,
      token,
    );
    assert.equal(list.pagination.total, 2);
    await http('detail', 'GET', '/suppliers/' + a._id, 200, token);
    await http('update', 'PATCH', '/suppliers/' + a._id, 200, token, {
      tradeName: marker + ' edited',
      paymentTerms: 'Net 30',
      currency: 'CAD',
    });
    assert.equal(
      (await Supplier.findById(a._id)).tradeName,
      marker + ' edited',
    );
    assert.equal(
      (await http('search', 'GET', '/suppliers/search?q=' + marker, 200, token))
        .data.length,
      2,
    );
    assert.equal(
      (
        await http(
          'filters',
          'GET',
          '/suppliers?search=' +
            marker +
            '&category=QA%20Metal&country=CA&type=legal&status=active',
          200,
          token,
        )
      ).data.length,
      1,
    );
    await Supplier.collection.updateMany(
      {
        _id: {
          $in: [
            new mongoose.Types.ObjectId(a._id),
            new mongoose.Types.ObjectId(b._id),
          ],
        },
      },
      { $set: { createdAt: new Date('2026-01-01') } },
    );
    const p1 = await http(
        'page1',
        'GET',
        '/suppliers?search=' + marker + '&page=1&limit=1',
        200,
        token,
      ),
      p2 = await http(
        'page2',
        'GET',
        '/suppliers?search=' + marker + '&page=2&limit=1',
        200,
        token,
      );
    assert.notEqual(p1.data[0]._id, p2.data[0]._id);
    await http(
      'status',
      'PATCH',
      '/suppliers/' + a._id + '/status',
      200,
      token,
      { status: 'inactive' },
    );
    assert.equal((await Supplier.findById(a._id)).status, 'inactive');
    await http('duplicate-email', 'POST', '/suppliers', 409, token, {
      name: 'Duplicate',
      email: a.email.toUpperCase(),
    });
    await http('duplicate-fiscal', 'POST', '/suppliers', 409, token, {
      name: 'Duplicate',
      taxId: marker.replace(/_/g, ''),
      taxType: 'VAT',
      taxCountry: 'GB',
    });
    const otherCountry = (
      await http('different-fiscal-country', 'POST', '/suppliers', 201, token, {
        name: marker,
        taxId: marker.replace(/_/g, ''),
        taxType: 'VAT',
        taxCountry: 'CA',
      })
    ).data;
    for (const [label, body] of [
      ['invalid-name', { name: '' }],
      ['invalid-email', { name: marker, email: 'bad' }],
      ['mass-assignment', { name: marker, createdBy: a._id }],
      ['status-bypass', { status: 'deleted' }],
    ])
      await http(label, 'PATCH', '/suppliers/' + a._id, 400, token, body);
    await http('invalid-query', 'GET', '/suppliers?search[$ne]=x', 400, token);
    await http('invalid-id', 'GET', '/suppliers/invalid', 400, token);
    await http(
      'missing-id',
      'GET',
      '/suppliers/' + new mongoose.Types.ObjectId(),
      404,
      token,
    );
    await http('no-token', 'GET', '/suppliers', 401);
    await http('invalid-token', 'GET', '/suppliers', 401, 'invalid');
    await http('forbidden', 'GET', '/suppliers', 403, tokens.user);
    const endpoints = [
      ['GET', '/suppliers?search=' + marker, 0, 200],
      ['GET', '/suppliers/search?q=' + marker, 0, 200],
      ['GET', '/suppliers/' + a._id, 0, 200],
      ['POST', '/suppliers', 1, 201],
      ['PATCH', '/suppliers/' + a._id, 2, 200],
      ['PATCH', '/suppliers/' + a._id + '/status', 2, 200],
      ['DELETE', '/suppliers/' + a._id, 3, 200],
    ];
    for (const [role, grants] of Object.entries(matrix)) {
      await Supplier.updateOne({ _id: a._id }, { $set: { status: 'active' } });
      for (const [method, url, index, status] of endpoints) {
        const before = await Supplier.findById(a._id).lean();
        const body =
          method === 'POST'
            ? { name: marker + ' ' + role }
            : method === 'PATCH'
              ? url.endsWith('/status')
                ? { status: 'inactive' }
                : { tradeName: marker + ' ' + role }
              : undefined;
        await http(
          role + ':' + method + url.split('?')[0],
          method,
          url,
          grants[index] ? status : 403,
          tokens[role],
          body,
          'rbac',
        );
        if (!grants[index])
          assert.deepEqual(await Supplier.findById(a._id).lean(), before);
        if (method === 'DELETE' && grants[index])
          assert.equal((await Supplier.findById(a._id)).status, 'deleted');
      }
    }
    await http(
      'self-elevation',
      'PATCH',
      '/users/' + users.user,
      403,
      tokens.user,
      { role: 'superadmin' },
      'rbac',
    );
    await http(
      'purchasing-delete-via-status',
      'PATCH',
      '/suppliers/' + a._id + '/status',
      400,
      tokens.purchasing,
      { status: 'deleted' },
      'rbac',
    );
    await http('soft-delete', 'DELETE', '/suppliers/' + b._id, 200, token);
    assert.equal((await Supplier.findById(b._id)).status, 'deleted');
    await http('deleted-detail', 'GET', '/suppliers/' + b._id, 404, token);
    const after = await http(
      'after-delete',
      'GET',
      '/suppliers?search=' + marker,
      200,
      token,
    );
    assert(!after.data.some((x) => x._id === b._id));
    await http(
      'inactive-block',
      'PATCH',
      '/suppliers/' + b._id + '/status',
      404,
      token,
      { status: 'active' },
    );
  } catch (e) {
    console.log('M04 failure category: ' + classifyConnectionError(e));
    process.exitCode = 1;
  } finally {
    if (connected)
      try {
        cleaned += (
          await Supplier.deleteMany({
            _id: { $in: supplierIds },
            name: { $regex: '^' + marker },
          })
        ).deletedCount;
        cleaned += (
          await User.deleteMany({ _id: { $in: userIds }, firstName: marker })
        ).deletedCount;
        assert.equal(created, cleaned);
      } catch (_) {
        console.log('M04 cleanup: FAILED');
        process.exitCode = 1;
      }
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    console.log(
      'M04_RESULT: ' +
        JSON.stringify({
          connection: connected ? 'SUCCESS' : 'FAILED',
          checks: results,
          created,
          cleaned,
          failedStep: process.exitCode ? step : null,
          success: !process.exitCode,
        }),
    );
  }
}
main().catch(() => {
  console.log('M04 configuration: FAILED');
  process.exitCode = 2;
});
