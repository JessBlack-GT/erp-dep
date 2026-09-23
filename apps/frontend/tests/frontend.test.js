/**
 * ============================================
 * ERP-SYSTEM - Tests del Frontend
 * ============================================
 */

import { expect } from '@jest/globals';

describe('Frontend Utilities', () => {
  describe('formatDate', () => {
    it('debería formatear una fecha correctamente', () => {
      const result = require('../src/utils').formatDate('2024-01-15');
      expect(result).toBe('15/01/2024');
    });
  });

  describe('isValidEmail', () => {
    it('debería validar un email correcto', () => {
      const { isValidEmail } = require('../src/utils');
      expect(isValidEmail('test@example.com')).toBe(true);
    });
    it('debería rechazar un email inválido', () => {
      const { isValidEmail } = require('../src/utils');
      expect(isValidEmail('invalid')).toBe(false);
    });
  });

  describe('formatCurrency', () => {
    it('debería formatear una moneda', () => {
      const { formatCurrency } = require('../src/utils');
      expect(formatCurrency(100)).toBe('100.00 PEN');
    });
  });

  describe('truncate', () => {
    it('debería truncar texto largo', () => {
      const { truncate } = require('../src/utils');
      expect(truncate('Este es un texto muy largo', 10)).toBe('Este es un...');
    });
    it('debería retornar texto corto sin modificarlo', () => {
      const { truncate } = require('../src/utils');
      expect(truncate('Corto', 10)).toBe('Corto');
    });
  });
});

describe('Frontend - Estructura', () => {
  it('debería tener la estructura de utils preparada', () => {
    const utils = require('../src/utils');
    expect(utils.formatDate).toBeDefined();
    expect(utils.isValidEmail).toBeDefined();
  });
});
