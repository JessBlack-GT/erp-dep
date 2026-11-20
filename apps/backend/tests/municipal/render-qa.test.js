'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const request = require('supertest');
const express = require('express');
const { readRenderQaConfig } = require('../../scripts/municipal-render-config.cjs');
const { createApp } = require('../../src/app');

const fake = (value) => value.repeat(32);
const env = () => ({
  RENDER: 'true', RENDER_EXTERNAL_URL: 'https://munierp-qa.onrender.com',
  RENDER_GIT_BRANCH: 'integration/munierp-atlas-qa', NODE_ENV: 'test',
  MUNICIPAL_QA_RENDER_ENABLED: '1', PORT: '10000',
  MUNICIPAL_QA_USERS_JSON: JSON.stringify({ ventanilla: fake('a'), obras: fake('b'), auditor: fake('c') }),
});

describe('MuniERP QA en Render (sin conectarse a Atlas)', () => {
  it('requiere la rama, servicio, marcador y puerto de QA', () => {
    for (const mutation of [
      { RENDER_GIT_BRANCH: 'main' }, { IS_PULL_REQUEST: 'true' }, { NODE_ENV: 'production' },
      { RENDER_EXTERNAL_URL: 'https://yj-nexo-api.onrender.com' },
      { RENDER_EXTERNAL_URL: 'http://munierp-qa.onrender.com' },
      { PORT: '65536' }, { MUNICIPAL_QA_RENDER_ENABLED: '' }, { RENDER: '' },
    ]) assert.throws(() => readRenderQaConfig({ ...env(), ...mutation }));
  });

  it('requiere claves distintas y no devuelve ni acepta el secreto de otro perfil', () => {
    const config = readRenderQaConfig(env());
    assert.equal(config.port, 10000);
    assert.deepEqual(config.profiles, ['ventanilla', 'obras', 'auditor']);
    assert.equal(config.matchesPassword('ventanilla', fake('a')), true);
    assert.equal(config.matchesPassword('obras', fake('a')), false);
    assert.equal(config.matchesPassword('comercial', fake('a')), false);
    assert.equal(config.matchesPassword('auditor', {}), false);
    assert.ok(!JSON.stringify(config).includes(fake('a')));
    assert.throws(() => readRenderQaConfig({ ...env(), MUNICIPAL_QA_USERS_JSON: '{"ventanilla":"demo"}' }));
    const repeated = JSON.stringify({ ventanilla: fake('a'), obras: fake('a'), auditor: fake('c') });
    assert.throws(() => readRenderQaConfig({ ...env(), MUNICIPAL_QA_USERS_JSON: repeated }));
  });

  it('sirve la web y API en el mismo origen, mantiene el 404 de API y refleja el estado de Atlas', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'munierp-render-'));
    try {
      writeFileSync(path.join(directory, 'index.html'), '<!doctype html><title>MuniERP QA</title><script src="/app.js"></script>');
      writeFileSync(path.join(directory, 'app.js'), 'console.log("municipal");');
      const qaRoutes = express.Router();
      const municipalRouter = express.Router();
      municipalRouter.get('/probe', (_req, res) => res.json({ municipal: true }));
      let ready = true;
      const origin = readRenderQaConfig(env()).origin;
      const qaWeb = { directory, origin, isReady: async () => ready };
      assert.throws(() => createApp({ qaWeb }), /requiere sus rutas/);
      const app = request(createApp({ qaRoutes, municipalRouter, qaWeb }));
      await app.get('/').expect(200).expect(/MuniERP QA/);
      await app.get('/municipal').expect(200).expect(/MuniERP QA/);
      await app.get('/app.js').expect(200).expect(/municipal/);
      await app.get('/qa-ready').expect(200, { ok: true });
      ready = false;
      await app.get('/qa-ready').expect(503, { ok: false });
      await app.get('/api/no-existe').expect(404).expect('Content-Type', /json/);
      await app.get('/api/municipal/v1/probe').set('Origin', origin)
        .expect('Access-Control-Allow-Origin', origin).expect(200, { municipal: true });
      const denied = await app.get('/api/municipal/v1/probe').set('Origin', 'https://erp-dep.pages.dev');
      assert.equal(denied.headers['access-control-allow-origin'], undefined);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
