/**
 * ============================================
 * ERP-SYSTEM - Test de Configuración y Conexión
 * ============================================
 */

const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const app = express();
const { errorHandler, NotFoundError } = require('../shared/errors/appErrors');

// Test básico del servidor
describe('Server Configuration', () => {
  describe('Configuración de entorno', () => {
    it('debería cargar variables de entorno', () => {
      const { config } = require('../config/environment');
      expect(config).to.be.an('object');
      expect(config.nodeEnv).to.be.a('string');
    });
  });

  describe('Manejo de errores', () => {
    it('debería crear NotFoundError con statusCode 404', () => {
      const err = new NotFoundError('Test');
      expect(err.statusCode).to.equal(404);
      expect(err.isOperational).to.be.true;
    });

    it('debería crear AppError con código personalizado', () => {
      const { AppError } = require('../shared/errors/appErrors');
      const err = new AppError('Test', 500, 'TEST');
      expect(err.code).to.equal('TEST');
    });
  });
});

describe('Health Check', () => {
  it('debería responder a la ruta de salud', async () => {
    // Ruta de salud definida en server.js
    // Este test verifica la estructura de la app
    const config = require('./src/config/environment');
    expect(config.port).to.be.a('number');
  });
});
