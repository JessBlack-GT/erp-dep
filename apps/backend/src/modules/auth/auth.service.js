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
const crypto = require('crypto');
const mongoose = require('mongoose');
const PasswordResetToken = require('./password-reset-token.model');
const emailService = require('../../shared/services/email');
const { logger } = require('../../shared/utils/logger');
const resetMessage =
  'Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.';
const invalidReset = () =>
  new ValidationError('El enlace de recuperación no es válido o ha expirado.');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const diagnosticCode = (value) => {
  if (typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(value)) return value;
  return Number.isInteger(value) && Math.abs(value) <= 999999 ? value : undefined;
};
const safeDiagnosticMessage = (value) => {
  if (typeof value !== 'string') return undefined;
  let message = value;
  for (const secret of [
    config.resendApiKey,
    config.mongodbUri,
    config.jwtSecret,
    config.jwtRefreshSecret,
    config.emailPass,
  ]) {
    if (typeof secret === 'string' && secret.length > 0) {
      message = message.split(secret).join('[redacted]');
    }
  }
  return (
    message
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
      .replace(/\b(?:re|rk|sk)_[a-zA-Z0-9_-]{8,}\b/g, '[redacted]')
      .replace(/https?:\/\/[^\s"'<>]+/gi, '[redacted-url]')
      .replace(/\bmongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[redacted-database-uri]')
      .replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[redacted-email]')
      .replace(/\b[a-f0-9]{32,}\b/gi, '[redacted-token]')
      .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[redacted-token]')
      .replace(/("?(?:password|token|secret|authorization)"?\s*[:=]\s*"?)[^\s,;"}]+/gi, '$1[redacted]')
      .slice(0, 240) || undefined
  );
};
const escapeHtml = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );

class AuthService {
  async forgotPassword(email) {
    if (typeof email !== 'string' || !validateEmail(email.trim()).valid || email.length > 254)
      throw new ValidationError('Introduce un correo electrónico válido.');
    const result = { success: true, message: resetMessage };
    const startedAt = Date.now();
    let stage = 'recovery_configuration';
    let tokenHash;
    try {
      const minutes = config.passwordResetTokenTtlMinutes;
      const base = new URL(config.frontendAppUrl);
      if (
        !Number.isInteger(minutes) ||
        minutes < 1 ||
        minutes > 60 ||
        base.username ||
        base.password ||
        base.search ||
        base.hash ||
        base.pathname !== '/' ||
        (base.protocol !== 'https:' &&
          !(
            config.nodeEnv !== 'production' &&
            base.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
          ))
      )
        throw Error('Invalid recovery configuration');
      stage = 'user_lookup';
      const user = await User.findOne({ email: email.trim().toLowerCase(), status: 'active' });
      if (!user) return result;
      stage = 'token_generation';
      const token = crypto.randomBytes(32).toString('hex');
      tokenHash = hashToken(token);
      let created = false;
      stage = 'transaction_start';
      await mongoose.connection.transaction(async (session) => {
        created = false;
        // Serialize issuance and redemption on the same user, including when no tokens exist.
        stage = 'user_lock';
        const locked = await User.findOneAndUpdate(
          { _id: user._id, status: 'active' },
          { $inc: { __v: 1 } },
          { session, new: true },
        );
        if (!locked) return;
        const now = new Date();
        stage = 'invalidate_existing_tokens';
        await PasswordResetToken.updateMany(
          { userId: user._id, usedAt: null },
          { $set: { usedAt: now } },
          { session },
        );
        stage = 'token_creation';
        await PasswordResetToken.create(
          [
            {
              userId: user._id,
              tokenHash,
              expiresAt: new Date(now.getTime() + minutes * 60000),
            },
          ],
          { session },
        );
        created = true;
        stage = 'transaction_commit';
      });
      if (!created) return result;
      stage = 'reset_url_generation';
      const url = new URL('/reset-password', base);
      url.searchParams.set('token', token);
      const link = url.toString();
      stage = 'email_configuration';
      await emailService.sendEmail({
        to: user.email,
        subject: 'Restablecimiento de contraseña — YJ Nexo ERP',
        text: `YJ Nexo ERP\n\nSolicitud para restablecer tu contraseña\n\nSe solicitó un cambio de contraseña para tu cuenta.\nRestablecer contraseña: ${link}\n\nEl enlace expira en ${minutes} minutos y solo puede utilizarse una vez.\nSi no hiciste esta solicitud, puedes ignorar este correo.`,
        html: `<!doctype html><html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px" cellspacing="0" cellpadding="0"><tr><td style="padding:28px;background:#0f172a;color:#ffffff;font-size:24px;font-weight:bold">YJ Nexo <span style="font-size:14px;font-weight:normal">ERP</span></td></tr><tr><td style="padding:32px"><h1 style="font-size:24px;line-height:1.3">Solicitud para restablecer tu contraseña</h1><p style="line-height:1.6">Se solicitó un cambio de contraseña para tu cuenta. Usa el siguiente botón para elegir una nueva contraseña.</p><p style="padding:16px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;padding:16px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Restablecer contraseña</a></p><p>El enlace expira en <strong>${minutes} minutos</strong> y solo puede utilizarse una vez.</p><p style="color:#475569;line-height:1.6">Si no hiciste esta solicitud, puedes ignorar este correo. Tu contraseña no cambiará.</p></td></tr></table></td></tr></table></body></html>`,
      });
    } catch (error) {
      // Same public response for unknown users, database failures and provider failures.
      if (tokenHash) {
        try {
          await PasswordResetToken.updateMany(
            { tokenHash, usedAt: null },
            { $set: { usedAt: new Date() } },
          );
        } catch (_) {
          /* Expiration remains enforced even when cleanup is unavailable. */
        }
      }
      const errorStage = [
        'email_configuration',
        'resend_request',
        'resend_response',
        'resend_timeout',
      ].includes(error?.stage)
        ? error.stage
        : stage;
      const httpStatus = Number.isInteger(error?.httpStatus)
        ? error.httpStatus
        : Number.isInteger(error?.status)
          ? error.status
          : undefined;
      logger.warn('No se pudo completar la solicitud de recuperación de contraseña', {
        stage: errorStage,
        errorName: diagnosticCode(error?.name),
        errorCode: diagnosticCode(error?.code),
        httpStatus,
        providerCode: diagnosticCode(error?.providerCode),
        providerMessage: safeDiagnosticMessage(error?.providerMessage),
        durationMs: Math.max(0, Date.now() - startedAt),
      });
    }
    return result;
  }

  async resetPassword(token, password) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw invalidReset();
    validation.password(password);
    const tokenHash = hashToken(token);
    // Reject invalid tokens before the expensive password hash. Recheck in the transaction.
    const pending = await PasswordResetToken.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!pending) throw invalidReset();
    const passwordHash = await bcrypt.hash(password, 12);
    await mongoose.connection.transaction(async (session) => {
      const user = await User.findOneAndUpdate(
        { _id: pending.userId, status: 'active' },
        { $inc: { __v: 1 } },
        { session, new: true },
      );
      if (!user) throw invalidReset();
      const now = new Date();
      const consumed = await PasswordResetToken.findOneAndUpdate(
        { tokenHash, userId: user._id, usedAt: null, expiresAt: { $gt: now } },
        { $set: { usedAt: now } },
        { session, new: true },
      );
      if (!consumed) throw invalidReset();
      // updateOne avoids hashing the already-bcrypt-hashed password in the save hook.
      const updated = await User.updateOne(
        { _id: user._id, status: 'active' },
        {
          $set: { password: passwordHash, updatedBy: user._id },
          $inc: { sessionVersion: 1 },
        },
        { session },
      );
      if (updated.modifiedCount !== 1) throw invalidReset();
      await PasswordResetToken.updateMany(
        { userId: user._id, usedAt: null },
        { $set: { usedAt: now } },
        { session },
      );
    });
    return { success: true, message: 'Contraseña restablecida correctamente.' };
  }

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
