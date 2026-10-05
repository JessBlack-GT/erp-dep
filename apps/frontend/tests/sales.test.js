import React from 'react';
import {
  render,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from '@testing-library/react-native';
import { AuthContext } from '../src/context/AuthContext';
import { SalesScreen, SaleForm, SaleDetailScreen } from '../src/features/sales';
import { SalesSelector } from '../src/features/sales/SalesSelector';
import { SaleTotals } from '../src/features/sales/SaleTotals';
import { salesError } from '../src/features/sales/shared';
import {
  salesService as api,
  customerService,
  productService,
  inventoryService,
} from '../src/services/api';

jest.mock('../src/services/api', () => ({
  salesService: Object.fromEntries(
    ['getAll', 'getById', 'create', 'update', 'confirm', 'cancel'].map((k) => [
      k,
      jest.fn(),
    ]),
  ),
  customerService: { getAll: jest.fn(), getById: jest.fn() },
  productService: { getAll: jest.fn(), getById: jest.fn() },
  inventoryService: { getWarehouses: jest.fn() },
}));
const permissions = [
  'commercial.read',
  'commercial.create',
  'commercial.update',
  'commercial.confirm',
  'commercial.cancel',
  'customers.read',
  'products.read',
  'inventory.read',
];
const customer = {
  _id: 'customer-1',
  name: 'Cliente activo',
  status: 'active',
};
const product = {
  _id: 'product-1',
  name: 'Artículo',
  sku: 'SKU-1',
  type: 'PRODUCT',
  unit: 'UND',
  trackInventory: true,
  price: '12.3400',
  currency: 'GTQ',
  status: 'active',
};
const service = {
  ...product,
  _id: 'service-1',
  name: 'Asesoría',
  sku: 'SERV-1',
  type: 'SERVICE',
  unit: 'H',
  trackInventory: false,
};
const warehouse = {
  _id: 'warehouse-1',
  name: 'Central',
  code: 'CEN',
  status: 'active',
};
const line = {
  _id: 'line-1',
  productId: product._id,
  snapshot: { ...product, name: 'Nombre al vender' },
  quantity: '2.0000',
  unitPrice: '12.3400',
  discountRate: '5.00',
  taxRate: '12.00',
  warehouseId: warehouse._id,
  subtotal: '24.6800',
  discount: '1.2340',
  tax: '2.8135',
  total: '26.2595',
};
const sale = {
  _id: 'sale-1',
  number: 'SALE-000001',
  date: '2026-10-05T00:00:00.000Z',
  currency: 'GTQ',
  entity: { id: customer._id, name: 'Cliente al vender' },
  status: 'draft',
  revision: 7,
  lines: [line],
  subtotal: '24.6800',
  discount: '1.2340',
  tax: '2.8135',
  total: '26.2595',
};
const response = (data) => ({ data: { data } });
const list = (rows, page = 1, total = rows.length) => ({
  data: {
    data: rows,
    pagination: { page, limit: 20, total, pages: Math.ceil(total / 20) },
  },
});
const nav = () => ({ navigate: jest.fn(), replace: jest.fn() });
const draw = (child, granted = permissions) =>
  render(
    <AuthContext.Provider
      value={{ isAuthenticated: true, user: { permissions: granted } }}
    >
      {child}
    </AuthContext.Provider>,
  );
const press = (ui, name) => fireEvent.press(ui.getByRole('button', { name }));
const change = (ui, name, value) =>
  fireEvent.changeText(ui.getByLabelText(name), value);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
async function select(ui, label, option) {
  press(ui, `Seleccionar ${label}`);
  await waitFor(() =>
    expect(ui.getByRole('button', { name: option })).toBeTruthy(),
  );
  fireEvent.press(ui.getByRole('button', { name: option }));
}
async function fill(ui, selected = /Artículo · SKU-1/) {
  change(ui, 'Fecha', '2026-10-05');
  change(ui, 'Moneda', 'GTQ');
  await select(ui, 'Cliente', 'Cliente activo');
  await select(ui, 'Producto 1', selected);
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  api.getAll.mockResolvedValue(list([sale]));
  api.getById.mockResolvedValue(response(sale));
  api.create.mockResolvedValue(response(sale));
  api.update.mockResolvedValue(response({ ...sale, revision: 8 }));
  api.confirm.mockResolvedValue(
    response({ ...sale, status: 'confirmed', revision: 8 }),
  );
  api.cancel.mockResolvedValue(
    response({ ...sale, status: 'cancelled', revision: 8 }),
  );
  customerService.getAll.mockResolvedValue(response([customer]));
  customerService.getById.mockResolvedValue(response(customer));
  productService.getAll.mockResolvedValue(list([product, service]));
  productService.getById.mockResolvedValue(response(product));
  inventoryService.getWarehouses.mockResolvedValue(list([warehouse]));
});
afterEach(async () => {
  cleanup();
  await act(async () => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

test('list loading, real fields, detail and create navigation, refresh', async () => {
  const n = nav(),
    ui = draw(<SalesScreen navigation={n} />);
  expect(ui.getByLabelText('Cargando ventas')).toBeTruthy();
  await waitFor(() => expect(ui.getByText(sale.number)).toBeTruthy());
  for (const text of [
    '2026-10-05',
    'Cliente al vender',
    '26.2595 GTQ',
    'Borrador',
  ])
    expect(ui.getAllByText(text).length).toBeGreaterThan(0);
  press(ui, `Ver ${sale.number}`);
  expect(n.navigate).toHaveBeenCalledWith('SaleDetail', { id: sale._id });
  press(ui, 'Nueva venta');
  expect(n.navigate).toHaveBeenCalledWith('SaleForm', { id: null });
  press(ui, 'Actualizar ventas');
  await waitFor(() => expect(api.getAll).toHaveBeenCalledTimes(2));
});
test('empty list', async () => {
  api.getAll.mockResolvedValue(list([]));
  const ui = draw(<SalesScreen navigation={nav()} />);
  await waitFor(() => expect(ui.getByText('Sin ventas')).toBeTruthy());
});
test.each([400, 401, 403, 404, 409, 500, 503])(
  'safe HTTP %s error, no backend details',
  async (status) => {
    const error = {
      response: { status, data: { error: 'MongoDB SECRET token stack' } },
    };
    api.getAll.mockRejectedValue(error);
    const ui = draw(<SalesScreen navigation={nav()} />);
    await waitFor(() => expect(ui.getByText(salesError(error))).toBeTruthy());
    expect(JSON.stringify(ui.toJSON())).not.toContain('MongoDB SECRET');
  },
);
test('search, state, dates and pagination keep applied filters', async () => {
  api.getAll.mockResolvedValue(list([sale], 1, 41));
  const ui = draw(<SalesScreen navigation={nav()} />);
  await waitFor(() => expect(ui.getByText(sale.number)).toBeTruthy());
  change(ui, 'Buscar ventas', ' SALE- ');
  change(ui, 'Desde', '2026-10-01');
  change(ui, 'Hasta', '2026-10-31');
  press(ui, 'Confirmada');
  press(ui, 'Aplicar filtros');
  await waitFor(() =>
    expect(api.getAll).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      search: 'SALE-',
      status: 'confirmed',
      from: '2026-10-01',
      to: '2026-10-31',
    }),
  );
  await waitFor(() =>
    expect(ui.queryByLabelText('Cargando ventas')).toBeNull(),
  );
  press(ui, 'Página siguiente');
  await waitFor(() =>
    expect(api.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, status: 'confirmed' }),
    ),
  );
  await waitFor(() =>
    expect(ui.queryByLabelText('Cargando ventas')).toBeNull(),
  );
  press(ui, 'Página anterior');
  await waitFor(() =>
    expect(api.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
    ),
  );
  press(ui, 'Limpiar filtros');
  await waitFor(() =>
    expect(api.getAll).toHaveBeenLastCalledWith({ page: 1, limit: 20 }),
  );
});
test('invalid date range does not request API', async () => {
  const ui = draw(<SalesScreen navigation={nav()} />);
  await waitFor(() => expect(ui.getByText(sale.number)).toBeTruthy());
  change(ui, 'Desde', '2026-02-30');
  press(ui, 'Aplicar filtros');
  expect(ui.getByText(/Revisa las fechas/)).toBeTruthy();
  expect(api.getAll).toHaveBeenCalledTimes(1);
});
test('ignores late list response after filters change', async () => {
  const slow = deferred();
  api.getAll.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(list([]));
  const ui = draw(<SalesScreen navigation={nav()} />);
  press(ui, 'Aplicar filtros');
  await waitFor(() => expect(ui.getByText('Sin ventas')).toBeTruthy());
  await act(async () => slow.resolve(list([sale])));
  expect(ui.queryByText(sale.number)).toBeNull();
});
test('create whitelists editable payload, selects active catalog and warehouse', async () => {
  const n = nav(),
    ui = draw(<SaleForm navigation={n} />);
  await fill(ui);
  await select(ui, 'Almacén 1', 'Central · CEN');
  change(ui, 'Cantidad 1', '2');
  change(ui, 'Descuento % 1', '5');
  change(ui, 'Impuesto % 1', '12');
  press(ui, 'Guardar borrador');
  await waitFor(() =>
    expect(n.replace).toHaveBeenCalledWith('SaleDetail', { id: sale._id }),
  );
  expect(api.create).toHaveBeenCalledWith({
    date: '2026-10-05',
    currency: 'GTQ',
    entityId: customer._id,
    lines: [
      {
        productId: product._id,
        quantity: '2',
        unitPrice: '12.3400',
        discountRate: '5',
        taxRate: '12',
        warehouseId: warehouse._id,
      },
    ],
  });
  for (const method of [
    customerService.getAll,
    productService.getAll,
    inventoryService.getWarehouses,
  ])
    expect(method).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
    );
});
test.each([
  ['SERVICE', false],
  ['PRODUCT', false],
])(
  '%s untracked has no warehouse and sends none',
  async (type, trackInventory) => {
    productService.getAll.mockResolvedValue(
      list([{ ...service, type, trackInventory }]),
    );
    const ui = draw(<SaleForm navigation={nav()} />);
    await fill(ui, /Asesoría · SERV-1/);
    expect(ui.queryByText(/Almacén obligatorio/)).toBeNull();
    press(ui, 'Guardar borrador');
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0][0].lines[0]).not.toHaveProperty(
      'warehouseId',
    );
  },
);
test('tracked draft may be saved before choosing warehouse', async () => {
  const ui = draw(<SaleForm navigation={nav()} />);
  await fill(ui);
  press(ui, 'Guardar borrador');
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  expect(api.create.mock.calls[0][0].lines[0]).not.toHaveProperty(
    'warehouseId',
  );
});
test('changing tracked product to service removes old warehouse and add/remove lines', async () => {
  const ui = draw(<SaleForm navigation={nav()} />);
  await fill(ui);
  await select(ui, 'Almacén 1', 'Central · CEN');
  await select(ui, 'Producto 1', /Asesoría · SERV-1/);
  press(ui, 'Agregar línea');
  expect(ui.getByText('Línea 2')).toBeTruthy();
  press(ui, 'Eliminar línea 2');
  expect(ui.queryByText('Línea 2')).toBeNull();
  press(ui, 'Guardar borrador');
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  expect(api.create.mock.calls[0][0].lines).toHaveLength(1);
  expect(api.create.mock.calls[0][0].lines[0]).not.toHaveProperty(
    'warehouseId',
  );
});
test.each([
  ['Cantidad 1', '0'],
  ['Cantidad 1', '-1'],
  ['Precio 1', '-1'],
  ['Precio 1', 'NaN'],
  ['Descuento % 1', '101'],
  ['Impuesto % 1', '-1'],
])('validates %s = %s', async (field, value) => {
  const ui = draw(<SaleForm navigation={nav()} />);
  await fill(ui);
  change(ui, field, value);
  press(ui, 'Guardar borrador');
  expect(ui.getByText(/Revisa las líneas/)).toBeTruthy();
  expect(api.create).not.toHaveBeenCalled();
});
test('requires date, currency, active customer and at least one line', async () => {
  const ui = draw(<SaleForm navigation={nav()} />);
  change(ui, 'Fecha', '2026-02-30');
  press(ui, 'Guardar borrador');
  expect(ui.getByText(/fecha válida/)).toBeTruthy();
  change(ui, 'Fecha', '2026-10-05');
  press(ui, 'Guardar borrador');
  expect(ui.getByText(/moneda de tres/)).toBeTruthy();
  change(ui, 'Moneda', 'GTQ');
  press(ui, 'Guardar borrador');
  expect(ui.getByText('Selecciona un cliente activo.')).toBeTruthy();
  await select(ui, 'Cliente', 'Cliente activo');
  press(ui, 'Eliminar línea 1');
  press(ui, 'Guardar borrador');
  expect(ui.getByText('Agrega al menos una línea.')).toBeTruthy();
  expect(api.create).not.toHaveBeenCalled();
});
test.each(['customer', 'product', 'warehouse'])(
  'selector rejects inactive/deleted %s and searches',
  async (kind) => {
    const row = { customer, product, warehouse }[kind];
    const method = {
      customer: customerService.getAll,
      product: productService.getAll,
      warehouse: inventoryService.getWarehouses,
    }[kind];
    method.mockResolvedValue(
      list([
        row,
        { ...row, _id: 'bad', name: 'Inactivo', status: 'inactive' },
        { ...row, _id: 'deleted', name: 'Eliminado', deletedAt: '2026-01-01' },
      ]),
    );
    const ui = draw(
      <SalesSelector kind={kind} label="Catálogo" onSelect={jest.fn()} />,
    );
    press(ui, 'Seleccionar Catálogo');
    await waitFor(() =>
      expect(ui.queryByLabelText('Cargando Catálogo')).toBeNull(),
    );
    expect(ui.queryByText(/Inactivo|Eliminado/)).toBeNull();
    change(ui, 'Buscar Catálogo', ' consulta ');
    press(ui, 'Buscar Catálogo');
    await waitFor(() =>
      expect(method).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'consulta', status: 'active' }),
      ),
    );
  },
);
test('customer picker paginates without pagination metadata', async () => {
  customerService.getAll.mockResolvedValue(
    response(
      Array.from({ length: 10 }, (_, i) => ({
        ...customer,
        _id: `c${i}`,
        name: `Cliente ${i}`,
      })),
    ),
  );
  const ui = draw(
    <SalesSelector kind="customer" label="Cliente" onSelect={jest.fn()} />,
  );
  press(ui, 'Seleccionar Cliente');
  await waitFor(() => expect(ui.getByText('Cliente 9')).toBeTruthy());
  press(ui, 'Siguiente Cliente');
  await waitFor(() =>
    expect(customerService.getAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    ),
  );
});
test('picker sanitizes errors and respects catalog permission', async () => {
  productService.getAll.mockRejectedValue({
    response: { status: 503, data: { error: 'SECRET' } },
  });
  const ui = draw(
    <SalesSelector kind="product" label="Producto" onSelect={jest.fn()} />,
  );
  press(ui, 'Seleccionar Producto');
  await waitFor(() =>
    expect(ui.getByText(/servicio no está disponible/)).toBeTruthy(),
  );
  expect(JSON.stringify(ui.toJSON())).not.toContain('SECRET');
  cleanup();
  const denied = draw(
    <SalesSelector kind="product" label="Producto" onSelect={jest.fn()} />,
    ['commercial.read'],
  );
  expect(denied.getByText(/Se requiere permiso products.read/)).toBeTruthy();
});
test('server totals rendered exactly, no floating point recomputation', () => {
  const ui = render(
    <SaleTotals sale={{ ...sale, total: '99999999999.9999' }} dirty />,
  );
  expect(ui.getByText('Total: 99999999999.9999 GTQ')).toBeTruthy();
  expect(ui.getByText(/último guardado/)).toBeTruthy();
});
test('draft loads current catalog and updates with exact expectedRevision', async () => {
  const n = nav(),
    ui = draw(<SaleForm navigation={n} route={{ params: { id: sale._id } }} />);
  await waitFor(() => expect(ui.getByLabelText('Cantidad 1')).toBeTruthy());
  change(ui, 'Cantidad 1', '3');
  press(ui, 'Guardar borrador');
  await waitFor(() => expect(n.replace).toHaveBeenCalled());
  const payload = api.update.mock.calls[0][1];
  expect(payload.expectedRevision).toBe(7);
  expect(Object.keys(payload).sort()).toEqual([
    'currency',
    'date',
    'entityId',
    'expectedRevision',
    'lines',
  ]);
  expect(payload.lines[0].quantity).toBe('3');
  expect(payload.lines[0]).not.toHaveProperty('snapshot');
});
test.each(['confirmed', 'cancelled'])(
  '%s cannot be edited through direct route',
  async (status) => {
    api.getById.mockResolvedValue(response({ ...sale, status }));
    const ui = draw(
      <SaleForm navigation={nav()} route={{ params: { id: sale._id } }} />,
    );
    await waitFor(() => expect(ui.getByText(/no puede editarse/)).toBeTruthy());
    expect(ui.queryByRole('button', { name: 'Guardar borrador' })).toBeNull();
    expect(api.update).not.toHaveBeenCalled();
  },
);
test('inactive product loaded in draft cannot be saved', async () => {
  productService.getById.mockResolvedValue(
    response({ ...product, status: 'inactive' }),
  );
  const ui = draw(
    <SaleForm navigation={nav()} route={{ params: { id: sale._id } }} />,
  );
  await waitFor(() => expect(ui.getByLabelText('Cantidad 1')).toBeTruthy());
  press(ui, 'Guardar borrador');
  expect(ui.getByText(/producto o servicio activo/)).toBeTruthy();
  expect(api.update).not.toHaveBeenCalled();
});
test('create double click prevented and uncertain creation is never retried', async () => {
  const pending = deferred();
  api.create.mockReturnValue(pending.promise);
  const ui = draw(<SaleForm navigation={nav()} />);
  await fill(ui);
  press(ui, 'Guardar borrador');
  press(ui, 'Guardar borrador');
  expect(api.create).toHaveBeenCalledTimes(1);
  await act(async () => pending.reject(new Error('network SECRET')));
  expect(ui.getByText(/resultado del guardado es incierto/)).toBeTruthy();
  press(ui, 'Guardar borrador');
  expect(api.create).toHaveBeenCalledTimes(1);
});
test('update conflict reloads state and blocks overwrite until explicit reload', async () => {
  api.update.mockRejectedValue({ response: { status: 409 } });
  api.getById
    .mockResolvedValueOnce(response(sale))
    .mockResolvedValue(response({ ...sale, revision: 10 }));
  const ui = draw(
    <SaleForm navigation={nav()} route={{ params: { id: sale._id } }} />,
  );
  await waitFor(() => expect(ui.getByLabelText('Cantidad 1')).toBeTruthy());
  press(ui, 'Guardar borrador');
  await waitFor(() =>
    expect(ui.getByText(/Recarga antes de editar/)).toBeTruthy(),
  );
  press(ui, 'Guardar borrador');
  expect(api.update).toHaveBeenCalledTimes(1);
  press(ui, 'Recargar y descartar cambios');
  await waitFor(() =>
    expect(ui.queryByLabelText('Procesando venta')).toBeNull(),
  );
  api.update.mockResolvedValue(response({ ...sale, revision: 11 }));
  press(ui, 'Guardar borrador');
  await waitFor(() =>
    expect(api.update).toHaveBeenLastCalledWith(
      sale._id,
      expect.objectContaining({ expectedRevision: 10 }),
    ),
  );
});
test('detail uses snapshots and movement references; edit navigation', async () => {
  api.getById.mockResolvedValue(
    response({
      ...sale,
      lines: [
        { ...line, exitMovementId: 'exit-1', reversalMovementId: 'reverse-1' },
      ],
    }),
  );
  const n = nav(),
    ui = draw(
      <SaleDetailScreen navigation={n} route={{ params: { id: sale._id } }} />,
    );
  await waitFor(() =>
    expect(ui.getByText('Nombre al vender · SKU-1')).toBeTruthy(),
  );
  expect(ui.getByText('Salida: exit-1')).toBeTruthy();
  expect(ui.getByText('Reversión: reverse-1')).toBeTruthy();
  expect(productService.getById).not.toHaveBeenCalled();
  press(ui, 'Editar borrador');
  expect(n.navigate).toHaveBeenCalledWith('SaleForm', { id: sale._id });
});
test.each(['confirm', 'cancel'])(
  '%s requires intent and current revision; guards double click',
  async (operation) => {
    const pending = deferred();
    api[operation].mockReturnValue(pending.promise);
    const ui = draw(
      <SaleDetailScreen
        navigation={nav()}
        route={{ params: { id: sale._id } }}
      />,
    );
    await waitFor(() => expect(ui.getByText('Borrador')).toBeTruthy());
    press(ui, operation === 'confirm' ? 'Confirmar venta' : 'Cancelar venta');
    expect(api[operation]).not.toHaveBeenCalled();
    press(ui, 'Aceptar operación');
    press(ui, 'Aceptar operación');
    expect(api[operation]).toHaveBeenCalledTimes(1);
    expect(api[operation]).toHaveBeenCalledWith(sale._id, {
      expectedRevision: 7,
    });
    await act(async () =>
      pending.resolve(
        response({
          ...sale,
          status: operation === 'confirm' ? 'confirmed' : 'cancelled',
          revision: 8,
        }),
      ),
    );
    expect(
      ui.getByText(operation === 'confirm' ? 'Confirmada' : 'Cancelada'),
    ).toBeTruthy();
  },
);
test('confirmation blocked when tracked line has no warehouse', async () => {
  api.getById.mockResolvedValue(
    response({ ...sale, lines: [{ ...line, warehouseId: undefined }] }),
  );
  const ui = draw(
    <SaleDetailScreen
      navigation={nav()}
      route={{ params: { id: sale._id } }}
    />,
  );
  await waitFor(() =>
    expect(ui.getByText(/Selecciona un almacén en cada producto/)).toBeTruthy(),
  );
  press(ui, 'Confirmar venta');
  expect(api.confirm).not.toHaveBeenCalled();
});
test.each(['confirmed', 'cancelled'])(
  'detail actions for %s',
  async (status) => {
    api.getById.mockResolvedValue(response({ ...sale, status }));
    const ui = draw(
      <SaleDetailScreen
        navigation={nav()}
        route={{ params: { id: sale._id } }}
      />,
    );
    await waitFor(() => expect(ui.getByText(sale.number)).toBeTruthy());
    expect(ui.queryByRole('button', { name: 'Editar borrador' })).toBeNull();
    expect(ui.queryByRole('button', { name: 'Confirmar venta' })).toBeNull();
    expect(!!ui.queryByRole('button', { name: 'Cancelar venta' })).toBe(
      status === 'confirmed',
    );
  },
);
test('network loss on cancel queries server without repeating mutation', async () => {
  api.cancel.mockRejectedValue(new Error('lost response'));
  api.getById
    .mockResolvedValueOnce(response({ ...sale, status: 'confirmed' }))
    .mockResolvedValue(response({ ...sale, status: 'cancelled', revision: 8 }));
  const ui = draw(
    <SaleDetailScreen
      navigation={nav()}
      route={{ params: { id: sale._id } }}
    />,
  );
  await waitFor(() => expect(ui.getByText('Confirmada')).toBeTruthy());
  press(ui, 'Cancelar venta');
  press(ui, 'Aceptar operación');
  await waitFor(() => expect(ui.getByText('Cancelada')).toBeTruthy());
  expect(api.cancel).toHaveBeenCalledTimes(1);
  expect(api.getById).toHaveBeenCalledTimes(2);
});
test('failed recovery disables mutations until state can be verified', async () => {
  api.cancel.mockRejectedValue(new Error('lost response'));
  api.getById
    .mockResolvedValueOnce(response(sale))
    .mockRejectedValue(new Error('offline'));
  const ui = draw(
    <SaleDetailScreen
      navigation={nav()}
      route={{ params: { id: sale._id } }}
    />,
  );
  await waitFor(() => expect(ui.getByText('Borrador')).toBeTruthy());
  press(ui, 'Cancelar venta');
  press(ui, 'Aceptar operación');
  await waitFor(() =>
    expect(ui.getByText('Estado sin verificar')).toBeTruthy(),
  );
  expect(ui.queryByRole('button', { name: 'Cancelar venta' })).toBeNull();
  api.getById.mockResolvedValue(response({ ...sale, status: 'cancelled' }));
  press(ui, 'Consultar estado');
  await waitFor(() => expect(ui.getByText('Cancelada')).toBeTruthy());
  expect(api.cancel).toHaveBeenCalledTimes(1);
});
test('confirm 409 refreshes revision without retry or internal errors', async () => {
  api.confirm.mockRejectedValue({
    response: { status: 409, data: { error: 'MongoDB stack' } },
  });
  api.getById
    .mockResolvedValueOnce(response(sale))
    .mockResolvedValue(response({ ...sale, revision: 9 }));
  const ui = draw(
    <SaleDetailScreen
      navigation={nav()}
      route={{ params: { id: sale._id } }}
    />,
  );
  await waitFor(() => expect(ui.getByText('Borrador')).toBeTruthy());
  press(ui, 'Confirmar venta');
  press(ui, 'Aceptar operación');
  await waitFor(() => expect(ui.getByText(/La venta cambió/)).toBeTruthy());
  expect(api.confirm).toHaveBeenCalledTimes(1);
  expect(api.getById).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(ui.toJSON())).not.toContain('MongoDB stack');
});
test('closing intent sends nothing', async () => {
  const ui = draw(
    <SaleDetailScreen
      navigation={nav()}
      route={{ params: { id: sale._id } }}
    />,
  );
  await waitFor(() => expect(ui.getByText('Borrador')).toBeTruthy());
  press(ui, 'Cancelar venta');
  press(ui, 'Volver sin cambios');
  expect(api.cancel).not.toHaveBeenCalled();
});
test('read-only permission hides all write actions', async () => {
  const ui = draw(
    <SaleDetailScreen
      navigation={nav()}
      route={{ params: { id: sale._id } }}
    />,
    ['commercial.read'],
  );
  await waitFor(() => expect(ui.getByText(sale.number)).toBeTruthy());
  for (const name of ['Editar borrador', 'Confirmar venta', 'Cancelar venta'])
    expect(ui.queryByRole('button', { name })).toBeNull();
});
test('no commercial permission prevents direct screen API access', () => {
  for (const Screen of [SalesScreen, SaleDetailScreen, SaleForm]) {
    const ui = draw(
      <Screen navigation={nav()} route={{ params: { id: sale._id } }} />,
      [],
    );
    expect(ui.getByText(/No tienes permiso/)).toBeTruthy();
    cleanup();
  }
  expect(api.getAll).not.toHaveBeenCalled();
  expect(api.getById).not.toHaveBeenCalled();
});
