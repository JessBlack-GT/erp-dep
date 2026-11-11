/* eslint-env node */
/**
 * MuniERP IA — F1-15a: flujos de la DEMOSTRACIÓN navegable (qa/demo-app.web.jsx, servida en /demo/).
 * API SIMULADA: el servicio municipal REAL con almacén en memoria y datos sintéticos se ejecuta en el
 * navegador. La autorización es la del servicio, pero NO hay HTTP, JWT ni MongoDB: estas pruebas no
 * acreditan la integración HTTP real ni la persistencia.
 */
const { test, expect } = require('playwright/test');
const { registerEvidence } = require('./evidence.cjs');

const API_MODE = 'SIMULADA: servicio municipal real en memoria (sin HTTP/JWT/MongoDB) · demostración';
registerEvidence(test, { suite: 'f1-15a-demostracion', apiMode: API_MODE });

const tid = (id) => `[data-testid="${id}"]`;
const field = (page, name) => page.getByLabel(name, { exact: true });

async function demo(page, persona, extra = '') {
  await page.goto(`/demo/${persona ? `?persona=${persona}${extra}` : ''}`);
  await expect(page.locator(tid('demo-label'))).toContainText('MODO DEMOSTRACIÓN');
  await expect(page.locator(tid('demo-label'))).toContainText('API simulada');
  if (persona && persona !== 'u_reg') await expect(page.locator(tid('app-header'))).toBeVisible();
}
async function go(page, key) {
  await page.locator(tid(`nav-${key}`)).click();
}
const h1s = (page) => page.locator('h1').allInnerTexts();

test('01 navegación principal: perfiles, secciones y modo identificado', async ({ page }) => {
  await demo(page, null);
  await expect(page.locator(tid('demo-personas'))).toBeVisible();
  await page.locator(tid('demo-persona-u_sup')).click();
  await expect(page.locator(tid('home-title'))).toHaveText('Panel principal');
  await expect(page.locator(tid('app-role'))).toHaveText('Supervisor municipal');
  const nav = page.getByRole('navigation', { name: 'Secciones de MuniERP' });
  await expect(nav.getByRole('button')).toHaveText(['Panel principal', 'Registrar solicitud', 'Solicitudes', 'Dependencias', 'Membresías y permisos']);
  for (const [key, title] of [['intake', 'Registrar solicitud'], ['requests', 'Solicitudes'], ['dependencies', 'Dependencias'], ['memberships', 'Membresías y permisos'], ['home', 'Panel principal']]) {
    await go(page, key);
    await expect(page.locator('h1')).toHaveText([title]);
    await expect(page.locator(tid(`nav-${key}`))).toHaveAttribute('aria-current', 'page');
  }
  await expect(page.locator(tid('indicator-total'))).toContainText('10');
});

test('02 registro de solicitud y visualización del folio (ventanilla)', async ({ page }) => {
  await demo(page, 'u_vent');
  await go(page, 'intake');
  await page.locator(tid('intake-dependency-OBP')).click();
  await page.locator('[data-testid^="intake-citizen-"]').first().click();
  await field(page, 'Asunto').fill('Luminaria intermitente (demostración)');
  await page.locator(tid('intake-submit')).click();
  await expect(page.locator(tid('receipt-folio'))).toHaveText(/^SJH-OBP-SOL-2026-0000\d\d$/);
  const folio = await page.locator(tid('receipt-folio')).innerText();
  await expect(page.locator('h1')).toHaveText(['Solicitud registrada']);
  await page.locator(tid('receipt-open')).click();
  await expect(page.locator(tid('detail-folio'))).toHaveText(folio);
  await expect(page.locator(tid('detail-history'))).toContainText('Registro');
});

