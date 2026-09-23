/**
 * ============================================
 * ERP-SYSTEM - Test de Estructura Completa
 * ============================================
 */

const { expect } = require('chai');
const path = require('path');
const fs = require('fs');

describe('ERP-SYSTEM - Estructura del Proyecto', () => {
  const basePath = path.join(__dirname, '..', '..', '..', '..');

  it('debería existir el directorio raíz', () => {
    expect(fs.existsSync(basePath)).to.be.true;
  });

  it('debería existir el directorio apps/frontend', () => {
    expect(fs.existsSync(path.join(basePath, 'apps', 'frontend'))).to.be.true;
  });

  it('debería existir el directorio apps/backend', () => {
    expect(fs.existsSync(path.join(basePath, 'apps', 'backend'))).to.be.true;
  });

  it('debería existir el directorio docs', () => {
    expect(fs.existsSync(path.join(basePath, 'docs'))).to.be.true;
  });

  it('debería existir el directorio scripts', () => {
    expect(fs.existsSync(path.join(basePath, 'scripts'))).to.be.true;
  });
});

describe('ERP-SYSTEM - Backend Modules', () => {
  const modules = ['auth', 'users', 'roles', 'dashboard', 'customers', 'suppliers', 'products', 'inventory', 'sales', 'purchases', 'finance', 'human-resources', 'reports', 'notifications', 'audit', 'settings', 'integrations'];

  modules.forEach((module) => {
    it(`debería tener la estructura del módulo ${module}`, () => {
      const modulePath = path.join(__dirname, '..', 'src', 'modules', module);
      expect(fs.existsSync(modulePath)).to.be.true;
    });
  });
});

describe('ERP-SYSTEM - Configuración de Seguridad', () => {
  it('debería tener el middleware de autenticación', () => {
    const auth = require('../src/middleware/authenticate');
    expect(auth.authenticateToken).toBeDefined();
  });

  it('debería tener el middleware de autorización', () => {
    const authorize = require('../src/middleware/authorize');
    expect(authorize.authorizeRoles).toBeDefined();
  });

  it('debería tener el middleware de validación', () => {
    const validate = require('../src/middleware/validateRequest');
    expect(validate.validateRequest).toBeDefined();
  });

  it('debería tener el manejo de errores', () => {
    const errorHandler = require('../src/middleware/errorHandler');
    expect(errorHandler.errorHandler).toBeDefined();
  });
});
