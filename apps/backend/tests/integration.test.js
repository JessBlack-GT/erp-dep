/**
 * ============================================
 * ERP-SYSTEM - Test de Integración de Módulos
 * ============================================
 */

const { expect } = require('chai');

describe('Module Structure', () => {
  it('debería tener la estructura de módulos auth', () => {
    const authRoutes = require('../src/modules/auth/auth.routes');
    const authService = require('../src/modules/auth/auth.service');
    const authController = require('../src/modules/auth/auth.controller');
    expect(authRoutes).to.be.an('object');
    expect(authService).to.be.an('object');
    expect(authController).to.be.an('object');
  });

  it('debería tener la estructura de módulos users', () => {
    const usersRoutes = require('../src/modules/users/users.routes');
    const userService = require('../src/modules/users/users.service');
    const userController = require('../src/modules/users/users.controller');
    expect(usersRoutes).to.be.an('object');
    expect(userService).to.be.an('object');
    expect(userController).to.be.an('object');
  });

  it('debería tener la estructura de módulos roles', () => {
    const roleRoutes = require('../src/modules/roles/roles.routes');
    const roleService = require('../src/modules/roles/roles.repository');
    expect(roleRoutes).to.be.an('object');
    expect(roleService).to.be.an('object');
  });
});

describe('Shared Modules', () => {
  it('debería tener constantes de la aplicación', () => {
    const constants = require('../src/shared/constants/appConstants');
    expect(constants.ROLES).to.be.an('object');
    expect(constants.MODULES).to.be.an('object');
  });

  it('debería tener validadores', () => {
    const validators = require('../src/shared/validators/validators');
    expect(validators.validateEmail).to.be.a('function');
    expect(validators.validateRequired).to.be.a('function');
    expect(validators.validateObjectId).to.be.a('function');
  });

  it('debería tener errores personalizados', () => {
    const errors = require('../src/shared/errors/appErrors');
    expect(errors.NotFoundError).to.be.a('function');
    expect(errors.UnauthorizedError).to.be.a('function');
    expect(errors.ForbiddenError).to.be.a('function');
    expect(errors.ConflictError).to.be.a('function');
  });

  it('debería tener logger', () => {
    const { logger } = require('../src/shared/utils/logger');
    expect(logger.info).to.be.a('function');
    expect(logger.error).to.be.a('function');
    expect(logger.warn).to.be.a('function');
  });
});