test('03 listado, filtros y búsqueda por folio (titular)', async ({ page }) => {
  await demo(page, 'u_tit_obp');
  await go(page, 'requests');
  await expect(page.locator(tid('requests-summary'))).toHaveText(/^Página 1 de 1 · \d+ solicitud\(es\)$/);
  await page.locator(tid('requests-filter-status-EN_ESPERA_CIUDADANO')).click();
  await expect(page.locator(tid('requests-summary'))).toHaveText('Página 1 de 1 · 1 solicitud(es)');
  await page.locator(tid('requests-filter-status-')).click();
  await field(page, 'Folio').fill('no-es-folio');
  await page.locator(tid('requests-folio-open')).click();
  await expect(page.getByText(/Folio con formato MUN-DEP-TIPO/)).toBeVisible();
  const folios = await page.evaluate(() => window.__muniFolios);
  await field(page, 'Folio').fill(folios.r4); // Tesorería: fuera del alcance de Obras Públicas
  await page.locator(tid('requests-folio-open')).click();
  await expect(page.getByText('Expediente no encontrado o sin acceso.')).toBeVisible();
  await page.locator(tid('detail-back')).click();
  await field(page, 'Folio').fill(folios.r1);
  await page.locator(tid('requests-folio-open')).click();
  await expect(page.locator(tid('detail-folio'))).toHaveText(folios.r1);
});

test('04 expediente e historial: reanudar un trámite en espera (titular)', async ({ page }) => {
  await demo(page, 'u_tit_obp');
  await go(page, 'requests');
  const folios = await page.evaluate(() => window.__muniFolios);
  await page.locator(tid(`request-${folios.r6}`)).click();
  await expect(page.locator(tid('detail-folio'))).toHaveText(folios.r6);
  await expect(page.locator(tid('detail-history'))).toContainText('En espera del ciudadano');
  await page.locator(tid('action-REANUDAR')).click();
  await page.locator(tid('action-continue')).click();
  await page.locator(tid('action-confirm-button')).click();
  await expect(page.locator(tid('detail-history'))).toContainText('Reanudación');
  await page.locator(tid('detail-back')).click();
  await expect(page.locator('h1')).toHaveText(['Solicitudes']);
});

test('05 administración de dependencias (administrador municipal)', async ({ page }) => {
  await demo(page, 'u_admin_mun');
  await go(page, 'dependencies');
  await expect(page.locator(tid('dependency-PCV'))).toContainText('Protección Civil');
  await field(page, 'Código (3 letras)').fill('drl');
  await field(page, 'Nombre').fill('Desarrollo Rural');
  await page.locator(tid('dependency-create-submit')).click();
  await expect(page.locator(tid('dependencies-notice'))).toHaveText('Dependencia DRL · Desarrollo Rural creada.');
  await page.locator(tid('dependency-edit-DRL')).click();
  await field(page, 'Nombre de la dependencia').fill('Desarrollo Rural y Agropecuario');
  await page.locator(tid('dependency-edit-save')).click();
  await expect(page.locator(tid('dependency-DRL'))).toContainText('Desarrollo Rural y Agropecuario');
  // Regla del servidor: no se desactiva una dependencia con expedientes abiertos.
  await page.locator(tid('dependency-edit-OBP')).click();
  await page.locator(tid('dependency-edit-status-INACTIVA')).click();
  await page.locator(tid('dependency-edit-save')).click();
  await expect(page.locator(tid('dependencies-notice'))).toContainText('expediente(s) abierto(s)');
  await expect(page.locator(tid('dependencies-notice'))).toHaveAttribute('role', 'alert');
});

