/**
 * ============================================
 * ERP-SYSTEM - Repositorio de Roles
 * ============================================
 */

const Role = require('./roles.model');
const { NotFoundError } = require('../../shared/errors/appErrors');

class RoleRepository {
  async findAll() {
    return Role.find().lean();
  }

  async findById(id) {
    return Role.findById(id);
  }

  async findByName(name) {
    return Role.findOne({ name });
  }

  async create(roleData) {
    const role = new Role(roleData);
    return role.save();
  }

  async updateById(id, updateData) {
    return Role.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  }

  async deleteById(id) {
    return Role.findByIdAndUpdate(id, { status: 'deleted' }, { new: true });
  }
}

module.exports = new RoleRepository();
