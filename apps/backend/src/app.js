/**
 * ============================================
 * ERP-SYSTEM - Backend Application
 * ============================================
 * Punto de entrada de la aplicacion Express.
 * Configura la app, middlewares, rutas y manejo de errores.
 * ============================================
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const routes = require('./routes');
const { connectDB } = require('./config/database');
const { corsOptions } = require('./config/cors');

dotenv.config();

const app = express();

// ============================================
// Middlewares globales
// ============================================

// Seguridad HTTP
app.use(helmet());

// CORS
app.use(cors(corsOptions));

// Parser de body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}
app.use(requestLogger);

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Intente mas tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ============================================
// Conexion a Base de Datos
// ============================================
connectDB().catch((err) => {
  console.error('Error critico: No se pudo conectar a MongoDB Atlas');
  console.error('Detalle:', err.message);
  process.exit(1);
});

// ============================================
// Rutas
// ============================================
app.use('/api/v1', routes);

// ============================================
// Route no encontrada
// ============================================
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
  });
});

// ============================================
// Manejo centralizado de errores
// ============================================
app.use(errorHandler);

module.exports = app;
