import React from 'react';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';
import { getStateFromPath } from '@react-navigation/native';
import { AuthContext } from '../src/context/AuthContext';
import { LoginScreen } from '../src/features/auth/LoginScreen';
import { ForgotPasswordScreen } from '../src/features/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../src/features/auth/ResetPasswordScreen';
import { authService } from '../src/services/api';
import { linking } from '../src/app/App';

jest.mock('../src/services/api', () => ({
  authService: {
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  },
}));
const token = require('crypto').randomBytes(32).toString('hex');
const password = require('crypto').randomBytes(16).toString('hex');
const generic =
  'Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.';
function setup(Screen, route = { params: { token } }) {
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  const clearSession = jest.fn().mockResolvedValue();
  return {
    navigation,
    clearSession,
    ...render(
      <AuthContext.Provider value={{ clearSession, login: jest.fn() }}>
        <Screen navigation={navigation} route={route} />
      </AuthContext.Provider>,
    ),
  };
}
function fillReset(ui, first = password, second = first) {
  fireEvent.changeText(ui.getByLabelText('Nueva contraseña'), first);
  fireEvent.changeText(ui.getByLabelText('Confirmar contraseña'), second);
}
describe('Password recovery screens and web deep links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(async () => {
    cleanup();
    await act(async () => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });
  it('links Login to ForgotPassword', () => {
    const ui = setup(LoginScreen);
    fireEvent.press(ui.getByText('¿Olvidaste tu contraseña?'));
    expect(ui.navigation.navigate).toHaveBeenCalledWith('ForgotPassword');
  });
  it('validates email and does not submit invalid input', () => {
    const ui = setup(ForgotPasswordScreen);
    fireEvent.changeText(ui.getByLabelText('Correo electrónico'), 'invalid');
    fireEvent.press(ui.getByText('Enviar instrucciones'));
    expect(ui.getByText('Introduce un correo electrónico válido.')).toBeTruthy();
    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });
  it('sends a normalized email, displays only the generic response and returns to login', async () => {
    authService.forgotPassword.mockResolvedValue({ data: { message: 'not displayed' } });
    const ui = setup(ForgotPasswordScreen);
    fireEvent.changeText(ui.getByLabelText('Correo electrónico'), ' PERSON@EXAMPLE.COM ');
    fireEvent.press(ui.getByText('Enviar instrucciones'));
    await waitFor(() => expect(ui.getByText(generic)).toBeTruthy());
    expect(authService.forgotPassword).toHaveBeenCalledWith('person@example.com');
    fireEvent.press(ui.getByText('Volver a iniciar sesión'));
    expect(ui.navigation.navigate).toHaveBeenCalledWith('Login');
  });
  it('handles rate limits without exposing server details', async () => {
    authService.forgotPassword.mockRejectedValue({ response: { status: 429, data: 'PRIVATE' } });
    const ui = setup(ForgotPasswordScreen);
    fireEvent.changeText(ui.getByLabelText('Correo electrónico'), 'person@example.com');
    fireEvent.press(ui.getByText('Enviar instrucciones'));
    await waitFor(() =>
      expect(ui.getByText('Demasiadas solicitudes. Inténtalo de nuevo más tarde.')).toBeTruthy(),
    );
    expect(ui.queryByText('PRIVATE')).toBeNull();
  });
  it('parses the URL token into ResetPassword route params', () => {
    const state = getStateFromPath(`/reset-password?token=${token}`, linking.config);
    expect(state.routes[0].name).toBe('ResetPassword');
    expect(state.routes[0].params.token).toBe(token);
    expect(linking.prefixes).toContain('https://erp-dep.pages.dev');
    expect(getStateFromPath('/Customers', linking.config).routes[0].name).toBe('Customers');
  });
  it('rejects missing or malformed tokens without showing the password form', () => {
    const ui = setup(ResetPasswordScreen, { params: {} });
    expect(ui.getByText('El enlace de recuperación no es válido o ha expirado.')).toBeTruthy();
    expect(ui.queryByLabelText('Nueva contraseña')).toBeNull();
  });
  it.each(['short', 'é'.repeat(37), '😀'.repeat(19)])(
    'rejects invalid password length %#',
    (value) => {
      const ui = setup(ResetPasswordScreen);
      fillReset(ui, value);
      fireEvent.press(ui.getByLabelText('Restablecer contraseña'));
      expect(
        ui.getByText('La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes.'),
      ).toBeTruthy();
      expect(authService.resetPassword).not.toHaveBeenCalled();
    },
  );
  it('rejects mismatched confirmation', () => {
    const ui = setup(ResetPasswordScreen);
    fillReset(ui, password, password + 'different');
    fireEvent.press(ui.getByLabelText('Restablecer contraseña'));
    expect(ui.getByText('Las contraseñas deben coincidir.')).toBeTruthy();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });
  it('submits URL token and password, clears session, then offers login without auto-login', async () => {
    authService.resetPassword.mockResolvedValue({ data: { success: true } });
    const ui = setup(ResetPasswordScreen);
    fillReset(ui);
    fireEvent.press(ui.getByLabelText('Restablecer contraseña'));
    await waitFor(() =>
      expect(ui.getByText('Tu contraseña se restableció correctamente.')).toBeTruthy(),
    );
    expect(authService.resetPassword).toHaveBeenCalledWith(token, password);
    expect(ui.clearSession).toHaveBeenCalled();
    expect(ui.navigation.setParams).toHaveBeenCalledWith({ token: undefined });
    fireEvent.press(ui.getByText('Volver a iniciar sesión'));
    await waitFor(() => expect(ui.navigation.navigate).toHaveBeenCalledWith('Login'));
  });
  it('shows a generic expired/used-link error', async () => {
    authService.resetPassword.mockRejectedValue({ response: { status: 400, data: 'PRIVATE' } });
    const ui = setup(ResetPasswordScreen);
    fillReset(ui);
    fireEvent.press(ui.getByLabelText('Restablecer contraseña'));
    await waitFor(() =>
      expect(ui.getByText('El enlace de recuperación no es válido o ha expirado.')).toBeTruthy(),
    );
    expect(ui.queryByText('PRIVATE')).toBeNull();
    expect(ui.clearSession).not.toHaveBeenCalled();
  });
});
