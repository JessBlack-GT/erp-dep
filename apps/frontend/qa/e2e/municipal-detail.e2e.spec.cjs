/* eslint-env node */
/**
 * MuniERP IA — F1-13 detalle de expediente con Playwright.
 * API SIMULADA respaldada por el servicio municipal REAL con almacén en memoria y datos sintéticos
 * (`?persona=`): la autorización es la del servidor, pero no hay HTTP, JWT ni MongoDB.
 */
const { test, expect } = require('playwright/test');
const { registerEvidence } = require('./evidence.cjs');

registerEvidence(test, { suite: 'f1-13-detalle', apiMode: 'SIMULADA: servicio municipal real en memoria (sin HTTP/JWT/MongoDB)' });

const tid = (id) => `[data-testid="${id}"]`;
const R1 = 'SJH-OBP-SOL-2026-000001';
const R2 = 'SJH-OBP-SOL-2026-000002';

async function workspace(page, persona, extra = '') {
  await page.goto(`/?persona=${persona}${extra}`);
  await expect(page.locator(tid('municipal-workspace')).or(page.locator(tid('municipal-no-membership')))).toBeVisible();
  await expect(page.locator(tid('municipal-mock-banner')).or(page.locator(tid('municipal-no-membership')))).toBeVisible();
}
async function direct(page, persona, folioKey, extra = '') {
  await page.goto(`/?persona=${persona}&openFolio=${folioKey}${extra}`);
  await expect(page.locator(tid('municipal-mock-banner'))).toContainText('servicio municipal real');
}

test('01 abrir el detalle desde la lista y volver', async ({ page }) => {
  await workspace(page, 'u_tit_obp');
  await page.locator(tid(`request-${R1}`)).click();
  await expect(page.locator(tid('detail-folio'))).toHaveText(R1);
  await expect(page.locator(tid('municipal-mock-banner'))).toContainText('API simulada');
  await page.locator(tid('detail-back')).click();
  await expect(page.locator(tid('municipal-workspace'))).toBeVisible();
});

test('02 folio, estado, tipo, descripción, municipio y dependencia', async ({ page }) => {
  await direct(page, 'u_tit_obp', 'r1');
  await expect(page.locator(tid('detail-folio'))).toHaveText(R1);
  await expect(page.locator(tid('detail-status'))).toContainText('En trámite');
  await expect(page.locator(tid('detail-data'))).toContainText('Solicitud general');
  await expect(page.locator(tid('detail-description'))).toContainText('Luminaria apagada');
  await expect(page.locator(tid('detail-data'))).toContainText('San Juan Huactzinco');
  await expect(page.locator(tid('detail-owner'))).toContainText('Obras Públicas');
  await expect(page.locator(tid('detail-data'))).not.toContainText('@example.org');
});

test('03 historial cronológico con fecha y actor', async ({ page }) => {
  await direct(page, 'u_tit_obp', 'r1');
  const items = page.locator('[data-testid^="history-"]');
  await expect(items).toHaveCount(3);
  const labels = await items.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(labels[0]).toMatch(/^Registro, estado Registrada, .+, por Funcionario ···[0-9a-f]{6}$/);
  expect(labels[1]).toMatch(/^Turnado, de Registrada a En trámite/);
  expect(labels[2]).toMatch(/^Asignación de responsable/);
  await expect(page.locator(tid('detail-history'))).toContainText('Nota: Se atiende en Obras');
});

test('04 documentos autorizados: descarga real del PDF por el servicio', async ({ page }) => {
  await direct(page, 'u_tit_obp', 'r1');
  const buttons = page.getByRole('button', { name: /^Descargar / });
  await expect(buttons).toHaveCount(2);
  const [download] = await Promise.all([page.waitForEvent('download'), buttons.first().click()]);
  expect(download.suggestedFilename()).toMatch(/^Oficio de inspecci(o|ó)n\.pdf$/);
  const stream = await download.createReadStream();
  const chunks = []; for await (const c of stream) chunks.push(c);
  expect(Buffer.concat(chunks).toString('latin1')).toMatch(/^%PDF-1\.4/);
  await expect(page.locator(tid('detail-notice-success'))).toContainText('Descarga iniciada');
});

