/**
 * MuniERP IA — arnés web de QA para Playwright (F1-12).
 * Renderiza el espacio de trabajo municipal con la API SIMULADA (sin red, datos sintéticos).
 * NO forma parte de la app ni de su navegación; se compila aparte con build-municipal-harness.cjs.
 *
 * Parámetros de URL (solo QA):
 *   ?scenario=no-membership  → usuario sin membresía
 *   ?scenario=load-error     → falla la carga inicial (reintento)
 *   ?scenario=submit-error   → el primer registro falla por red (continuidad)
 *   ?delay=<ms>              → latencia simulada
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { MunicipalWorkspaceScreen, createMockMunicipalApi } from '../src/features/municipal';

const params = new URLSearchParams(window.location.search);
const scenario = params.get('scenario') || 'default';
const delayMs = Math.min(Number(params.get('delay')) || 0, 3000);

function buildApi() {
  const api = createMockMunicipalApi({ delayMs });
  if (scenario === 'no-membership') return { ...api, myMemberships: async () => [] };
  if (scenario === 'load-error') {
    let failed = false;
    return { ...api, listRequests: (q) => (failed ? api.listRequests(q) : ((failed = true), Promise.reject(new Error('red simulada')))) };
  }
  if (scenario === 'submit-error') {
    let failed = false;
    const keys = [];
    window.__muniIdempotencyKeys = keys;
    return {
      ...api,
      createRequest: (body, key) => {
        keys.push(key);
        if (!failed) { failed = true; return Promise.reject(new Error('red simulada')); }
        return api.createRequest(body, key);
      },
    };
  }
  return api;
}

const api = buildApi();
document.documentElement.dataset.muniScenario = scenario;
createRoot(document.getElementById('root')).render(
  <View style={{ flex: 1 }}>
    <MunicipalWorkspaceScreen api={api} />
  </View>,
);
