/* eslint-env node, es2020 */
/**
 * ============================================
 * ERP-SYSTEM - Servicios del Frontend
 * ============================================
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionEvents } from './sessionEvents';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.PUBLIC_API_BASE_URL ||
  'https://yj-nexo-api.onrender.com/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // Ignorar si no hay token
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor para manejar errores de respuesta
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
      sessionEvents.emit('invalid');
    }
    if (error.response?.status === 403) sessionEvents.emit('permissions');
    return Promise.reject(error);
  },
);

// ============================================
// Servicio de AutenticaciÃ³n
// ============================================
export const authService = {
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => apiClient.post('/auth/reset-password', { token, password }),
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  register: (data) => apiClient.post('/auth/register', data),
  refreshToken: (refreshToken) => apiClient.post('/auth/refresh', { refreshToken }),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get('/auth/me'),
  changePassword: (data) => apiClient.post('/auth/password', data),
};

// ============================================
// Servicio de Usuarios
// ============================================
export const userService = {
  getAll: (params) => apiClient.get('/users', { params }),
  getById: (id) => apiClient.get(`/users/${id}`),
  create: (data) => apiClient.post('/users', data),
  update: (id, data) => apiClient.patch(`/users/${id}`, data),
  delete: (id) => apiClient.delete(`/users/${id}`),
  getProfile: () => apiClient.get('/users/profile/me'),
  changeStatus: (id, status) => apiClient.patch(`/users/${id}/status`, { status }),
  assignRole: (id, role) => apiClient.patch(`/users/${id}/role`, { role }),
};
export const roleService = {
  getAll: () => apiClient.get('/roles'),
  permissions: () => apiClient.get('/roles/permissions'),
  create: (data) => apiClient.post('/roles', data),
  update: (name, data) => apiClient.patch('/roles/' + encodeURIComponent(name), data),
};

// ============================================
// Servicio de Clientes
// ============================================
export const customerService = {
  getAll: (params) => apiClient.get('/customers', { params }),
  getById: (id) => apiClient.get(`/customers/${id}`),
  create: (data) => apiClient.post('/customers', data),
  update: (id, data) => apiClient.patch(`/customers/${id}`, data),
  delete: (id) => apiClient.delete(`/customers/${id}`),
  changeStatus: (id, status) => apiClient.patch(`/customers/${id}/status`, { status }),
  search: (query) => apiClient.get('/customers/search', { params: { q: query } }),
  getStats: () => apiClient.get('/customers/stats'),
};

// ============================================
// Servicio de Productos
// ============================================
export const productService = {
  getAll: (params) => apiClient.get('/products', { params }),
  getById: (id) => apiClient.get(`/products/${id}`),
  create: (data) => apiClient.post('/products', data),
  update: (id, data) => apiClient.patch(`/products/${id}`, data),
  delete: (id) => apiClient.delete(`/products/${id}`),
  changeStatus: (id, status) => apiClient.patch(`/products/${id}/status`, { status }),
  search: (q) => apiClient.get('/products/search', { params: { q } }),
};

// ============================================
// Servicio de Inventario
// ============================================
export const inventoryService = {
  getWarehouses: (params) => apiClient.get('/inventory/warehouses', { params }),
  getProducts: (params) => apiClient.get('/inventory/products', { params }),
  createWarehouse: (data) => apiClient.post('/inventory/warehouses', data),
  updateWarehouse: (id, data) => apiClient.patch('/inventory/warehouses/' + id, data),
  getByProduct: (id, params) => apiClient.get('/inventory/balances/product/' + id, { params }),
  getBalances: (params) => apiClient.get('/inventory/balances', { params }),
  getMovements: (params) => apiClient.get('/inventory/movements', { params }),
  createMovement: (data) => apiClient.post('/inventory/movements', data),
};

// ============================================
// Servicio de Ventas
// ============================================
export const salesService = {
  getAll: (params) => apiClient.get('/sales', { params }),
  getById: (id) => apiClient.get(`/sales/${id}`),
  create: (data) => apiClient.post('/sales', data),
  update: (id, data) => apiClient.put(`/sales/${id}`, data),
  confirm: (id, data) => apiClient.post(`/sales/${id}/confirm`, data),
  cancel: (id, data) => apiClient.post(`/sales/${id}/cancel`, data),
};

// ============================================
// Servicio de Reportes
// ============================================
const inventoryExportPath = (view, format) =>
  `/reports/inventory/${view}/${format}`;

export const reportService = {
  getDashboard: () => apiClient.get('/dashboard'),
  generateReport: (type, params) => apiClient.post(`/reports/generate/${type}`, params),
  exportSales: (format, params) =>
    apiClient.get(`/reports/sales/${format}`, { params, responseType: 'blob' }),
  exportInventory: (view, format, params) =>
    apiClient.get(inventoryExportPath(view, format), {
      params,
      responseType: 'blob',
    }),
  getInventoryExportRequest: async (view, format, params) => {
    const token = await AsyncStorage.getItem('accessToken');
    const config = {
      url: inventoryExportPath(view, format),
      params,
    };
    return {
      url: apiClient.getUri(config),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    };
  },
};

export default apiClient;

export const supplierService = {
  getAll: (params) => apiClient.get('/suppliers', { params }),
  getById: (id) => apiClient.get('/suppliers/' + id),
  create: (data) => apiClient.post('/suppliers', data),
  update: (id, data) => apiClient.patch('/suppliers/' + id, data),
  changeStatus: (id, status) => apiClient.patch('/suppliers/' + id + '/status', { status }),
  delete: (id) => apiClient.delete('/suppliers/' + id),
  search: (q) => apiClient.get('/suppliers/search', { params: { q } }),
};
