/* eslint-env node */
/**
 * MuniERP IA — F1-14 bitácora de auditoría con Playwright.
 * API SIMULADA: el servicio municipal REAL con almacén en memoria y datos sintéticos se ejecuta en el
 * navegador (`?persona=…&view=audit`). La autorización es la del servicio, pero NO hay HTTP, JWT ni
 * MongoDB: estas pruebas no acreditan la integración HTTP real.
 */
const { test, expect } = require('playwright/test');
const { registerEvidence } = require('./evidence.cjs');

registerEvidence(test, { suite: 'f1-14-auditoria', apiMode: 'SIMULADA: servicio municipal real en memoria (sin HTTP/JWT/MongoDB)' });

const tid = (id) => `[data-testid="${id}"]`;
async function audit(page, persona, extra = '') {
  await page.goto(`/?persona=${persona}&view=audit${extra}`);
  await expect(page.locator(tid('municipal-mock-banner'))).toContainText('servicio municipal real');
}
/**
 * Campo por su nombre accesible, sin depender del rol: el Input común de esta rama aún declara
 * role="search" (C-19, corregido por Codex en su copia); con el núcleo corregido será un campo de texto.
 */
const field = (page, name) => page.getByLabel(name, { exact: true });
const allText = (page) => page.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'))].join('\n'));

test('01 auditor: acceso permitido, lista paginada y orden del servidor', async ({ page }) => {
  await audit(page, 'u_aud');
  await expect(page.locator(tid('audit-title'))).toHaveText('Bitácora de auditoría · San Juan Huactzinco');
  await expect(page.locator(tid('audit-summary'))).toHaveText(/^Página 1 de 2 · \d+ evento\(s\)$/);
  await expect(page.getByRole('listitem')).toHaveCount(10);
  await expect(page.getByText('Más recientes primero', { exact: false })).toBeVisible();
});

test('02 administrador municipal: denegado por la política vigente (ADMIN_MUNICIPAL sin audit.read)', async ({ page }) => {
  await audit(page, 'u_admin_mun');
  await expect(page.locator(tid('audit-denied-message'))).toHaveText('Su rol municipal no tiene acceso a la bitácora de auditoría.');
  await expect(page.locator(tid('audit-list'))).toHaveCount(0);
});

test('03 sin permisos o sin membresía: titular, operador, usuario sin membresía y admin comercial del ERP', async ({ page }) => {
  for (const [persona, text] of [['u_tit_obp', 'no tiene acceso a la bitácora'], ['u_op_obp', 'no tiene acceso a la bitácora'], ['u_reg', 'membresía municipal vigente'], ['u_admin_erp', 'membresía municipal vigente']]) {
    await audit(page, persona);
    await expect(page.locator(tid('audit-denied-message'))).toContainText(text);
    await expect(page.locator(tid('audit-list'))).toHaveCount(0);
  }
});

test('04 aislamiento: sin eventos de otro municipio y consulta a ZZZ denegada', async ({ page }) => {
  await audit(page, 'u_aud');
  await page.locator(tid('audit-filter-limit')).getByText('50', { exact: true }).click();
  await page.locator(tid('audit-apply')).click();
  await expect(page.locator(tid('audit-summary'))).toHaveText(/^Página 1 de 1 /);
  expect(await allText(page)).not.toMatch(/ZZZ-/);
  await audit(page, 'u_aud', '&mun=ZZZ');
  await expect(page.locator(tid('audit-denied-message'))).toContainText('membresía municipal vigente');
});

test('05 filtros: folio, validación local y periodo sin eventos', async ({ page }) => {
  await audit(page, 'u_aud');
  await field(page, 'Folio').fill('SJH-OBP-SOL-2026-000001');
  await page.locator(tid('audit-apply')).click();
  await expect(page.locator(tid('audit-summary'))).toContainText('Página 1 de 1');
  const labels = await page.getByRole('listitem').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(labels.length).toBeGreaterThan(0);
  for (const l of labels) expect(l).toContain('SJH-OBP-SOL-2026-000001');
  await field(page, 'Folio').fill('');
  await field(page, 'Desde (AAAA-MM-DD)').fill('2026-02-30');
  await page.locator(tid('audit-apply')).click();
  await expect(page.locator(tid('audit-filter-errors'))).toContainText('Revise los filtros');
  await field(page, 'Desde (AAAA-MM-DD)').fill('2027-01-01');
  await field(page, 'Hasta, inclusive (AAAA-MM-DD)').fill('2027-01-31');
  await page.locator(tid('audit-apply')).click();
  await expect(page.locator(tid('audit-empty'))).toHaveText('No hay eventos para los filtros seleccionados.');
  await page.locator(tid('audit-clear')).click();
  await expect(page.getByRole('listitem')).toHaveCount(10);
});

test('06 paginación: siguiente, anterior y límites', async ({ page }) => {
  await audit(page, 'u_aud');
  await expect(page.locator(tid('audit-prev'))).toHaveAttribute('aria-disabled', 'true');
  const first = await page.getByRole('listitem').first().getAttribute('aria-label');
  await page.locator(tid('audit-next')).click();
  await expect(page.locator(tid('audit-summary'))).toContainText('Página 2 de 2');
  await expect(page.locator(tid('audit-next'))).toHaveAttribute('aria-disabled', 'true');
  expect(await page.getByRole('listitem').first().getAttribute('aria-label')).not.toBe(first);
  await page.locator(tid('audit-prev')).click();
  await expect(page.locator(tid('audit-summary'))).toContainText('Página 1 de 2');
});

