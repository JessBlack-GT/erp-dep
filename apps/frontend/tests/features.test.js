/**
 * ============================================
 * ERP-SYSTEM - Tests del Frontend - Features
 * ============================================
 */

import { expect } from '@jest/globals';

describe('Frontend Features', () => {
  const features = ['auth', 'dashboard', 'customers', 'suppliers', 'products', 'inventory', 'sales', 'purchases', 'finance', 'human-resources', 'reports', 'notifications', 'settings'];

  features.forEach((feature) => {
    it(`debería tener la estructura de feature "${feature}" preparada`, () => {
      const featureModule = require(`../src/features/${feature}`);
      expect(featureModule).toBeDefined();
    });
  });
});
