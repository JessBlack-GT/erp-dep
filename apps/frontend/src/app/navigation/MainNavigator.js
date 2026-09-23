import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { LoginScreen } from '../../features/auth/LoginScreen';
import { CustomersScreen } from '../../features/customers/CustomersScreen';
import { CustomerDetailScreen } from '../../features/customers/CustomerDetailScreen';
import { CustomerForm } from '../../features/customers/CustomerForm';
const Stack = createNativeStackNavigator();
// Future modules are not registered until their screens exist.
export function MainNavigator() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return <Stack.Navigator>
    {!isAuthenticated ? <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Iniciar sesión' }} /> : <>
      <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: 'Clientes' }} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Detalle' }} />
      <Stack.Screen name="CustomerForm" component={CustomerForm} options={{ title: 'Cliente' }} />
    </>}
  </Stack.Navigator>;
}
