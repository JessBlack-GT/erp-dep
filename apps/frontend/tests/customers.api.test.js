import apiClient, { customerService } from '../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('M03 API client with a mocked HTTP adapter', () => {
  afterEach(() => jest.restoreAllMocks());
  it('sends the stored access token and PATCH endpoint', async () => {
    await AsyncStorage.setItem('accessToken', 'fictional-test-token');
    const adapter = jest.fn(async config => ({ data: { success: true }, status: 200, statusText: 'OK', headers: {}, config }));
    const original = apiClient.defaults.adapter;
    apiClient.defaults.adapter = adapter;
    try {
      await customerService.update('customer-id', { name: 'QA' });
      const config = adapter.mock.calls[0][0];
      expect(config.url).toBe('/customers/customer-id');
      expect(config.method).toBe('patch');
      expect(config.headers.Authorization).toBe('Bearer fictional-test-token');
    } finally { apiClient.defaults.adapter = original; await AsyncStorage.clear(); }
  });
});
