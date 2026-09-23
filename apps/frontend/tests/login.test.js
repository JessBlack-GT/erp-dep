import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LoginScreen } from '../src/features/auth/LoginScreen';
import { authService } from '../src/services/api';
jest.mock('../src/services/api', () => ({ authService: { login: jest.fn() } }));
function Session() {
  const auth = useAuth();
  return auth.loading ? <Text>Loading</Text> : auth.isAuthenticated ? <Text>Authenticated</Text> : <LoginScreen />;
}
describe('Login and real auth context with mocked API', () => {
  beforeEach(async () => { jest.clearAllMocks(); jest.useFakeTimers(); await AsyncStorage.clear(); });
  afterEach(async () => {
    cleanup();
    await act(async () => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });
  it('validates required fields without sending credentials', async () => {
    const ui = render(<AuthProvider><Session /></AuthProvider>);
    await waitFor(() => expect(ui.getByText('Entrar')).toBeTruthy());
    fireEvent.press(ui.getByText('Entrar'));
    expect(ui.getByText('Introduce email y contraseña')).toBeTruthy();
    expect(authService.login).not.toHaveBeenCalled();
  });
  it('unwraps the HTTP envelope, stores the session and restores it on remount', async () => {
    authService.login.mockResolvedValue({ data: { success: true, data: { accessToken: 'fictional-access', refreshToken: 'fictional-refresh', user: { email: 'qa@example.com' } } } });
    const ui = render(<AuthProvider><Session /></AuthProvider>);
    await waitFor(() => expect(ui.getByText('Entrar')).toBeTruthy());
    fireEvent.changeText(ui.getByLabelText('Email'), 'qa@example.com');
    fireEvent.changeText(ui.getByLabelText('Contraseña'), 'fictional-password');
    fireEvent.press(ui.getByText('Entrar'));
    await waitFor(() => expect(ui.getByText('Authenticated')).toBeTruthy());
    expect(await AsyncStorage.getItem('accessToken')).toBe('fictional-access');
    ui.unmount();
    const restored = render(<AuthProvider><Session /></AuthProvider>);
    await waitFor(() => expect(restored.getByText('Authenticated')).toBeTruthy());
  });
  it('shows a failed login without storing a session', async () => {
    authService.login.mockRejectedValue({ response: { status: 401 } });
    const ui = render(<AuthProvider><Session /></AuthProvider>);
    await waitFor(() => expect(ui.getByText('Entrar')).toBeTruthy());
    fireEvent.changeText(ui.getByLabelText('Email'), 'qa@example.com');
    fireEvent.changeText(ui.getByLabelText('Contraseña'), 'fictional-password');
    fireEvent.press(ui.getByText('Entrar'));
    await waitFor(() => expect(ui.getByText('Credenciales inválidas')).toBeTruthy());
    expect(await AsyncStorage.getItem('accessToken')).toBeNull();
  });
});
