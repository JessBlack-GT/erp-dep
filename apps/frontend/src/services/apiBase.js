export function resolveApiBase(value, platform, development) {
  if (value) {
    if (
      !development &&
      (!/^https:\/\/[^/?#@]+\/api\/v1$/.test(value) ||
        /^https:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//i.test(value))
    )
      throw new Error('PUBLIC_API_BASE_URL HTTPS requerida');
    return value;
  }
  if (!development) throw new Error('PUBLIC_API_BASE_URL requerida');
  return platform === 'android' ? 'http://10.0.2.2:3000/api/v1' : 'http://localhost:3000/api/v1';
}
