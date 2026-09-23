function selectedDatabase(env) {
  if (env.MONGODB_DB_NAME) return env.MONGODB_DB_NAME;
  try { return decodeURIComponent(new URL(env.MONGODB_URI).pathname.slice(1)); }
  catch (_) { return ''; }
}
function validateQaEnvironment(env) {
  if (!env.MONGODB_URI || /USER:PASSWORD|@HOST|replace_with/.test(env.MONGODB_URI)) return { ok: false, reason: 'MONGODB_CONFIG_MISSING' };
  if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI)) return { ok: false, reason: 'URI_INVALID' };
  try {
    const uri = new URL(env.MONGODB_URI);
    if (!uri.hostname) return { ok: false, reason: 'URI_INVALID' };
  } catch (_) { return { ok: false, reason: 'URI_INVALID' }; }
  const dbName = selectedDatabase(env);
  if (!['test', 'development'].includes(env.NODE_ENV) || !dbName || /prod/i.test(dbName) || env.M03_QA_DATABASE !== dbName) return { ok: false, reason: 'QA_DATABASE_NOT_CONFIRMED' };
  return { ok: true, dbName };
}
function classifyConnectionError(error) {
  const codes = [error?.code, error?.cause?.code];
  const message = String(error?.message || '');
  if (codes.includes(18) || /authentication failed|bad auth/i.test(message)) return 'AUTHENTICATION';
  if (codes.some(c => ['ENOTFOUND', 'EAI_AGAIN', 'ENODATA'].includes(c)) || /querySrv|ENOTFOUND/i.test(message)) return 'DNS';
  if (/TLS|SSL|certificate/i.test(message)) return 'TLS';
  if (error?.name === 'MongoParseError') return 'URI';
  if (error?.name === 'MongooseServerSelectionError') return 'NETWORK_OR_IP_ALLOWLIST_UNCONFIRMED';
  return 'APPLICATION';
}
module.exports = { selectedDatabase, validateQaEnvironment, classifyConnectionError };
