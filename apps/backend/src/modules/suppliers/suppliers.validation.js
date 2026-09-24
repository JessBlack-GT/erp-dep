const { ValidationError } = require('../../shared/errors/appErrors');
const lengths = {
  name: 255,
  tradeName: 255,
  type: 7,
  taxId: 80,
  taxType: 40,
  taxCountry: 2,
  email: 254,
  phone: 30,
  contactName: 200,
  address: 500,
  city: 100,
  region: 100,
  country: 2,
  zipCode: 20,
  website: 500,
  paymentTerms: 200,
  currency: 3,
  category: 100,
  notes: 2000,
};
const invalid = (message) => {
  throw new ValidationError(message);
};
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
    if (!Object.hasOwn(lengths, key) || typeof value !== 'string')
      invalid('Campo no permitido o inválido: ' + key);
    out[key] = value.trim();
    if (out[key].length > lengths[key]) invalid('Longitud excedida: ' + key);
  }
  if ((!partial || out.name !== undefined) && !out.name)
    invalid('Nombre requerido');
  if (out.type !== undefined && !['natural', 'legal'].includes(out.type))
    invalid('Tipo inválido');
  if (out.email) {
    out.email = out.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))
      invalid('Email inválido');
  }
  if (
    out.phone &&
    (!/^[+()\d .-]+$/.test(out.phone) ||
      out.phone.replace(/\D/g, '').length < 7 ||
      out.phone.replace(/\D/g, '').length > 20)
  )
    invalid('Teléfono inválido');
  for (const key of ['country', 'taxCountry', 'currency'])
    if (out[key]) {
      out[key] = out[key].toUpperCase();
      if (!(key === 'currency' ? /^[A-Z]{3}$/ : /^[A-Z]{2}$/).test(out[key]))
        invalid('Código inválido: ' + key);
    }
  if (out.taxId) {
    out.taxId = out.taxId.toUpperCase();
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .\/-]*$/u.test(out.taxId))
      invalid('Identificador fiscal inválido');
  }
  if (out.taxType) out.taxType = out.taxType.toUpperCase();
  if (out.website) {
    try {
      const url = new URL(out.website);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        !url.hostname
      )
        invalid('URL inválida');
    } catch (_) {
      invalid('URL inválida');
    }
  }
  return out;
}
function fiscal(data) {
  if (data.taxId && (!data.taxCountry || !data.taxType))
    invalid('El identificador fiscal requiere país fiscal y tipo');
}
function id(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))
    invalid('ID inválido');
  return value;
}
function query(params = {}) {
  const allowed = [
    'page',
    'limit',
    'search',
    'status',
    'category',
    'country',
    'type',
    'sortBy',
    'sortOrder',
  ];
  for (const [key, value] of Object.entries(params))
    if (!allowed.includes(key) || typeof value !== 'string')
      invalid('Filtro inválido: ' + key);
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
  if (params.status) {
    if (!['active', 'inactive'].includes(params.status))
      invalid('Estado inválido');
    filters.status = params.status;
  }
  if (params.type) {
    if (!['natural', 'legal'].includes(params.type)) invalid('Tipo inválido');
    filters.type = params.type;
  }
  if (params.category) {
    if (params.category.length > 100) invalid('Categoría inválida');
    filters.category = params.category.trim();
  }
  if (params.country) {
    if (!/^[a-z]{2}$/i.test(params.country)) invalid('País inválido');
    filters.country = params.country.toUpperCase();
  }
  const search = (params.search || '').trim();
  if (search.length > 255) invalid('Búsqueda demasiado larga');
  const sortBy = params.sortBy || 'createdAt',
    sortOrder = params.sortOrder || 'desc';
  if (
    !['name', 'createdAt', 'status', 'category', 'country'].includes(sortBy) ||
    !['asc', 'desc'].includes(sortOrder)
  )
    invalid('Orden inválido');
  return { filters, page, limit, search, sortBy, sortOrder };
}
module.exports = { lengths, input, fiscal, id, query };
