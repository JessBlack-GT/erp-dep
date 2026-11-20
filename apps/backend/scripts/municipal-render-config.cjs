'use strict';

const { createHash, timingSafeEqual } = require('node:crypto');

const QA_PROFILES = Object.freeze(['ventanilla', 'obras', 'auditor']);
const digest = (value) => createHash('sha256').update(value).digest();

function readRenderQaConfig(env) {
  const fail = (message) => { throw Object.assign(new Error(message), { qaSafe: true }); };
  if (env.RENDER !== 'true' || env.MUNICIPAL_QA_RENDER_ENABLED !== '1' || env.NODE_ENV !== 'test') {
    fail('El modo Render QA requiere RENDER=true, MUNICIPAL_QA_RENDER_ENABLED=1 y NODE_ENV=test');
  }
  if (env.RENDER_GIT_BRANCH !== 'integration/munierp-atlas-qa' || env.IS_PULL_REQUEST === 'true') {
    fail('El arranque de Render QA solo admite la rama integration/munierp-atlas-qa');
  }
  if (!/^[1-9][0-9]{0,4}$/.test(env.PORT || '') || Number(env.PORT) > 65535) {
    fail('El puerto asignado por Render no es válido');
  }
  const origin = env.RENDER_EXTERNAL_URL || '';
  if (!/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin) || origin === 'https://yj-nexo-api.onrender.com') {
    fail('Se requiere la URL HTTPS de un servicio separado de Render QA');
  }
  let passwords;
  try { passwords = JSON.parse(env.MUNICIPAL_QA_USERS_JSON || '{}'); }
  catch { fail('MUNICIPAL_QA_USERS_JSON no contiene JSON válido'); }
  if (!passwords || typeof passwords !== 'object' || Array.isArray(passwords) ||
      Object.keys(passwords).length !== QA_PROFILES.length ||
      !QA_PROFILES.every((role) => typeof passwords[role] === 'string' && /^[0-9a-f]{32}$/i.test(passwords[role])) ||
      new Set(QA_PROFILES.map((role) => passwords[role])).size !== QA_PROFILES.length) {
    fail('Configura claves hexadecimales distintas de 32 caracteres para ventanilla, obras y auditor');
  }
  const digests = new Map(QA_PROFILES.map((role) => [role, digest(passwords[role])]));
  return {
    origin,
    port: Number(env.PORT),
    profiles: QA_PROFILES,
    matchesPassword: (role, password) => typeof password === 'string' && password.length === 32 &&
      digests.has(role) && timingSafeEqual(digests.get(role), digest(password)),
  };
}

module.exports = { readRenderQaConfig };
