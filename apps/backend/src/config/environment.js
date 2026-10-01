/**
 * ============================================
 * ERP-SYSTEM - Configuracion de Entorno
 * ============================================
 * Lee y valida las variables de entorno.
 * ============================================
 */

const dotenv = require('dotenv');
const { logger } = require('../shared/utils/logger');

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

// Render terminates public requests at its reverse proxy. Direct local traffic trusts none.
const proxyHops = process.env.TRUST_PROXY_HOPS ?? (process.env.RENDER === 'true' ? '1' : '0');
if (!/^[0-5]$/.test(proxyHops)) {
  throw new Error('TRUST_PROXY_HOPS debe ser un entero entre 0 y 5');
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  trustProxyHops: Number(proxyHops),

  // MongoDB
  mongodbUri: process.env.MONGODB_URI,
  mongodbDbName: process.env.MONGODB_DB_NAME || undefined,

  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Seguridad
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  corsOriginFrontend: process.env.CORS_ORIGIN_FRONTEND || 'http://localhost:8081',

  // Rate Limiting
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,

  // Email (opcional)
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM,
  frontendAppUrl: process.env.FRONTEND_APP_URL || 'https://erp-dep.pages.dev',
  passwordResetTokenTtlMinutes:
    process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES === undefined
      ? 15
      : Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES),
  emailHost: process.env.EMAIL_HOST,
  emailPort: parseInt(process.env.EMAIL_PORT) || 587,
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,

  // Empresa
  companyName: process.env.COMPANY_NAME || 'ERP-SYSTEM',
  companyUrl: process.env.COMPANY_URL || 'https://erp-system.local',
};

// Validacion de configuracion critica
const requiredFields = ['mongodbUri', 'jwtSecret', 'jwtRefreshSecret'];
const missingFields = requiredFields.filter((field) => !config[field]);

if (missingFields.length > 0 && config.nodeEnv !== 'test') {
  logger.error(`Campos de entorno requeridos faltantes: ${missingFields.join(', ')}`);
  logger.error('Copie .env.example a .env y configure los valores requeridos');

  if (config.nodeEnv === 'production') {
    logger.error('No se puede iniciar en produccion sin los campos requeridos');
    process.exit(1);
  }
}

/**
 * Obtiene la configuracion completa
 * @returns {Object} Configuracion del entorno
 */
function getConfig() {
  return { ...config };
}

/**
 * Obtiene una configuracion especifica
 * @param {string} key - Nombre de la configuracion
 * @returns {*} Valor de la configuracion
 */
function getConfigValue(key) {
  return config[key];
}

module.exports = {
  config,
  getConfig,
  getConfigValue,
};
