/**
 * ============================================
 * ERP-SYSTEM - Servidor principal
 * ============================================
 * Inicia el servidor Express y gestiona la conexion a MongoDB.
 * ============================================
 */

const app = require('./app');
const { connectDB } = require('./config/database');
const { logger } = require('./shared/utils/logger');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    // Conectar a MongoDB Atlas
    await connectDB();

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`ERP-SYSTEM Backend ejecutandose en puerto ${PORT}`);
      logger.info(`Entorno: ${NODE_ENV}`);
      logger.info(`API disponible en: http://localhost:${PORT}/api/v1`);
    });

    // Manejo de errores no capturados
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection:', reason);
      server.close(() => process.exit(1));
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      server.close(() => process.exit(1));
    });

    // Cierre graceful
    process.on('SIGTERM', () => {
      logger.info('SIGTERM recibido. Cerrando servidor...');
      server.close(() => {
        logger.info('Servidor cerrado');
        process.exit(0);
      });
    });

    return server;
  } catch (error) {
    logger.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
