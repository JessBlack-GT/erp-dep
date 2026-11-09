// @ts-check
'use strict';
/**
 * Aplicación Express AISLADA para probar la API municipal sin tocar app.js del ERP (F1-04).
 * Monta el router en `/api/municipal/v1`, igual que se propone para el ERP (C-01).
 *
 * Usa la identidad central real del ERP (`erpIdentityMiddlewares`) salvo que se inyecte otra
 * cadena equivalente. No crea usuarios, no emite tokens y no abre puertos por sí misma.
 */
const express = require('express');
const { createMunicipalRouter } = require('./municipal.router');
const { erpIdentityMiddlewares } = require('./erp-identity');
const { createMunicipalService } = require('../application/municipal.service');

/**
 * @param {{ store: any, storage: any, clock?: () => Date, identity?: Function[] }} deps
 */
function createIsolatedMunicipalApp({ store, storage, clock = () => new Date(), identity }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // mismo valor que el ERP
  const service = createMunicipalService({ store, storage, clock });
  app.use('/api/municipal/v1', createMunicipalRouter({ service, store, clock, identity: identity || erpIdentityMiddlewares() }));
  app.use((req, res) => res.status(404).json({ success: false, error: 'No encontrado', code: 'NOT_FOUND' }));
  return { app, service };
}

module.exports = { createIsolatedMunicipalApp };
