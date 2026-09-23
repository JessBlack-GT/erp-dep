// Existing component behavior uses an authorized session; RBAC is covered separately.
jest.mock('../src/hooks/usePermissions', () => ({ usePermissions: () => () => true }));
import React from 'react';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import { Alert, FlatList } from 'react-native';
import { expect } from '@jest/globals';

jest.mock('../src/services/api', () => ({
  customerService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getById: jest.fn(),
  },
}));

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

const { customerService } = require('../src/services/api');
const { CustomerList } = require('../src/features/customers/CustomersScreen');
const { CustomerForm } = require('../src/features/customers/CustomerForm');
const { CustomerDetailScreen } = require('../src/features/customers/CustomerDetailScreen');

describe('M03 - Customers frontend isolated tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
  });
  afterEach(async () => {
    cleanup();
    await act(async () => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('1. renderiza la pantalla de clientes y muestra resultados', async () => {
    customerService.getAll.mockResolvedValue({
      data: {
        data: [{
          id: '1',
          name: 'Ana',
          lastName: 'Pérez',
          email: 'ana@example.com',
          type: 'natural',
          status: 'active',
          getFullName: () => 'Ana Pérez',
        }],
      },
    });

    const navigation = { navigate: jest.fn() };
    const { getByText } = render(<CustomerList navigation={navigation} />);

    await waitFor(() => expect(getByText('Ana Pérez')).toBeTruthy());
    expect(customerService.getAll).toHaveBeenCalled();
  });

  it('2. valida el formulario y rechaza email inválido', () => {
    const navigation = { goBack: jest.fn() };
    const { getByText, getByPlaceholderText } = render(
      <CustomerForm route={{ params: {} }} navigation={navigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Nombre del cliente'), '');
    fireEvent.changeText(getByPlaceholderText('email@example.com'), 'email-no-valido');
    fireEvent.press(getByText('Registrar'));

    expect(getByText('El nombre es requerido')).toBeTruthy();
    expect(getByText('Formato de email inválido')).toBeTruthy();
  });

  it('3. envía la creación de cliente con datos válidos', async () => {
    customerService.create.mockResolvedValue({ data: { success: true } });

    const navigation = { goBack: jest.fn() };
    const { getByPlaceholderText, getByText } = render(
      <CustomerForm route={{ params: {} }} navigation={navigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Nombre del cliente'), 'Ana');
    fireEvent.changeText(getByPlaceholderText('email@example.com'), 'ana@example.com');
    fireEvent.press(getByText('Registrar'));

    await waitFor(() => expect(customerService.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Ana',
      email: 'ana@example.com',
    })));
  });

  it('4. maneja un error del servicio al crear cliente', async () => {
    customerService.create.mockRejectedValue({
      response: { data: { error: 'Cliente duplicado' } },
    });

    const navigation = { goBack: jest.fn() };
    const { getByPlaceholderText, getByText } = render(
      <CustomerForm route={{ params: {} }} navigation={navigation} />
    );

    fireEvent.changeText(getByPlaceholderText('Nombre del cliente'), 'Ana');
    fireEvent.changeText(getByPlaceholderText('email@example.com'), 'ana@example.com');
    fireEvent.press(getByText('Registrar'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'Cliente duplicado'));
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('5. muestra carga y navega al detalle usando el _id de MongoDB', async () => {
    let resolve;
    customerService.getAll.mockReturnValue(new Promise(r => { resolve = r; }));
    const navigation = { navigate: jest.fn() };
    const screen = render(<CustomerList navigation={navigation} />);
    expect(screen.getByText('Cargando clientes...')).toBeTruthy();
    await act(async () => resolve({ data: { data: [{ _id: 'mongo-id', name: 'Cliente', email: 'test@example.com' }] } }));
    fireEvent.press(screen.getByText('Cliente'));
    expect(navigation.navigate).toHaveBeenCalledWith('CustomerDetail', { id: 'mongo-id' });
    fireEvent.press(screen.getByText('+'));
    expect(navigation.navigate).toHaveBeenCalledWith('CustomerForm');
  });

  it('6. permite reintentar un error de listado', async () => {
    customerService.getAll.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { data: [] } });
    const screen = render(<CustomerList navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(screen.getByText('Error al cargar clientes')).toBeTruthy());
    fireEvent.press(screen.getByText('Reintentar'));
    await waitFor(() => expect(screen.getByText('No se encontraron clientes')).toBeTruthy());
  });

  it('7. busca con el texto actual y agrega la segunda página', async () => {
    const rows = Array.from({ length: 20 }, (_, n) => ({ _id: String(n), name: `Cliente ${n}`, email: `${n}@example.com` }));
    customerService.getAll.mockResolvedValueOnce({ data: { data: rows } }).mockResolvedValueOnce({ data: { data: [{ _id: '20', name: 'Segundo', email: '20@example.com' }] } }).mockResolvedValueOnce({ data: { data: [] } });
    const screen = render(<CustomerList navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(screen.getByText('Cliente 0')).toBeTruthy());
    fireEvent(screen.UNSAFE_getByType(FlatList), 'onEndReached');
    await waitFor(() => expect(customerService.getAll).toHaveBeenLastCalledWith({ page: 2, limit: 20, search: '' }));
    await waitFor(() => expect(screen.UNSAFE_getByType(FlatList).props.data).toHaveLength(21));
    fireEvent.changeText(screen.getByPlaceholderText('Buscar clientes...'), 'Ana');
    await waitFor(() => expect(customerService.getAll).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: 'Ana' }));
    await waitFor(() => expect(screen.getByText('No se encontraron clientes')).toBeTruthy());
  });

  it('8. abre detalle y navega a edición', async () => {
    customerService.getById.mockResolvedValue({ data: { data: { _id: '1', name: 'Ana', email: 'ana@example.com', status: 'active' } } });
    const navigation = { navigate: jest.fn() };
    const screen = render(<CustomerDetailScreen route={{ params: { id: '1' } }} navigation={navigation} />);
    await waitFor(() => expect(screen.getByText('ana@example.com')).toBeTruthy());
    fireEvent.press(screen.getByText('Editar'));
    expect(navigation.navigate).toHaveBeenCalledWith('CustomerForm', { customerId: '1' });
  });

  it('9. carga y guarda la edición', async () => {
    customerService.getById.mockResolvedValue({ data: { data: { name: 'Ana', email: 'ana@example.com' } } });
    customerService.update.mockResolvedValue({ data: { success: true } });
    const navigation = { goBack: jest.fn() };
    const screen = render(<CustomerForm route={{ params: { customerId: '1' } }} navigation={navigation} />);
    await waitFor(() => expect(screen.getByDisplayValue('Ana')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Nombre del cliente'), 'Ana Editada');
    fireEvent.press(screen.getByText('Actualizar'));
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
    expect(customerService.update).toHaveBeenCalledWith('1', expect.objectContaining({ name: 'Ana Editada' }));
  });

  it('10. muestra errores de detalle y de carga del formulario', async () => {
    customerService.getById.mockRejectedValue(new Error('offline'));
    const detail = render(<CustomerDetailScreen route={{ params: { id: '1' } }} navigation={{}} />);
    await waitFor(() => expect(detail.getByText('No se pudo cargar el cliente')).toBeTruthy());
    detail.unmount();
    render(<CustomerForm route={{ params: { customerId: '1' } }} navigation={{}} />);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo cargar el cliente'));
  });
});
