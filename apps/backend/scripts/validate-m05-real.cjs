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
  warehouse: [1, 1, 1, 0],
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
    console.log('M05 PREFLIGHT: LOCAL_ENV_MISSING');
    process.exitCode = 2;
    return;
  }
  const env = require('dotenv').parse(fs.readFileSync(file)),
    check = validateQaEnvironment(env);
  if (!check.ok) {
    console.log('M05 PREFLIGHT: ' + check.reason);
    process.exitCode = 2;
    return;
  }
  Object.assign(process.env, env, {
    MONGODB_DB_NAME: check.dbName,
    RATE_LIMIT_MAX: '1000',
  });
  const User = require('../src/modules/users/users.model'),
    Product = require('../src/modules/products/products.model');
  const marker =
    'QA_M05_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const userIds = [],
    productIds = [],
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
    await Product.init();
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
      if (method === 'POST' && url === '/products' && response.status === 201) {
        productIds.push(new mongoose.Types.ObjectId(data.data._id));
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
      await http('create-product', 'POST', '/products', 201, token, {
        name: marker,
        sku: marker + '-P',
        barcode: marker + '-B',
        type: 'PRODUCT',
        price: '0.10',
        cost: '0',
        currency: 'usd',
        category: 'QA',
        unit: 'kg',
        trackInventory: true,
      })
    ).data;
    assert.equal(a.price, '0.1000');
    assert.equal(a.cost, '0.0000');
    assert.equal((await Product.findById(a._id)).price, '0.1000');
    const b = (
      await http('create-service', 'POST', '/products', 201, token, {
        name: marker + ' SERVICE',
        sku: marker + '-S',
        type: 'SERVICE',
        price: '120.1234',
        currency: 'USD',
        unit: 'hour',
        category: 'QA',
      })
    ).data;
    assert.equal(b.trackInventory, false);
    await http('list', 'GET', '/products?search=' + marker, 200, token);
    await http('detail-product', 'GET', '/products/' + a._id, 200, token);
    await http('detail-service', 'GET', '/products/' + b._id, 200, token);
    await http('update-product', 'PATCH', '/products/' + a._id, 200, token, {
      description: 'Edited product',
    });
    await http('update-service', 'PATCH', '/products/' + b._id, 200, token, {
      description: 'Edited service',
      cost: '10.0001',
    });
    for (const [label, q] of [
      ['name', marker],
      ['sku', a.sku],
      ['barcode', a.barcode],
    ]) {
      const r = await http(
        'search-' + label,
        'GET',
        '/products/search?q=' + encodeURIComponent(q),
        200,
        token,
      );
      assert(r.data.some((x) => x._id === a._id));
    }
    for (const type of ['PRODUCT', 'SERVICE']) {
      const r = await http(
        'filter-' + type,
        'GET',
        '/products?search=' +
          marker +
          '&type=' +
          type +
          '&category=QA&currency=USD&status=active',
        200,
        token,
      );
      assert.equal(r.data.length, 1);
      assert.equal(r.data[0].type, type);
    }
    const date = new Date();
    await Product.updateMany(
      { _id: { $in: [a._id, b._id] } },
      { $set: { createdAt: date } },
      { timestamps: false },
    );
    const page1 = await http(
        'page1',
        'GET',
        '/products?search=' + marker + '&limit=1&page=1',
        200,
        token,
      ),
      page2 = await http(
        'page2',
        'GET',
        '/products?search=' + marker + '&limit=1&page=2',
        200,
        token,
      );
    assert.equal(page1.pagination.total, 2);
    assert.notEqual(page1.data[0]._id, page2.data[0]._id);
    for (const status of ['inactive', 'active']) {
      await http(
        'status-' + status,
        'PATCH',
        '/products/' + a._id + '/status',
        200,
        token,
        { status },
      );
      assert.equal((await Product.findById(a._id)).status, status);
    }
    await http('duplicate-sku', 'POST', '/products', 409, token, {
      name: marker,
      sku: a.sku.toLowerCase(),
    });
    await http('duplicate-barcode', 'POST', '/products', 409, token, {
      name: marker,
      sku: marker + '-OTHER',
      barcode: a.barcode,
    });
    for (const [label, payload] of Object.entries({
      negativePrice: { price: '-1' },
      negativeCost: { cost: '-1' },
      precision: { price: '1.00001' },
      numericPrice: { price: 0.1 },
      type: { type: 'OTHER' },
      massAssignment: { createdBy: users.admin },
      stock: { stock: 1 },
      serviceBarcode: { type: 'SERVICE', barcode: '123' },
      serviceInventory: { type: 'SERVICE', trackInventory: true },
    }))
      await http('invalid-' + label, 'POST', '/products', 400, token, {
        name: marker,
        sku: marker + '-INVALID',
        ...payload,
      });
    await http(
      'type-change-blocked',
      'PATCH',
      '/products/' + a._id,
      400,
      token,
      { type: 'SERVICE' },
    );
    await http('type-change-clear', 'PATCH', '/products/' + a._id, 200, token, {
      type: 'SERVICE',
      barcode: '',
      trackInventory: false,
    });
    await http('type-change-back', 'PATCH', '/products/' + a._id, 200, token, {
      type: 'PRODUCT',
      barcode: a.barcode,
    });
    await http('invalid-query', 'GET', '/products?page=0', 400, token);
    await http('invalid-id', 'GET', '/products/bad', 400, token);
    await http(
      'missing-id',
      'GET',
      '/products/' + new mongoose.Types.ObjectId(),
      404,
      token,
    );
    await http('no-token', 'GET', '/products', 401);
    await http('invalid-token', 'GET', '/products', 401, 'invalid');
    await http('forbidden', 'GET', '/products', 403, tokens.user);
    const endpoints = [
      ['GET', '/products?search=' + marker, 0, 200],
      ['GET', '/products/search?q=' + marker, 0, 200],
      ['GET', '/products/' + a._id, 0, 200],
      ['POST', '/products', 1, 201],
      ['PATCH', '/products/' + a._id, 2, 200],
      ['PATCH', '/products/' + a._id + '/status', 2, 200],
      ['DELETE', '/products/' + a._id, 3, 200],
    ];
    for (const [role, grants] of Object.entries(matrix)) {
      await Product.updateOne({ _id: a._id }, { $set: { status: 'active' } });
      for (const [method, url, index, status] of endpoints) {
        const before = await Product.findById(a._id).lean();
        const body =
          method === 'POST'
            ? { name: marker + ' ' + role, sku: marker + '-ROLE-' + role }
            : method === 'PATCH'
              ? url.endsWith('/status')
                ? { status: 'inactive' }
                : { description: marker + ' ' + role }
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
          assert.deepEqual(await Product.findById(a._id).lean(), before);
        if (method === 'DELETE' && grants[index])
          assert.equal((await Product.findById(a._id)).status, 'deleted');
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
      '/products/' + a._id + '/status',
      400,
      tokens.purchasing,
      { status: 'deleted' },
      'rbac',
    );
    await http('soft-delete', 'DELETE', '/products/' + b._id, 200, token);
    assert.equal((await Product.findById(b._id)).status, 'deleted');
    await http('deleted-detail', 'GET', '/products/' + b._id, 404, token);
    const after = await http(
      'after-delete',
      'GET',
      '/products?search=' + marker,
      200,
      token,
    );
    assert(!after.data.some((x) => x._id === b._id));
    await http(
      'inactive-block',
      'PATCH',
      '/products/' + b._id + '/status',
      404,
      token,
      { status: 'active' },
    );
  } catch (e) {
    console.log('M05 failure category: ' + classifyConnectionError(e));
    process.exitCode = 1;
  } finally {
    if (connected)
      try {
        cleaned += (
          await Product.deleteMany({
            _id: { $in: productIds },
            name: { $regex: '^' + marker },
          })
        ).deletedCount;
        cleaned += (
          await User.deleteMany({ _id: { $in: userIds }, firstName: marker })
        ).deletedCount;
        assert.equal(created, cleaned);
      } catch (_) {
        console.log('M05 cleanup: FAILED');
        process.exitCode = 1;
      }
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    console.log(
      'M05_RESULT: ' +
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
  console.log('M05 configuration: FAILED');
  process.exitCode = 2;
});
