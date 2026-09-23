// Existing component behavior uses an authorized session; RBAC is covered separately.
jest.mock('../src/hooks/usePermissions', () => ({ usePermissions: () => () => true }));
import React from 'react';
import { Platform, Alert } from 'react-native';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';
import { CustomerDetailScreen } from '../src/features/customers/CustomerDetailScreen';
import { CustomerForm } from '../src/features/customers/CustomerForm';
import { customerService } from '../src/services/api';
jest.mock('../src/services/api', () => ({ customerService: { getById: jest.fn(), delete: jest.fn(), create: jest.fn() } }));
const originalOS = Platform.OS;
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  Platform.OS = 'web';
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  customerService.getById.mockResolvedValue({ data: { data: { _id: 'qa', name: 'QA', email: 'qa@example.com', status: 'active' } } });
});
afterEach(async () => {
  cleanup();
  await act(async () => jest.runOnlyPendingTimers());
  jest.useRealTimers();
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});
test('web deletion requires confirmation and cancellation does not call the API', async () => {
  customerService.delete.mockResolvedValue({});
  const navigation = { goBack: jest.fn() };
  const ui = render(<CustomerDetailScreen route={{ params: { id: 'qa' } }} navigation={navigation} />);
  await waitFor(() => expect(ui.getByText('Eliminar')).toBeTruthy());
  fireEvent.press(ui.getByText('Eliminar'));
  fireEvent.press(ui.getByText('Cancelar'));
  expect(customerService.delete).not.toHaveBeenCalled();
  fireEvent.press(ui.getByText('Eliminar'));
  fireEvent.press(ui.getByText('Confirmar eliminación'));
  await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
  expect(customerService.delete).toHaveBeenCalledWith('qa');
});
test('web deletion failure is visible and preserves the detail screen', async () => {
  customerService.delete.mockRejectedValue(new Error('offline'));
  const navigation = { goBack: jest.fn() };
  const ui = render(<CustomerDetailScreen route={{ params: { id: 'qa' } }} navigation={navigation} />);
  await waitFor(() => expect(ui.getByText('Eliminar')).toBeTruthy());
  fireEvent.press(ui.getByText('Eliminar'));
  fireEvent.press(ui.getByText('Confirmar eliminación'));
  await waitFor(() => expect(ui.getByText('No se pudo eliminar el cliente')).toBeTruthy());
  expect(navigation.goBack).not.toHaveBeenCalled();
});
test('duplicate API errors remain visible without relying on native Alert', async () => {
  customerService.create.mockRejectedValue({ response: { data: { error: 'Cliente duplicado' } } });
  const navigation = { goBack: jest.fn() };
  const ui = render(<CustomerForm route={{ params: {} }} navigation={navigation} />);
  fireEvent.changeText(ui.getByPlaceholderText('Nombre del cliente'), 'QA');
  fireEvent.changeText(ui.getByPlaceholderText('email@example.com'), 'qa@example.com');
  fireEvent.press(ui.getByText('Registrar'));
  await waitFor(() => expect(ui.getByText('Cliente duplicado')).toBeTruthy());
  expect(navigation.goBack).not.toHaveBeenCalled();
});
