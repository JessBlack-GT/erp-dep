/**
 * ============================================
 * ERP-SYSTEM - Validaciones de Cliente
 * ============================================
 */

const { validateRequired, validateEmail, validateStringLength, validateObjectId } = require('../../shared/validators/validators');

// Validacion para crear cliente
const createCustomerRules = [
  {
    field: 'name',
    validate: (value) => validateRequired(value, 'Nombre')
  },
  {
    field: 'email',
    validate: (value) => {
      const result = validateRequired(value, 'Email');
      if (!result.valid) return result;
      return validateEmail(value);
    }
  },
];

// Validacion para actualizar cliente
const updateCustomerRules = [
  {
    field: 'name',
    validate: (value) => validateRequired(value, 'Nombre')
  },
  {
    field: 'email',
    validate: (value) => validateEmail(value)
  },
];

// Validacion de parametros de ruta
const validateCustomerId = (id) => validateObjectId(id);

// Validacion de filtros
const validateFilters = (params) => {
  const errors = [];
  const { page, limit, sortBy, sortOrder, search } = params;

  if (page !== undefined && (!/^\d+$/.test(String(page)) || !Number.isSafeInteger(Number(page)) || Number(page) < 1)) {
    errors.push({ field: 'page', message: 'Debe ser un número positivo' });
  }
  if (limit !== undefined && (!/^\d+$/.test(String(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
    errors.push({ field: 'limit', message: 'Debe ser entre 1 y 100' });
  }
  if (search && typeof search !== 'string') {
    errors.push({ field: 'search', message: 'Debe ser un string' });
  }
  if (params.status !== undefined && !Object.values(require('../../shared/constants/appConstants').STATUS).includes(params.status)) errors.push({ field: 'status', message: 'Estado inválido' });
  if (params.type !== undefined && !['natural', 'legal'].includes(params.type)) errors.push({ field: 'type', message: 'Tipo inválido' });
  if (params.city !== undefined && typeof params.city !== 'string') errors.push({ field: 'city', message: 'Ciudad inválida' });
  if (sortBy && !['name', 'email', 'status', 'createdAt', 'type'].includes(sortBy)) {
    errors.push({ field: 'sortBy', message: 'Campo de ordenamiento inválido' });
  }
  if (sortOrder && !['asc', 'desc'].includes(sortOrder)) {
    errors.push({ field: 'sortOrder', message: 'Orden inválido' });
  }

  return { valid: errors.length === 0, errors };
};

module.exports = {
  createCustomerRules,
  updateCustomerRules,
  validateCustomerId,
  validateFilters,
};
