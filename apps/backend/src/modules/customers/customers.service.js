/**
 * ============================================
 * ERP-SYSTEM - Servicio de Clientes
 * ============================================
 */

const customerRepository = require('./customers.repository');
const { NotFoundError, ConflictError, ValidationError } = require('../../shared/errors/appErrors');
const { validateEmail, validateRequired } = require('../../shared/validators/validators');

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
    return customerRepository.findAll({}, options);
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
    const customer = await this.getById(id);

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
    const customer = await this.getById(id);
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
