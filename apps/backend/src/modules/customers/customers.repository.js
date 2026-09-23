/**
 * ============================================
 * ERP-SYSTEM - Repositorio de Clientes
 * ============================================
 */

const Customer = require('./customers.model');
const { ValidationError } = require('../../shared/errors/appErrors');
const { validateObjectId } = require('../../shared/validators/validators');

class CustomerRepository {
  async findAll(filters = {}, options = {}) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', search = '' } = options;
    const skip = (page - 1) * limit;

    const query = { status: { $ne: 'deleted' }, ...filters };
    const literalSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Busqueda por texto
    if (search) {
      query.$or = [
        { name: { $regex: literalSearch, $options: 'i' } },
        { email: { $regex: literalSearch, $options: 'i' } },
        { businessName: { $regex: literalSearch, $options: 'i' } },
        { documentNumber: { $regex: literalSearch, $options: 'i' } },
      ];
    }

    return Customer.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async findById(id) {
    if (!validateObjectId(id).valid) throw new ValidationError('ID inválido');
    return Customer.findById(id);
  }

  async findByEmail(email) {
    return Customer.findOne({ email });
  }

  async findByDocumentNumber(documentNumber) {
    return Customer.findOne({ documentNumber });
  }

  async create(customerData) {
    const customer = new Customer(customerData);
    return customer.save();
  }

  async updateById(id, updateData) {
    if (!validateObjectId(id).valid) throw new ValidationError('ID inválido');
    return Customer.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  }

  async updateStatus(id, status) {
    if (!validateObjectId(id).valid) throw new ValidationError('ID inválido');
    return Customer.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  }

  async softDelete(id) {
    if (!validateObjectId(id).valid) throw new ValidationError('ID inválido');
    return Customer.findByIdAndUpdate(id, { status: 'deleted' }, { new: true });
  }

  async count(filters = {}) {
    return Customer.countDocuments(filters);
  }

  async exists(email) {
    return Customer.findOne({ email });
  }
}

module.exports = new CustomerRepository();
