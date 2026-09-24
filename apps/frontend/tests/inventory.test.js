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
  InventoryScreen,
  InventoryMovementForm,
  WarehouseForm,
} from '../src/features/inventory';
import { InventorySelector } from '../src/features/inventory/InventorySelector';
import { inventoryService as api } from '../src/services/api';
jest.mock('../src/services/api', () => ({
  inventoryService: Object.fromEntries(
    [
      'getBalances',
      'getMovements',
      'getProducts',
      'getWarehouses',
      'createMovement',
      'createWarehouse',
    ].map((k) => [k, jest.fn()]),
  ),
}));
const permissions = [
  'read',
  'entry',
  'exit',
  'transfer',
  'adjust',
  'warehouse.manage',
].map((k) => 'inventory.' + k);
const product = {
  _id: 'p',
  name: 'Steel',
  sku: 'ST',
  type: 'PRODUCT',
  trackInventory: true,
  status: 'active',
};
const a = { _id: 'a', name: 'North', code: 'N' },
  b = { _id: 'b', name: 'South', code: 'S' };
const balance = {
  _id: 'bal',
  productId: product,
  warehouseId: a,
  quantity: '10.0000',
  available: '10.0000',
};
const response = (rows, total = rows.length) => ({
  data: { data: rows, pagination: { total } },
});
const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const draw = (child, grants = permissions) =>
  render(
    <AuthContext.Provider
      value={{ isAuthenticated: true, user: { permissions: grants } }}
    >
      {child}
    </AuthContext.Provider>,
  );
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  api.getBalances.mockResolvedValue(response([balance]));
  api.getMovements.mockResolvedValue(
    response([
      {
        _id: 'm',
        productId: product,
        type: 'ENTRY',
        quantity: '10.0000',
        destinationWarehouseId: a,
        reason: 'Initial',
        createdBy: 'actor',
      },
    ]),
  );
  api.getProducts.mockResolvedValue(response([product]));
  api.getWarehouses.mockResolvedValue(response([a, b]));
  api.createMovement.mockResolvedValue({
    data: { data: { _id: 'm', quantity: '2.0000' } },
  });
  api.createWarehouse.mockResolvedValue({});
});
afterEach(async () => {
  cleanup();
  await act(async () => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});
async function select(ui, label, title) {
  fireEvent.press(ui.getByText('Seleccionar ' + label));
  await waitFor(() => expect(ui.getByText(title)).toBeTruthy());
  fireEvent.press(ui.getByText(title));
}
async function fill(ui, type = 'ENTRY', quantity = '2') {
  await select(ui, 'Producto', 'Steel · ST');
  fireEvent.changeText(ui.getByLabelText('Cantidad'), quantity);
  if (['EXIT', 'TRANSFER'].includes(type) || quantity.startsWith('-'))
    await select(ui, 'Origen', 'North · N');
  if (
    ['ENTRY', 'TRANSFER'].includes(type) ||
    (type === 'ADJUSTMENT' && !quantity.startsWith('-'))
  )
    await select(
      ui,
      'Destino',
      type === 'TRANSFER' ? 'South · S' : 'North · N',
    );
  fireEvent.changeText(ui.getByLabelText('Motivo'), 'Physical count');
}
test('loading and balances', async () => {
  const ui = draw(<InventoryScreen navigation={nav()} />);
  expect(ui.getByLabelText('Cargando inventario')).toBeTruthy();
  await waitFor(() =>
    expect(ui.getByText('North · Disponible: 10.0000 ')).toBeTruthy(),
  );
});
test('history and audited movement', async () => {
  const ui = draw(<InventoryScreen navigation={nav()} />);
  fireEvent.press(ui.getByText('Historial'));
  await waitFor(() => expect(ui.getByText('Initial · ')).toBeTruthy());
  expect(api.getMovements).toHaveBeenCalled();
});
test('empty state', async () => {
  api.getBalances.mockResolvedValue(response([]));
  const ui = draw(<InventoryScreen navigation={nav()} />);
  await waitFor(() =>
    expect(ui.getByText('Sin registros de inventario')).toBeTruthy(),
  );
});
test('list error and retry', async () => {
  api.getBalances.mockRejectedValueOnce(new Error());
  const ui = draw(<InventoryScreen navigation={nav()} />);
  await waitFor(() => expect(ui.getByText('Reintentar')).toBeTruthy());
  fireEvent.press(ui.getByText('Reintentar'));
  await waitFor(() => expect(ui.getByText('Steel · ST')).toBeTruthy());
});
test('search filters and clearing', async () => {
  const ui = draw(<InventoryScreen navigation={nav()} />);
  fireEvent.press(ui.getByText('Historial'));
  fireEvent.changeText(ui.getByLabelText('Buscar producto o SKU'), 'Steel');
  fireEvent.press(ui.getByText('Entrada'));
  fireEvent.changeText(ui.getByLabelText('Desde UTC'), '2026-01-01T00:00:00Z');
  await select(ui, 'Almacén del filtro', 'North · N');
  fireEvent.press(ui.getByText('Aplicar filtros'));
  await waitFor(() =>
    expect(api.getMovements).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      search: 'Steel',
      type: 'ENTRY',
      from: '2026-01-01T00:00:00Z',
      warehouseId: 'a',
    }),
  );
  fireEvent.press(ui.getByText('Limpiar filtros'));
  await waitFor(() =>
    expect(api.getMovements).toHaveBeenLastCalledWith({ page: 1, limit: 20 }),
  );
});
test('pagination', async () => {
  api.getBalances.mockResolvedValue(response([balance], 21));
  const ui = draw(<InventoryScreen navigation={nav()} />);
  await waitFor(() => expect(ui.getByText('Página 1 · Total 21')).toBeTruthy());
  fireEvent.press(ui.getByText('Siguiente'));
  await waitFor(() => expect(ui.getByText('Página 2 · Total 21')).toBeTruthy());
  fireEvent.press(ui.getByText('Anterior'));
  await waitFor(() => expect(ui.getByText('Página 1 · Total 21')).toBeTruthy());
});
test('no read permission no request', () => {
  const ui = draw(<InventoryScreen navigation={nav()} />, []);
  expect(ui.getByText('Sin permiso para consultar inventario')).toBeTruthy();
  expect(api.getBalances).not.toHaveBeenCalled();
});
test('read only hides all operations', async () => {
  const ui = draw(<InventoryScreen navigation={nav()} />, ['inventory.read']);
  await waitFor(() => expect(ui.getByText('Steel · ST')).toBeTruthy());
  for (const name of ['entrada', 'salida', 'transferencia', 'ajuste'])
    expect(ui.queryByText('Nueva ' + name)).toBeNull();
  expect(ui.queryByText('Nuevo ajuste')).toBeNull();
  expect(ui.queryByText('Nuevo almacén')).toBeNull();
});
test('purchasing sees only entry', async () => {
  const n = nav(),
    ui = draw(<InventoryScreen navigation={n} />, [
      'inventory.read',
      'inventory.entry',
    ]);
  fireEvent.press(ui.getByText('Nueva entrada'));
  expect(n.navigate).toHaveBeenCalledWith('InventoryMovementForm', {
    type: 'ENTRY',
  });
  expect(ui.queryByText('Nueva salida')).toBeNull();
  await waitFor(() => expect(api.getBalances).toHaveBeenCalled());
});
for (const [type, quantity] of [
  ['ENTRY', '2'],
  ['EXIT', '2'],
  ['TRANSFER', '2'],
  ['ADJUSTMENT', '-0.1'],
  ['ADJUSTMENT', '0.1'],
])
  test(
    type + ' ' + quantity + ' confirmation applies one operation',
    async () => {
      const n = nav(),
        ui = draw(
          <InventoryMovementForm route={{ params: { type } }} navigation={n} />,
        );
      await fill(ui, type, quantity);
      fireEvent.press(ui.getByText('Revisar movimiento'));
      expect(api.createMovement).not.toHaveBeenCalled();
      fireEvent.press(ui.getByText('Confirmar y aplicar'));
      await waitFor(() =>
        expect(ui.getByText('Movimiento aplicado')).toBeTruthy(),
      );
      expect(api.createMovement).toHaveBeenCalledTimes(1);
      const data = api.createMovement.mock.calls[0][0];
      expect(data).toMatchObject({
        type,
        quantity,
        productId: 'p',
        reason: 'Physical count',
      });
      expect(data.createdBy).toBeUndefined();
      if (type === 'TRANSFER')
        expect(data).toMatchObject({
          sourceWarehouseId: 'a',
          destinationWarehouseId: 'b',
        });
      fireEvent.press(ui.getByText('Volver a inventario'));
      expect(n.navigate).toHaveBeenCalledWith('Inventory');
    },
  );
