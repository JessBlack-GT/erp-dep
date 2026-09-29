// Local demonstrations only. Never start against an unconfirmed database.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { validateQaEnvironment } = require('./qa-environment.cjs');
const file = path.resolve(__dirname, '../.env');
const env = { ...(fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {}), ...process.env };
const guard = validateQaEnvironment(env);
if (!guard.ok) {
  console.error('QA_START_BLOCKED: ' + guard.reason);
  process.exitCode = 1;
} else {
  Object.assign(process.env, env, { MONGODB_DB_NAME: guard.dbName });
  require('../src/server');
}
