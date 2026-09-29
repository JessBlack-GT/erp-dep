import React from 'react';
import { render } from '@testing-library/react-native';
import { MainNavigator } from '../src/app/navigation/MainNavigator';
import { useAuth } from '../src/context/AuthContext';
import { usePermissions } from '../src/hooks/usePermissions';
jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../src/hooks/usePermissions', () => ({ usePermissions: jest.fn() }));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => {
    const React = require('react'),
      { View, Text } = require('react-native');
    return {
      Navigator: ({ children }) => <View>{children}</View>,
      Screen: ({ name }) => <Text>{name}</Text>,
    };
  },
}));
test('administrative routes follow actual permissions', () => {
  useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
  usePermissions.mockReturnValue(() => false);
  const ui = render(<MainNavigator />);
  expect(ui.queryByText('Users')).toBeNull();
  expect(ui.queryByText('Roles')).toBeNull();
  expect(ui.getByText('Password')).toBeTruthy();
  usePermissions.mockReturnValue((p) => p === 'users.read');
  ui.rerender(<MainNavigator />);
  expect(ui.getByText('Users')).toBeTruthy();
  expect(ui.getByText('UserDetail')).toBeTruthy();
  expect(ui.queryByText('UserForm')).toBeNull();
  expect(ui.queryByText('Roles')).toBeNull();
  usePermissions.mockReturnValue(() => true);
  ui.rerender(<MainNavigator />);
  expect(ui.getByText('UserForm')).toBeTruthy();
  expect(ui.getByText('Roles')).toBeTruthy();
});
test('all administrative screens absent without a session', () => {
  useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
  usePermissions.mockReturnValue(() => true);
  const ui = render(<MainNavigator />);
  expect(ui.getByText('Login')).toBeTruthy();
  expect(ui.queryByText('Users')).toBeNull();
  expect(ui.queryByText('Password')).toBeNull();
});
