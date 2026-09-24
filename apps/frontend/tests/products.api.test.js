import apiClient, { productService } from '../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
const cases = [
  ['getAll', [{ page: 2 }], 'get', '/products'],
  ['getById', ['qa-id'], 'get', '/products/qa-id'],
  ['create', [{ name: 'QA' }], 'post', '/products'],
  ['update', ['qa-id', { name: 'Changed' }], 'patch', '/products/qa-id'],
  ['changeStatus', ['qa-id', 'inactive'], 'patch', '/products/qa-id/status'],
  ['delete', ['qa-id'], 'delete', '/products/qa-id'],
  ['search', ['QA'], 'get', '/products/search'],
];
describe('M05 reuses the authenticated HTTP client', () => {
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
        await productService[method](...args);
        const config = adapter.mock.calls[0][0];
        expect(config.url).toBe(url);
        expect(config.method).toBe(verb);
        expect(config.headers.Authorization).toBe(
          'Bearer fictional-test-token',
        );
        if (method === 'getAll') expect(config.params).toEqual({ page: 2 });
        if (method === 'search') expect(config.params).toEqual({ q: 'QA' });
      } finally {
        apiClient.defaults.adapter = original;
        await AsyncStorage.clear();
      }
    });
});
