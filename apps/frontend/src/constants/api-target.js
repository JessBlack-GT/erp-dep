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
  dev: typeof __DEV__ === 'undefined' || __DEV__,
  atlasQaUrl: process.env.YJ_NEXO_BUNDLED_ANDROID_QA_URL,
  localQa: process.env.YJ_NEXO_LOCAL_QA === '1',
  configuredUrl: process.env.EXPO_PUBLIC_API_BASE_URL || process.env.PUBLIC_API_BASE_URL,
});
