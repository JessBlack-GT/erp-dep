// Return variable names only: never include configuration values in errors.
function productionErrors(env) {
  if (env.NODE_ENV !== 'production') return [];
  const errors = [];
  for (const name of [
    'MONGODB_URI',
    'MONGODB_DB_NAME',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CORS_ORIGIN_FRONTEND',
  ]) {
    if (!env[name] || /replace_with|USER:PASSWORD|@HOST/.test(env[name])) errors.push(name);
  }
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (Buffer.byteLength(env[name] || '') < 32) errors.push(name);
  }
  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) errors.push('JWT_REFRESH_SECRET');
  for (const name of ['CORS_ORIGIN_FRONTEND', 'CORS_ORIGIN']) {
    if (!env[name] && name === 'CORS_ORIGIN') continue;
    try {
      const url = new URL(env[name]);
      if (
        url.protocol !== 'https:' ||
        url.origin !== env[name] ||
        url.username ||
        url.password ||
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      )
        errors.push(name);
    } catch (_) {
      errors.push(name);
    }
  }
  if (env.M03_QA_DATABASE || /(?:^|[_-])(qa|test)(?:$|[_-])/i.test(env.MONGODB_DB_NAME || ''))
    errors.push('MONGODB_DB_NAME');
  try {
    const uri = new URL(env.MONGODB_URI);
    if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol)) errors.push('MONGODB_URI');
    const options = new Map(
      [...uri.searchParams].map(([key, value]) => [key.toLowerCase(), value.toLowerCase()]),
    );
    if (
      options.get('tls') === 'false' ||
      options.get('ssl') === 'false' ||
      ['tlsinsecure', 'tlsallowinvalidcertificates', 'tlsallowinvalidhostnames'].some(
        (key) => options.get(key) === 'true',
      )
    )
      errors.push('MONGODB_URI');
  } catch (_) {
    errors.push('MONGODB_URI');
  }
  if (env.TRUST_PROXY_HOPS !== undefined && !/^[0-5]$/.test(env.TRUST_PROXY_HOPS))
    errors.push('TRUST_PROXY_HOPS');
  return [...new Set(errors)];
}
module.exports = { productionErrors };
