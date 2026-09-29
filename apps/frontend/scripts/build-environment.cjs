function apiBaseUrl(env, production) {
  const value = env.PUBLIC_API_BASE_URL;
  if (!production) return value || 'http://localhost:3000/api/v1';
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/api/v1' ||
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
      throw Error();
    return value;
  } catch (_) {
    throw Error('PUBLIC_API_BASE_URL debe ser una URL HTTPS pública terminada en /api/v1');
  }
}
module.exports = { apiBaseUrl };
