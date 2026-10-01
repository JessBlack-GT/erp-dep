/**
 * ============================================
 * ERP-SYSTEM - Punto de Entrada de la Aplicación
 * ============================================
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ApiProvider } from '../context/ApiContext';
import { MainNavigator } from './navigation/MainNavigator';

export const linking = {
  prefixes: ['https://erp-dep.pages.dev'],
  config: {
    screens: {
      Login: 'login',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      Customers: 'Customers',
      CustomerDetail: 'CustomerDetail',
      CustomerForm: 'CustomerForm',
      Suppliers: 'Suppliers',
      SupplierDetail: 'SupplierDetail',
      SupplierForm: 'SupplierForm',
      Products: 'Products',
      ProductDetail: 'ProductDetail',
      ProductForm: 'ProductForm',
      Inventory: 'Inventory',
      InventoryMovementForm: 'InventoryMovementForm',
      WarehouseForm: 'WarehouseForm',
      Users: 'Users',
      UserDetail: 'UserDetail',
      UserForm: 'UserForm',
      Roles: 'Roles',
      Password: 'Password',
    },
  },
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ApiProvider>
          <NavigationContainer linking={linking}>
            <MainNavigator />
          </NavigationContainer>
        </ApiProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
