const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  cp = require('child_process'),
  assert = require('assert/strict'),
  mongoose = require('mongoose');
const root = path.resolve(__dirname, '../../..'),
  file = path.join(root, 'tmp/m06-ui-credentials.json'),
  output = path.join(root, 'tmp/m06-ui-results.json');
const { validateQaEnvironment } = require('./qa-environment.cjs');
async function main() {
  const env = require('dotenv').parse(
      fs.readFileSync(path.join(__dirname, '../.env')),
    ),
    check = validateQaEnvironment(env);
  if (!check.ok) throw Error('QA preflight');
  cp.execFileSync(
    'git',
    ['check-ignore', '--quiet', 'tmp/m06-ui-credentials.json'],
    { cwd: root },
  );
  const command = process.argv[2],
    scope = crypto
      .createHash('sha256')
      .update(env.MONGODB_URI + check.dbName)
      .digest('hex');
  if (
    ![
      'setup',
      'verify-entry',
      'verify-exit',
      'verify-transfer',
      'verify-adjustment',
      'cleanup',
    ].includes(command)
  )
    throw Error('command');
  await mongoose.connect(env.MONGODB_URI, {
    dbName: check.dbName,
    serverSelectionTimeoutMS: 10000,
  });
  const User = require('../src/modules/users/users.model'),
    Product = require('../src/modules/products/products.model');
  const {
    Warehouse,
    InventoryBalance: Balance,
    InventoryMovement: Movement,
  } = require('../src/modules/inventory/inventory.model');
  if (command === 'setup') {
    const marker = 'QA_M06_UI_' + Date.now(),
      oid = () => String(new mongoose.Types.ObjectId());
    const f = {
      marker,
      scope,
      email: marker.toLowerCase() + '@example.com',
      password: crypto.randomBytes(32).toString('hex'),
      userId: oid(),
      productId: oid(),
      warehouseA: oid(),
      warehouseB: oid(),
    };
    fs.writeFileSync(file, JSON.stringify(f), { flag: 'wx' });
    await User.create({
      _id: f.userId,
      email: f.email,
      password: f.password,
      firstName: marker,
      lastName: 'QA',
      role: 'admin',
    });
    await Product.create({
      _id: f.productId,
      name: marker + ' Product',
      sku: marker,
      type: 'PRODUCT',
      trackInventory: true,
      unit: 'kg',
      createdBy: f.userId,
    });
    await Warehouse.create([
      {
        _id: f.warehouseA,
        name: marker + ' North',
        code: marker + '_N',
        createdBy: f.userId,
        updatedBy: f.userId,
      },
      {
        _id: f.warehouseB,
        name: marker + ' South',
        code: marker + '_S',
        createdBy: f.userId,
        updatedBy: f.userId,
      },
    ]);
    fs.writeFileSync(
      output,
      JSON.stringify({
        mode: 'AUTOMATED',
        environment: 'authorized-exclusive-QA',
        stages: [],
        success: false,
      }),
    );
    console.log('M06 UI setup: 1 product, 2 warehouses, 1 user');
  } else {
    const f = JSON.parse(fs.readFileSync(file));
    assert.equal(f.scope, scope);
    const mf = {
      productId: new mongoose.Types.ObjectId(f.productId),
      createdBy: new mongoose.Types.ObjectId(f.userId),
    };
    const bf = {
      productId: f.productId,
      warehouseId: { $in: [f.warehouseA, f.warehouseB] },
    };
    const movements = await Movement.find(mf).sort({ createdAt: 1 }).lean(),
      balances = await Balance.find(bf).lean();
    const ledger = new Map([
      [f.warehouseA, 0],
      [f.warehouseB, 0],
    ]);
    for (const m of movements) {
      assert.equal(m.reason, f.marker);
      for (const [w, sign] of [
        [m.sourceWarehouseId, -1],
        [m.destinationWarehouseId, 1],
      ])
        if (w) {
          assert.ok(ledger.has(String(w)));
          ledger.set(
            String(w),
            ledger.get(String(w)) + sign * Math.abs(m.quantityUnits),
          );
        }
    }
    for (const b of balances)
      assert.equal(b.quantityUnits, ledger.get(String(b.warehouseId)));
    const report = JSON.parse(fs.readFileSync(output));
    if (command.startsWith('verify-')) {
      const expectations = {
        'verify-entry': [1, 100000, 0],
        'verify-exit': [2, 70000, 0],
        'verify-transfer': [3, 50000, 20000],
        'verify-adjustment': [4, 45000, 20000],
      };
      const [count, north, south] = expectations[command];
      assert.equal(movements.length, count);
      assert.equal(ledger.get(f.warehouseA), north);
      assert.equal(ledger.get(f.warehouseB), south);
      report.stages.push({
        stage: command,
        ledgerCount: count,
        northUnits: north,
        southUnits: south,
        reconciliation: 'PASS',
      });
      report.success = command === 'verify-adjustment';
      console.log(
        'M06 UI persistence: ' + JSON.stringify(report.stages.at(-1)),
      );
    } else {
      report.created = {
        products: 1,
        warehouses: 2,
        movements: movements.length,
        balances: balances.length,
        users: 1,
      };
      report.cleaned = {};
      report.cleaned.movements = (
        await Movement.collection.deleteMany({
          ...mf,
          reason: f.marker,
          _id: { $in: movements.map((m) => m._id) },
        })
      ).deletedCount;
      report.cleaned.balances = (
        await Balance.deleteMany({
          ...bf,
          _id: { $in: balances.map((b) => b._id) },
        })
      ).deletedCount;
      report.cleaned.warehouses = (
        await Warehouse.deleteMany({
          _id: { $in: [f.warehouseA, f.warehouseB] },
          createdBy: f.userId,
          name: { $regex: '^' + f.marker },
        })
      ).deletedCount;
      report.cleaned.products = (
        await Product.deleteOne({
          _id: f.productId,
          createdBy: f.userId,
          name: f.marker + ' Product',
        })
      ).deletedCount;
      report.cleaned.users = (
        await User.deleteOne({ _id: f.userId, firstName: f.marker })
      ).deletedCount;
      assert.deepEqual(report.created, report.cleaned);
      fs.unlinkSync(file);
      console.log(
        'M06 UI cleanup: ' +
          JSON.stringify({ created: report.created, cleaned: report.cleaned }),
      );
    }
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
  }
  await mongoose.disconnect();
}
main().catch(async () => {
  console.log('M06 UI fixture: FAILED');
  await mongoose.disconnect();
  process.exitCode = 1;
});
