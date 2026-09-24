const { ValidationError } = require('../../shared/errors/appErrors');
const MAX_UNITS = 1000000000000;
const TYPES = ['ENTRY', 'EXIT', 'TRANSFER', 'ADJUSTMENT'];
const fail = (message) => {
  throw new ValidationError(message);
};
function object(value, allowed) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !allowed.includes(k))
  )
    fail('Campos inválidos o protegidos');
}
function id(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))
    fail('Identificador inválido');
  return value.toLowerCase();
}
function text(value, max, required = false) {
  if (value === undefined && !required) return '';
  if (
    typeof value !== 'string' ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    fail('Texto inválido');
  return value.trim();
}
function units(value, signed = false) {
  if (
    typeof value !== 'string' ||
    !/^-?(0|[1-9]\d{0,8})(\.\d{1,4})?$/.test(value)
  )
    fail('Cantidad debe ser texto decimal con máximo cuatro decimales');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace('-', '').split('.');
  const result =
    Number(BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'))) *
    (negative ? -1 : 1);
  if (!result || Math.abs(result) > MAX_UNITS || (!signed && negative))
    fail('Cantidad fuera de rango');
  return result;
}
function decimal(value) {
  if (!Number.isSafeInteger(value)) throw new Error('Invalid stored quantity');
  const number = BigInt(value);
  const absolute = number < 0n ? -number : number;
  return `${number < 0n ? '-' : ''}${absolute / 10000n}.${String(absolute % 10000n).padStart(4, '0')}`;
}
function movement(data) {
  object(data, [
    'productId',
    'type',
    'quantity',
    'sourceWarehouseId',
    'destinationWarehouseId',
    'reason',
    'reference',
    'notes',
    'idempotencyKey',
  ]);
  if (!TYPES.includes(data.type)) fail('Tipo inválido');
  const result = {
    productId: id(data.productId),
    type: data.type,
    quantityUnits: units(data.quantity, data.type === 'ADJUSTMENT'),
    reason: text(data.reason, 500, true),
    reference: text(data.reference, 200),
    notes: text(data.notes, 2000),
    idempotencyKey: text(data.idempotencyKey, 100, true),
  };
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(result.idempotencyKey))
    fail('Clave de idempotencia inválida');
  const source =
    ['EXIT', 'TRANSFER'].includes(data.type) ||
    (data.type === 'ADJUSTMENT' && result.quantityUnits < 0);
  const destination =
    ['ENTRY', 'TRANSFER'].includes(data.type) ||
    (data.type === 'ADJUSTMENT' && result.quantityUnits > 0);
  for (const [field, needed] of [
    ['sourceWarehouseId', source],
    ['destinationWarehouseId', destination],
  ]) {
    if (needed) result[field] = id(data[field]);
    else if (data[field] !== undefined)
      fail('Almacén no aplicable al movimiento');
  }
  if (
    result.sourceWarehouseId &&
    result.sourceWarehouseId === result.destinationWarehouseId
  )
    fail('Origen y destino deben ser distintos');
  return result;
}
function warehouse(data, update = false) {
  object(
    data,
    update
      ? ['name', 'description', 'location', 'status']
      : ['code', 'name', 'description', 'location'],
  );
  if (!Object.keys(data).length) fail('Payload vacío');
  const result = {};
  for (const [key, max] of Object.entries({
    code: 80,
    name: 255,
    description: 2000,
    location: 500,
  })) {
    if (data[key] !== undefined || (!update && ['code', 'name'].includes(key)))
      result[key] = text(data[key], max, ['code', 'name'].includes(key));
  }
  if (result.code) {
    result.code = result.code.toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(result.code)) fail('Código inválido');
  }
  if (data.status !== undefined) {
    if (!['active', 'inactive'].includes(data.status)) fail('Estado inválido');
    result.status = data.status;
  }
  return result;
}
function query(data = {}, kind) {
  const allowed = {
    warehouses: ['search', 'status'],
    products: ['search'],
    balances: ['productId', 'warehouseId', 'search'],
    movements: ['productId', 'warehouseId', 'type', 'from', 'to', 'search'],
  };
  object(data, ['page', 'limit', ...allowed[kind]]);
  const result = { page: 1, limit: 20 };
  for (const [key, max] of [
    ['page', 1000000],
    ['limit', 100],
  ])
    if (data[key] !== undefined) {
      if (
        !/^[1-9]\d*$/.test(String(data[key])) ||
        typeof data[key] === 'object' ||
        Number(data[key]) > max
      )
        fail('Paginación inválida');
      result[key] = Number(data[key]);
    }
  for (const key of allowed[kind])
    if (data[key] !== undefined) {
      if (key.endsWith('Id')) result[key] = id(data[key]);
      else if (['from', 'to'].includes(key)) {
        if (
          typeof data[key] !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(data[key]) ||
          !Number.isFinite(Date.parse(data[key]))
        )
          fail('Fecha ISO UTC inválida');
        result[key] = new Date(data[key]);
        if (result[key].toISOString().slice(0, 19) !== data[key].slice(0, 19))
          fail('Fecha de calendario inválida');
      } else result[key] = text(data[key], 100, true);
    }
  if (result.type && !TYPES.includes(result.type)) fail('Tipo inválido');
  if (result.status && !['active', 'inactive'].includes(result.status))
    fail('Estado inválido');
  if (result.from && result.to && result.from > result.to)
    fail('Rango de fechas inválido');
  return result;
}
module.exports = {
  MAX_UNITS,
  TYPES,
  id,
  units,
  decimal,
  movement,
  warehouse,
  query,
};
