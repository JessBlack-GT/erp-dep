import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import { AuthContext } from '../src/context/AuthContext';
import { LoginScreen } from '../src/features/auth/LoginScreen';

const fill = ui => {
  fireEvent.changeText(ui.getByLabelText('Correo electrónico'), ' person@example.com ');
  fireEvent.changeText(ui.getByLabelText('Contraseña'), 'fictional-password');
};
function setup(login = jest.fn().mockResolvedValue({})) {
  return { login, ...render(<AuthContext.Provider value={{ login }}><LoginScreen /></AuthContext.Provider>) };
}
describe('UI-04 authentication experience', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(async () => { cleanup(); await act(async () => jest.runOnlyPendingTimers()); jest.useRealTimers(); });
  it('renders official branding and welcome', () => {
    const ui = setup();
    expect(ui.getByLabelText('YJ Nexo')).toBeTruthy();
    expect(ui.getByText('Bienvenido')).toBeTruthy();
  });
  it('provides labeled email with autofill and no search role', () => {
    const input = setup().getByLabelText('Correo electrónico');
    expect(input.props.keyboardType).toBe('email-address');
    expect(input.props.autoComplete).toBe('email');
    expect(input.props.accessibilityRole).toBeUndefined();
  });
  it('masks the password by default with current-password autofill', () => {
    const input = setup().getByLabelText('Contraseña');
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.autoComplete).toBe('current-password');
  });
  it.each([
    ['', 'fictional-password', 'Introduce tu correo electrónico.'],
    ['person@example.com', '', 'Introduce tu contraseña.'],
    ['invalid', 'fictional-password', 'Introduce un correo electrónico válido.'],
  ])('rejects invalid input %s locally', (email, password, message) => {
    const ui = setup();
    fireEvent.changeText(ui.getByLabelText('Correo electrónico'), email);
    fireEvent.changeText(ui.getByLabelText('Contraseña'), password);
    fireEvent.press(ui.getByLabelText('Iniciar sesión'));
    expect(ui.getByText(message).props.accessibilityRole).toBe('alert');
    expect(ui.login).not.toHaveBeenCalled();
  });
  it('submits trimmed email and unmodified password via Enter', async () => {
    const ui = setup(); fill(ui);
    fireEvent(ui.getByLabelText('Contraseña'), 'submitEditing');
    await waitFor(() => expect(ui.login).toHaveBeenCalledWith('person@example.com', 'fictional-password'));
  });
  it('locks fields and duplicate submissions during a pending request', async () => {
    let resolve;
    const ui = setup(jest.fn(() => new Promise(done => { resolve = done; }))); fill(ui);
    act(() => {
      const submit = ui.getByLabelText('Contraseña').props.onSubmitEditing;
      submit(); submit();
    });
    expect(ui.login).toHaveBeenCalledTimes(1);
    expect(ui.getByLabelText('Iniciando sesión').props.accessibilityState.busy).toBe(true);
    expect(ui.getByLabelText('Correo electrónico').props.editable).toBe(false);
    expect(ui.getByLabelText('Contraseña').props.editable).toBe(false);
    await act(async () => resolve({}));
  });
  it.each([
    [{ response: { status: 401, data: { message: 'PRIVATE_DETAIL' } } }, 'Credenciales inválidas'],
    [{ code: 'ERR_NETWORK', message: 'PRIVATE_DETAIL' }, 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'],
    [{ code: 'ECONNABORTED', message: 'PRIVATE_DETAIL' }, 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'],
    [{ response: { status: 500, data: 'PRIVATE_DETAIL' } }, 'No se pudo iniciar sesión. Inténtalo de nuevo más tarde.'],
  ])('sanitizes failures and permits retry %#', async (error, message) => {
    const ui = setup(jest.fn().mockRejectedValue(error)); fill(ui);
    fireEvent.press(ui.getByLabelText('Iniciar sesión'));
    await waitFor(() => expect(ui.getByText(message)).toBeTruthy());
    expect(ui.queryByText(/PRIVATE_DETAIL/)).toBeNull();
    expect(ui.getByLabelText('Iniciar sesión').props.accessibilityState.disabled).toBe(false);
  });
  it('toggles password visibility without changing its value', () => {
    const ui = setup(); fill(ui);
    fireEvent.press(ui.getByLabelText('Mostrar contraseña'));
    expect(ui.getByLabelText('Contraseña').props.secureTextEntry).toBe(false);
    expect(ui.getByLabelText('Contraseña').props.value).toBe('fictional-password');
    fireEvent.press(ui.getByLabelText('Ocultar contraseña'));
    expect(ui.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
  });
  it('clears stale validation when editing', () => {
    const ui = setup();
    fireEvent.press(ui.getByLabelText('Iniciar sesión'));
    fireEvent.changeText(ui.getByLabelText('Correo electrónico'), 'person@example.com');
    expect(ui.queryByText('Introduce tu correo electrónico.')).toBeNull();
  });
  it('uses accessible labels and 48px submit target', () => {
    const ui = setup();
    expect(ui.getByLabelText('Iniciar sesión').props.accessibilityRole).toBe('button');
    expect(StyleSheet.flatten(ui.getByLabelText('Iniciar sesión').props.style).height).toBe(48);
    expect(ui.getByLabelText('Mostrar contraseña').props.accessibilityRole).toBe('button');
  });
});
