import React from 'react';

import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '../src/context/AuthContext';
import { MainNavigator } from '../src/app/navigation/MainNavigator';
import { authService } from '../src/services/api';
jest.mock('../src/services/api', () => ({ authService: { login: jest.fn(), logout: jest.fn() } }));
jest.mock('../src/features/customers', () => { const React = require('react'); const { Text } = require('react-native'); return ({
  CustomersScreen: () => <Text>Protected customer content</Text>, CustomerDetailScreen: () => null, CustomerForm: () => null,
}); });
jest.mock('@react-navigation/native-stack', () => { const React = require('react'); return ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }) => React.Children.toArray(children)[0],
    Screen: ({ component: Component, name }) => ['Login', 'Customers'].includes(name) ? <Component navigation={{ navigate: jest.fn() }} /> : null,
  }),
}); });
describe('UI-04 real context, navigator and shell (HTTP and native stack mocked)', () => {
  beforeEach(async () => { jest.clearAllMocks(); jest.useFakeTimers(); await AsyncStorage.clear(); });
  afterEach(async () => { cleanup(); await act(async () => jest.runOnlyPendingTimers()); jest.useRealTimers(); });
  it('hides protected content while restoring and before login', async () => {
    const ui = render(<AuthProvider><MainNavigator /></AuthProvider>);
    expect(ui.queryByTestId('topbar-container')).toBeNull();
    await waitFor(() => expect(ui.getByText('Bienvenido')).toBeTruthy());
    expect(ui.queryByTestId('topbar-container')).toBeNull();
    expect(ui.queryByText('Protected customer content')).toBeNull();
  });
  it('logs in, displays the existing shell, then logs out and removes session keys', async () => {
    authService.login.mockResolvedValue({ data: { data: {
      accessToken: 'fictional-access', refreshToken: 'fictional-refresh', user: { name: 'Test', email: 'person@example.com', role: 'admin' },
    } } });
    authService.logout.mockResolvedValue({});
    const ui = render(<AuthProvider><MainNavigator /></AuthProvider>);
    await waitFor(() => expect(ui.getByText('Bienvenido')).toBeTruthy());
    fireEvent.changeText(ui.getByLabelText('Correo electrónico'), 'person@example.com');
    fireEvent.changeText(ui.getByLabelText('Contraseña'), 'fictional-password');
    fireEvent.press(ui.getByLabelText('Iniciar sesión'));
    await waitFor(() => expect(ui.getByTestId('topbar-container')).toBeTruthy());
    expect(ui.getByText('Protected customer content')).toBeTruthy();
    expect(ui.queryByText('Bienvenido')).toBeNull();
    expect((await AsyncStorage.getAllKeys()).sort()).toEqual(['accessToken', 'refreshToken', 'user']);
    fireEvent.press(ui.getByTestId('user-menu-trigger'));
    fireEvent.press(ui.getByTestId('user-menu-logout-btn'));
    await waitFor(() => expect(ui.getByText('Bienvenido')).toBeTruthy());
    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(ui.queryByTestId('topbar-container')).toBeNull();
    expect(ui.getByLabelText('Contraseña').props.value).toBe('');
  });
});
