/**
 * ============================================
 * ERP-SYSTEM - Servicios del Frontend
 * ============================================
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE_URL = process.env.PUBLIC_API_BASE_URL || (Platform.OS === 'web'
  ? 'http://localhost:3000/api/v1'
  : 'http://10.0.2.2:3000/api/v1');

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
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores de respuesta
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    }
    return Promise.reject(error);
  }
);

// ============================================
// Servicio de Autenticación
// ============================================
export const authService = {
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  register: (data) => apiClient.post('/auth/register', data),
  refreshToken: (refreshToken) => apiClient.post('/auth/refresh', { refreshToken }),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get('/auth/me'),
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
  search: q => apiClient.get('/products/search', {params:{q}}),
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
  update: (id, data) => apiClient.patch(`/sales/${id}`, data),
  delete: (id) => apiClient.delete(`/sales/${id}`),
};

// ============================================
// Servicio de Reportes
// ============================================
export const reportService = {
  getDashboard: () => apiClient.get('/dashboard'),
  generateReport: (type, params) => apiClient.post(`/reports/generate/${type}`, params),
};

export default apiClient;

export const supplierService = {
 getAll: params => apiClient.get('/suppliers', {params}),
 getById: id => apiClient.get('/suppliers/'+id),
 create: data => apiClient.post('/suppliers',data),
 update: (id,data) => apiClient.patch('/suppliers/'+id,data),
 changeStatus: (id,status) => apiClient.patch('/suppliers/'+id+'/status',{status}),
 delete: id => apiClient.delete('/suppliers/'+id),
 search: q => apiClient.get('/suppliers/search',{params:{q}}),
};
