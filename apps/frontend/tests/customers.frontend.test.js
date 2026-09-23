import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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

describe('M03 - Customers frontend isolated tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    await waitFor(() => expect(customerService.create).toHaveBeenCalledTimes(1));
  });
});
