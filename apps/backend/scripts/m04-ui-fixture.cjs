// Local browser QA fixture. Credentials are written only under Git-ignored tmp/.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  cp = require('child_process'),
  mongoose = require('mongoose');
const root = path.resolve(__dirname, '../../..'),
  file = path.join(root, 'tmp/m04-ui-credentials.json');
const { validateQaEnvironment } = require('./qa-environment.cjs');
async function main() {
  const env = require('dotenv').parse(
      fs.readFileSync(path.join(__dirname, '../.env')),
    ),
    check = validateQaEnvironment(env);
  if (!check.ok) throw Error();
  cp.execFileSync(
    'git',
    ['check-ignore', '--quiet', 'tmp/m04-ui-credentials.json'],
    { cwd: root },
  );
  const command = process.argv[2];
  if (!['setup', 'verify', 'cleanup'].includes(command)) throw Error();
  const scope = crypto
    .createHash('sha256')
    .update(env.MONGODB_URI + check.dbName)
    .digest('hex');
  await mongoose.connect(env.MONGODB_URI, {
    dbName: check.dbName,
    serverSelectionTimeoutMS: 10000,
  });
  const User = require('../src/modules/users/users.model'),
    Supplier = require('../src/modules/suppliers/suppliers.model');
  if (command === 'setup') {
    const marker = 'QA_M04_UI_' + Date.now();
    const fixture = {
      marker,
      scope,
      email: marker.toLowerCase() + '@example.com',
      password: crypto.randomBytes(32).toString('hex'),
      userId: new mongoose.Types.ObjectId().toString(),
      ids: Array.from({ length: 21 }, () =>
        new mongoose.Types.ObjectId().toString(),
      ),
    };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(fixture), { flag: 'wx' });
    await User.create({
      _id: fixture.userId,
      email: fixture.email,
      password: fixture.password,
      firstName: marker,
      lastName: 'QA',
      role: 'admin',
    });
    await Supplier.insertMany(
      fixture.ids.map((_id, i) => ({
        _id,
        name: marker + ' seed ' + String(i + 1).padStart(2, '0'),
        country: 'CA',
        category: 'QA seed',
        createdBy: fixture.userId,
      })),
    );
    console.log('M04 UI fixtures created: 22');
  } else {
    const f = JSON.parse(fs.readFileSync(file));
    if (f.scope !== scope) throw Error();
    const ui = await Supplier.find({
      createdBy: f.userId,
      _id: { $nin: f.ids },
      name: { $regex: '^' + f.marker },
    }).lean();
    console.log(
      'M04 UI persistence: ' +
        JSON.stringify(
          ui.map((x) => ({
            edited: x.name === f.marker + ' EDITED',
            status: x.status,
            country: x.country,
            category: x.category,
          })),
        ),
    );
    if (command === 'cleanup') {
      const count = (
        await Supplier.deleteMany({
          _id: { $in: [...f.ids, ...ui.map((x) => x._id)] },
          createdBy: f.userId,
          name: { $regex: '^' + f.marker },
        })
      ).deletedCount;
      const users = (
        await User.deleteOne({ _id: f.userId, firstName: f.marker })
      ).deletedCount;
      console.log('M04 UI created: ' + (22 + ui.length));
      console.log('M04 UI cleaned: ' + (count + users));
      if (count + users !== 22 + ui.length) throw Error();
      fs.unlinkSync(file);
    }
  }
  await mongoose.disconnect();
}
main().catch(async () => {
  console.log('M04 UI fixture: FAILED');
  await mongoose.disconnect();
  process.exitCode = 1;
});
