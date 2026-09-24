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
  ProductsScreen,
  ProductForm,
  ProductDetailScreen,
} from '../src/features/products';
import { productService as api } from '../src/services/api';
jest.mock('../src/services/api', () => ({
  productService: {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    delete: jest.fn(),
  },
}));
const all = [
  'products.read',
  'products.create',
  'products.update',
  'products.delete',
];
const item = {
  _id: '1',
  name: 'QA Product',
  status: 'active',
  type: 'PRODUCT',
  sku: 'QA-1',
  trackInventory: false,
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
    ui = draw(<ProductsScreen navigation={n} />);
  expect(ui.getByLabelText('Cargando elementos')).toBeTruthy();
  await waitFor(() => expect(ui.getByText('QA Product')).toBeTruthy());
  fireEvent.press(ui.getByLabelText('Abrir QA Product'));
  expect(n.navigate).toHaveBeenCalledWith('ProductDetail', { id: '1' });
});
test('empty list', async () => {
  api.getAll.mockResolvedValue({
    data: { data: [], pagination: { total: 0 } },
  });
  const ui = draw(<ProductsScreen navigation={nav()} />);
  await waitFor(() =>
    expect(ui.getByText('No se encontraron elementos')).toBeTruthy(),
  );
});
test('list error and retry', async () => {
  api.getAll.mockRejectedValueOnce(new Error('offline'));
  const ui = draw(<ProductsScreen navigation={nav()} />);
  await waitFor(() => expect(ui.getByText('Reintentar')).toBeTruthy());
  fireEvent.press(ui.getByText('Reintentar'));
  await waitFor(() => expect(ui.getByText('QA Product')).toBeTruthy());
});
test('search and filters reset page and use existing API', async () => {
  const ui = draw(<ProductsScreen navigation={nav()} />);
  await waitFor(() => expect(ui.getByText('QA Product')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('Buscar elementos'), 'Steel');
  fireEvent.changeText(ui.getByLabelText('Filtro Categoría'), 'Metal');
  fireEvent.changeText(ui.getByLabelText('Filtro Moneda (3 letras)'), 'USD');
  fireEvent.press(ui.getByText('Inactivos'));
  fireEvent.press(ui.getByText('Producto'));
  fireEvent.press(ui.getByText('Buscar / aplicar filtros'));
  await waitFor(() =>
    expect(api.getAll).toHaveBeenLastCalledWith({
      search: 'Steel',
      category: 'Metal',
      currency: 'USD',
      status: 'inactive',
      type: 'PRODUCT',
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
  const ui = draw(<ProductsScreen navigation={nav()} />);
  await waitFor(() => expect(ui.getByText('QA Product')).toBeTruthy());
  fireEvent.press(ui.getByText('Siguiente'));
  await waitFor(() => expect(ui.getByText('Página 2 · Total 21')).toBeTruthy());
  expect(api.getAll).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
  fireEvent.press(ui.getByText('Anterior'));
  await waitFor(() => expect(ui.getByText('Página 1 · Total 21')).toBeTruthy());
});
test('create navigation respects permission', async () => {
  const n = nav(),
    ui = draw(<ProductsScreen navigation={n} />);
  await waitFor(() => expect(ui.getByText('QA Product')).toBeTruthy());
  fireEvent.press(ui.getByText('Crear elemento'));
  expect(n.navigate).toHaveBeenCalledWith('ProductForm');
});
test('read-only hides create', async () => {
  const ui = draw(<ProductsScreen navigation={nav()} />, ['products.read']);
  await waitFor(() => expect(ui.getByText('QA Product')).toBeTruthy());
  expect(ui.queryByText('Crear elemento')).toBeNull();
});
test('no permission means no request', () => {
  const ui = draw(<ProductsScreen navigation={nav()} />, []);
  expect(ui.getByText('Sin permiso para consultar elementos')).toBeTruthy();
  expect(api.getAll).not.toHaveBeenCalled();
});
test('form validates name and required SKU', () => {
  const ui = draw(<ProductForm route={{ params: {} }} navigation={nav()} />);
  fireEvent.press(ui.getByText('Registrar elemento'));
  expect(ui.getByText('Nombre requerido')).toBeTruthy();
  fireEvent.changeText(ui.getByLabelText('Nombre'), 'QA');
  fireEvent.changeText(ui.getByLabelText('SKU'), 'QA-1');
  fireEvent.changeText(ui.getByLabelText('SKU'), '');
  fireEvent.press(ui.getByText('Registrar elemento'));
  expect(ui.getByText('SKU requerido')).toBeTruthy();
  expect(api.create).not.toHaveBeenCalled();
});
test('create then replace with real detail ID', async () => {
  api.create.mockResolvedValue({ data: { data: item } });
  const n = nav(),
    ui = draw(<ProductForm route={{ params: {} }} navigation={n} />);
  fireEvent.changeText(ui.getByLabelText('Nombre'), 'QA');
  fireEvent.changeText(ui.getByLabelText('SKU'), 'QA-1');
  fireEvent.press(ui.getByText('Registrar elemento'));
  await waitFor(() =>
    expect(n.replace).toHaveBeenCalledWith('ProductDetail', { id: '1' }),
  );
  expect(api.create).toHaveBeenCalledWith({
    name: 'QA',
    sku: 'QA-1',
    type: 'PRODUCT',
    trackInventory: false,
  });
});
test('server errors remain visible and do not navigate', async () => {
  api.create.mockRejectedValue({
    response: { status: 409, data: { error: 'Elemento duplicado' } },
  });
  const n = nav(),
    ui = draw(<ProductForm route={{ params: {} }} navigation={n} />);
  fireEvent.changeText(ui.getByLabelText('Nombre'), 'QA');
  fireEvent.changeText(ui.getByLabelText('SKU'), 'QA-1');
  fireEvent.press(ui.getByText('Registrar elemento'));
  await waitFor(() => expect(ui.getByText('Elemento duplicado')).toBeTruthy());
  expect(n.replace).not.toHaveBeenCalled();
});
test('edit loads allowlisted fields and updates', async () => {
  api.update.mockResolvedValue({});
  const n = nav(),
    ui = draw(
      <ProductForm route={{ params: { productId: '1' } }} navigation={n} />,
    );
  await waitFor(() =>
    expect(ui.getByLabelText('Nombre').props.value).toBe(item.name),
  );
  fireEvent.changeText(ui.getByLabelText('Nombre'), 'Edited');
  fireEvent.press(ui.getByText('Guardar cambios'));
  await waitFor(() => expect(n.goBack).toHaveBeenCalled());
  expect(api.update.mock.calls[0][1].name).toBe('Edited');
  expect(api.update.mock.calls[0][1]._id).toBeUndefined();
});
test('failed load prevents saving until retry succeeds', async () => {
  api.getById.mockRejectedValueOnce(new Error('offline'));
  const ui = draw(
    <ProductForm route={{ params: { productId: '1' } }} navigation={nav()} />,
  );
  await waitFor(() => expect(ui.getByText('Reintentar')).toBeTruthy());
  fireEvent.press(ui.getByText('Guardar cambios'));
  expect(api.update).not.toHaveBeenCalled();
  fireEvent.press(ui.getByText('Reintentar'));
  await waitFor(() =>
    expect(ui.getByLabelText('Nombre').props.value).toBe(item.name),
  );
});
test('unauthorized direct form is denied', () => {
  const ui = draw(<ProductForm route={{ params: {} }} navigation={nav()} />, [
    'products.read',
  ]);
  expect(ui.getByText('Sin permiso para guardar elementos')).toBeTruthy();
});
test('detail renders and navigates to edit', async () => {
  const n = nav(),
    ui = draw(
      <ProductDetailScreen route={{ params: { id: '1' } }} navigation={n} />,
    );
  await waitFor(() => expect(ui.getByText('QA Product')).toBeTruthy());
  fireEvent.press(ui.getByText('Editar elemento'));
  expect(n.navigate).toHaveBeenCalledWith('ProductForm', { productId: '1' });
});
test('detail error retries', async () => {
  api.getById.mockRejectedValueOnce(new Error('offline'));
  const ui = draw(
    <ProductDetailScreen route={{ params: { id: '1' } }} navigation={nav()} />,
  );
  await waitFor(() => expect(ui.getByText('Reintentar')).toBeTruthy());
  fireEvent.press(ui.getByText('Reintentar'));
  await waitFor(() => expect(ui.getByText('QA Product')).toBeTruthy());
});
test('changes active status and shows returned state', async () => {
  api.changeStatus.mockResolvedValue({
    data: { data: { ...item, status: 'inactive' } },
  });
  const ui = draw(
    <ProductDetailScreen route={{ params: { id: '1' } }} navigation={nav()} />,
  );
  await waitFor(() => expect(ui.getByText('Desactivar elemento')).toBeTruthy());
  fireEvent.press(ui.getByText('Desactivar elemento'));
  await waitFor(() => expect(ui.getByText('Inactivo')).toBeTruthy());
  expect(api.changeStatus).toHaveBeenCalledWith('1', 'inactive');
});
test('cancel does not delete; confirmed delete navigates to list', async () => {
  api.delete.mockResolvedValue({});
  const n = nav(),
    ui = draw(
      <ProductDetailScreen route={{ params: { id: '1' } }} navigation={n} />,
    );
  await waitFor(() => expect(ui.getByText('Eliminar elemento')).toBeTruthy());
  fireEvent.press(ui.getByText('Eliminar elemento'));
  fireEvent.press(ui.getByText('Cancelar'));
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.press(ui.getByText('Eliminar elemento'));
  fireEvent.press(ui.getByText('Confirmar eliminación'));
  await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('Products'));
  expect(api.delete).toHaveBeenCalledWith('1');
});
test('forbidden delete is visible and preserves detail', async () => {
  api.delete.mockRejectedValue({ response: { status: 403 } });
  const n = nav(),
    ui = draw(
      <ProductDetailScreen route={{ params: { id: '1' } }} navigation={n} />,
    );
  await waitFor(() => expect(ui.getByText('Eliminar elemento')).toBeTruthy());
  fireEvent.press(ui.getByText('Eliminar elemento'));
  fireEvent.press(ui.getByText('Confirmar eliminación'));
  await waitFor(() =>
    expect(ui.getByText('Sin permiso para esta operación')).toBeTruthy(),
  );
  expect(n.navigate).not.toHaveBeenCalled();
});
test('purchasing can edit/status but not delete', async () => {
  const ui = draw(
    <ProductDetailScreen route={{ params: { id: '1' } }} navigation={nav()} />,
    all.slice(0, 3),
  );
  await waitFor(() => expect(ui.getByText('Editar elemento')).toBeTruthy());
  expect(ui.getByText('Desactivar elemento')).toBeTruthy();
  expect(ui.queryByText('Eliminar elemento')).toBeNull();
});
test('auditor sees no mutations', async () => {
  const ui = draw(
    <ProductDetailScreen route={{ params: { id: '1' } }} navigation={nav()} />,
    ['products.read'],
  );
  await waitFor(() => expect(ui.getByText('QA Product')).toBeTruthy());
  for (const t of [
    'Editar elemento',
    'Desactivar elemento',
    'Eliminar elemento',
  ])
    expect(ui.queryByText(t)).toBeNull();
});

test('SERVICE dynamically hides physical fields and clears their values', async () => {
  api.create.mockResolvedValue({
    data: { data: { ...item, type: 'SERVICE' } },
  });
  const ui = draw(<ProductForm route={{ params: {} }} navigation={nav()} />);
  fireEvent.changeText(ui.getByLabelText('Nombre'), 'Labor');
  fireEvent.changeText(ui.getByLabelText('SKU'), 'LABOR');
  fireEvent.changeText(ui.getByLabelText('Código de barras'), '123');
  fireEvent.press(ui.getByText('Seguimiento futuro de inventario: No'));
  fireEvent.press(ui.getByText('Servicio'));
  expect(ui.queryByLabelText('Código de barras')).toBeNull();
  expect(ui.queryByText('Seguimiento futuro de inventario: Sí')).toBeNull();
  fireEvent.press(ui.getByText('Registrar elemento'));
  await waitFor(() =>
    expect(api.create).toHaveBeenCalledWith({
      name: 'Labor',
      sku: 'LABOR',
      type: 'SERVICE',
      barcode: '',
      trackInventory: false,
    }),
  );
});
test('rejects negative or excess precision monetary values in form', () => {
  const ui = draw(<ProductForm route={{ params: {} }} navigation={nav()} />);
  fireEvent.changeText(ui.getByLabelText('Nombre'), 'QA');
  fireEvent.changeText(ui.getByLabelText('SKU'), 'QA');
  for (const value of ['-1', '1.00001']) {
    fireEvent.changeText(ui.getByLabelText('Precio base'), value);
    fireEvent.press(ui.getByText('Registrar elemento'));
    expect(ui.getByText('Importe inválido')).toBeTruthy();
  }
  expect(api.create).not.toHaveBeenCalled();
});
test('SERVICE detail shows exact price and unit', async () => {
  api.getById.mockResolvedValue({
    data: { data: { ...item, type: 'SERVICE', price: '0.1000', unit: 'hour' } },
  });
  const ui = draw(
    <ProductDetailScreen route={{ params: { id: '1' } }} navigation={nav()} />,
  );
  await waitFor(() => expect(ui.getByText('SERVICE')).toBeTruthy());
  expect(ui.getByText('0.1000')).toBeTruthy();
  expect(ui.getByText('hour')).toBeTruthy();
});
