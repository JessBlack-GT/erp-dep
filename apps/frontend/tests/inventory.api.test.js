import apiClient, { inventoryService } from '../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
const cases = [
  ['getBalances', [{ page: 2 }], 'get', '/inventory/balances'],
  ['getMovements', [{ type: 'TRANSFER' }], 'get', '/inventory/movements'],
  ['getWarehouses', [{ status: 'active' }], 'get', '/inventory/warehouses'],
  ['getProducts', [{ search: 'QA' }], 'get', '/inventory/products'],
  [
    'getByProduct',
    ['id', { page: 1 }],
    'get',
    '/inventory/balances/product/id',
  ],
  [
    'createMovement',
    [{ type: 'ENTRY', quantity: '0.1', idempotencyKey: 'stable-key' }],
    'post',
    '/inventory/movements',
  ],
  [
    'createWarehouse',
    [{ code: 'QA', name: 'QA' }],
    'post',
    '/inventory/warehouses',
  ],
  [
    'updateWarehouse',
    ['id', { status: 'inactive' }],
    'patch',
    '/inventory/warehouses/id',
  ],
];
describe('M06 authenticated API client', () => {
  for (const [method, args, verb, url] of cases)
    test(method, async () => {
      const original = apiClient.defaults.adapter;
      await AsyncStorage.setItem('accessToken', 'fictional-test-token');
      const adapter = jest.fn(async (config) => ({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }));
      apiClient.defaults.adapter = adapter;
      try {
        await inventoryService[method](...args);
        const config = adapter.mock.calls[0][0];
        expect(config.url).toBe(url);
        expect(config.method).toBe(verb);
        expect(config.headers.Authorization).toBe(
          'Bearer fictional-test-token',
        );
        if (verb === 'get')
          expect(config.params).toEqual(
            args[method === 'getByProduct' ? 1 : 0],
          );
        else
          expect(JSON.parse(config.data)).toEqual(
            args[method === 'updateWarehouse' ? 1 : 0],
          );
      } finally {
        apiClient.defaults.adapter = original;
        await AsyncStorage.clear();
      }
    });
});
