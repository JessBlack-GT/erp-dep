/**
 * ============================================
 * ERP-SYSTEM - Navegación de Módulos
 * ============================================
 */

// Este archivo define las rutas y navegación entre módulos funcionales.
// Cada módulo tiene su propia navegación anidada.
// Otras IAs pueden agregar nuevas pantallas aquí sin modificar la estructura principal.

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Tab = createBottomTabNavigator();

// TODO: Importar pantallas de módulos
// import DashboardScreen from '../../features/dashboard/DashboardScreen';
// import CustomersScreen from '../../features/customers/CustomersScreen';
// import ProductsScreen from '../../features/products/ProductsScreen';
// import SalesScreen from '../../features/sales/SalesScreen';
// import ReportsScreen from '../../features/reports/ReportsScreen';

export function MainTabNavigator() {
  // TODO: Implementar navegación con pestañas
  return null;
}

/**
 * Configuración de navegación por defecto
 */
export const defaultNavigationOptions = {
  headerStyle: {
    backgroundColor: '#1976D2',
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTintColor: '#fff',
  headerTitleStyle: {
    fontWeight: '600',
  },
};
