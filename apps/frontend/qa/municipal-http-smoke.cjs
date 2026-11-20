'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');


const root = path.resolve(__dirname, '../../..');
const site = 'http://127.0.0.1:8081';
const api = 'http://127.0.0.1:4314/api';
const municipal = api + '/municipal/v1';
const output = path.resolve(process.env.QA_OUTPUT || 'municipal-http-evidence');

function start(script, pattern, extraEnv = {}) {
  const child = spawn(process.execPath, [script], { cwd: root, env: { ...process.env, ...extraEnv } });
  const ready = new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('El proceso local no inició a tiempo')), 30000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`El proceso local cerró (${code})`)); });
    child.stderr.on('data', () => {}); // No publicar información de sesión ni datos de la petición.
    child.stdout.on('data', (chunk) => {
      buffer = (buffer + chunk).slice(-4096);
      const match = buffer.match(pattern);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  return { child, ready };
}

async function login(page, profile, password, mobile = false) {
  await page.goto(site);
  await page.getByTestId('login-email').fill(profile + '@demo.test');
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await page.getByTestId('topbar-container').first().waitFor();
  if (mobile) await page.getByTestId('sidebar-toggle-btn').click();
}

async function httpOnly(password) {
  async function json(url, { status = 200, data, token, headers = {} } = {}) {
    const res = await fetch(url, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    assert.equal(res.status, status, new URL(url).pathname);
    return (await res.json()).data;
  }
  const login = async (name) => (await json(api + '/v1/auth/login', { data: { email: name + '@demo.test', password } })).accessToken;
  const at = (mun, endpoint) => municipal + '/municipalities/' + mun + endpoint;
  const ventanilla = await login('ventanilla');
  const obras = await login('obras');
  const auditor = await login('auditor');
  const comercial = await login('comercial');
  const dosMunicipios = await login('dosmunicipios');
  assert.deepEqual(await json(municipal + '/me/memberships', { token: comercial }), []);
  assert.deepEqual((await json(municipal + '/me/memberships', { token: dosMunicipios })).map((m) => m.municipality.code).sort(), ['SJH', 'ZZZ']);
  const originallyVisible = await json(at('SJH', '/citizens'), { token: ventanilla });
  assert.deepEqual(originallyVisible, []);
  const citizen = await json(at('SJH', '/citizens'), {
    status: 201, token: ventanilla, data: { fullName: 'Persona Sintética HTTP' },
  });
  const payload = { type: 'SOL', channel: 'PRESENCIAL', ownerDependency: 'OBP', citizenId: citizen.id, subject: 'Prueba sintética de luminaria' };
  const options = { token: ventanilla, data: payload, headers: { 'Idempotency-Key': 'ensayo-folio-web' } };
  const created = await json(at('SJH', '/requests'), { ...options, status: 201 });
  const folio = created.folio;
  assert.match(folio, /^SJH-OBP-SOL-\d{4}-\d{6}$/);
  const replay = await json(at('SJH', '/requests'), options);
  assert.equal(replay.folio, folio);
  const detail = '/requests/' + folio;
  assert.equal((await json(at('SJH', detail + '/receipt'), { token: ventanilla })).folio, folio);
  assert.equal((await json(at('SJH', detail), { token: obras })).subject, payload.subject);
  assert.ok((await json(at('SJH', detail + '/history'), { token: obras })).length > 0);
  const newCitizen = await json(at('SJH', '/citizens'), {
    status: 201, token: obras, data: { fullName: 'Persona Sintética Alta Obras' },
  });
  assert.ok((await json(at('SJH', '/citizens'), { token: obras })).some((c) => c.id === newCitizen.id));
  const newRequest = { ...payload, citizenId: newCitizen.id, subject: 'Segunda solicitud sintética de Obras' };
  const byObras = { token: obras, data: newRequest, headers: { 'Idempotency-Key': 'obras-segundo-folio-qa' } };
  await json(at('SJH', '/requests'), { ...byObras, data: { ...newRequest, ownerDependency: 'TES' }, status: 403 });
  const second = await json(at('SJH', '/requests'), { ...byObras, status: 201 });
  assert.notEqual(second.folio, folio);
  assert.equal((await json(at('SJH', '/requests'), byObras)).folio, second.folio);
  const actual = await json(at('SJH', '/requests'), { token: obras });
  assert.equal(actual.filter((r) => r.folio === second.folio).length, 1);
  assert.ok(actual.some((r) => r.folio === folio));
  assert.ok((await json(at('SJH', '/audit-events?folio=' + folio), { token: auditor })).some((e) => e.folio === folio));
  await json(at('SJH', '/audit-events'), { token: ventanilla, status: 403 });
  await json(at('SJH', detail), { token: comercial, status: 403 });
  await json(at('ZZZ', detail), { token: dosMunicipios, status: 404 });
  await json(municipal + '/me/memberships', { status: 401 });
  const health = await fetch(api + '/v1/health');
  assert.equal(health.status, 200);
  const shell = await fetch(site + '/municipal');
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /id="root"/);
  console.log(JSON.stringify({ mode: 'HTTP localhost sin navegador', folio, secondFolio: second.folio, checks: ['alta y acuse', 'reintento idempotente', 'consulta e historial desde otra sesión', 'alta inmediata de ciudadano y segundo folio sin duplicar', 'denegación fuera de dependencia', 'auditoría y denegación', 'aislamiento municipal', 'ERP y página web disponibles'] }));
}

async function main() {
  let browser;
  const backend = start('apps/backend/scripts/municipal-local-qa.cjs', /Clave temporal de demostración: ([a-f0-9]{16})/);
  const frontend = start('apps/frontend/scripts/web.cjs', /Frontend development:/, {
    EXPO_PUBLIC_API_BASE_URL: api + '/v1',
  });
  try {
    const [password] = await Promise.all([backend.ready, frontend.ready]);
    if (process.argv.includes('--http-only')) {
      await httpOnly(password);
      return;
    }
    await mkdir(output, { recursive: true });
    const engine = process.env.QA_BROWSER || 'chromium';
    const executablePath = process.env.QA_BROWSER_EXE || undefined;
    browser = await require('playwright')[engine].launch({ executablePath });

    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await desktop.newPage();
    await login(page, 'ventanilla', password);
    await page.getByTestId('nav-item-Municipal').click();
    await page.getByText(/DEMOSTRACIÓN LOCAL · HTTP real/).waitFor();
    await page.getByTestId('nav-intake').click();
    await page.getByTestId('intake-new-citizen').click();
    await page.getByTestId('intake-citizen-name').fill('Persona Sintética QA');
    const citizenCall = page.waitForResponse((response) => response.url().endsWith('/SJH/citizens') && response.request().method() === 'POST');
    await page.getByTestId('intake-save-citizen').click();
    assert.equal((await citizenCall).status(), 201);
    await page.getByTestId('intake-dependency-OBP').click();
    await page.getByRole('radio', { name: 'Persona Sintética QA' }).click();
    await page.getByTestId('intake-subject').fill('Reparación sintética de luminaria');
    await page.getByTestId('intake-description').fill('Registro para verificar el traspaso entre perfiles.');
    const createCall = page.waitForResponse((response) => response.url().endsWith('/SJH/requests') && response.request().method() === 'POST');
    await page.getByTestId('intake-submit').click();
    const created = await createCall;
    assert.equal(created.status(), 201);
    const folio = (await created.json()).data.folio;
    assert.match(folio, /^SJH-OBP-SOL-\d{4}-\d{6}$/);
    const receipt = page.getByTestId('receipt-folio');
    await receipt.waitFor();
    assert.equal(await receipt.innerText(), folio);
    await page.screenshot({ path: path.join(output, `${engine}-01-acuse.png`) });
    assert.equal(await page.getByTestId('nav-audit').count(), 0);
    const bearer = (await created.request().allHeaders()).authorization;
    const forbidden = await fetch(municipal + '/municipalities/SJH/audit-events', { headers: { Authorization: bearer } });
    assert.equal(forbidden.status, 403);

    const mobile = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: engine !== 'firefox', hasTouch: true });
    const narrow = await mobile.newPage();
    await login(narrow, 'obras', password, true);
    await narrow.getByTestId('nav-item-Municipal').click();
    await narrow.getByTestId('nav-requests').click();
    await narrow.getByTestId('requests-folio').fill(folio);
    const history = narrow.waitForResponse((response) => response.url().endsWith(`/${folio}/history`));
    await narrow.getByTestId('requests-folio-open').click();
    assert.equal((await history).status(), 200);
    const shown = narrow.getByTestId('detail-folio');
    await shown.waitFor();
    assert.equal(await shown.innerText(), folio);
    assert.match(await narrow.getByTestId('detail-subject').innerText(), /luminaria/);
    await narrow.getByTestId('history-0').waitFor();
    await narrow.screenshot({ path: path.join(output, `${engine}-02-expediente-web-movil.png`) });

    const audit = await (await browser.newContext()).newPage();
    await login(audit, 'auditor', password);
    await audit.getByTestId('nav-item-Municipal').click();
    await audit.getByTestId('nav-audit').click();
    await audit.getByTestId('audit-filter-folio').fill(folio);
    await audit.getByTestId('audit-apply').click();
    await audit.getByTestId('audit-list').getByText(folio, { exact: false }).first().waitFor();
    await audit.screenshot({ path: path.join(output, `${engine}-03-bitacora.png`) });

    const denied = await (await browser.newContext()).newPage();
    const discovery = denied.waitForResponse((response) => response.url().endsWith('/me/memberships'));
    await login(denied, 'comercial', password);
    assert.deepEqual((await (await discovery).json()).data, []);
    assert.equal(await denied.getByTestId('nav-item-Municipal').count(), 0);
    await denied.goto(site + '/municipal');
    await denied.getByTestId('municipal-access-denied').waitFor();

    const multi = await (await browser.newContext()).newPage();
    await login(multi, 'dosmunicipios', password);
    await multi.getByTestId('nav-item-Municipal').click();
    await multi.getByTestId('municipality-ZZZ').click();
    await multi.getByText(/MuniERP IA · Municipio Ficticio de Aislamiento/).waitFor();
    await multi.getByTestId('nav-requests').click();
    await multi.getByTestId('requests-folio').fill(folio);
    const cross = multi.waitForResponse((response) => response.url().endsWith('/ZZZ/requests/' + folio));
    await multi.getByTestId('requests-folio-open').click();
    assert.equal((await cross).status(), 404);

    const health = await fetch(api + '/v1/health');
    assert.equal(health.status, 200);
    console.log(JSON.stringify({ mode: 'HTTP local con datos sintéticos', engine, version: browser.version(), folio, checks: ['alta y acuse', 'expediente e historial web móvil', 'bitácora', 'administrador comercial sin acceso', 'aislamiento entre municipios', 'salud ERP'] }));
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      backend.child.kill();
      frontend.child.kill();
    }
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
