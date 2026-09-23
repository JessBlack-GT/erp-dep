/**
 * ============================================
 * ERP-SYSTEM - Constantes del Frontend
 * ============================================
 */

export const APP_NAME = 'ERP-SYSTEM';
export const APP_VERSION = '1.0.0';
export const API_BASE_URL = '/api/v1';
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
};

export const ROUTES = {
  LOGIN: 'Login',
  REGISTER: 'Register',
  DASHBOARD: 'Dashboard',
  CUSTOMERS: 'Customers',
  SUPPLIERS: 'Suppliers',
  PRODUCTS: 'Products',
  INVENTORY: 'Inventory',
  SALES: 'Sales',
  PURCHASES: 'Purchases',
  FINANCE: 'Finance',
  REPORTS: 'Reports',
  SETTINGS: 'Settings',
};

export const STATUS_TYPES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
};

export const PAGE_SIZES = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;
