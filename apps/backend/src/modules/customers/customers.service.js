/**
 * ============================================
 * ERP-SYSTEM - Servicio de Clientes
 * ============================================
 */

const customerRepository = require('./customers.repository');
const { NotFoundError, ConflictError, ValidationError } = require('../../shared/errors/appErrors');
const { validateEmail, validateRequired } = require('../../shared/validators/validators');
const { STATUS } = require('../../shared/constants/appConstants');

function customerInput(data) {
  const allowed = ['name', 'lastName', 'businessName', 'type', 'email', 'phone', 'documentType', 'documentNumber', 'address', 'city', 'country', 'zipCode', 'status', 'notes'];
  const result = {};
  for (const field of Object.keys(data)) {
    if (!allowed.includes(field)) throw new ValidationError(`Campo no permitido: ${field}`);
    if (typeof data[field] !== 'string') throw new ValidationError(`Campo inválido: ${field}`);
    result[field] = data[field].trim();
  }
  if (result.email !== undefined) {
    result.email = result.email.toLowerCase();
    if (!validateEmail(result.email).valid) throw new ValidationError('Email inválido');
  }
  if (result.name !== undefined && !result.name) throw new ValidationError('Nombre requerido');
  if (result.status !== undefined && !Object.values(STATUS).includes(result.status)) throw new ValidationError('Estado inválido');
  if (result.status === STATUS.DELETED) throw new ValidationError('Utilice la operación de eliminación');
  if (result.type !== undefined && !['natural', 'legal'].includes(result.type)) throw new ValidationError('Tipo inválido');
  return result;
}

class CustomerService {
  /**
   * Obtener todos los clientes con filtros y paginacion
   */
  async getAll(filters = {}) {
    const { page, limit, sortBy, sortOrder, search } = filters;
    const options = {
      page: page || 1,
      limit: limit || 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
      search: search || '',
    };
    return customerRepository.findAll(filters.filters || {}, options);
  }

  /**
   * Obtener un cliente por ID
   */
  async getById(id) {
    const customer = await customerRepository.findById(id);
    if (!customer) throw new NotFoundError('Cliente no encontrado', 'Customer');
    return customer;
  }

  /**
   * Crear un nuevo cliente
   */
  async create(customerData) {
    customerData = customerInput(customerData);
    if (!customerData.documentNumber) delete customerData.documentNumber;
    // Validar email
    const emailValidation = validateEmail(customerData.email);
    if (!emailValidation.valid) {
      throw new ValidationError('Email inválido', { field: 'email', message: emailValidation.error });
    }

    // Verificar email unico
    const existingEmail = await customerRepository.exists(customerData.email);
    if (existingEmail && existingEmail._id.toString() !== customerData._id) {
      throw new ConflictError('Ya existe un cliente con este email');
    }

    // Verificar documento unico si existe
    if (customerData.documentNumber) {
      const existingDoc = await customerRepository.findByDocumentNumber(customerData.documentNumber);
      if (existingDoc && existingDoc._id.toString() !== customerData._id) {
        throw new ConflictError('Ya existe un cliente con este número de documento');
      }
    }

    // Validar campos requeridos
    const requiredResult = validateRequired(customerData.name, 'name');
    if (!requiredResult.valid) {
      throw new ValidationError(requiredResult.error);
    }

    return customerRepository.create(customerData);
  }

  /**
   * Actualizar un cliente existente
   */
  async update(id, updateData) {
    updateData = customerInput(updateData);
    const customer = await this.getById(id);
    if (updateData.documentNumber) {
      const existingDoc = await customerRepository.findByDocumentNumber(updateData.documentNumber);
      if (existingDoc && existingDoc._id.toString() !== id) throw new ConflictError('Ya existe un cliente con este número de documento');
    }
    if (updateData.documentNumber === '') {
      delete updateData.documentNumber;
      updateData.$unset = { documentNumber: 1 };
    }

    // Validar email si se actualiza
    if (updateData.email && updateData.email !== customer.email) {
      const emailValidation = validateEmail(updateData.email);
      if (!emailValidation.valid) {
        throw new ValidationError('Email inválido', { field: 'email', message: emailValidation.error });
      }
      const existingEmail = await customerRepository.exists(updateData.email);
      if (existingEmail && existingEmail._id.toString() !== id) {
        throw new ConflictError('Ya existe un cliente con este email');
      }
    }

    // No permitir cambiar campos internos
    delete updateData.createdAt;
    delete updateData._id;
    delete updateData.__v;

    return customerRepository.updateById(id, updateData);
  }

  /**
   * Cambiar estado de un cliente
   */
  async changeStatus(id, status) {
    const { STATUS } = require('../../shared/constants/appConstants');
    if (!Object.values(STATUS).includes(status)) throw new ValidationError('Estado inválido');
    if (status === STATUS.DELETED) throw new ValidationError('Utilice la operación de eliminación');
    await this.getById(id);
    return customerRepository.updateStatus(id, status);
  }

  /**
   * Eliminar un cliente (soft delete)
   */
  async delete(id) {
    await this.getById(id);
    return customerRepository.softDelete(id);
  }

  /**
   * Obtener estadisticas de clientes
   */
  async getStats() {
    const total = await customerRepository.count({});
    const active = await customerRepository.count({ status: 'active' });
    const inactive = await customerRepository.count({ status: 'inactive' });
    const deleted = await customerRepository.count({ status: 'deleted' });

    return { total, active, inactive, deleted };
  }
}

module.exports = new CustomerService();
