'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { createApp } = require('../../src/app');

describe('Montaje optativo del router municipal en YJ Nexo', () => {
  const prefix = '/api/municipal/v1';
  const origins = 'http://127.0.0.1:8081';
  const make = () => {
    const municipalRouter = express.Router();
    municipalRouter.get('/probe', (_req, res) => res.set('ETag', '"3"').json({ test: true }));
    return request(createApp({ municipalRouter }));
  };

  it('monta el router como hermano, detrás de protecciones globales y antes del 404', async () => {
    const app = make();
    const response = await app.get(prefix + '/probe').expect(200);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(typeof response.headers['ratelimit-remaining'], 'string');
    await app.get('/api/v1/health').expect(200);
    await app.get('/api/v1/probe').expect(404);
    await app.get('/api/municipal/v1-externa/probe').expect(404);
  });

  it('limita los encabezados adicionales de CORS al prefijo municipal', async () => {
    const app = make();
    const preflight = async (endpoint) => app.options(endpoint)
      .set('Origin', origins)
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'if-match,idempotency-key')
      .expect(200);
    const municipal = await preflight(prefix + '/probe');
    assert.match(municipal.headers['access-control-allow-headers'], /If-Match/);
    assert.match(municipal.headers['access-control-allow-headers'], /Idempotency-Key/);
    assert.equal(municipal.headers['access-control-expose-headers'], 'ETag');
    assert.equal(municipal.headers['access-control-allow-origin'], origins);
    for (const route of ['/api/v1/health', '/api/municipal/v1extra/probe']) {
      const response = await preflight(route);
      assert.doesNotMatch(response.headers['access-control-allow-headers'], /If-Match|Idempotency-Key/);
    }
    const denied = await app.options(prefix + '/probe').set('Origin', 'https://foraneo.invalid');
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
  });
});