test('05 documento confidencial restringido para CONSULTA (sin botón de descarga)', async ({ page }) => {
  await direct(page, 'u_consulta_obp', 'r1');
  await expect(page.locator(tid('detail-documents'))).toContainText('Documento restringido (Confidencial)');
  await expect(page.getByRole('button', { name: /^Descargar / })).toHaveCount(1);
  await expect(page.locator(tid('detail-documents'))).not.toContainText('Dictamen interno');
  await expect(page.locator(tid('detail-no-actions'))).toBeVisible();
});

test('06 expediente ajeno: otra dependencia, otro municipio e inexistente → mismo mensaje', async ({ page }) => {
  for (const key of ['r1', 'z1', 'SJH-OBP-SOL-2026-000999']) {
    await direct(page, 'u_op_tes', key);
    await expect(page.locator(tid('detail-error-message'))).toHaveText('Expediente no encontrado o sin acceso.');
    await expect(page.locator(tid('detail-subject'))).toHaveCount(0);
    await expect(page.locator(tid('detail-retry'))).toHaveCount(0);
  }
  await workspace(page, 'u_op_tes');
  await expect(page.locator(tid(`request-${R1}`))).toHaveCount(0);
});

test('07 usuario sin membresía y administrador comercial del ERP', async ({ page }) => {
  for (const persona of ['u_reg', 'u_admin_erp']) {
    await workspace(page, persona);
    await expect(page.locator(tid('municipal-no-membership'))).toContainText('No tiene una membresía municipal vigente');
    await expect(page.locator(tid('municipal-workspace'))).toHaveCount(0);
  }
  await direct(page, 'u_admin_erp', 'r1');
  await expect(page.locator(tid('municipal-no-membership'))).toBeVisible();
  await expect(page.locator(tid('detail-folio'))).toHaveCount(0);
});

test('08 estado de carga visible con latencia', async ({ page }) => {
  await page.goto('/?persona=u_tit_obp&openFolio=r1&latency=1500');
  await expect(page.getByText('Cargando expediente…')).toBeVisible();
  await expect(page.locator(tid('detail-folio'))).toHaveText(R1, { timeout: 10000 });
});

test('09 error de red y reintento; error parcial de documentos', async ({ page }) => {
  await direct(page, 'u_tit_obp', 'r1', '&fail=getRequest');
  await expect(page.locator(tid('detail-error-message'))).toContainText('No fue posible comunicarse');
  await page.locator(tid('detail-retry')).click();
  await expect(page.locator(tid('detail-folio'))).toHaveText(R1);
  await direct(page, 'u_tit_obp', 'r1', '&fail=listDocuments');
  await expect(page.locator(tid('detail-documents'))).toContainText('No fue posible comunicarse');
  await expect(page.locator('[data-testid^="history-"]')).toHaveCount(3);
});

test('10 revocación de membresía durante la sesión', async ({ page }) => {
  await workspace(page, 'u_tit_obp');
  await page.locator(tid(`request-${R2}`)).click();
  await expect(page.locator(tid('detail-folio'))).toHaveText(R2);
  await page.evaluate(() => window.__muniRevokeCurrent());
  await page.locator(tid('detail-back')).click();
  await expect(page.locator(tid('municipal-no-membership'))).toBeVisible();
});

test('11 validación y confirmación de acciones', async ({ page }) => {
  await direct(page, 'u_tit_obp', 'r2');
  await page.locator(tid('action-CANCELAR')).click();
  await page.locator(tid('action-continue')).click();
  await expect(page.getByText('Escriba una nota de al menos 5 caracteres.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Nota (obligatoria)' }).fill('Solicitud duplicada (prueba)');
  await page.locator(tid('action-continue')).click();
  await expect(page.locator(tid('action-confirm'))).toContainText(`para el expediente ${R2}`);
  await page.locator(tid('action-confirm-button')).click();
  await expect(page.locator(tid('detail-notice-success'))).toHaveText('Acción registrada: Cancelar.');
  await expect(page.locator(tid('detail-status'))).toContainText('Cancelada');
  await expect(page.locator(tid('detail-no-actions'))).toBeVisible();
});

