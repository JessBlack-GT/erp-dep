// @ts-check
'use strict';
/**
 * MuniERP IA — módulo de dominio municipal (Fase 1, preparación).
 *
 * ⚠️ NO MONTADO en app.js. Montarlo (`app.use('/api/municipal/v1', …)`) es la dependencia C-01 y
 * requiere revisión del equipo de Codex. Este módulo solo importa de sí mismo y de `crypto`;
 * no importa ni modifica ningún módulo del ERP. Ver docs/munierp/.
 */
module.exports = {
  permissions: require('./policy/permissions'),
  access: require('./policy/access'),
  folio: require('./domain/folio'),
  requestState: require('./domain/request-state'),
  validation: require('./domain/validation'),
  indicators: require('./domain/indicators'),
  documents: require('./domain/documents'),
  receipt: require('./domain/receipt'),
  createMunicipalService: require('./application/municipal.service').createMunicipalService,
};
