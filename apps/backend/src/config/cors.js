/**
 * ============================================
 * ERP-SYSTEM - Configuracion de CORS
 * ============================================
 * Configuracion segura de Cross-Origin Resource Sharing.
 * ============================================
 */

const { config } = require('./environment');

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como mobile apps o curl)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = [
      config.corsOrigin,
      config.corsOriginFrontend,
      'http://localhost:3000',
      'http://localhost:8081',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8081',
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 200,
};

module.exports = {
  corsOptions,
};
