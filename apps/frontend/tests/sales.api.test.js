import apiClient, { salesService } from '../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
const content = {
  date: '2026-10-05',
  currency: 'GTQ',
  entityId: 'customer-test',
  lines: [],
};
const cases = [
  ['getAll', [{ page: 2, status: 'draft' }], 'get', '/sales', null],
  ['getById', ['sale-test'], 'get', '/sales/sale-test', null],
  ['create', [content], 'post', '/sales', content],
  [
    'update',
    ['sale-test', { ...content, expectedRevision: 4 }],
    'put',
    '/sales/sale-test',
    { ...content, expectedRevision: 4 },
  ],
  [
    'confirm',
    ['sale-test', { expectedRevision: 4 }],
    'post',
    '/sales/sale-test/confirm',
    { expectedRevision: 4 },
  ],
  [
    'cancel',
    ['sale-test', { expectedRevision: 5 }],
    'post',
    '/sales/sale-test/cancel',
    { expectedRevision: 5 },
  ],
];
test.each(cases)(
  '%s uses authenticated real client contract (mock adapter)',
  async (method, args, verb, url, body) => {
    const original = apiClient.defaults.adapter;
    const adapter = jest.fn(async (config) => ({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
    apiClient.defaults.adapter = adapter;
    await AsyncStorage.setItem('accessToken', 'fictional-sales-test-token');
    try {
      await salesService[method](...args);
      const config = adapter.mock.calls[0][0];
      expect(config.url).toBe(url);
      expect(config.method).toBe(verb);
      expect(config.headers.Authorization).toBe(
        'Bearer fictional-sales-test-token',
      );
      if (body) expect(JSON.parse(config.data)).toEqual(body);
      if (method === 'getAll') expect(config.params).toEqual(args[0]);
    } finally {
      apiClient.defaults.adapter = original;
      await AsyncStorage.clear();
    }
  },
);
test('no unsupported delete sales operation', () =>
  expect(salesService.delete).toBeUndefined());
