/**
 * ============================================
 * ERP-SYSTEM - Test de Clientes
 * ============================================
 */

const { expect } = require('chai');
const { validateEmail } = require('../../shared/validators/validators');
const { validateObjectId } = require('../../shared/validators/validators');
const { NotFoundError, ConflictError, ValidationError } = require('../../shared/errors/appErrors');
const { validateFilters } = require('./customers.validation');

describe('Customer Module', () => {
  describe('Validación de Email', () => {
    it('debería validar email válido', () => {
      expect(validateEmail('customer@example.com').valid).to.be.true;
    });
    it('debería rechazar email inválido', () => {
      expect(validateEmail('invalid').valid).to.be.false;
    });
  });

  describe('Validación de ObjectId', () => {
    it('debería validar un ObjectId válido', () => {
      expect(validateObjectId('a'.repeat(24)).valid).to.be.true;
    });
    it('debería rechazar un ID inválido', () => {
      expect(validateObjectId('invalid').valid).to.be.false;
    });
  });

  describe('Errores personalizados', () => {
    it('debería crear NotFoundError con statusCode 404', () => {
      const err = new NotFoundError('Cliente no encontrado');
      expect(err.statusCode).to.equal(404);
      expect(err.code).to.equal('NOT_FOUND');
    });
    it('debería crear ConflictError con statusCode 409', () => {
      const err = new ConflictError('Ya existe');
      expect(err.statusCode).to.equal(409);
    });
    it('debería crear ValidationError con statusCode 400', () => {
      const err = new ValidationError('Error de validación');
      expect(err.statusCode).to.equal(400);
      expect(err.code).to.equal('VALIDATION_ERROR');
    });
  });

  describe('Validación de Filtros', () => {
    it('debería aceptar filtros válidos', () => {
      const result = validateFilters({ page: 1, limit: 20, sortBy: 'name', sortOrder: 'asc' });
      expect(result.valid).to.be.true;
    });
    it('debería rechazar page inválido', () => {
      const result = validateFilters({ page: -1 });
      expect(result.valid).to.be.false;
    });
    it('debería rechazar limit mayor a 100', () => {
      const result = validateFilters({ limit: 200 });
      expect(result.valid).to.be.false;
    });
  });

  describe('Estructura del módulo', () => {
    it('debería tener el controlador de clientes', () => {
      const controller = require('./customers.controller');
      expect(controller.getCustomers).to.be.a('function');
      expect(controller.createCustomer).to.be.a('function');
      expect(controller.getCustomerById).to.be.a('function');
      expect(controller.updateCustomer).to.be.a('function');
      expect(controller.deleteCustomer).to.be.a('function');
    });
  });
});
