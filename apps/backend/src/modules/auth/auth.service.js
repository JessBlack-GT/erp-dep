/**
 * ============================================
 * ERP-SYSTEM - Servicio de Autenticación
 * ============================================
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../users/users.model');
const Role = require('../roles/roles.model');
const { config } = require('../../config/environment');
const { validateEmail } = require('../../shared/validators/validators');
const { UnauthorizedError, ConflictError } = require('../../shared/errors/appErrors');

class AuthService {
  /**
   * Registrar un nuevo usuario
   */
  async register(userData) {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) throw new ConflictError('Ya existe un usuario con este email');

    const emailValidation = validateEmail(userData.email);
    if (!emailValidation.valid) throw new Error(emailValidation.error);

    const user = new User({
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role || 'user',
    });
    return user.save();
  }

  /**
   * Iniciar sesión y generar tokens JWT
   */
  async login(email, password) {
    const user = await User.findOne({ email }).select('+password');
    if (!user) throw new UnauthorizedError('Credenciales inválidas');

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) throw new UnauthorizedError('Credenciales inválidas');

    // Actualizar último login
    user.lastLoginAt = new Date();
    await user.save();

    // Generar tokens
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role, permissions: user.permissions },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    const refreshToken = jwt.sign(
      { id: user._id, email: user.email },
      config.jwtRefreshSecret,
      { expiresIn: config.jwtRefreshExpiresIn }
    );

    return { accessToken, refreshToken, user: user.toPublicJSON() };
  }

  /**
   * Refresh de token
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
      const user = await User.findById(decoded.id);
      if (!user || user.status === 'inactive') throw new UnauthorizedError('Usuario no válido');

      const newAccessToken = jwt.sign(
        { id: user._id, email: user.email, role: user.role, permissions: user.permissions },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      return { accessToken: newAccessToken };
    } catch (error) {
      throw new UnauthorizedError('Refresh token inválido');
    }
  }

  /**
   * Cerrar sesión (invalidar token - implementación simplificada)
   */
  async logout(userId) {
    // En una implementación completa, se añadiría el token a una blacklist
    return { success: true, message: 'Sesión cerrada' };
  }
}

module.exports = new AuthService();
