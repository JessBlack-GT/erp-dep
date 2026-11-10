/* eslint-env node */
/**
 * MuniERP IA — E2E/funcionales con Playwright sobre el arnés web (API SIMULADA, datos sintéticos).
 * No hay backend real ni MongoDB: valida interfaz, teclado, formularios, navegación interna y
 * disposición adaptable. Cada prueba deja una captura en <evidencias>/<navegador>/<NN-escenario>.png.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('playwright/test');

const EVIDENCE = path.resolve(process.env.MUNI_EVIDENCE_DIR || path.join(__dirname, '..', 'evidence-local'));
const tid = (id) => `[data-testid="${id}"]`;

test.beforeEach(async ({ page }) => {
  // Ninguna petición puede salir de 127.0.0.1: la API es simulada.
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
});

test.afterEach(async ({ page, browserName }, info) => {
  const dir = path.join(EVIDENCE, browserName);
  fs.mkdirSync(dir, { recursive: true });
  const slug = info.title.replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 70);
  const file = path.join(dir, `${slug}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  await info.attach('captura', { path: file, contentType: 'image/png' }).catch(() => {});
  const record = { browser: browserName, date: new Date().toISOString(), scenario: info.title, result: info.status, expected: info.expectedStatus, durationMs: info.duration, screenshot: path.relative(EVIDENCE, file), error: info.error ? String(info.error.message).split('\n')[0].slice(0, 300) : null, apiMode: 'SIMULADA' };
  // JSONL en modo anexar: sobrevive al reinicio del worker que Playwright hace tras cada fallo.
  fs.appendFileSync(path.join(EVIDENCE, `registro-${browserName}.jsonl`), JSON.stringify(record) + '\n');
});

async function open(page, query = '') {
  await page.goto('/' + query);
  await expect(page.locator(tid('municipal-workspace')).or(page.locator(tid('municipal-no-membership'))).or(page.getByRole('alert'))).toBeVisible();
}

test('01 carga inicial con API simulada identificada', async ({ page }) => {
  await open(page);
  await expect(page.locator(tid('municipal-mock-banner'))).toHaveText(/datos sintéticos/);
  await expect(page.getByText('MuniERP · San Juan Huactzinco')).toBeVisible();
  await expect(page.locator(tid('indicator-total'))).toContainText('3');
  await expect(page.locator('[data-testid^="request-SJH-"]')).toHaveCount(3);
});

test('02 validación del formulario sin datos', async ({ page }) => {
  await open(page);
  await page.locator(tid('intake-submit')).click();
  await expect(page.getByText('Seleccione la dependencia responsable.')).toBeVisible();
  await expect(page.getByText('Seleccione o registre al ciudadano.')).toBeVisible();
  await expect(page.getByText('El asunto debe tener entre 5 y 200 caracteres.')).toBeVisible();
  await expect(page.locator(tid('receipt-folio'))).toHaveCount(0);
});

test('03 bloqueo de CURP en la descripción', async ({ page }) => {
  await open(page);
  await page.locator(tid('intake-dependency-OBP')).click();
  await page.locator(tid('intake-citizen-000000000000000000000190')).click();
  await page.locator(tid('intake-subject')).fill('Bache sintético en calle de prueba');
  await page.locator(tid('intake-description')).fill('Mi CURP es GOMC800101HTLRRR09');
  await page.locator(tid('intake-submit')).click();
  await expect(page.getByText('No capture CURP ni datos de identificación oficial.')).toBeVisible();
  await expect(page.locator(tid('receipt-folio'))).toHaveCount(0);
});

test('04 registro con ratón, acuse y regreso al formulario', async ({ page }) => {
  await open(page);
  await page.locator(tid('intake-dependency-AGP')).click();
  await expect(page.locator(tid('intake-dependency-AGP'))).toHaveAttribute('aria-checked', 'true');
  await page.locator(tid('intake-citizen-000000000000000000000190')).click();
  await page.locator(tid('intake-channel-TELEFONO')).click();
  await page.locator(tid('intake-subject')).fill('Solicitud de pipa de agua (prueba)');
  await page.locator(tid('intake-submit')).click();
  await expect(page.locator(tid('receipt-folio'))).toHaveText('SJH-AGP-SOL-2026-000001');
  await expect(page.locator(tid('municipal-receipt'))).toContainText('Agua Potable');
  await expect(page.locator(tid('municipal-receipt'))).not.toContainText('@');
  await expect(page.locator(tid('request-SJH-AGP-SOL-2026-000001'))).toBeVisible();
  await expect(page.locator(tid('indicator-total'))).toContainText('4');
  await page.locator(tid('receipt-done')).click();
  await expect(page.locator(tid('intake-submit'))).toBeVisible();
});

test('05 flujo completo solo con teclado (MT-90)', async ({ page }) => {
  await open(page);
  // Llega a la primera opción de dependencia solo con Tab.
  const target = page.locator(tid('intake-dependency-OBP'));
  let reached = false;
  for (let i = 0; i < 40 && !reached; i += 1) {
    await page.keyboard.press('Tab');
    reached = await target.evaluate((el) => el === document.activeElement || el.contains(document.activeElement));
  }
  expect(reached, 'la opción OBP debe ser alcanzable con Tab').toBe(true);
  await page.keyboard.press('Enter');
  await expect(target).toHaveAttribute('aria-checked', 'true');
  // Ciudadano: siguiente(s) Tab hasta la opción y Espacio.
  const citizen = page.locator(tid('intake-citizen-000000000000000000000190'));
  for (let i = 0; i < 15; i += 1) {
    if (await citizen.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Space');
  await expect(citizen).toHaveAttribute('aria-checked', 'true');
  const subject = page.locator(tid('intake-subject'));
  for (let i = 0; i < 15; i += 1) {
    if (await subject.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await page.keyboard.type('Luminaria apagada (prueba de teclado)');
  const submit = page.locator(tid('intake-submit'));
  for (let i = 0; i < 15; i += 1) {
    if (await submit.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))) break;
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  await expect(page.locator(tid('receipt-folio'))).toHaveText('SJH-OBP-SOL-2026-000003');
});

test('06 foco visible al navegar con teclado', async ({ page }) => {
  await open(page);
  const target = page.locator(tid('intake-dependency-OBP'));
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) break;
  }
  const style = await target.evaluate((el) => { const s = getComputedStyle(el); return { outline: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow }; });
  const visible = (style.outline !== 'none' && style.width !== '0px') || (style.shadow && style.shadow !== 'none');
  expect(visible, `indicador de foco: ${JSON.stringify(style)}`).toBe(true);
});

test('07 continuidad: reintento tras fallo de red reutiliza la clave de idempotencia', async ({ page }) => {
  await open(page, '?scenario=submit-error');
  await page.locator(tid('intake-dependency-OBP')).click();
  await page.locator(tid('intake-citizen-000000000000000000000190')).click();
  await page.locator(tid('intake-subject')).fill('Fuga de agua sintética');
  await page.locator(tid('intake-submit')).click();
  await expect(page.locator(tid('intake-failure'))).toContainText('reintentar');
  await expect(page.locator(tid('intake-submit'))).toContainText('Reintentar registro');
  await page.locator(tid('intake-submit')).click();
  await expect(page.locator(tid('receipt-folio'))).toHaveText(/^SJH-OBP-SOL-2026-\d{6}$/);
  const keys = await page.evaluate(() => window.__muniIdempotencyKeys);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test('08 error de carga con reintento', async ({ page }) => {
  await open(page, '?scenario=load-error');
  await expect(page.getByRole('alert')).toContainText('No fue posible cargar');
  await page.getByText('Reintentar').click();
  await expect(page.locator(tid('municipal-workspace'))).toBeVisible();
});

test('09 usuario sin membresía no ve el espacio de trabajo', async ({ page }) => {
  await open(page, '?scenario=no-membership');
  await expect(page.locator(tid('municipal-no-membership'))).toContainText('No tiene una membresía municipal vigente');
  await expect(page.locator(tid('municipal-workspace'))).toHaveCount(0);
});

test('10 accesibilidad: roles, estado de radios y etiquetas de expedientes', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('radiogroup', { name: 'Dependencia responsable' })).toBeVisible();
  const radios = page.getByRole('radio');
  expect(await radios.count()).toBeGreaterThanOrEqual(8);
  await expect(page.locator(tid('intake-dependency-OBP'))).toHaveAttribute('aria-checked', 'false');
  const label = await page.locator(tid('request-SJH-OBP-SOL-2026-000001')).getAttribute('aria-label');
  expect(label).toMatch(/Folio .*Estado En trámite/);
  await expect(page.locator(tid('request-SJH-TES-SOL-2026-000001'))).toContainText('Concluida');
});

for (const [name, width, height, cols] of [['celular', 360, 740, 1], ['tableta', 800, 1000, 2], ['escritorio', 1280, 900, 4]]) {
  test(`11 disposición adaptable ${name} ${width}px: sin desplazamiento horizontal y ${cols} columna(s)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'desplazamiento horizontal').toBeLessThanOrEqual(1);
    const xs = await page.locator('[data-testid^="indicator-"]').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().left)))]);
    expect(xs.length).toBe(cols);
    const box = await page.locator(tid('intake-dependency-OBP')).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
}

test('12 impresión del acuse en web', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed += 1; }; });
  await page.locator(tid('intake-dependency-RCI')).click();
  await page.locator(tid('intake-citizen-000000000000000000000191')).click();
  await page.locator(tid('intake-subject')).fill('Copia certificada (prueba)');
  await page.locator(tid('intake-submit')).click();
  await page.locator(tid('receipt-print')).click();
  expect(await page.evaluate(() => window.__printed)).toBe(1);
});
