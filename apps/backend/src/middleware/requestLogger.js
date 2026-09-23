/**
 * ============================================
 * ERP-SYSTEM - Logger de Solicitudes
 * ============================================
 */

const { logger } = require('../shared/utils/logger');

function requestLogger(req, res, next) {
  const startTime = Date.now();
  const { method, originalUrl, ip } = req;
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    const sanitizedBody = { ...req.body };
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    delete sanitizedBody.refreshToken;
    delete sanitizedBody.confirmPassword;
    logger.info(`${method} ${originalUrl} ${statusCode} ${duration}ms - IP: ${ip}`);
  });
  next();
}

module.exports = { requestLogger };
