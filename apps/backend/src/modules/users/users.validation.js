const { ValidationError } = require('../../shared/errors/appErrors');
const fail = () => {
  throw new ValidationError('Datos de usuario inválidos');
};
function object(data, keys) {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).some((k) => !keys.includes(k))
  )
    fail();
}
function password(value) {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value, 'utf8') > 72)
    throw new ValidationError(
      'La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes',
    );
  return value;
}
function payload(data, create = false) {
  object(
    data,
    create
      ? ['email', 'firstName', 'lastName', 'phone', 'password', 'role']
      : ['email', 'firstName', 'lastName', 'phone'],
  );
  const out = {};
  for (const key of ['email', 'firstName', 'lastName', 'phone']) {
    if (data[key] !== undefined) {
      if (
        typeof data[key] !== 'string' ||
        !data[key].trim() ||
        data[key].length > (key === 'email' ? 254 : 100)
      )
        fail();
      out[key] = data[key].trim();
    }
  }
  if (out.email) {
    out.email = out.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) fail();
  }
  if (create) {
    if (!out.email || !out.firstName || !out.lastName) fail();
    out.password = password(data.password);
    out.role = data.role ?? 'user';
    if (typeof out.role !== 'string' || !/^[a-z][a-z0-9_]{1,63}$/.test(out.role)) fail();
  } else if (!Object.keys(out).length) fail();
  return out;
}
function id(value) {
  if (!/^[a-f\d]{24}$/i.test(value || '')) fail();
  return value;
}
function query(q) {
  object(q, ['page', 'limit', 'search', 'role', 'status']);
  const number = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(String(value))) fail();
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 1 || n > max) fail();
    return n;
  };
  const result = {
    page: number(q.page, 1, 100000),
    limit: number(q.limit, 20, 100),
    filter: { status: { $ne: 'deleted' } },
  };
  if (q.status !== undefined) {
    if (!['active', 'inactive', 'deleted'].includes(q.status)) fail();
    result.filter.status = q.status;
  }
  if (q.role !== undefined) {
    if (typeof q.role !== 'string' || !/^[a-z][a-z0-9_]{1,63}$/.test(q.role)) fail();
    result.filter.role = q.role;
  }
  if (q.search !== undefined) {
    if (typeof q.search !== 'string' || q.search.length > 100) fail();
    const search = q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result.filter.$or = ['email', 'firstName', 'lastName'].map((k) => ({
      [k]: { $regex: search, $options: 'i' },
    }));
  }
  return result;
}
module.exports = { object, password, payload, id, query, fail };
