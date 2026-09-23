/**
 * ============================================
 * ERP-SYSTEM - Test del Servidor
 * ============================================
 */

const { expect } = require('chai');

describe('Server Module', () => {
  it('debería existir el módulo de configuración de entorno', () => {
    const env = require('../src/config/environment');
    expect(env).to.be.an('object');
  });

  it('debería tener la función getConfig', () => {
    const env = require('../src/config/environment');
    expect(env.getConfig).to.be.a('function');
  });
});
