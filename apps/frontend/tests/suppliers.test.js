import React from 'react';
import {
  render,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from '@testing-library/react-native';
import { AuthContext } from '../src/context/AuthContext';
import {
  SuppliersScreen,
  SupplierForm,
  SupplierDetailScreen,
} from '../src/features/suppliers';
import { supplierService as api } from '../src/services/api';
jest.mock('../src/services/api', () => ({
  supplierService: {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    delete: jest.fn(),
  },
}));
const all = [
  'suppliers.read',
  'suppliers.create',
  'suppliers.update',
  'suppliers.delete',
];
const item = {
  _id: '1',
  name: 'QA Supplier',
  status: 'active',
  type: 'legal',
  email: 'qa@example.com',
};
const nav = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
});
const draw = (child, permissions = all) =>
  render(
    <AuthContext.Provider
      value={{ isAuthenticated: true, user: { permissions } }}
    >
      {child}
    </AuthContext.Provider>,
  );
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  api.getAll.mockResolvedValue({
    data: { data: [item], pagination: { total: 1 } },
  });
  api.getById.mockResolvedValue({ data: { data: item } });
});
afterEach(async () => {
  cleanup();
  await act(async () => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});
test('loading then list and detail navigation', async () => {
  const n = nav(),
    ui = draw(<SuppliersScreen navigation={n} />);
  expect(ui.getByLabelText('Cargando proveedores')).toBeTruthy();
  await waitFor(() => expect(ui.getByText('QA Supplier')).toBeTruthy());
  fireEvent.press(ui.getByLabelText('Abrir QA Supplier'));
  expect(n.navigate).toHaveBeenCalledWith('SupplierDetail', { id: '1' });
});
test('empty list', async () => {
  api.getAll.mockResolvedValue({
    data: { data: [], pagination: { total: 0 } },
  });
  const ui = draw(<SuppliersScreen navigation={nav()} />);
  await waitFor(() =>
    expect(ui.getByText('No se encontraron proveedores')).toBeTruthy(),
  );
});
test('list error and retry', async () => {
  api.getAll.mockRejectedValueOnce(new Error('offline'));
  const ui = draw(<SuppliersScreen navigation={nav()} />);
  await waitFor(() => expect(ui.getByText('Reintentar')).toBeTruthy());
  fireEvent.press(ui.getByText('Reintentar'));
  await waitFor(() => expect(ui.getByText('QA Supplier')).toBeTruthy());
});
test('search and filters reset page and use existing API', async () => {
  const ui = draw(<SuppliersScreen navigation={nav()} />);
  await waitFor(() => expect(ui.getByText('QA Supplier')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('Buscar proveedores'), 'Steel');
  fireEvent.changeText(ui.getByLabelText('Filtro Categoría'), 'Metal');
  fireEvent.changeText(ui.getByLabelText('Filtro País (2 letras)'), 'CA');
  fireEvent.press(ui.getByText('Inactivos'));
  fireEvent.press(ui.getByText('Empresa'));
  fireEvent.press(ui.getByText('Buscar / aplicar filtros'));
  await waitFor(() =>
    expect(api.getAll).toHaveBeenLastCalledWith({
      search: 'Steel',
      category: 'Metal',
      country: 'CA',
      status: 'inactive',
      type: 'legal',
      page: 1,
      limit: 20,
    }),
  );
  fireEvent.press(ui.getByText('Limpiar filtros'));
  await waitFor(() =>
    expect(api.getAll).toHaveBeenLastCalledWith({ page: 1, limit: 20 }),
  );
});
test('pagination next and previous', async () => {
  api.getAll.mockResolvedValue({
    data: { data: [item], pagination: { total: 21 } },
  });
  const ui = draw(<SuppliersScreen navigation={nav()} />);
  await waitFor(() => expect(ui.getByText('QA Supplier')).toBeTruthy());
  fireEvent.press(ui.getByText('Siguiente'));
  await waitFor(() => expect(ui.getByText('Página 2 · Total 21')).toBeTruthy());
  expect(api.getAll).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
  fireEvent.press(ui.getByText('Anterior'));
  await waitFor(() => expect(ui.getByText('Página 1 · Total 21')).toBeTruthy());
});
test('create navigation respects permission', async () => {
  const n = nav(),
    ui = draw(<SuppliersScreen navigation={n} />);
  await waitFor(() => expect(ui.getByText('QA Supplier')).toBeTruthy());
  fireEvent.press(ui.getByText('Crear proveedor'));
  expect(n.navigate).toHaveBeenCalledWith('SupplierForm');
});
test('read-only hides create', async () => {
  const ui = draw(<SuppliersScreen navigation={nav()} />, ['suppliers.read']);
  await waitFor(() => expect(ui.getByText('QA Supplier')).toBeTruthy());
  expect(ui.queryByText('Crear proveedor')).toBeNull();
});
test('no permission means no request', () => {
  const ui = draw(<SuppliersScreen navigation={nav()} />, []);
  expect(ui.getByText('Sin permiso para consultar proveedores')).toBeTruthy();
  expect(api.getAll).not.toHaveBeenCalled();
});
test('form validates name and optional email', () => {
  const ui = draw(<SupplierForm route={{ params: {} }} navigation={nav()} />);
  fireEvent.press(ui.getByText('Registrar proveedor'));
  expect(ui.getByText('Nombre requerido')).toBeTruthy();
  fireEvent.changeText(ui.getByLabelText('Nombre / razón social'), 'QA');
  fireEvent.changeText(ui.getByLabelText('Correo empresarial'), 'bad');
  fireEvent.press(ui.getByText('Registrar proveedor'));
  expect(ui.getByText('Email inválido')).toBeTruthy();
  expect(api.create).not.toHaveBeenCalled();
});
test('create then replace with real detail ID', async () => {
  api.create.mockResolvedValue({ data: { data: item } });
  const n = nav(),
    ui = draw(<SupplierForm route={{ params: {} }} navigation={n} />);
  fireEvent.changeText(ui.getByLabelText('Nombre / razón social'), 'QA');
  fireEvent.press(ui.getByText('Registrar proveedor'));
  await waitFor(() =>
    expect(n.replace).toHaveBeenCalledWith('SupplierDetail', { id: '1' }),
  );
  expect(api.create).toHaveBeenCalledWith({ name: 'QA', type: 'legal' });
});
test('server errors remain visible and do not navigate', async () => {
  api.create.mockRejectedValue({
    response: { status: 409, data: { error: 'Proveedor duplicado' } },
  });
  const n = nav(),
    ui = draw(<SupplierForm route={{ params: {} }} navigation={n} />);
  fireEvent.changeText(ui.getByLabelText('Nombre / razón social'), 'QA');
  fireEvent.press(ui.getByText('Registrar proveedor'));
  await waitFor(() => expect(ui.getByText('Proveedor duplicado')).toBeTruthy());
  expect(n.replace).not.toHaveBeenCalled();
});
test('edit loads allowlisted fields and updates', async () => {
  api.update.mockResolvedValue({});
  const n = nav(),
    ui = draw(
      <SupplierForm route={{ params: { supplierId: '1' } }} navigation={n} />,
    );
  await waitFor(() =>
    expect(ui.getByLabelText('Nombre / razón social').props.value).toBe(
      item.name,
    ),
  );
  fireEvent.changeText(ui.getByLabelText('Nombre / razón social'), 'Edited');
  fireEvent.press(ui.getByText('Guardar cambios'));
  await waitFor(() => expect(n.goBack).toHaveBeenCalled());
  expect(api.update.mock.calls[0][1].name).toBe('Edited');
  expect(api.update.mock.calls[0][1]._id).toBeUndefined();
});
test('failed load prevents saving until retry succeeds', async () => {
  api.getById.mockRejectedValueOnce(new Error('offline'));
  const ui = draw(
    <SupplierForm route={{ params: { supplierId: '1' } }} navigation={nav()} />,
  );
  await waitFor(() => expect(ui.getByText('Reintentar')).toBeTruthy());
  fireEvent.press(ui.getByText('Guardar cambios'));
  expect(api.update).not.toHaveBeenCalled();
  fireEvent.press(ui.getByText('Reintentar'));
  await waitFor(() =>
    expect(ui.getByLabelText('Nombre / razón social').props.value).toBe(
      item.name,
    ),
  );
});
test('unauthorized direct form is denied', () => {
  const ui = draw(<SupplierForm route={{ params: {} }} navigation={nav()} />, [
    'suppliers.read',
  ]);
  expect(ui.getByText('Sin permiso para guardar proveedores')).toBeTruthy();
});
test('detail renders and navigates to edit', async () => {
  const n = nav(),
    ui = draw(
      <SupplierDetailScreen route={{ params: { id: '1' } }} navigation={n} />,
    );
  await waitFor(() => expect(ui.getByText('QA Supplier')).toBeTruthy());
  fireEvent.press(ui.getByText('Editar proveedor'));
  expect(n.navigate).toHaveBeenCalledWith('SupplierForm', { supplierId: '1' });
});
test('detail error retries', async () => {
  api.getById.mockRejectedValueOnce(new Error('offline'));
  const ui = draw(
    <SupplierDetailScreen route={{ params: { id: '1' } }} navigation={nav()} />,
  );
  await waitFor(() => expect(ui.getByText('Reintentar')).toBeTruthy());
  fireEvent.press(ui.getByText('Reintentar'));
  await waitFor(() => expect(ui.getByText('QA Supplier')).toBeTruthy());
});
test('changes active status and shows returned state', async () => {
  api.changeStatus.mockResolvedValue({
    data: { data: { ...item, status: 'inactive' } },
  });
  const ui = draw(
    <SupplierDetailScreen route={{ params: { id: '1' } }} navigation={nav()} />,
  );
  await waitFor(() =>
    expect(ui.getByText('Desactivar proveedor')).toBeTruthy(),
  );
  fireEvent.press(ui.getByText('Desactivar proveedor'));
  await waitFor(() => expect(ui.getByText('Inactivo')).toBeTruthy());
  expect(api.changeStatus).toHaveBeenCalledWith('1', 'inactive');
});
test('cancel does not delete; confirmed delete navigates to list', async () => {
  api.delete.mockResolvedValue({});
  const n = nav(),
    ui = draw(
      <SupplierDetailScreen route={{ params: { id: '1' } }} navigation={n} />,
    );
  await waitFor(() => expect(ui.getByText('Eliminar proveedor')).toBeTruthy());
  fireEvent.press(ui.getByText('Eliminar proveedor'));
  fireEvent.press(ui.getByText('Cancelar'));
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.press(ui.getByText('Eliminar proveedor'));
  fireEvent.press(ui.getByText('Confirmar eliminación'));
  await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('Suppliers'));
  expect(api.delete).toHaveBeenCalledWith('1');
});
test('forbidden delete is visible and preserves detail', async () => {
  api.delete.mockRejectedValue({ response: { status: 403 } });
  const n = nav(),
    ui = draw(
      <SupplierDetailScreen route={{ params: { id: '1' } }} navigation={n} />,
    );
  await waitFor(() => expect(ui.getByText('Eliminar proveedor')).toBeTruthy());
  fireEvent.press(ui.getByText('Eliminar proveedor'));
  fireEvent.press(ui.getByText('Confirmar eliminación'));
  await waitFor(() =>
    expect(ui.getByText('Sin permiso para esta operación')).toBeTruthy(),
  );
  expect(n.navigate).not.toHaveBeenCalled();
});
test('purchasing can edit/status but not delete', async () => {
  const ui = draw(
    <SupplierDetailScreen route={{ params: { id: '1' } }} navigation={nav()} />,
    all.slice(0, 3),
  );
  await waitFor(() => expect(ui.getByText('Editar proveedor')).toBeTruthy());
  expect(ui.getByText('Desactivar proveedor')).toBeTruthy();
  expect(ui.queryByText('Eliminar proveedor')).toBeNull();
});
test('auditor sees no mutations', async () => {
  const ui = draw(
    <SupplierDetailScreen route={{ params: { id: '1' } }} navigation={nav()} />,
    ['suppliers.read'],
  );
  await waitFor(() => expect(ui.getByText('QA Supplier')).toBeTruthy());
  for (const t of [
    'Editar proveedor',
    'Desactivar proveedor',
    'Eliminar proveedor',
  ])
    expect(ui.queryByText(t)).toBeNull();
});
