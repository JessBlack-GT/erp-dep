import { getApiTarget, API_TARGET } from '../src/constants/api-target';
import { STORAGE_KEYS } from '../src/constants';

const qaUrl = 'https://yj-nexo-munierp-qa.onrender.com/api/v1';

test('Android QA release fuerza el destino HTTPS y usa una sesión aislada', () => {
  const qa = getApiTarget({ dev: false, atlasQaUrl: qaUrl, localQa: true, configuredUrl: 'https://example.invalid' });
  expect(qa.baseURL).toBe(qaUrl);
  expect(qa.sessionPrefix + 'accessToken').not.toBe(STORAGE_KEYS.ACCESS_TOKEN);
  expect(qa.sessionPrefix + 'refreshToken').not.toBe(STORAGE_KEYS.REFRESH_TOKEN);
  expect(qa.sessionPrefix + 'user').not.toBe(STORAGE_KEYS.USER);
});

test('no cambia la API normal ni las claves existentes si no se solicita el APK QA', () => {
  expect(getApiTarget({ dev: false, atlasQaUrl: '' })).toEqual({
    baseURL: 'https://yj-nexo-api.onrender.com/api/v1', sessionPrefix: '',
  });
  expect(API_TARGET.sessionPrefix).toBe('');
  expect(STORAGE_KEYS).toEqual({ ACCESS_TOKEN: 'accessToken', REFRESH_TOKEN: 'refreshToken', USER: 'user' });
});

test('la opción local sigue solo en debug y el navegador puede usar una ruta relativa', () => {
  expect(getApiTarget({ dev: true, atlasQaUrl: qaUrl, localQa: true })).toEqual({
    baseURL: 'http://127.0.0.1:4314/api/v1', sessionPrefix: 'munierp-local-qa:',
  });
  expect(getApiTarget({ dev: false, localQa: true, atlasQaUrl: '', configuredUrl: '/api/v1' })).toEqual({
    baseURL: '/api/v1', sessionPrefix: '',
  });
});
