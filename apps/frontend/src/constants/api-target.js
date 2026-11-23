import { Platform } from 'react-native';
/* eslint-env node, es2020 */
export function getApiTarget({ dev, atlasQaUrl, localQa, configuredUrl }) {
  if (!dev && atlasQaUrl) {
    return { baseURL: atlasQaUrl, sessionPrefix: 'munierp-atlas-qa:' };
  }
  if (dev && localQa) {
    return { baseURL: 'http://127.0.0.1:4314/api/v1', sessionPrefix: 'munierp-local-qa:' };
  }
  return {
    baseURL: configuredUrl || 'https://yj-nexo-api.onrender.com/api/v1',
    sessionPrefix: '',
  };
}

export const API_TARGET = getApiTarget({
  dev: false,
  atlasQaUrl: Platform.OS === 'web' ? '/api/v1' : 'https://yj-nexo-munierp-qa.onrender.com/api/v1',
  localQa: false,
  configuredUrl: undefined,
});
