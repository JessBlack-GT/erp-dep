/**
 * ============================================
 * ERP-SYSTEM - Test de Autenticación
 * ============================================
 */

const { expect } = require('chai');
const { validateEmail, validateRequired } = require('../../shared/validators/validators');

describe('Auth Module', () => {
  describe('Validación de Email', () => {
    it('debería validar email válido', () => {
      expect(validateEmail('user@example.com').valid).to.be.true;
    });
    it('debería rechazar email inválido', () => {
      expect(validateEmail('invalid').valid).to.be.false;
    });
    it('debería rechazar string vacío', () => {
      expect(validateRequired('', 'email').valid).to.be.false;
    });
  });

  describe('Errores personalizados', () => {
    it('debería crear NotFoundError con statusCode 404', () => {
      const { NotFoundError } = require('../../shared/errors/appErrors');
      const err = new NotFoundError('No encontrado');
      expect(err.statusCode).to.equal(404);
    });
    it('debería crear ConflictError con statusCode 409', () => {
      const { ConflictError } = require('../../shared/errors/appErrors');
      const err = new ConflictError('Ya existe');
      expect(err.statusCode).to.equal(409);
    });
  });
});
