/**
 * MuniERP IA — arnés web de QA para Playwright (F1-12).
 * Renderiza el espacio de trabajo municipal con la API SIMULADA (sin red, datos sintéticos).
 * NO forma parte de la app ni de su navegación; se compila aparte con build-municipal-harness.cjs.
 *
 * Dos modos, ambos con API SIMULADA y datos sintéticos:
 *  - Básico (F1-12): `mockApi.js` escrito a mano.
 *  - Servicio real (F1-13): `?persona=<usuario sintético>` usa el servicio municipal del backend con
 *    almacén en memoria (autorización real, sin HTTP/JWT/MongoDB). Personas: u_tit_obp, u_op_obp,
 *    u_op_tes, u_vent, u_aud, u_sup, u_consulta_obp, u_tit_dif, u_reg (sin membresía), u_admin_erp.
 *    `?latency=<ms>` simula latencia; `?fail=getRequest,listDocuments` falla la primera llamada.
 *    `?openFolio=r1|r2|r3|r4|r5|z1|<folio>` abre directamente el detalle (prueba de acceso directo).
 *
 * Parámetros de URL del modo básico:
 *   ?scenario=no-membership  → usuario sin membresía
 *   ?scenario=load-error     → falla la carga inicial (reintento)
 *   ?scenario=submit-error   → el primer registro falla por red (continuidad)
 *   ?delay=<ms>              → latencia simulada
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { MunicipalWorkspaceScreen, RequestDetail, createMockMunicipalApi } from '../src/features/municipal';
import { Text } from '../src/components/common';
import { savePrivateDocumentWeb } from '../src/features/municipal/privateDocument';
import { createServiceBackedWorld } from './service-backed-api';

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

async function main() {
  const persona = params.get('persona');
  let api;
  if (persona) {
    // C-21: el arnés entrega documentos con el lector privado municipal, no con el exportador comercial.
    const world = await createServiceBackedWorld({ save: (out) => savePrivateDocumentWeb(out.bytes, out.info) });
    const fail = (params.get('fail') || '').split(',').filter(Boolean);
    api = world.apiFor(persona, { latencyMs: Math.min(Number(params.get('latency')) || 0, 5000), failFirst: fail, tamperDocuments: params.get('tamperDocs') === '1' });
    // Solo QA: folios sembrados y revocación de la membresía de la persona actual.
    window.__muniFolios = world.folios;
    window.__muniRevokeCurrent = () => world.revoke(persona);
    document.documentElement.dataset.muniMode = 'servicio-real-en-memoria';
  } else {
    api = buildApi();
    document.documentElement.dataset.muniMode = 'mock-basico';
  }
  document.documentElement.dataset.muniScenario = scenario;
  const openFolio = params.get('openFolio');
  const root = createRoot(document.getElementById('root'));
  if (persona && openFolio) {
    // Acceso directo al detalle: equivale a abrir un enlace a un folio. Sin membresía no se pide nada.
    const folio = (window.__muniFolios && window.__muniFolios[openFolio]) || openFolio;
    const [membership] = await api.myMemberships();
    const dependencies = membership ? await api.listDependencies().catch(() => []) : [];
    root.render(
      <View style={{ flex: 1 }}>
        <Text variant="caption" testID="municipal-mock-banner">{api.mockLabel}</Text>
        {membership ? (
          <RequestDetail api={api} folio={folio} membership={membership} dependencies={dependencies} />
        ) : (
          <Text testID="municipal-no-membership">No tiene una membresía municipal vigente. Solicítela al administrador municipal.</Text>
        )}
      </View>,
    );
    return;
  }
  root.render(
    <View style={{ flex: 1 }}>
      <MunicipalWorkspaceScreen api={api} />
    </View>,
  );
}

main();