test('06 membresías: asignar un usuario central, efecto inmediato y revocación', async ({ page }) => {
  await demo(page, 'u_admin_mun');
  await go(page, 'memberships');
  await expect(page.locator(tid('memberships-summary'))).toHaveText('Página 1 de 1 · 10 membresía(s)');
  await page.locator(tid('demo-users-toggle')).click();
  const uReg = (await page.locator(tid('demo-user-u_reg')).innerText()).split(': ')[1].trim();
  await field(page, 'Identificador del usuario central').fill(uReg);
  await page.locator(tid('membership-role-OPERADOR_DEPENDENCIA')).click();
  await page.locator(tid('membership-deps-OBP')).click();
  await expect(page.locator(tid('membership-deps-OBP'))).toHaveAttribute('aria-checked', 'true');
  await page.locator(tid('membership-create-submit')).click();
  await expect(page.locator(tid('memberships-notice'))).toContainText('Membresía creada');
  // Mismo mundo, otro perfil: el usuario asignado ya entra como operador.
  await page.locator(tid('demo-change-persona')).click();
  await page.locator(tid('demo-persona-u_reg')).click();
  await expect(page.locator(tid('app-role'))).toHaveText('Operador de dependencia');
  // El administrador revoca y el acceso se retira de inmediato.
  await page.locator(tid('demo-change-persona')).click();
  await page.locator(tid('demo-persona-u_admin_mun')).click();
  await go(page, 'memberships');
  await page.locator(tid('memberships-filter-role-OPERADOR_DEPENDENCIA')).click();
  const row = page.locator('[data-testid^="membership-"][aria-label*="···0000cb"]');
  await row.locator('[data-testid^="membership-revoke-"]').click();
  await page.locator(tid('membership-revoke-confirm-button')).click();
  await expect(page.locator(tid('memberships-notice'))).toContainText('revocada');
  await page.locator(tid('demo-change-persona')).click();
  await page.locator(tid('demo-persona-u_reg')).click();
  await expect(page.locator(tid('app-no-membership'))).toContainText('No tiene una membresía municipal vigente');
});

test('07 restricciones por rol (la interfaz oculta; el servidor decide)', async ({ page }) => {
  const expectations = [
    ['u_admin_mun', ['home', 'dependencies', 'memberships']],
    ['u_vent', ['home', 'intake', 'requests', 'dependencies']],
    ['u_consulta_obp', ['home', 'requests', 'dependencies']],
    ['u_aud', ['home', 'requests', 'dependencies', 'memberships', 'audit']],
    ['u_tit_obp', ['home', 'intake', 'requests', 'dependencies', 'memberships']],
  ];
  for (const [persona, keys] of expectations) {
    await demo(page, persona);
    const ids = await page.locator('[data-testid^="nav-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('nav-', '')));
    expect(ids, persona).toEqual(keys);
  }
  // Vista pedida por URL sin permiso → panel principal (sin bitácora para el administrador).
  await demo(page, 'u_admin_mun', '&view=audit');
  await expect(page.locator('h1')).toHaveText(['Panel principal']);
  // Titular: membresías solo lectura; Ventanilla: dependencias solo lectura.
  await demo(page, 'u_tit_obp', '&view=memberships');
  await expect(page.getByText('Solo consulta: su rol no administra membresías.')).toBeVisible();
  await expect(page.locator(tid('membership-create'))).toHaveCount(0);
  await demo(page, 'u_vent', '&view=dependencies');
  await expect(page.locator(tid('dependency-create'))).toHaveCount(0);
  await expect(page.locator('[data-testid^="dependency-edit-"]')).toHaveCount(0);
  await demo(page, 'u_reg');
  await expect(page.locator(tid('app-no-membership'))).toBeVisible();
});

test('08 auditoría solo para el auditor, con las acciones de la demostración', async ({ page }) => {
  await demo(page, 'u_aud');
  await go(page, 'audit');
  await expect(page.locator(tid('audit-title'))).toHaveText('Bitácora de auditoría · San Juan Huactzinco');
  await expect(page.locator(tid('audit-list'))).toContainText('Alta de dependencia');
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).not.toMatch(/192\.0\.2\.|127\.0\.0\.1|demo-seed|qa-ui/);
  await demo(page, 'u_sup');
  await expect(page.locator(tid('nav-audit'))).toHaveCount(0);
});

