import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useAuth } from '../src/context/AuthContext';
import { usePermissions } from '../src/hooks/usePermissions';
import { MainNavigator } from '../src/app/navigation/MainNavigator';
import { Sidebar, NAV_ITEMS } from '../src/components/layout/Sidebar';
jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../src/hooks/usePermissions', () => ({ usePermissions: jest.fn() }));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => {
    const React = require('react'),
      { View, Text } = require('react-native');
    return {
      Navigator: ({ children }) => <View>{children}</View>,
      Screen: ({ name, component }) => (
        <Text>{`${name}:${typeof component}`}</Text>
      ),
    };
  },
}));
beforeEach(() => {
  useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
  usePermissions.mockReturnValue(() => true);
});
test('registers sales with existing routes and every sidebar destination', () => {
  const ui = render(<MainNavigator />);
  for (const name of [
    'Sales',
    'SaleDetail',
    'SaleForm',
    'Customers',
    'Suppliers',
    'Products',
    'Inventory',
    'Password',
  ])
    expect(ui.getByText(`${name}:function`)).toBeTruthy();
  for (const item of NAV_ITEMS)
    expect(ui.getByText(`${item.route}:function`)).toBeTruthy();
  expect(NAV_ITEMS.find((x) => x.route === 'Sales').permission).toBe(
    'commercial.read',
  );
});
test('read-only can view, not open form route', () => {
  usePermissions.mockReturnValue((p) => p === 'commercial.read');
  const ui = render(<MainNavigator />);
  expect(ui.getByText('Sales:function')).toBeTruthy();
  expect(ui.getByText('SaleDetail:function')).toBeTruthy();
  expect(ui.queryByText('SaleForm:function')).toBeNull();
});
test.each(['commercial.create', 'commercial.update'])(
  '%s adds form when read allowed',
  (permission) => {
    usePermissions.mockReturnValue((p) =>
      ['commercial.read', permission].includes(p),
    );
    const ui = render(<MainNavigator />);
    expect(ui.getByText('SaleForm:function')).toBeTruthy();
  },
);
test('no read permission removes sales routes and sidebar item', () => {
  usePermissions.mockReturnValue((p) => p !== 'commercial.read');
  const ui = render(<MainNavigator />);
  for (const name of ['Sales', 'SaleDetail', 'SaleForm'])
    expect(ui.queryByText(`${name}:function`)).toBeNull();
  const sidebar = render(<Sidebar />);
  expect(sidebar.queryByTestId('nav-item-Sales')).toBeNull();
});
test('sidebar selects Sales and closes mobile drawer', () => {
  const onSelectRoute = jest.fn(),
    onCloseMobile = jest.fn();
  const ui = render(
    <Sidebar
      isMobile
      mobileOpen
      activeRoute="Sales"
      onSelectRoute={onSelectRoute}
      onCloseMobile={onCloseMobile}
    />,
  );
  fireEvent.press(ui.getByTestId('nav-item-Sales'));
  expect(onSelectRoute).toHaveBeenCalledWith('Sales');
  expect(onCloseMobile).toHaveBeenCalled();
});
test('unauthenticated and loading sessions expose no sales routes', () => {
  useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
  const ui = render(<MainNavigator />);
  expect(ui.getByText('Login:function')).toBeTruthy();
  expect(ui.queryByText('Sales:function')).toBeNull();
  useAuth.mockReturnValue({ isAuthenticated: true, loading: true });
  ui.rerender(<MainNavigator />);
  expect(ui.toJSON()).toBeNull();
});
