import React from 'react';
import { InventoryScreen, InventoryMovementForm, WarehouseForm } from '../../features/inventory';
import {ProductsScreen, ProductDetailScreen, ProductForm} from '../../features/products';
import { View, Button } from 'react-native';
import { SuppliersScreen, SupplierDetailScreen, SupplierForm } from '../../features/suppliers';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { LoginScreen } from '../../features/auth/LoginScreen';
import { CustomersScreen } from '../../features/customers/CustomersScreen';
import { CustomerDetailScreen } from '../../features/customers/CustomerDetailScreen';
import { CustomerForm } from '../../features/customers/CustomerForm';
const Stack = createNativeStackNavigator();
// Future modules are not registered until their screens exist.
export function MainNavigator() {
  const { isAuthenticated, loading, logout } = useAuth();
  if (loading) return null;
  return <Stack.Navigator screenOptions={({ navigation }) => ({ headerRight: () => isAuthenticated ? <View style={{flexDirection:'row',gap:8}}><Button title="Clientes" onPress={() => navigation.navigate('Customers')} /><Button title="Proveedores" onPress={() => navigation.navigate('Suppliers')} /><Button title="Catálogo" onPress={() => navigation.navigate('Products')} /><Button title="Inventario" onPress={() => navigation.navigate('Inventory')} /><Button title="Cerrar sesión" onPress={() => logout().catch(() => {})} /></View> : null })}>
    {!isAuthenticated ? <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Iniciar sesión' }} /> : <>
      <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: 'Clientes' }} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Detalle' }} />
      <Stack.Screen name="CustomerForm" component={CustomerForm} options={{ title: 'Cliente' }} />
      <Stack.Screen name="Suppliers" component={SuppliersScreen} options={{ title: 'Proveedores' }} />
      <Stack.Screen name="SupplierDetail" component={SupplierDetailScreen} options={{ title: 'Proveedor' }} />
      <Stack.Screen name="SupplierForm" component={SupplierForm} options={{ title: 'Proveedor' }} />
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{title: 'Inventario'}} />
      <Stack.Screen name="InventoryMovementForm" component={InventoryMovementForm} options={{title: 'Movimiento de inventario'}} />
      <Stack.Screen name="WarehouseForm" component={WarehouseForm} options={{title: 'Almacén'}} />
      <Stack.Screen name="Products" component={ProductsScreen} options={{title: "Productos y servicios"}} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{title: "Elemento"}} />
      <Stack.Screen name="ProductForm" component={ProductForm} options={{title: "Elemento"}} />
    </>}
  </Stack.Navigator>;
}
