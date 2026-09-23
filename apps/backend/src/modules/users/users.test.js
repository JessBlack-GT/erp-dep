/**
 * ============================================
 * ERP-SYSTEM - Test de Usuarios
 * ============================================
 */

const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const app = express();

describe('User Module', () => {
  describe('Validation', () => {
    it('debería validar que el email es requerido', () => {
      const { validateEmail } = require('../../shared/validators/validators');
      const result = validateEmail('invalid-email');
      expect(result.valid).to.be.false;
    });

    it('debería validar un email correcto', () => {
      const { validateEmail } = require('../../shared/validators/validators');
      const result = validateEmail('test@example.com');
      expect(result.valid).to.be.true;
    });

    it('debería validar que un campo requerido no esté vacío', () => {
      const { validateRequired } = require('../../shared/validators/validators');
      const result = validateRequired('', 'campo');
      expect(result.valid).to.be.false;
    });

    it('debería aceptar un campo requerido no vacío', () => {
      const { validateRequired } = require('../../shared/validators/validators');
      const result = validateRequired('valor', 'campo');
      expect(result.valid).to.be.true;
    });
  });

  describe('Errores', () => {
    it('debería crear un NotFoundError con el mensaje correcto', () => {
      const { NotFoundError } = require('../../shared/errors/appErrors');
      const error = new NotFoundError('Usuario no encontrado', 'User');
      expect(error.statusCode).to.equal(404);
      expect(error.code).to.equal('NOT_FOUND');
    });

    it('debería crear un UnauthorizedError', () => {
      const { UnauthorizedError } = require('../../shared/errors/appErrors');
      const error = new UnauthorizedError();
      expect(error.statusCode).to.equal(401);
    });

    it('debería crear un ForbiddenError', () => {
      const { ForbiddenError } = require('../../shared/errors/appErrors');
      const error = new ForbiddenError();
      expect(error.statusCode).to.equal(403);
    });
  });
});
