import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../src/services/api';
import { STORAGE_KEYS } from '../src/constants';

jest.mock('../src/constants/api-target', () => ({
  API_TARGET: {
    baseURL: 'https://yj-nexo-munierp-qa.onrender.com/api/v1',
    sessionPrefix: 'munierp-atlas-qa:',
  },
}));

beforeEach(async () => { await AsyncStorage.clear(); });

test('una sesión normal guardada nunca se adjunta a las peticiones de QA', async () => {
  await AsyncStorage.setItem('accessToken', 'old-production-token');
  const request = apiClient.interceptors.request.handlers[0].fulfilled;
  expect(apiClient.defaults.baseURL).toBe('https://yj-nexo-munierp-qa.onrender.com/api/v1');
  expect(await request({ headers: {} })).toEqual({ headers: {} });

  await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'qa-session-token');
  expect(await request({ headers: {} })).toEqual({ headers: { Authorization: 'Bearer qa-session-token' } });
});

test('un 401 de QA no borra la sesión normal del APK anterior', async () => {
  await AsyncStorage.multiSet([
    ['accessToken', 'old-production-token'],
    ['refreshToken', 'old-production-refresh'],
    [STORAGE_KEYS.ACCESS_TOKEN, 'qa-session-token'],
  ]);
  const reject = apiClient.interceptors.response.handlers[0].rejected;
  await expect(reject({ response: { status: 401 } })).rejects.toEqual({ response: { status: 401 } });
  expect(await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
  expect(await AsyncStorage.getItem('accessToken')).toBe('old-production-token');
  expect(await AsyncStorage.getItem('refreshToken')).toBe('old-production-refresh');
});
