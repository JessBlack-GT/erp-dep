/**
 * ============================================
 * YJ NEXO ERP - Web App Shell Unit Tests (UI-03)
 * ============================================
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useAuth } from '../src/context/AuthContext';
import { usePermissions } from '../src/hooks/usePermissions';
import {
  WebAppShell,
  Sidebar,
  Topbar,
  UserMenu,
  Breadcrumbs,
  PageContainer,
} from '../src/components/layout';
import { Text } from '../src/components/common/Text';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../src/hooks/usePermissions', () => ({
  usePermissions: jest.fn(),
}));

describe('YJ Nexo UI-03 Web App Shell Suite', () => {
  const mockLogout = jest.fn().mockResolvedValue(true);

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: { name: 'Admin Test', email: 'admin@yjnexo.com', role: 'admin' },
      isAuthenticated: true,
      logout: mockLogout,
    });
    // Grant all permissions by default
    usePermissions.mockReturnValue(() => true);
  });

  // 1. WEB APP SHELL RENDER
  test('renders WebAppShell with topbar and page content', () => {
    const { getByText, getByTestId } = render(
      <WebAppShell activeRoute="Customers" title="Clientes">
        <Text>Contenido de Clientes</Text>
      </WebAppShell>
    );

    expect(getByText('Clientes')).toBeTruthy();
    expect(getByText('Contenido de Clientes')).toBeTruthy();
    expect(getByTestId('topbar-container')).toBeTruthy();
  });

  // 2. SIDEBAR & RBAC FILTERING
  test('filters sidebar navigation links based on RBAC permissions', () => {
    // Only allow customers.read and products.read
    usePermissions.mockReturnValue(perm =>
      ['customers.read', 'products.read'].includes(perm)
    );

    const { getByTestId, queryByTestId } = render(
      <Sidebar activeRoute="Customers" onSelectRoute={jest.fn()} />
    );

    expect(getByTestId('nav-item-Customers')).toBeTruthy();
    expect(getByTestId('nav-item-Products')).toBeTruthy();
    expect(queryByTestId('nav-item-Suppliers')).toBeNull();
    expect(queryByTestId('nav-item-Inventory')).toBeNull();
  });

  test('handles sidebar route selection callback', () => {
    const onSelectMock = jest.fn();
    const { getByTestId } = render(
      <Sidebar activeRoute="Customers" onSelectRoute={onSelectMock} />
    );

    fireEvent.press(getByTestId('nav-item-Suppliers'));
    expect(onSelectMock).toHaveBeenCalledWith('Suppliers');
  });

  test('supports sidebar collapsed mode', () => {
    const { getByTestId, queryByText } = render(
      <Sidebar activeRoute="Customers" collapsed={true} />
    );

    expect(getByTestId('sidebar-container')).toBeTruthy();
    // In collapsed mode, labels are hidden
    expect(queryByText('Clientes')).toBeNull();
  });

  // 3. TOPBAR & USER MENU
  test('renders Topbar with title, toggle, and UserMenu trigger', () => {
    const onToggleMock = jest.fn();
    const { getByTestId, getByText } = render(
      <Topbar title="Inventario" onToggleSidebar={onToggleMock} />
    );

    expect(getByText('Inventario')).toBeTruthy();
    const toggleBtn = getByTestId('sidebar-toggle-btn');
    fireEvent.press(toggleBtn);
    expect(onToggleMock).toHaveBeenCalledTimes(1);
  });

  test('renders UserMenu with user details and handles logout', async () => {
    const { getByTestId, getByText } = render(<UserMenu />);

    expect(getByText('Admin Test')).toBeTruthy();
    const trigger = getByTestId('user-menu-trigger');
    fireEvent.press(trigger);

    // Dropdown modal becomes visible
    expect(getByTestId('user-menu-dropdown')).toBeTruthy();
    expect(getByText('admin@yjnexo.com')).toBeTruthy();

    const logoutBtn = getByTestId('user-menu-logout-btn');
    fireEvent.press(logoutBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  // 4. BREADCRUMBS
  test('renders Breadcrumbs and supports navigation click', () => {
    const onNavMock = jest.fn();
    const items = [
      { label: 'Inicio', route: 'Dashboard' },
      { label: 'Clientes', route: 'Customers' },
      { label: 'Detalle' },
    ];

    const { getByText } = render(
      <Breadcrumbs items={items} onNavigate={onNavMock} />
    );

    expect(getByText('Inicio')).toBeTruthy();
    expect(getByText('Clientes')).toBeTruthy();
    expect(getByText('Detalle')).toBeTruthy();

    fireEvent.press(getByText('Inicio'));
    expect(onNavMock).toHaveBeenCalledWith('Dashboard');
  });

  // 5. PAGE CONTAINER
  test('renders PageContainer with scrollable and non-scrollable variants', () => {
    const { getByText, getByTestId, rerender } = render(
      <PageContainer scrollable={true}>
        <Text>Contenido Scrolleable</Text>
      </PageContainer>
    );

    expect(getByText('Contenido Scrolleable')).toBeTruthy();
    expect(getByTestId('page-container-scroll')).toBeTruthy();

    rerender(
      <PageContainer scrollable={false}>
        <Text>Contenido Estático</Text>
      </PageContainer>
    );

    expect(getByText('Contenido Estático')).toBeTruthy();
    expect(getByTestId('page-container-view')).toBeTruthy();
  });
});