test('required selection and reason', () => {
  const ui = draw(<InventoryMovementForm navigation={nav()} />);
  fireEvent.press(ui.getByText('Revisar movimiento'));
  expect(ui.getByText('Completa producto, almacén y motivo')).toBeTruthy();
});
test('invalid quantities blocked before request', async () => {
  const ui = draw(<InventoryMovementForm navigation={nav()} />);
  await fill(ui);
  for (const quantity of ['0', '-1', 'NaN', '1.00001', '1e2']) {
    fireEvent.changeText(ui.getByLabelText('Cantidad'), quantity);
    fireEvent.press(ui.getByText('Revisar movimiento'));
    expect(
      ui.getByText('Cantidad inválida: hasta cuatro decimales, sin cero'),
    ).toBeTruthy();
  }
  expect(api.createMovement).not.toHaveBeenCalled();
});
test('same warehouse blocked', async () => {
  const ui = draw(
    <InventoryMovementForm
      route={{ params: { type: 'TRANSFER' } }}
      navigation={nav()}
    />,
  );
  await fill(ui, 'TRANSFER');
  await select(ui, 'Destino', 'North · N');
  fireEvent.press(ui.getByText('Revisar movimiento'));
  expect(ui.getByText('Origen y destino deben ser distintos')).toBeTruthy();
});
test('cancel confirmation does not write', async () => {
  const ui = draw(<InventoryMovementForm navigation={nav()} />);
  await fill(ui);
  fireEvent.press(ui.getByText('Revisar movimiento'));
  fireEvent.press(ui.getByText('Cancelar'));
  expect(api.createMovement).not.toHaveBeenCalled();
});
test('insufficient stock shown and retry preserves idempotency key', async () => {
  api.createMovement.mockRejectedValueOnce({
    response: { status: 409, data: { error: 'Stock insuficiente' } },
  });
  const ui = draw(
    <InventoryMovementForm
      route={{ params: { type: 'EXIT' } }}
      navigation={nav()}
    />,
  );
  await fill(ui, 'EXIT');
  fireEvent.press(ui.getByText('Revisar movimiento'));
  fireEvent.press(ui.getByText('Confirmar y aplicar'));
  await waitFor(() => expect(ui.getByText('Stock insuficiente')).toBeTruthy());
  fireEvent.press(ui.getByText('Revisar movimiento'));
  fireEvent.press(ui.getByText('Confirmar y aplicar'));
  await waitFor(() => expect(ui.getByText('Movimiento aplicado')).toBeTruthy());
  expect(api.createMovement.mock.calls[0][0].idempotencyKey).toBe(
    api.createMovement.mock.calls[1][0].idempotencyKey,
  );
});
test('direct unauthorized form blocked', () => {
  const ui = draw(<InventoryMovementForm navigation={nav()} />, [
    'inventory.read',
  ]);
  expect(
    ui.getByText('Sin permiso para registrar este movimiento'),
  ).toBeTruthy();
});
test('service and untracked products filtered defensively', async () => {
  api.getProducts.mockResolvedValue(
    response([
      product,
      { ...product, _id: 's', name: 'Labor', type: 'SERVICE' },
      { ...product, _id: 'u', name: 'Untracked', trackInventory: false },
    ]),
  );
  const ui = draw(<InventoryMovementForm navigation={nav()} />);
  fireEvent.press(ui.getByText('Seleccionar Producto'));
  await waitFor(() => expect(ui.getByText('Steel · ST')).toBeTruthy());
  expect(ui.queryByText('Labor · ST')).toBeNull();
  expect(ui.queryByText('Untracked · ST')).toBeNull();
});
test('selector search pagination and empty', async () => {
  api.getProducts.mockResolvedValue(response([product], 11));
  const ui = draw(
    <InventorySelector kind="products" label="Producto" onSelect={jest.fn()} />,
  );
  fireEvent.press(ui.getByText('Seleccionar Producto'));
  await waitFor(() => expect(ui.getByText('Steel · ST')).toBeTruthy());
  fireEvent.press(ui.getByText('Siguiente Producto'));
  await waitFor(() =>
    expect(api.getProducts).toHaveBeenLastCalledWith({ page: 2, limit: 10 }),
  );
  api.getProducts.mockResolvedValue(response([]));
  fireEvent.changeText(ui.getByLabelText('Buscar Producto'), 'missing');
  fireEvent.press(ui.getByText('Buscar Producto'));
  await waitFor(() =>
    expect(ui.getByText('Sin opciones elegibles')).toBeTruthy(),
  );
});
test('warehouse creation', async () => {
  const n = nav(),
    ui = draw(<WarehouseForm navigation={n} />);
  fireEvent.changeText(ui.getByLabelText('Código'), 'N');
  fireEvent.changeText(ui.getByLabelText('Nombre del almacén'), 'North');
  fireEvent.press(ui.getByText('Guardar almacén'));
  await waitFor(() => expect(n.goBack).toHaveBeenCalled());
  expect(api.createWarehouse).toHaveBeenCalledWith({
    code: 'N',
    name: 'North',
  });
});
test('warehouse forbidden', () => {
  const ui = draw(<WarehouseForm navigation={nav()} />, []);
  expect(ui.getByText('Sin permiso para administrar almacenes')).toBeTruthy();
});