test('09 recorrido solo con teclado: perfil, sección y expediente', async ({ page }) => {
  await demo(page, null);
  const persona = page.locator(tid('demo-persona-u_tit_obp'));
  for (let i = 0; i < 25 && !(await persona.evaluate((e) => e === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(persona).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator(tid('home-title'))).toBeVisible();
  const navReq = page.locator(tid('nav-requests'));
  for (let i = 0; i < 25 && !(await navReq.evaluate((e) => e === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(navReq).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('h1')).toHaveText(['Solicitudes']);
  const first = page.locator('[data-testid^="request-SJH-"]').first();
  for (let i = 0; i < 40 && !(await first.evaluate((e) => e === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator(tid('detail-folio'))).toBeVisible();
});

test('10 accesibilidad: un h1 por pantalla, regiones y nombres de campos', async ({ page }) => {
  await demo(page, 'u_aud');
  for (const key of ['home', 'requests', 'dependencies', 'memberships', 'audit']) {
    await go(page, key);
    await expect(page.locator(tid('app-main')).locator('h1')).toHaveCount(1);
    const levels = await page.locator('h1,h2,h3,h4,h5,h6').evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
    for (let i = 1; i < levels.length; i += 1) expect(levels[i] - levels[i - 1], `${key}: salto de nivel`).toBeLessThanOrEqual(1);
  }
  await expect(page.getByRole('navigation', { name: 'Secciones de MuniERP' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await demo(page, 'u_admin_mun', '&view=memberships');
  await expect(field(page, 'Identificador del usuario central')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Rol municipal' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Dependencias' }).last()).toBeVisible();
  // Los botones contiguos no se tocan (separación ≥ 4 px).
  const gaps = await page.locator(tid('memberships-list')).locator('[role="button"]').evaluateAll((els) => {
    const r = els.slice(0, 2).map((e) => e.getBoundingClientRect());
    return r.length === 2 && Math.abs(r[0].top - r[1].top) < 2 ? r[1].left - r[0].right : null;
  });
  expect(gaps).toBeGreaterThanOrEqual(4);
});

test('11 restablecer la demostración vuelve a los datos sembrados', async ({ page }) => {
  await demo(page, 'u_admin_mun', '&view=dependencies');
  await field(page, 'Código (3 letras)').fill('TMP');
  await field(page, 'Nombre').fill('Temporal de prueba');
  await page.locator(tid('dependency-create-submit')).click();
  await expect(page.locator(tid('dependency-TMP'))).toBeVisible();
  await page.locator(tid('demo-reset')).click();
  await go(page, 'dependencies');
  await expect(page.locator(tid('dependency-PCV'))).toBeVisible();
  await expect(page.locator(tid('dependency-TMP'))).toHaveCount(0);
});

test('12 estados de carga y error con reintento', async ({ page }) => {
  await page.goto('/demo/?persona=u_tit_obp&view=requests&latency=1200');
  await expect(page.locator(tid('requests-loading'))).toBeVisible();
  await expect(page.locator(tid('requests-summary'))).toBeVisible();
  await page.goto('/demo/?persona=u_tit_obp&view=requests&fail=listRequests');
  await expect(page.locator(tid('requests-error'))).toHaveText('No fue posible comunicarse con el servidor. Intente de nuevo.');
  await page.locator(tid('requests-retry')).click();
  await expect(page.locator(tid('requests-summary'))).toBeVisible();
});

for (const [name, width, height] of [['celular 360px', 360, 780], ['tableta 800px', 800, 1000], ['escritorio 1280px', 1280, 900]]) {
  test(`13 diseño adaptable ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await demo(page, 'u_sup');
    for (const key of ['home', 'requests', 'memberships']) {
      await go(page, key);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${key} sin desplazamiento horizontal`).toBeLessThanOrEqual(1);
    }
    await go(page, 'home');
    const sidebar = await page.locator(tid('app-nav')).evaluate((e) => getComputedStyle(e).flexDirection);
    expect(sidebar).toBe(width >= 1024 ? 'column' : 'row');
  });
}
