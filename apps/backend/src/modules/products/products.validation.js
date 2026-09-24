const { ValidationError } = require('../../shared/errors/appErrors');
const lengths = {
  name: 255,
  description: 2000,
  type: 7,
  sku: 80,
  barcode: 80,
  category: 100,
  unit: 40,
  price: 17,
  cost: 17,
  currency: 3,
  taxCategory: 80,
  notes: 2000,
};
const invalid = (message) => {
  throw new ValidationError(message);
};
function money(value) {
  if (
    typeof value !== 'string' ||
    !/^(0|[1-9]\d{0,11})(\.\d{1,4})?$/.test(value)
  )
    invalid(
      'Importe inválido: use texto decimal no negativo, máximo 12 enteros y 4 decimales',
    );
  const [integer, fraction = ''] = value.split('.');
  return integer + '.' + fraction.padEnd(4, '0');
}
function input(data, partial = false) {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    !Object.keys(data).length
  )
    invalid('Payload vacío o inválido');
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'trackInventory') {
      if (typeof value !== 'boolean')
        invalid('trackInventory debe ser booleano');
      out[key] = value;
      continue;
    }
    if (!Object.hasOwn(lengths, key) || typeof value !== 'string')
      invalid('Campo no permitido o inválido: ' + key);
    out[key] = value.trim();
    if (out[key].length > lengths[key]) invalid('Longitud excedida: ' + key);
  }
  for (const key of ['name', 'sku'])
    if ((!partial || out[key] !== undefined) && !out[key])
      invalid(key + ' requerido');
  if (out.type !== undefined && !['PRODUCT', 'SERVICE'].includes(out.type))
    invalid('Tipo inválido');
  if (out.sku) {
    out.sku = out.sku.toUpperCase().replace(/\s+/g, '-');
    if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(out.sku)) invalid('SKU inválido');
  }
  if (out.barcode && !/^[!-~]{3,80}$/.test(out.barcode))
    invalid('Código de barras inválido');
  if (out.unit !== undefined) {
    out.unit = out.unit.toLowerCase();
    if (!/^[\p{L}\p{N}][\p{L}\p{N} ._/-]{0,39}$/u.test(out.unit))
      invalid('Unidad inválida');
  }
  for (const key of ['category', 'taxCategory'])
    if (out[key]) out[key] = out[key].replace(/\s+/g, ' ');
  for (const key of ['price', 'cost']) if (out[key]) out[key] = money(out[key]);
  if (out.currency) {
    out.currency = out.currency.toUpperCase();
    if (!/^[A-Z]{3}$/.test(out.currency)) invalid('Moneda inválida');
  }
  return out;
}
function domain(data) {
  if (data.type === 'SERVICE' && (data.barcode || data.trackInventory))
    invalid('SERVICE no admite barcode ni seguimiento de inventario');
  if ((data.price || data.cost) && !data.currency)
    invalid('Precio/costo requieren moneda');
}
function id(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))
    invalid('ID inválido');
  return value.toLowerCase();
}
function query(params = {}) {
  const allowed = [
    'page',
    'limit',
    'search',
    'status',
    'category',
    'type',
    'currency',
    'sortBy',
    'sortOrder',
  ];
  for (const [key, value] of Object.entries(params))
    if (!allowed.includes(key) || typeof value !== 'string')
      invalid('Filtro inválido');
  const page = params.page === undefined ? 1 : Number(params.page),
    limit = params.limit === undefined ? 20 : Number(params.limit);
  if (
    (params.page !== undefined && !/^\d+$/.test(params.page)) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1000000
  )
    invalid('Página inválida');
  if (
    (params.limit !== undefined && !/^\d+$/.test(params.limit)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    invalid('Límite inválido');
  const filters = { status: { $ne: 'deleted' } };
  for (const [key, values] of [
    ['status', ['active', 'inactive']],
    ['type', ['PRODUCT', 'SERVICE']],
  ])
    if (params[key] !== undefined) {
      if (!values.includes(params[key])) invalid('Filtro inválido');
      filters[key] = params[key];
    }
  if (params.category !== undefined) {
    const value = params.category.trim().replace(/\s+/g, ' ');
    if (!value || value.length > 100) invalid('Categoría inválida');
    filters.category = value;
  }
  if (params.currency !== undefined) {
    if (!/^[A-Za-z]{3}$/.test(params.currency)) invalid('Moneda inválida');
    filters.currency = params.currency.toUpperCase();
  }
  const search = (params.search || '').trim();
  if (search.length > 255) invalid('Búsqueda demasiado larga');
  const sortBy = params.sortBy || 'createdAt',
    sortOrder = params.sortOrder || 'desc';
  if (
    !['name', 'sku', 'type', 'status', 'createdAt', 'category'].includes(
      sortBy,
    ) ||
    !['asc', 'desc'].includes(sortOrder)
  )
    invalid('Orden inválido');
  return { filters, page, limit, search, sortBy, sortOrder };
}
module.exports = { lengths, input, domain, id, query, money };
