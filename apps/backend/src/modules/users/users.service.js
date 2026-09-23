/**
 * ============================================
 * ERP-SYSTEM - Servicio de Usuarios
 * ============================================
 */

const userRepository = require('./users.repository');
const { NotFoundError, ConflictError } = require('../../shared/errors/appErrors');
const { validateEmail } = require('../../shared/validators/validators');

class UserService {
  async getAll(filters, options) {
    return userRepository.findAll(filters, options);
  }

  async getById(id) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('Usuario no encontrado', 'User');
    return user;
  }

  async create(userData) {
    // Verificar email único
    const existing = await userRepository.findByEmail(userData.email);
    if (existing) throw new ConflictError('Ya existe un usuario con este email');

    // Validar email
    const emailValidation = validateEmail(userData.email);
    if (!emailValidation.valid) throw new Error(emailValidation.error);

    return userRepository.create(userData);
  }

  async update(id, updateData) {
    const user = await this.getById(id);
    return userRepository.updateById(id, updateData);
  }

  async delete(id) {
    await this.getById(id);
    return userRepository.deleteById(id);
  }

  async getProfile(userId) {
    return this.getById(userId);
  }
}

module.exports = new UserService();
