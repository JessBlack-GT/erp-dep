/**
 * ============================================
 * ERP-SYSTEM - Configuracion de MongoDB Atlas
 * ============================================
 * Conexion centralizada a MongoDB Atlas usando Mongoose.
 * Las credenciales se leen desde variables de entorno.
 * ============================================
 */

const mongoose = require('mongoose');
const { logger } = require('../shared/utils/logger');
const { config } = require('./environment');

const MONGODB_URI = config.mongodbUri;
const MONGODB_DB_NAME = config.mongodbDbName;

if (!MONGODB_URI) {
  logger.error('MONGODB_URI no esta definida en las variables de entorno');
  logger.error('Copie .env.example a .env y configure sus credenciales');
}

const dbOptions = {
  dbName: MONGODB_DB_NAME,
  maxPoolSize: 50,
  minPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  w: 'majority',
};

/**
 * Conecta a MongoDB Atlas
 * @returns {Promise<mongoose.Connection>}
 */
async function connectDB() {
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI no configurada. Verifique el archivo .env');
    }

    const connection = await mongoose.connect(MONGODB_URI, dbOptions);
    logger.info('MongoDB connection: SUCCESS');

    // Monitoreo de eventos de conexion
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB Atlas desconectado. Reconectando...');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Error de conexion MongoDB');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB Atlas reconectado');
    });

    return connection;
  } catch (error) {
    logger.error('MongoDB connection: FAILED');
    throw error;
  }
}

/**
 * Cierra la conexion a MongoDB
 * @returns {Promise<void>}
 */
async function closeDB() {
  try {
    await mongoose.connection.close();
    logger.info('Conexion a MongoDB Atlas cerrada');
  } catch (error) {
    logger.error('Error al cerrar la conexion');
    throw error;
  }
}

/**
 * Obtiene la conexion actual de Mongoose
 * @returns {mongoose.Connection}
 */
function getDB() {
  return mongoose.connection;
}

module.exports = {
  connectDB,
  closeDB,
  getDB,
  MONGODB_URI,
  MONGODB_DB_NAME,
};