test('07 estados de carga y de error con reintento', async ({ page }) => {
  await page.goto('/?persona=u_aud&view=audit&latency=1200');
  await expect(page.getByText('Cargando bitácora…')).toBeVisible();
  await expect(page.locator(tid('audit-list'))).toBeVisible({ timeout: 15000 });
  await audit(page, 'u_aud', '&fail=listAuditEvents');
  await expect(page.locator(tid('audit-error-message'))).toContainText('No fue posible comunicarse');
  await page.locator(tid('audit-retry')).click();
  await expect(page.locator(tid('audit-list'))).toBeVisible();
});

test('08 navegación completa con teclado: filtrar y paginar', async ({ page }) => {
  await audit(page, 'u_aud');
  await expect(page.locator(tid('audit-list'))).toBeVisible();
  const tabTo = async (locator, max = 60) => {
    for (let i = 0; i < max; i += 1) {
      if (await locator.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))) return true;
      await page.keyboard.press('Tab');
    }
    return false;
  };
  expect(await tabTo(field(page, 'Folio'))).toBe(true);
  await page.keyboard.type('SJH-OBP-SOL-2026-000001');
  expect(await tabTo(page.locator(tid('audit-apply')))).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator(tid('audit-summary'))).toContainText('Página 1 de 1');
  expect(await tabTo(page.locator(tid('audit-clear')))).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator(tid('audit-summary'))).toContainText('Página 1 de 2');
  expect(await tabTo(page.locator(tid('audit-next')))).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator(tid('audit-summary'))).toContainText('Página 2 de 2');
});

test('09 accesibilidad: encabezados, lista, nombres de campos y alertas', async ({ page }) => {
  await audit(page, 'u_aud');
  await expect(page.getByRole('heading', { name: 'Bitácora de auditoría · San Juan Huactzinco' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Filtros' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Eventos' })).toBeVisible();
  await expect(page.getByRole('list')).toHaveCount(1);
  for (const name of ['Folio', 'Identificador del recurso', 'Desde (AAAA-MM-DD)', 'Hasta, inclusive (AAAA-MM-DD)']) {
    await expect(field(page, name)).toBeVisible();
    // C-19: núcleo actual → role="search"; núcleo corregido → sin rol explícito (campo de texto). El módulo no lo sobrescribe.
    expect([null, 'search']).toContain(await field(page, name).getAttribute('role'));
  }
  await expect(page.getByRole('radio', { name: '10' })).toHaveAttribute('aria-checked', 'true');
  const label = await page.getByRole('listitem').first().getAttribute('aria-label');
  expect(label).toMatch(/, (Permitido|Denegado), .+, por Funcionario ···[0-9a-f]{6}$/);
  await field(page, 'Identificador del recurso').fill('xyz');
  await page.locator(tid('audit-apply')).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Revise los filtros' })).toBeVisible();
});

test('10 sin datos sensibles en la vista (IP, requestId, ids completos, contenido de expedientes)', async ({ page }) => {
  await audit(page, 'u_aud');
  await page.locator(tid('audit-filter-limit')).getByText('50', { exact: true }).click();
  await page.locator(tid('audit-apply')).click();
  await expect(page.getByText('Acceso denegado').first()).toBeVisible();
  const text = await allText(page);
  expect(text).not.toMatch(/192\.0\.2\.10|127\.0\.0\.1|qa-seed-denegado|qa-ui/);
  expect(text).not.toMatch(/\b[0-9a-f]{24}\b/);
  expect(text).not.toMatch(/Bearer|token|contraseña|password/i);
  expect(text).not.toMatch(/Ciudadano Sintético|Luminaria|ciudadano\d+@example\.org/);
});

test('11 espacio de trabajo: entrada solo con permiso', async ({ page }) => {
  await page.goto('/?persona=u_aud');
  await page.locator(tid('workspace-open-audit')).click();
  await expect(page.locator(tid('audit-title'))).toBeVisible();
  await page.locator(tid('audit-back')).click();
  await expect(page.locator(tid('municipal-workspace'))).toBeVisible();
  await page.goto('/?persona=u_tit_obp');
  await expect(page.locator(tid('municipal-workspace'))).toBeVisible();
  await expect(page.locator(tid('workspace-open-audit'))).toHaveCount(0);
});

for (const [name, width, height] of [['celular', 360, 740], ['tableta', 800, 1000], ['escritorio', 1280, 900]]) {
  test(`12 bitácora adaptable ${name} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await audit(page, 'u_aud');
    await expect(page.locator(tid('audit-list'))).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'sin desplazamiento horizontal').toBeLessThanOrEqual(1);
    const filters = await page.locator(tid('audit-filters')).boundingBox();
    const results = await page.locator(tid('audit-results')).boundingBox();
    if (width >= 1024) expect(results.x, 'columnas lado a lado').toBeGreaterThan(filters.x + filters.width - 1);
    else expect(results.y, 'apilado').toBeGreaterThan(filters.y + filters.height - 1);
  });
}
