import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { WebAppShell } from '../../components/layout/WebAppShell';
import { LoginScreen } from '../../features/auth/LoginScreen';
import { CustomersScreen, CustomerDetailScreen, CustomerForm } from '../../features/customers';
import { SuppliersScreen, SupplierDetailScreen, SupplierForm } from '../../features/suppliers';
import { ProductsScreen, ProductDetailScreen, ProductForm } from '../../features/products';
import { InventoryScreen, InventoryMovementForm, WarehouseForm } from '../../features/inventory';
import { UsersScreen, UserForm, UserDetail, PasswordScreen } from '../../features/users';
import { RolesScreen } from '../../features/roles';
import { usePermissions } from '../../hooks/usePermissions';

const Stack = createNativeStackNavigator();

function createShellScreen(ScreenComponent, activeRoute, title) {
  return function ShellWrappedScreen(props) {
    return (
      <WebAppShell
        activeRoute={activeRoute}
        title={title}
        onSelectRoute={(route) => props.navigation.navigate(route)}
      >
        <ScreenComponent {...props} />
      </WebAppShell>
    );
  };
}

// Shell-wrapped screen components
const CustomersWithShell = createShellScreen(CustomersScreen, 'Customers', 'Clientes');
const CustomerDetailWithShell = createShellScreen(
  CustomerDetailScreen,
  'Customers',
  'Detalle de Cliente',
);
const CustomerFormWithShell = createShellScreen(CustomerForm, 'Customers', 'Gestión de Cliente');

const SuppliersWithShell = createShellScreen(SuppliersScreen, 'Suppliers', 'Proveedores');
const SupplierDetailWithShell = createShellScreen(
  SupplierDetailScreen,
  'Suppliers',
  'Detalle de Proveedor',
);
const SupplierFormWithShell = createShellScreen(SupplierForm, 'Suppliers', 'Gestión de Proveedor');

const ProductsWithShell = createShellScreen(ProductsScreen, 'Products', 'Productos y Servicios');
const ProductDetailWithShell = createShellScreen(
  ProductDetailScreen,
  'Products',
  'Detalle de Producto',
);
const ProductFormWithShell = createShellScreen(ProductForm, 'Products', 'Gestión de Producto');

const InventoryWithShell = createShellScreen(InventoryScreen, 'Inventory', 'Inventario');
const InventoryMovementFormWithShell = createShellScreen(
  InventoryMovementForm,
  'Inventory',
  'Movimiento de Inventario',
);
const WarehouseFormWithShell = createShellScreen(WarehouseForm, 'Inventory', 'Gestión de Almacén');
const UsersWithShell = createShellScreen(UsersScreen, 'Users', 'Usuarios');
const UserDetailWithShell = createShellScreen(UserDetail, 'Users', 'Detalle de usuario');
const UserFormWithShell = createShellScreen(UserForm, 'Users', 'Administrar usuario');
const RolesWithShell = createShellScreen(RolesScreen, 'Roles', 'Roles y permisos');
const PasswordWithShell = createShellScreen(PasswordScreen, 'Password', 'Seguridad de mi cuenta');

export function MainNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const can = usePermissions();

  if (loading) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Iniciar sesión' }} />
      ) : (
        <>
          <Stack.Screen
            name="Customers"
            component={CustomersWithShell}
            options={{ title: 'Clientes' }}
          />
          <Stack.Screen
            name="CustomerDetail"
            component={CustomerDetailWithShell}
            options={{ title: 'Detalle' }}
          />
          <Stack.Screen
            name="CustomerForm"
            component={CustomerFormWithShell}
            options={{ title: 'Cliente' }}
          />

          <Stack.Screen
            name="Suppliers"
            component={SuppliersWithShell}
            options={{ title: 'Proveedores' }}
          />
          <Stack.Screen
            name="SupplierDetail"
            component={SupplierDetailWithShell}
            options={{ title: 'Proveedor' }}
          />
          <Stack.Screen
            name="SupplierForm"
            component={SupplierFormWithShell}
            options={{ title: 'Proveedor' }}
          />

          <Stack.Screen
            name="Products"
            component={ProductsWithShell}
            options={{ title: 'Productos y servicios' }}
          />
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailWithShell}
            options={{ title: 'Elemento' }}
          />
          <Stack.Screen
            name="ProductForm"
            component={ProductFormWithShell}
            options={{ title: 'Elemento' }}
          />

          <Stack.Screen
            name="Inventory"
            component={InventoryWithShell}
            options={{ title: 'Inventario' }}
          />
          <Stack.Screen
            name="InventoryMovementForm"
            component={InventoryMovementFormWithShell}
            options={{ title: 'Movimiento de inventario' }}
          />
          <Stack.Screen
            name="WarehouseForm"
            component={WarehouseFormWithShell}
            options={{ title: 'Almacén' }}
          />
          {can('users.read') && <Stack.Screen name="Users" component={UsersWithShell} />}
          {can('users.read') && <Stack.Screen name="UserDetail" component={UserDetailWithShell} />}
          {(can('users.create') || can('users.update')) && (
            <Stack.Screen name="UserForm" component={UserFormWithShell} />
          )}
          {can('roles.read') && <Stack.Screen name="Roles" component={RolesWithShell} />}
          <Stack.Screen name="Password" component={PasswordWithShell} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default MainNavigator;
