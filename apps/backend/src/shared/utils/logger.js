/**
 * ============================================
 * ERP-SYSTEM - Logger Centralizado
 * ============================================
 * Utilidad de logging para todo el sistema.
 * ============================================
 */

const config = require('../config/environment');

const LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};

function formatMessage(level, message, meta = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
}

const logger = {
  error(message, meta = {}) {
    console.error(JSON.stringify(formatMessage(LEVELS.ERROR, message, meta)));
  },
  warn(message, meta = {}) {
    console.warn(JSON.stringify(formatMessage(LEVELS.WARN, message, meta)));
  },
  info(message, meta = {}) {
    console.log(JSON.stringify(formatMessage(LEVELS.INFO, message, meta)));
  },
  debug(message, meta = {}) {
    if (config.nodeEnv !== 'production') {
      console.log(JSON.stringify(formatMessage(LEVELS.DEBUG, message, meta)));
    }
  },
};

module.exports = { logger };
