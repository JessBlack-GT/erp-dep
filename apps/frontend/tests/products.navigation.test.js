jest.mock('../src/hooks/usePermissions', () => ({ usePermissions: jest.fn(() => () => false) }));
import React from 'react';
import { render } from '@testing-library/react-native';
import { useAuth } from '../src/context/AuthContext';
import { MainNavigator } from '../src/app/navigation/MainNavigator';
import { NAV_ITEMS } from '../src/components/layout/Sidebar';
import { usePermissions } from '../src/hooks/usePermissions';

jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return {
      Navigator: ({ children }) => <View>{children}</View>,
      Screen: ({ name, component }) => <Text>{`${name}:${typeof component}`}</Text>,
    };
  },
}));

describe('M05 registration in MainNavigator (native navigation mocked)', () => {
  it('registers every offered sidebar destination and leaves Dashboard pending', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
    usePermissions.mockReturnValueOnce(() => true);
    const screen = render(<MainNavigator />);
    for (const item of NAV_ITEMS)
      expect(screen.getByText(`${item.route}:function`)).toBeTruthy();
    expect(NAV_ITEMS.some(item => item.route === 'Dashboard')).toBe(false);
  });
  it('registers all product screens for an authenticated session', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
    const screen = render(<MainNavigator />);
    for (const name of ['Products', 'ProductDetail', 'ProductForm'])
      expect(screen.getByText(`${name}:function`)).toBeTruthy();
  });
  it('does not expose product screens while unauthenticated or loading', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
    const screen = render(<MainNavigator />);
    expect(screen.queryByText('Products:function')).toBeNull();
    useAuth.mockReturnValue({ isAuthenticated: false, loading: true });
    screen.rerender(<MainNavigator />);
    expect(screen.toJSON()).toBeNull();
  });
});
