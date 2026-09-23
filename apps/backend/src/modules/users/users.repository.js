/**
 * ============================================
 * ERP-SYSTEM - Repositorio de Usuario
 * ============================================
 */

const User = require('./users.model');
const { NotFoundError } = require('../../shared/errors/appErrors');
const { validateObjectId } = require('../../shared/validators/validators');

class UserRepository {
  async findAll(filters = {}, options = {}) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const query = { ...filters };
    const skip = (page - 1) * limit;

    return User.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .select('-password')
      .lean();
  }

  async findById(id) {
    if (!validateObjectId(id).valid) throw new Error('ID inválido');
    return User.findById(id).select('-password');
  }

  async findByEmail(email) {
    return User.findOne({ email }).select('+password');
  }

  async create(userData) {
    const user = new User(userData);
    return user.save();
  }

  async updateById(id, updateData) {
    if (!validateObjectId(id).valid) throw new Error('ID inválido');
    if (updateData.password) {
      const bcrypt = require('bcryptjs');
      updateData.password = await bcrypt.hash(updateData.password, 12);
    }
    return User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select('-password');
  }

  async deleteById(id) {
    if (!validateObjectId(id).valid) throw new Error('ID inválido');
    return User.findByIdAndUpdate(id, { status: 'deleted' }, { new: true });
  }

  async count(filters = {}) {
    return User.countDocuments(filters);
  }
}

module.exports = new UserRepository();
