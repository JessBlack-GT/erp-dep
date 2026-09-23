// Existing component behavior uses an authorized session; RBAC is covered separately.
jest.mock('../src/hooks/usePermissions', () => ({ usePermissions: () => () => true }));
import React from 'react';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { CustomerDetailScreen } from '../src/features/customers/CustomerDetailScreen';
import { CustomerList } from '../src/features/customers/CustomersScreen';
import { customerService } from '../src/services/api';
jest.mock('../src/services/api', () => ({ customerService: { getById: jest.fn(), getAll: jest.fn(), changeStatus: jest.fn() } }));
describe('M03 UI status and focus refresh (mock API)', () => {
  beforeEach(() => { jest.resetAllMocks(); jest.useFakeTimers(); });
  afterEach(async () => { cleanup(); await act(async () => jest.runOnlyPendingTimers()); jest.useRealTimers(); });
  it('changes status and displays the returned state', async () => {
    const customer = { _id: '1', name: 'QA', status: 'active', email: 'qa@example.com' };
    customerService.getById.mockResolvedValue({ data: { data: customer } });
    customerService.changeStatus.mockResolvedValue({ data: { data: { ...customer, status: 'inactive' } } });
    const ui = render(<CustomerDetailScreen route={{ params: { id: '1' } }} navigation={{}} />);
    await waitFor(() => expect(ui.getByText('Desactivar')).toBeTruthy());
    fireEvent.press(ui.getByText('Desactivar'));
    await waitFor(() => expect(ui.getByText('INACTIVE')).toBeTruthy());
    expect(customerService.changeStatus).toHaveBeenCalledWith('1', 'inactive');
  });
  it('refreshes the customer list after navigating back', async () => {
    let onFocus;
    const unsubscribe = jest.fn();
    customerService.getAll.mockResolvedValue({ data: { data: [] } });
    const ui = render(<CustomerList navigation={{ addListener: (name, fn) => { onFocus = fn; return unsubscribe; } }} />);
    await waitFor(() => expect(ui.getByText('No se encontraron clientes')).toBeTruthy());
    customerService.getAll.mockResolvedValue({ data: { data: [{ _id: 'new', name: 'Creado', email: 'new@example.com' }] } });
    await act(async () => onFocus());
    await waitFor(() => expect(ui.getByText('Creado')).toBeTruthy());
    ui.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