test('12 flujo completo solo con teclado: lista → detalle → concluir', async ({ page }) => {
  await workspace(page, 'u_tit_obp');
  const tabTo = async (locator, max = 80) => {
    for (let i = 0; i < max; i += 1) {
      if (await locator.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))) return true;
      await page.keyboard.press('Tab');
    }
    return false;
  };
  expect(await tabTo(page.locator(tid(`request-${R1}`))), 'fila alcanzable con Tab').toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator(tid('detail-folio'))).toHaveText(R1);
  expect(await tabTo(page.locator(tid('action-CERRAR'))), 'acción alcanzable con Tab').toBe(true);
  await page.keyboard.press('Enter');
  expect(await tabTo(page.getByRole('textbox', { name: 'Nota (obligatoria)' }))).toBe(true);
  await page.keyboard.type('Atendida con teclado (prueba)');
  expect(await tabTo(page.locator(tid('action-continue')))).toBe(true);
  await page.keyboard.press('Enter');
  expect(await tabTo(page.locator(tid('action-confirm-button')))).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator(tid('detail-notice-success'))).toHaveText('Acción registrada: Concluir.');
  await expect(page.locator(tid('detail-status'))).toContainText('Concluida');
});

test('13 accesibilidad: encabezado, listas, nombres de botones y alertas', async ({ page }) => {
  await direct(page, 'u_tit_obp', 'r1');
  await expect(page.getByRole('heading', { name: /^Expediente S J H, O B P, S O L, 2026, 1$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();
  expect(await page.getByRole('list').count()).toBeGreaterThanOrEqual(2);
  expect(await page.getByRole('listitem').count()).toBeGreaterThanOrEqual(5);
  await expect(page.getByRole('button', { name: /^Descargar Oficio de inspecci/ })).toBeVisible();
  await page.locator(tid('action-CERRAR')).click();
  await page.locator(tid('action-continue')).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Escriba una nota' })).toBeVisible();
});

test('14 auditor: solo metadatos', async ({ page }) => {
  await direct(page, 'u_aud', 'r1');
  await expect(page.locator(tid('detail-meta-only'))).toBeVisible();
  for (const id of ['detail-subject', 'detail-history', 'detail-documents', 'detail-actions', 'detail-citizen']) await expect(page.locator(tid(id))).toHaveCount(0);
});

test('16 documento alterado en el transporte: el lector privado no lo guarda e informa (C-21)', async ({ page }) => {
  await direct(page, 'u_tit_obp', 'r1', '&tamperDocs=1');
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.getByRole('button', { name: /^Descargar Oficio/ }).click();
  await expect(page.locator(tid('detail-notice-error'))).toContainText('no superó la verificación');
  await page.waitForTimeout(800);
  expect(downloads, 'sin archivo guardado').toBe(0);
  await expect(page.locator(tid('detail-notice-success'))).toHaveCount(0);
});

for (const [name, width, height] of [['celular', 360, 740], ['tableta', 800, 1000], ['escritorio', 1280, 900]]) {
  test(`15 detalle adaptable ${name} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await direct(page, 'u_tit_obp', 'r1');
    await expect(page.locator(tid('detail-folio'))).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'sin desplazamiento horizontal').toBeLessThanOrEqual(1);
    const data = await page.locator(tid('detail-data')).boundingBox();
    const docs = await page.locator(tid('detail-documents')).boundingBox();
    if (width >= 1024) expect(docs.x, 'columnas lado a lado').toBeGreaterThan(data.x + data.width - 1);
    else expect(Math.abs(docs.x - data.x), 'apilado').toBeLessThanOrEqual(2);
    const buttons = await page.getByRole('button').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect().height));
    expect(Math.min(...buttons), 'altura mínima de botones').toBeGreaterThanOrEqual(32);
  });
}
