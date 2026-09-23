/**
 * ============================================
 * ERP-SYSTEM - Navegación Principal (Actualizada)
 * ============================================
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { CustomersScreen } from '../../features/customers/CustomersScreen';
import { CustomerDetailScreen } from '../../features/customers/CustomerDetailScreen';
import { CustomerForm } from '../../features/customers/CustomerForm';

// Pantallas de autenticación
const LoginScreen = React.lazy(() => import('../../features/auth/LoginScreen'));
const RegisterScreen = React.lazy(() => import('../../features/auth/RegisterScreen'));

// Pantallas principales (requieren autenticación)
const DashboardScreen = React.lazy(() => import('../../features/dashboard/DashboardScreen'));
const SuppliersScreen = React.lazy(() => import('../../features/suppliers/SuppliersScreen'));
const ProductsScreen = React.lazy(() => import('../../features/products/ProductsScreen'));
const InventoryScreen = React.lazy(() => import('../../features/inventory/InventoryScreen'));
const SalesScreen = React.lazy(() => import('../../features/sales/SalesScreen'));
const PurchasesScreen = React.lazy(() => import('../../features/purchases/PurchasesScreen'));
const FinanceScreen = React.lazy(() => import('../../features/finance/FinanceScreen'));
const ReportsScreen = React.lazy(() => import('../../features/reports/ReportsScreen'));
const SettingsScreen = React.lazy(() => import('../../features/settings/SettingsScreen'));

const Stack = createNativeStackNavigator();

/**
 * Navegador principal de la aplicación
 */
export function MainNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Stack.Navigator>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
          
          {/* Módulo Clientes */}
          <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: 'Clientes' }} />
          <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Detalle' }} />
          <Stack.Screen name="CustomerForm" component={CustomerForm} options={{ title: 'Nuevo Cliente' }} />
          
          <Stack.Screen name="Suppliers" component={SuppliersScreen} />
          <Stack.Screen name="Products" component={ProductsScreen} />
          <Stack.Screen name="Inventory" component={InventoryScreen} />
          <Stack.Screen name="Sales" component={SalesScreen} />
          <Stack.Screen name="Purchases" component={PurchasesScreen} />
          <Stack.Screen name="Finance" component={FinanceScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
