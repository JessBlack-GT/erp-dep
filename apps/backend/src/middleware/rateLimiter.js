/**
 * ============================================
 * ERP-SYSTEM - Rate Limiter
 * ============================================
 */

const rateLimit = require('express-rate-limit');
const { config } = require('../config/environment');
const { logger } = require('../shared/utils/logger');

const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit excedido para IP: ${req.ip}, ruta: ${req.path}`);
    res.status(429).json({ success: false, error: 'Demasiadas solicitudes', message: `Intente en ${Math.round(config.rateLimitWindowMs / 60000)} minutos`, retryAfter: Math.round(config.rateLimitWindowMs / 1000) });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos de inicio de sesión', message: 'Intente de nuevo más tarde.' },
});

module.exports = { apiLimiter, authLimiter };
