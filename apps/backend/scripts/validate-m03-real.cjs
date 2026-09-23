// Explicit real-DB runner. Never loaded by the isolated Mocha suite.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const envPath = path.resolve(__dirname, '../.env');
async function main() {
  if (!fs.existsSync(envPath)) {
    console.error('BLOCKED: backend .env local ausente. No se abrió ninguna conexión.');
    process.exitCode = 2;
    return;
  }
  const local = require('dotenv').parse(fs.readFileSync(envPath));
  if (!['development', 'test'].includes(local.NODE_ENV) || !/^erp_m03_test(?:_[a-z0-9]+)*$/.test(local.MONGODB_DB_NAME || '')) {
    console.error('BLOCKED: se requiere entorno development/test y una base dedicada erp_m03_test.');
    process.exitCode = 2;
    return;
  }
  if (['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'].some(k => !local[k] || /replace_with|USER:PASSWORD|@HOST/.test(local[k]))) {
    console.error('BLOCKED: configuración local incompleta o ficticia.');
    process.exitCode = 2;
    return;
  }
  // Explicit .env values are authoritative; never inherit a production URI.
  Object.assign(process.env, local);
  const mongoose = require('mongoose');
  let server;
  const marker = `qa-m03-${require('crypto').randomUUID()}`;
  const email = `${marker}@example.com`;
  let ownedId;
  let Customer;
  try {
    const app = require('../src/app');
    const { connectDB } = require('../src/config/database');
    await connectDB();
    Customer = require('../src/modules/customers/customers.model');
    await Customer.init();
    console.log('MongoDB: conexión exitosa; entorno de pruebas M03.');
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const token = require('jsonwebtoken').sign({ id: new mongoose.Types.ObjectId().toString(), role: require('../src/shared/constants/appConstants').ROLES.ADMIN }, local.JWT_SECRET, { expiresIn: '5m' });
    const base = `http://127.0.0.1:${server.address().port}/api/v1/customers`;
    async function http(method, suffix, status, body) {
      const response = await fetch(base + suffix, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      assert.equal(response.status, status, `${method} status inesperado`);
      const result = await response.json();
      assert.equal(result.success, true);
      console.log(`${method} M03: HTTP ${status}`);
      return result.data;
    }
    const created = await http('POST', '', 201, { name: marker, email });
    ownedId = created._id;
    assert.equal(created.email, email);
    assert((await http('GET', `?search=${marker}`, 200)).some(c => c._id === ownedId));
    assert.equal((await http('GET', `/${ownedId}`, 200)).email, email);
    assert.equal((await http('PATCH', `/${ownedId}`, 200, { name: `${marker}-updated` })).name, `${marker}-updated`);
    assert((await http('GET', `/search?q=${marker}`, 200)).some(c => c._id === ownedId));
    assert.equal((await http('PATCH', `/${ownedId}/status`, 200, { status: 'inactive' })).status, 'inactive');
    await http('DELETE', `/${ownedId}`, 200);
    assert.equal((await Customer.findById(ownedId)).status, 'deleted');
    assert(!(await http('GET', `?search=${marker}`, 200)).some(c => c._id === ownedId));
  } catch (_) {
    console.error('FAIL: validación real M03 incompleta; no se muestran detalles potencialmente sensibles.');
    process.exitCode = 1;
  } finally {
    try {
      // Only this run's generated marker can be physically removed, even after a failed HTTP response.
      if (Customer && mongoose.connection.readyState === 1) await Customer.deleteMany({ email, ...(ownedId ? { _id: ownedId } : {}) });
    } catch (_) { console.error('FAIL: limpieza del registro de esta ejecución pendiente.'); process.exitCode = 1; }
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }
}
main().catch(() => { console.error('FAIL: no se pudo completar la validación.'); process.exitCode = 1; });
