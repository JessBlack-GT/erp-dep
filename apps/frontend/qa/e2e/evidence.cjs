/* eslint-env node */
/**
 * Evidencias por prueba (F1-13): captura en éxito y en fallo, registro JSONL anexado (sobrevive al
 * reinicio del worker tras un fallo) y bloqueo de cualquier petición fuera de 127.0.0.1.
 */
const fs = require('fs');
const path = require('path');

const EVIDENCE = path.resolve(process.env.MUNI_EVIDENCE_DIR || path.join(__dirname, '..', 'evidence-local'));

function registerEvidence(test, { suite, apiMode }) {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
  });
  test.afterEach(async ({ page, browserName }, info) => {
    const dir = path.join(EVIDENCE, browserName, suite);
    fs.mkdirSync(dir, { recursive: true });
    const slug = info.title.replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 70);
    const file = path.join(dir, `${slug}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    await info.attach('captura', { path: file, contentType: 'image/png' }).catch(() => {});
    const record = {
      suite, browser: browserName, browserVersion: page.context().browser() ? page.context().browser().version() : null,
      platform: process.platform, date: new Date().toISOString(), scenario: info.title, result: info.status,
      durationMs: info.duration, screenshot: path.relative(EVIDENCE, file).split(path.sep).join('/'),
      error: info.error ? String(info.error.message).replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 300) : null, apiMode,
    };
    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.appendFileSync(path.join(EVIDENCE, `registro-${browserName}.jsonl`), JSON.stringify(record) + '\n');
  });
}

module.exports = { registerEvidence, EVIDENCE };
