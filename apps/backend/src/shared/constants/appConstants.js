/**
 * ============================================
 * ERP-SYSTEM - Constantes de la Aplicación
 * ============================================
 * ============================================
 */

module.exports = {
  // Versiones
  API_VERSION: 'v1',
  APP_NAME: 'ERP-SYSTEM',
  APP_VERSION: '1.0.0',

  // Roles de usuario
  ROLES: {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    MANAGER: 'manager',
    USER: 'user',
    VIEWER: 'viewer',
  },

  // Módulos del sistema
  MODULES: {
    AUTH: 'M01',
    DASHBOARD: 'M02',
    CUSTOMERS: 'M03',
    SUPPLIERS: 'M04',
    PRODUCTS: 'M05',
    INVENTORY: 'M06',
    SALES: 'M07',
    PURCHASES: 'M08',
    FINANCE: 'M09',
    HUMAN_RESOURCES: 'M10',
    REPORTS: 'M11',
    NOTIFICATIONS: 'M12',
    AUDIT: 'M13',
    SETTINGS: 'M14',
    AI: 'M15',
    INTEGRATIONS: 'M16',
  },

  // Estados genéricos
  STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING: 'pending',
    ARCHIVED: 'archived',
    DELETED: 'deleted',
  },

  // Tipos de documentos
  DOCUMENT_TYPES: {
    INVOICE: 'invoice',
    RECEIPT: 'receipt',
    PURCHASE_ORDER: 'purchase_order',
    QUOTATION: 'quotation',
  },

  // Paginación por defecto
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
};
