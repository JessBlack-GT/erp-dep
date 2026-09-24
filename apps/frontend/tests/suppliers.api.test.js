import apiClient, { supplierService } from '../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
const cases = [
  ['getAll', [{ page: 2 }], 'get', '/suppliers'],
  ['getById', ['qa-id'], 'get', '/suppliers/qa-id'],
  ['create', [{ name: 'QA' }], 'post', '/suppliers'],
  ['update', ['qa-id', { name: 'Changed' }], 'patch', '/suppliers/qa-id'],
  ['changeStatus', ['qa-id', 'inactive'], 'patch', '/suppliers/qa-id/status'],
  ['delete', ['qa-id'], 'delete', '/suppliers/qa-id'],
  ['search', ['QA'], 'get', '/suppliers/search'],
];
describe('M04 reuses the authenticated HTTP client', () => {
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
        await supplierService[method](...args);
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
