/**
 * ============================================
 * ERP-SYSTEM - Tests del Frontend - API Client
 * ============================================
 */

import { expect } from '@jest/globals';

describe('API Service Client', () => {
  it('debería tener los servicios API definidos', () => {
    const services = require('../src/services');
    expect(services).toBeDefined();
    expect(services.authService).toBeDefined();
    expect(services.userService).toBeDefined();
    expect(services.customerService).toBeDefined();
  });
});

describe('API Client Configuration', () => {
  it('debería tener la URL base configurada', () => {
    const apiClient = require('../src/services/api');
    expect(apiClient.defaults?.baseURL).toBeDefined();
  });
});
