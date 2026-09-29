const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  assert = require('assert/strict'),
  mongoose = require('mongoose');
const { validateQaEnvironment, classifyConnectionError } = require('./qa-environment.cjs');
const root = path.resolve(__dirname, '../../..'),
  temporary = path.join(root, 'tmp');
async function main() {
  fs.mkdirSync(temporary, { recursive: true });
  const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env'))),
    guard = validateQaEnvironment(env);
  if (!guard.ok) {
    console.log('M01_PREFLIGHT: ' + guard.reason);
    process.exitCode = 2;
    return;
  }
  Object.assign(process.env, env, { MONGODB_DB_NAME: guard.dbName, RATE_LIMIT_MAX: '3000' });
  const User = require('../src/modules/users/users.model'),
    Role = require('../src/modules/roles/roles.model'),
    rbac = require('../src/security/rbac');
  const run = 'qa_m01_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const password = crypto.randomBytes(24).toString('base64url'),
    report = {
      environment: 'authorized-exclusive-QA',
      connection: false,
      checks: [],
      created: { users: 0, roles: 0 },
      cleaned: { users: 0, roles: 0 },
      success: false,
    };
  let server,
    step = 'connect',
    connected = false;
  const serving = process.argv.includes('--serve');
  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: guard.dbName,
      serverSelectionTimeoutMS: 10000,
    });
    connected = true;
    report.connection = true;
    // Never lock or modify another run's system Role documents.
    if (
      await Role.exists({
        name: { $in: [...Object.keys(rbac.ROLE_PERMISSIONS), 'super_admin', 'viewer'] },
      })
    )
      throw Error('QA_SYSTEM_ROLE_COLLISION');
    await Promise.all([User.init(), Role.init()]);
    server = await new Promise((resolve) => {
      const s = require('../src/app').listen(serving ? 3000 : 0, '127.0.0.1', () => resolve(s));
    });
    const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
    const http = async (label, method, url, expected, token, body) => {
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
      assert.equal(r.status, expected, label + ': unexpected HTTP ' + r.status);
      if (!url.startsWith('/auth/login') && !url.startsWith('/auth/refresh'))
        assert.ok(!JSON.stringify(data).includes(password), 'Password exposure');
      assert.ok(!JSON.stringify(data).includes('"password"'), 'Hash field exposure');
      report.checks.push({ label, status: r.status, pass: true });
      return data.data;
    };
    const seed = async (role, suffix) => {
      const user = new User({
        email: run + '_' + suffix + '@example.com',
        firstName: run,
        lastName: suffix,
        password,
        role,
        status: 'active',
      });
      await user.save();
      return user;
    };
    const owner = await seed('superadmin', 'owner'),
      administrator = await seed('admin', 'admin'),
      reader = await seed('user', 'reader');
    const login = async (user, p = password) =>
      http('login ' + user.role, 'POST', '/auth/login', 200, null, {
        email: user.email,
        password: p,
      });
    let ownerSession = await login(owner),
      adminSession = await login(administrator),
      readerSession = await login(reader);
    const a = adminSession.accessToken,
      o = ownerSession.accessToken;
    if (serving) {
      // Credentials exist only in an ignored local file and are never logged.
      fs.writeFileSync(
        path.join(temporary, 'm01-e2e-private.json'),
        JSON.stringify({
          run,
          password,
          email: administrator.email,
          readerEmail: reader.email,
          ownerId: String(owner._id),
          adminId: String(administrator._id),
          base,
        }),
      );
      console.log('M01_E2E_READY');
      await new Promise((resolve) => {
        const timer = setInterval(() => {
          if (fs.existsSync(path.join(temporary, 'm01-e2e-stop'))) {
            clearInterval(timer);
            resolve();
          }
        }, 500);
        process.once('SIGINT', () => {
          clearInterval(timer);
          resolve();
        });
      });
    } else {
      await http('anonymous', 'GET', '/users', 401);
      await http('invalid JWT', 'GET', '/users', 401, 'invalid');
      const expired = require('jsonwebtoken').sign(
        { id: String(administrator._id), sv: 0 },
        env.JWT_SECRET,
        { expiresIn: -1 },
      );
      await http('expired JWT', 'GET', '/users', 401, expired);
      await http('denied reader', 'GET', '/users', 403, readerSession.accessToken);
      await http('effective identity', 'GET', '/auth/me', 200, a);
      const available = await http('roles listing', 'GET', '/roles', 200, a);
      assert.equal(available.filter((r) => r.isSystem).length, 10);
      await http('registered permissions', 'GET', '/roles/permissions', 200, a);
      const roleName = run + '_custom';
      await http('create custom role', 'POST', '/roles', 201, a, {
        name: roleName,
        permissions: ['customers.read'],
        description: 'QA custom role',
      });
      await http('duplicate role', 'POST', '/roles', 409, a, { name: roleName, permissions: [] });
      await http('reject internal role fields', 'POST', '/roles', 400, a, {
        name: run + '_unsafe',
        permissions: [],
        isSystem: true,
      });
      await http('reject wildcard grant', 'POST', '/roles', 400, a, {
        name: run + '_unsafe',
        permissions: ['*'],
      });
      for (const name of Object.keys(rbac.ROLE_PERMISSIONS))
        await http('protect system ' + name, 'PATCH', '/roles/' + name, 403, o, {
          permissions: [],
        });
      const fields = {
        email: run + '_created@example.com',
        firstName: run,
        lastName: 'Created',
        password,
        role: roleName,
      };
      const created = await http('create user', 'POST', '/users', 201, a, fields),
        id = created._id;
      step = 'verify created role';
      assert.equal(created.role, roleName);
      step = 'verify actor metadata';
      assert.equal(created.createdBy, String(administrator._id));
      step = 'verify stored password';
      const saved = await User.findById(id).select('+password');
      assert.notEqual(saved.password, password);
      step = 'verify password comparison';
      assert.equal(await saved.comparePassword(password), true);
      await http('duplicate email', 'POST', '/users', 409, a, fields);
      for (const field of [
        '_id',
        'permissions',
        'sessionVersion',
        'createdBy',
        'updatedBy',
        'isSystem',
        '$set',
      ])
        await http('reject payload ' + field, 'PATCH', '/users/' + id, 400, a, {
          [field]: 'injected',
        });
      await http('invalid create', 'POST', '/users', 400, a, { ...fields, email: 'bad' });
      await http('invalid password', 'POST', '/users', 400, a, {
        ...fields,
        password: crypto.randomBytes(2).toString('hex'),
      });
      await http('invalid ID', 'GET', '/users/bad', 400, a);
      await http('missing user', 'GET', '/users/' + new mongoose.Types.ObjectId(), 404, a);
      const page1 = await http(
        'search filters page one',
        'GET',
        '/users?search=' + run + '&status=active&page=1&limit=2',
        200,
        a,
      );
      const page2 = await http(
        'search filters page two',
        'GET',
        '/users?search=' + run + '&status=active&page=2&limit=2',
        200,
        a,
      );
      assert.equal(page1.pagination.total, 4);
      assert.equal(page1.items.length, 2);
      assert.equal(page2.items.length, 2);
      assert.ok(page1.items.every((x) => !page2.items.some((y) => x._id === y._id)));
      const filtered = await http(
        'role filter',
        'GET',
        '/users?search=' + run + '&role=' + roleName,
        200,
        a,
      );
      assert.equal(filtered.pagination.total, 1);
      await http('invalid pagination', 'GET', '/users?limit=101', 400, a);
      await http('detail', 'GET', '/users/' + id, 200, a);
      const edited = await http('edit', 'PATCH', '/users/' + id, 200, a, { lastName: 'Edited' });
      assert.equal(edited.lastName, 'Edited');
      await http('self elevation', 'PATCH', '/users/' + administrator._id + '/role', 403, a, {
        role: 'superadmin',
      });
      await http('third party elevation', 'PATCH', '/users/' + id + '/role', 403, a, {
        role: 'superadmin',
      });
      await http('superadmin edit protection', 'PATCH', '/users/' + owner._id, 403, a, {
        email: run + '_hijack@example.com',
      });
      await http('last superadmin deactivate', 'PATCH', '/users/' + owner._id + '/status', 403, o, {
        status: 'inactive',
      });
      await http('last superadmin demote', 'PATCH', '/users/' + owner._id + '/role', 403, o, {
        role: 'user',
      });
      await http('last superadmin delete', 'DELETE', '/users/' + owner._id, 403, o);
      let session = await login({ ...created, email: fields.email });
      await http('custom role read M03', 'GET', '/customers', 200, session.accessToken);
      await http('custom role denied admin', 'GET', '/users', 403, session.accessToken);
      await http('revoke persisted permission', 'PATCH', '/roles/' + roleName, 200, a, {
        permissions: [],
      });
      await http('same token permission revoked', 'GET', '/customers', 403, session.accessToken);
      await http('grant persisted permission', 'PATCH', '/roles/' + roleName, 200, a, {
        permissions: ['customers.read'],
      });
      await http('same token current grant', 'GET', '/customers', 200, session.accessToken);
      await http('role deactivation', 'PATCH', '/roles/' + roleName, 200, a, {
        status: 'inactive',
      });
      await http('inactive role denied', 'GET', '/customers', 403, session.accessToken);
      await http('role activation', 'PATCH', '/roles/' + roleName, 200, a, { status: 'active' });
      await http('assign role', 'PATCH', '/users/' + id + '/role', 200, a, { role: 'sales' });
      await http('old token after role change', 'GET', '/auth/me', 401, session.accessToken);
      await http('old refresh after role change', 'POST', '/auth/refresh', 401, null, {
        refreshToken: session.refreshToken,
      });
      session = await login({ ...created, email: fields.email, role: 'sales' });
      await http('deactivate user', 'PATCH', '/users/' + id + '/status', 200, a, {
        status: 'inactive',
      });
      await http('inactive user access', 'GET', '/auth/me', 401, session.accessToken);
      await http('inactive user login', 'POST', '/auth/login', 401, null, {
        email: fields.email,
        password,
      });
      await http('activate user', 'PATCH', '/users/' + id + '/status', 200, a, {
        status: 'active',
      });
      session = await login({ ...created, email: fields.email, role: 'sales' });
      const refreshed = await http('refresh current session', 'POST', '/auth/refresh', 200, null, {
        refreshToken: session.refreshToken,
      });
      await http('restored identity', 'GET', '/auth/me', 200, refreshed.accessToken);
      await http('logout', 'POST', '/auth/logout', 200, session.accessToken);
      await http('token after logout', 'GET', '/customers', 401, refreshed.accessToken);
      await http('refresh after logout', 'POST', '/auth/refresh', 401, null, {
        refreshToken: session.refreshToken,
      });
      session = await login({ ...created, email: fields.email, role: 'sales' });
      await http('wrong current password', 'POST', '/auth/password', 401, session.accessToken, {
        currentPassword: crypto.randomBytes(20).toString('hex'),
        newPassword: password,
      });
      const nextPassword = crypto.randomBytes(24).toString('base64url');
      await http('password change', 'POST', '/auth/password', 200, session.accessToken, {
        currentPassword: password,
        newPassword: nextPassword,
      });
      await http('token after password change', 'GET', '/auth/me', 401, session.accessToken);
      await http('old password rejected', 'POST', '/auth/login', 401, null, {
        email: fields.email,
        password,
      });
      await login({ ...created, email: fields.email, role: 'sales' }, nextPassword);
      const limitedName = run + '_limited';
      await http('limited administrative role', 'POST', '/roles', 201, a, {
        name: limitedName,
        permissions: ['roles.manage', 'roles.read', 'users.assignRole', 'users.read'],
      });
      const limited = await http('limited administrator', 'POST', '/users', 201, a, {
        ...fields,
        email: run + '_limited@example.com',
        role: limitedName,
      });
      const limitedSession = await login({ ...limited, email: run + '_limited@example.com' });
      await http('grant beyond authority', 'POST', '/roles', 403, limitedSession.accessToken, {
        name: run + '_escalate',
        permissions: ['customers.delete'],
      });
      await http(
        'assign beyond authority',
        'PATCH',
        '/users/' + reader._id + '/role',
        403,
        limitedSession.accessToken,
        { role: 'admin' },
      );
      await http('soft delete', 'DELETE', '/users/' + id, 200, a);
      assert.equal((await User.findById(id)).status, 'deleted');
      await http('deleted user login', 'POST', '/auth/login', 401, null, {
        email: fields.email,
        password: nextPassword,
      });
      for (const url of ['/customers', '/suppliers', '/products', '/inventory/balances'])
        await http('M03-M06 smoke ' + url, 'GET', url, 200, a);
    }
    report.success = true;
  } catch (error) {
    report.failure = {
      step,
      category: step === 'connect' ? classifyConnectionError(error) : 'ASSERTION_OR_APPLICATION',
    };
    process.exitCode = 1;
  } finally {
    if (connected) {
      try {
        const users = await User.find({ email: { $regex: '^' + run + '_' } })
            .select('_id')
            .lean(),
          roles = await Role.find({ name: { $regex: '^' + run + '_' } })
            .select('_id')
            .lean();
        report.created = { users: users.length, roles: roles.length };
        for (const row of users) {
          const r = await User.deleteOne({ _id: row._id, email: { $regex: '^' + run + '_' } });
          report.cleaned.users += r.deletedCount;
        }
        for (const row of roles) {
          const r = await Role.deleteOne({ _id: row._id, name: { $regex: '^' + run + '_' } });
          report.cleaned.roles += r.deletedCount;
        }
        assert.deepEqual(report.created, report.cleaned);
      } catch (_) {
        report.success = false;
        report.cleanupFailure = true;
        process.exitCode = 1;
      }
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (serving)
      for (const file of ['m01-e2e-private.json', 'm01-e2e-stop']) {
        const p = path.join(temporary, file);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    fs.writeFileSync(
      path.join(temporary, serving ? 'm01-e2e-cleanup.json' : 'm01-real.json'),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        connection: report.connection,
        checks: report.checks.length,
        created: report.created,
        cleaned: report.cleaned,
        success: report.success,
        failure: report.failure,
      }),
    );
  }
}
main().catch(() => {
  console.log('M01_RUNNER_FAILED');
  process.exitCode = 1;
});
