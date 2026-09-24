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
  superadmin: [1, 1, 1, 1, 1, 1],
  admin: [1, 1, 1, 1, 1, 1],
  manager: [1, 1, 1, 1, 1, 1],
  sales: [1, 0, 0, 0, 0, 0],
  purchasing: [1, 1, 0, 0, 0, 0],
  warehouse: [1, 1, 1, 1, 1, 1],
  finance: [1, 0, 0, 0, 0, 0],
  hr: [0, 0, 0, 0, 0, 0],
  auditor: [1, 0, 0, 0, 0, 0],
  user: [0, 0, 0, 0, 0, 0],
};
async function main() {
  const env = require('dotenv').parse(
      fs.readFileSync(path.join(__dirname, '../.env')),
    ),
    check = validateQaEnvironment(env);
  if (!check.ok) {
    console.log('M06 PREFLIGHT: ' + check.reason);
    process.exitCode = 2;
    return;
  }
  Object.assign(process.env, env, {
    MONGODB_DB_NAME: check.dbName,
    RATE_LIMIT_MAX: '2000',
  });
  const User = require('../src/modules/users/users.model'),
    Product = require('../src/modules/products/products.model');
  const {
    Warehouse,
    InventoryBalance: Balance,
    InventoryMovement: Movement,
  } = require('../src/modules/inventory/inventory.model');
  const repo = require('../src/modules/inventory/inventory.repository');
  const marker =
      'QA_M06_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
    userIds = [],
    productIds = [],
    warehouseIds = [];
  const report = {
    environment: 'authorized-exclusive-QA',
    connection: false,
    checks: [],
    concurrency: [],
    reconciliation: [],
    created: {
      products: 0,
      warehouses: 0,
      movements: 0,
      balances: 0,
      users: 0,
    },
    cleaned: {
      products: 0,
      warehouses: 0,
      movements: 0,
      balances: 0,
      users: 0,
    },
    success: false,
  };
  let server,
    step = 'connect',
    connected = false;
  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: check.dbName,
      serverSelectionTimeoutMS: 10000,
    });
    connected = true;
    report.connection = true;
    for (const Model of [Product, Warehouse, Balance, Movement])
      await Model.init();
    server = await new Promise((resolve) => {
      const s = require('../src/app').listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
    async function http(
      label,
      method,
      url,
      expected,
      token,
      body,
      group = 'api',
    ) {
      step = label;
      const r = await fetch(base + url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json();
      assert.ok(
        [].concat(expected).includes(r.status),
        label + ': HTTP ' + r.status,
      );
      assert.equal(data.success, r.status < 400);
      report.checks.push({
        group,
        operation: label,
        http: r.status,
        result: 'PASS',
      });
      return { status: r.status, ...data };
    }
    const tokens = {},
      users = {};
    for (const role of Object.keys(matrix)) {
      const _id = new mongoose.Types.ObjectId(),
        email = marker.toLowerCase() + '_' + role + '@example.com',
        password = crypto.randomBytes(32).toString('hex');
      userIds.push(_id);
      users[role] = String(_id);
      await User.create({
        _id,
        email,
        password,
        role,
        firstName: marker,
        lastName: 'QA',
      });
      report.created.users++;
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
    const token = tokens.admin,
      products = {};
    for (const name of [
      'normal',
      'service',
      'untracked',
      'inactive',
      'raceExit',
      'raceTransfer',
      'raceRetry',
    ]) {
      const _id = new mongoose.Types.ObjectId();
      productIds.push(_id);
      products[name] = await Product.create({
        _id,
        name: marker + '_' + name,
        sku: marker + '_' + name.toUpperCase(),
        type: name === 'service' ? 'SERVICE' : 'PRODUCT',
        trackInventory: !['service', 'untracked'].includes(name),
        status: name === 'inactive' ? 'inactive' : 'active',
        createdBy: users.admin,
        unit: 'kg',
      });
      report.created.products++;
    }
    const warehouses = [];
    for (const name of ['A', 'B']) {
      const row = (
        await http(
          'warehouse ' + name,
          'POST',
          '/inventory/warehouses',
          201,
          token,
          {
            name: marker + '_' + name,
            code: marker + '_' + name,
            location: 'QA',
          },
        )
      ).data;
      warehouseIds.push(new mongoose.Types.ObjectId(row._id));
      warehouses.push(row);
      report.created.warehouses++;
    }
    const [a, b] = warehouses;
    let key = 0;
    const movement = (type, quantity = '1', product = products.normal) => ({
      productId: String(product._id),
      type,
      quantity,
      reason: marker,
      reference: marker,
      idempotencyKey: marker + '_' + ++key,
      ...(['EXIT', 'TRANSFER'].includes(type) || quantity.startsWith('-')
        ? { sourceWarehouseId: a._id }
        : {}),
      ...(['ENTRY', 'TRANSFER'].includes(type) ||
      (type === 'ADJUSTMENT' && !quantity.startsWith('-'))
        ? { destinationWarehouseId: type === 'TRANSFER' ? b._id : a._id }
        : {}),
    });
    const post = (label, body, status = 201, t = token, group = 'api') =>
      http(label, 'POST', '/inventory/movements', status, t, body, group);
    await http(
      'stock initial',
      'GET',
      '/inventory/balances?productId=' + products.normal._id,
      200,
      token,
    );
    const entry = movement('ENTRY', '20.1');
    const applied = await post('entry', entry);
    assert.equal(applied.data.createdBy, users.admin);
    assert.equal(applied.data.quantity, '20.1000');
    await post('exit', movement('EXIT', '3.1'));
    await post('insufficient exit', movement('EXIT', '100'), 409);
    await post('transfer', movement('TRANSFER', '5'));
    await post('insufficient transfer', movement('TRANSFER', '100'), 409);
    await post('positive adjustment', movement('ADJUSTMENT', '0.2'));
    await post('negative adjustment', movement('ADJUSTMENT', '-0.1'));
    await post('idempotent replay', entry, 200);
    await post('idempotent mismatch', { ...entry, quantity: '21' }, 409);
    for (const name of ['service', 'untracked', 'inactive'])
      await post('reject ' + name, movement('ENTRY', '1', products[name]), 400);
    await post(
      'invalid product ID',
      { ...movement('ENTRY'), productId: 'bad' },
      400,
    );
    await post(
      'missing product',
      {
        ...movement('ENTRY'),
        productId: String(new mongoose.Types.ObjectId()),
      },
      404,
    );
    await post(
      'missing warehouse',
      {
        ...movement('ENTRY'),
        destinationWarehouseId: String(new mongoose.Types.ObjectId()),
      },
      404,
    );
    await post(
      'same warehouse',
      { ...movement('TRANSFER'), destinationWarehouseId: a._id },
      400,
    );
    for (const quantity of ['0', '-1', '1.00001', 'NaN', 'Infinity', 1])
      await post(
        'invalid quantity ' + String(quantity),
        { ...movement('ENTRY'), quantity },
        400,
      );
    for (const field of ['createdBy', 'quantityUnits', 'role', 'requestHash'])
      await post(
        'mass assignment ' + field,
        { ...movement('ENTRY'), [field]: users.superadmin },
        400,
      );
    await http(
      'warehouse inactive',
      'PATCH',
      '/inventory/warehouses/' + b._id,
      200,
      token,
      { status: 'inactive' },
    );
    await post(
      'inactive warehouse',
      { ...movement('ENTRY'), destinationWarehouseId: b._id },
      400,
    );
    await http(
      'warehouse reactivate',
      'PATCH',
      '/inventory/warehouses/' + b._id,
      200,
      token,
      { status: 'active' },
    );
    await http(
      'duplicate warehouse',
      'POST',
      '/inventory/warehouses',
      409,
      token,
      { name: marker, code: a.code },
    );
    const eligible = await http(
      'eligible products',
      'GET',
      '/inventory/products?search=' + marker,
      200,
      token,
    );
    assert.equal(eligible.data.length, 4);
    assert.ok(
      eligible.data.every(
        (p) =>
          p.type === 'PRODUCT' && p.trackInventory && p.status === 'active',
      ),
    );
    for (const route of [
      '/warehouses?search=' + marker,
      '/balances/product/' + products.normal._id,
      '/balances?productId=' + products.normal._id + '&warehouseId=' + a._id,
      '/movements?productId=' +
        products.normal._id +
        '&warehouseId=' +
        a._id +
        '&type=ENTRY&from=2020-01-01T00:00:00Z&to=2099-01-01T00:00:00Z',
      '/movements?search=' + marker + '&page=2&limit=2',
    ])
      await http(
        'read ' + route.split('?')[0],
        'GET',
        '/inventory' + route,
        200,
        token,
      );
    const page = await http(
      'history page',
      'GET',
      '/inventory/movements?productId=' + products.normal._id + '&limit=2',
      200,
      token,
    );
    assert.equal(page.data.length, 2);
    assert.equal(page.pagination.total, 5);
    await http(
      'invalid pagination',
      'GET',
      '/inventory/movements?limit=0',
      400,
      token,
    );
    await http('no token', 'GET', '/inventory/balances', 401);
    await http('invalid token', 'GET', '/inventory/balances', 401, 'invalid');
    for (const route of [
      '/movements/' + applied.data._id,
      '/balances/' + products.normal._id,
    ])
      for (const method of ['PATCH', 'PUT', 'DELETE'])
        await http(
          'immutable ' + method + route.split('/')[1],
          method,
          '/inventory' + route,
          404,
          token,
          { quantity: '500' },
        );
    // Fault after balance updates must roll back both transfer legs and the ledger.
    const before = await Balance.find({ productId: products.normal._id })
        .sort({ warehouseId: 1 })
        .lean(),
      beforeCount = await Movement.countDocuments({
        productId: products.normal._id,
      });
    const original = repo.append;
    repo.append = async () => {
      throw new Error('QA injected private failure');
    };
    try {
      const r = await post(
        'transaction rollback',
        movement('TRANSFER', '1'),
        500,
      );
      assert.equal(r.error, 'Error interno del servidor');
    } finally {
      repo.append = original;
    }
    assert.deepEqual(
      await Balance.find({ productId: products.normal._id })
        .sort({ warehouseId: 1 })
        .lean(),
      before,
    );
    assert.equal(
      await Movement.countDocuments({ productId: products.normal._id }),
      beforeCount,
    );
    for (const [name, type] of [
      ['raceExit', 'EXIT'],
      ['raceTransfer', 'TRANSFER'],
    ]) {
      await post(name + ' seed', movement('ENTRY', '10', products[name]));
      const requests = [
        movement(type, '8', products[name]),
        movement(type, '8', products[name]),
      ];
      const results = await Promise.all(
        requests.map((data, i) =>
          post(
            name + ' concurrent ' + i,
            data,
            [201, 409],
            token,
            'concurrency',
          ),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      const balance = await Balance.findOne({
        productId: products[name]._id,
        warehouseId: a._id,
      }).lean();
      assert.equal(balance.quantityUnits, 20000);
      assert.equal(
        await Movement.countDocuments({ productId: products[name]._id }),
        2,
      );
      const dest = await Balance.findOne({
        productId: products[name]._id,
        warehouseId: b._id,
      }).lean();
      if (type === 'TRANSFER') assert.equal(dest.quantityUnits, 80000);
      report.concurrency.push({
        scenario: name,
        initial: '10.0000',
        simultaneous: 2,
        quantity: '8.0000',
        http: results.map((r) => r.status),
        source: '2.0000',
        destination: dest ? '8.0000' : null,
        ledgerCount: 2,
        result: 'PASS',
      });
    }
    const retry = movement('ENTRY', '0.1', products.raceRetry);
    const retries = await Promise.all([
      post('concurrent retry A', retry, [200, 201], token, 'concurrency'),
      post('concurrent retry B', retry, [200, 201], token, 'concurrency'),
    ]);
    assert.deepEqual(retries.map((r) => r.status).sort(), [200, 201]);
    assert.equal(
      await Movement.countDocuments({ productId: products.raceRetry._id }),
      1,
    );
    report.concurrency.push({
      scenario: 'same idempotency key',
      simultaneous: 2,
      http: retries.map((r) => r.status),
      final: '0.1000',
      ledgerCount: 1,
      result: 'PASS',
    });
    for (const [role, grants] of Object.entries(matrix)) {
      await http(
        role + ' read',
        'GET',
        '/inventory/balances',
        grants[0] ? 200 : 403,
        tokens[role],
        undefined,
        'rbac',
      );
      for (const [i, type] of [
        'ENTRY',
        'EXIT',
        'TRANSFER',
        'ADJUSTMENT',
      ].entries()) {
        const snapshot = await Balance.find({ productId: products.normal._id })
          .sort({ warehouseId: 1 })
          .lean();
        await post(
          role + ' ' + type,
          movement(type, '0.0001'),
          grants[i + 1] ? 201 : 403,
          tokens[role],
          'rbac',
        );
        if (!grants[i + 1])
          assert.deepEqual(
            await Balance.find({ productId: products.normal._id })
              .sort({ warehouseId: 1 })
              .lean(),
            snapshot,
          );
      }
      await http(
        role + ' warehouse.manage',
        'PATCH',
        '/inventory/warehouses/' + b._id,
        grants[5] ? 200 : 403,
        tokens[role],
        { location: 'QA' },
        'rbac',
      );
    }
    // Ledger reconciliation includes every created product/warehouse pair, before cleanup.
    const movements = await Movement.find({
      productId: { $in: productIds },
      createdBy: { $in: userIds },
    }).lean();
    const balances = await Balance.find({
      productId: { $in: productIds },
      warehouseId: { $in: warehouseIds },
    }).lean();
    const expected = new Map();
    for (const m of movements)
      for (const [warehouse, sign] of [
        [m.sourceWarehouseId, -1],
        [m.destinationWarehouseId, 1],
      ])
        if (warehouse) {
          const identity = String(m.productId) + ':' + String(warehouse);
          const row = expected.get(identity) || {
            initial: 0,
            entries: 0,
            exits: 0,
            transfers: 0,
            adjustments: 0,
          };
          const field = {
            ENTRY: 'entries',
            EXIT: 'exits',
            TRANSFER: 'transfers',
            ADJUSTMENT: 'adjustments',
          }[m.type];
          row[field] += sign * Math.abs(m.quantityUnits);
          expected.set(identity, row);
        }
    for (const balance of balances) {
      const identity =
          String(balance.productId) + ':' + String(balance.warehouseId),
        row = expected.get(identity);
      assert.ok(row);
      const total = Object.values(row).reduce((a, b) => a + b, 0);
      assert.equal(balance.quantityUnits, total);
      assert.ok(total >= 0);
      report.reconciliation.push({
        ...row,
        expected: total,
        actual: balance.quantityUnits,
        unit: 'scaled-1/10000',
        result: 'PASS',
      });
      expected.delete(identity);
    }
    assert.equal(expected.size, 0);
    report.created.movements = movements.length;
    report.created.balances = balances.length;
    report.success = true;
  } catch (error) {
    report.failedStep = step;
    report.failure = connected
      ? 'ASSERTION_OR_APPLICATION'
      : classifyConnectionError(error);
    process.exitCode = 1;
  } finally {
    if (connected) {
      try {
        const movementFilter = {
            productId: { $in: productIds },
            createdBy: { $in: userIds },
            reason: marker,
          },
          balanceFilter = {
            productId: { $in: productIds },
            warehouseId: { $in: warehouseIds },
          };
        report.created.movements =
          await Movement.countDocuments(movementFilter);
        report.created.balances = await Balance.countDocuments(balanceFilter);
        // Raw collection deletion is restricted to this runner's IDs and marker; application model stays immutable.
        report.cleaned.movements = (
          await Movement.collection.deleteMany(movementFilter)
        ).deletedCount;
        report.cleaned.balances = (
          await Balance.deleteMany(balanceFilter)
        ).deletedCount;
        report.cleaned.warehouses = (
          await Warehouse.deleteMany({
            _id: { $in: warehouseIds },
            createdBy: { $in: userIds },
            name: { $regex: '^' + marker },
          })
        ).deletedCount;
        report.cleaned.products = (
          await Product.deleteMany({
            _id: { $in: productIds },
            createdBy: { $in: userIds },
            name: { $regex: '^' + marker },
          })
        ).deletedCount;
        report.cleaned.users = (
          await User.deleteMany({ _id: { $in: userIds }, firstName: marker })
        ).deletedCount;
        assert.deepEqual(report.cleaned, report.created);
      } catch (_) {
        report.cleanup = 'FAILED';
        report.success = false;
        process.exitCode = 1;
      }
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    const out = path.resolve(__dirname, '../../../tmp/m06-real-results.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(
      'M06_RESULT: ' +
        JSON.stringify({
          connection: report.connection,
          checks: report.checks.length,
          concurrency: report.concurrency,
          created: report.created,
          cleaned: report.cleaned,
          failedStep: report.failedStep,
          failure: report.failure,
          success: report.success,
        }),
    );
  }
}
main().catch(async () => {
  console.log('M06_RESULT: PREFLIGHT_FAILED');
  await mongoose.disconnect();
  process.exitCode = 1;
});
