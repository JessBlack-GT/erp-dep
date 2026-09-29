/**
 * ============================================
 * ERP-SYSTEM - Servicio de Autenticación
 * ============================================
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../users/users.model');
const rbac = require('../../security/rbac');
const { config } = require('../../config/environment');
const { validateEmail } = require('../../shared/validators/validators');
const {
  UnauthorizedError,
  ConflictError,
  ValidationError,
} = require('../../shared/errors/appErrors');
const validation = require('../users/users.validation');

class AuthService {
  /**
   * Registrar un nuevo usuario
   */
  async register(userData) {
    validation.password(userData.password);
    if (
      typeof userData.email !== 'string' ||
      !validateEmail(userData.email).valid ||
      typeof userData.password !== 'string' ||
      !userData.password
    )
      throw new ValidationError('Email y contraseña requeridos');
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) throw new ConflictError('Ya existe un usuario con este email');

    const emailValidation = validateEmail(userData.email);
    if (!emailValidation.valid) throw new Error(emailValidation.error);

    const user = new User({
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      // Public registration never grants administrative access.
      role: 'user',
    });
    return user.save();
  }

  /**
   * Iniciar sesión y generar tokens JWT
   */
  async login(email, password) {
    if (
      typeof email !== 'string' ||
      !validateEmail(email).valid ||
      typeof password !== 'string' ||
      !password
    )
      throw new ValidationError('Email y contraseña requeridos');
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
      '+password +sessionVersion',
    );
    if (!user || user.status !== 'active') throw new UnauthorizedError('Credenciales inválidas');

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) throw new UnauthorizedError('Credenciales inválidas');

    // Actualizar último login
    user.lastLoginAt = new Date();
    await user.save();

    // Generar tokens
    const accessToken = jwt.sign(
      { id: user._id, sv: user.sessionVersion || 0, kind: 'access' },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn },
    );

    const refreshToken = jwt.sign(
      { id: user._id, sv: user.sessionVersion || 0, kind: 'refresh' },
      config.jwtRefreshSecret,
      { expiresIn: config.jwtRefreshExpiresIn },
    );

    const access = await rbac.resolveAccess(String(user._id));
    if (!access) throw new UnauthorizedError('Usuario no válido');
    return { accessToken, refreshToken, user: access };
  }

  /**
   * Refresh de token
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
      if (decoded.kind && decoded.kind !== 'refresh') throw new UnauthorizedError();
      const user = await User.findById(decoded.id).select('+sessionVersion');
      if (!user || user.status !== 'active' || (decoded.sv ?? 0) !== (user.sessionVersion || 0))
        throw new UnauthorizedError('Usuario no válido');

      const newAccessToken = jwt.sign(
        { id: user._id, sv: user.sessionVersion || 0, kind: 'access' },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn },
      );

      return { accessToken: newAccessToken };
    } catch (error) {
      throw new UnauthorizedError('Refresh token inválido');
    }
  }

  /**
   * Revocar todas las sesiones del usuario, sin almacenar tokens.
   */
  async logout(userId) {
    await User.updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } });
    return { success: true, message: 'Sesión cerrada' };
  }

  async changePassword(id, data, version = 0) {
    validation.object(data, ['currentPassword', 'newPassword']);
    validation.password(data.newPassword);
    if (typeof data.currentPassword !== 'string')
      throw new ValidationError('Contraseña actual requerida');
    const user = await User.findById(id).select('+password +sessionVersion');
    if (
      !user ||
      (user.sessionVersion || 0) !== version ||
      !(await user.comparePassword(data.currentPassword))
    )
      throw new UnauthorizedError('Contraseña actual o sesión inválida');
    const hash = await bcrypt.hash(data.newPassword, 12);
    const result = await User.updateOne(
      {
        _id: id,
        password: user.password,
        status: 'active',
        $expr: { $eq: [{ $ifNull: ['$sessionVersion', 0] }, version] },
      },
      { $set: { password: hash, updatedBy: id }, $inc: { sessionVersion: 1 } },
    );
    if (!result.modifiedCount)
      throw new UnauthorizedError('Sesión modificada; vuelva a iniciar sesión');
    return { success: true };
  }
}

module.exports = new AuthService();
