/* eslint-env node */
/**
 * Playwright — QA municipal (API SIMULADA, datos sintéticos).
 * Variables: MUNI_HARNESS_DIR (arnés compilado), MUNI_EVIDENCE_DIR (evidencias), MUNI_BROWSERS (lista).
 * Ejecutables existentes (misma convención que el ejecutor de Codex en M07): QA_CHROMIUM_EXE,
 * QA_FIREFOX_EXE, QA_WEBKIT_EXE. Si se definen, se usan tal cual (no se descarga ningún navegador).
 */
const path = require('path');
const { defineConfig, devices } = require('playwright/test');

const port = Number(process.env.MUNI_QA_PORT || 4178);
const evidence = path.resolve(process.env.MUNI_EVIDENCE_DIR || path.join(__dirname, '..', 'evidence-local'));
const wanted = (process.env.MUNI_BROWSERS || 'chromium').split(',').map((b) => b.trim()).filter(Boolean);
const exe = (browser) => process.env[`QA_${browser.toUpperCase()}_EXE`] || undefined;
const launch = (browser) => (exe(browser) ? { launchOptions: { executablePath: exe(browser) } } : {});
const catalog = {
  chromium: { name: 'chromium', use: { ...devices['Desktop Chrome'], ...launch('chromium') } },
  firefox: { name: 'firefox', use: { ...devices['Desktop Firefox'], ...launch('firefox') } },
  webkit: { name: 'webkit', use: { ...devices['Desktop Safari'], ...launch('webkit') } },
};

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.e2e\.spec\.cjs$/,
  outputDir: path.join(evidence, 'artifacts'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: path.join(evidence, 'results.json') }], ['html', { outputFolder: path.join(evidence, 'html-report'), open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  },
  projects: wanted.map((b) => catalog[b]).filter(Boolean),
  webServer: {
    command: `node ${JSON.stringify(path.join(__dirname, 'static-server.cjs'))} ${JSON.stringify(path.resolve(process.env.MUNI_HARNESS_DIR || path.join(__dirname, '..', 'dist-municipal')))} ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 20000,
  },
});
