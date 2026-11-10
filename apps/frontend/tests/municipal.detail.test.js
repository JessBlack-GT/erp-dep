/**
 * MuniERP IA — F1-13 detalle de expediente.
 * Usa el SERVICIO MUNICIPAL REAL del backend con almacén en memoria y datos sintéticos
 * (qa/service-backed-api.js): la autorización es la del servidor, sin HTTP ni MongoDB.
 */
import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { RequestDetail, MunicipalWorkspaceScreen, municipalModel, createMunicipalApi, municipalBaseUrl } from '../src/features/municipal';
import { MOCK_PERMISSIONS } from '../src/features/municipal/mockApi';
import { createServiceBackedWorld } from '../qa/service-backed-api';

const backendState = require('../../backend/src/modules/municipal/domain/request-state');
const backendPermissions = require('../../backend/src/modules/municipal/policy/permissions');

// La primera prueba siembra el mundo con el servicio real y compila los módulos del backend en frío;
// en equipos lentos supera los 5 s por defecto de Jest (medido: 16-18 s en la VM de QA).
jest.setTimeout(30000);

async function setup(persona, options) {
  const saved = [];
  const world = await createServiceBackedWorld({ save: (out, filename) => saved.push({ filename, bytes: out.buffer, headers: out.headers }) });
  const api = world.apiFor(persona, options);
  const [membership] = await api.myMemberships();
  const dependencies = await api.listDependencies().catch(() => []);
  return { world, api, membership, dependencies, saved };
}

const renderDetail = (ctx, folio, props = {}) =>
  render(<RequestDetail api={ctx.api} folio={folio} membership={ctx.membership} dependencies={ctx.dependencies} {...props} />);

describe('F1-13 — paridad con el backend (sin duplicar reglas a ciegas)', () => {
  test('acciones de la interfaz = ACTIONS del servidor (permiso y estados de origen)', () => {
    expect(Object.keys(municipalModel.TRANSITIONS).sort()).toEqual(Object.keys(backendState.ACTIONS).sort());
    for (const [action, rule] of Object.entries(backendState.ACTIONS)) {
      expect(municipalModel.TRANSITIONS[action].permission).toBe(rule.permission);
      expect([...municipalModel.TRANSITIONS[action].from].sort()).toEqual([...rule.from].sort());
    }
  });

  test('los permisos del mock básico son exactamente los de SUPERVISOR_MUNICIPAL', () => {
    expect([...MOCK_PERMISSIONS].sort()).toEqual(backendPermissions.permissionsOf('SUPERVISOR_MUNICIPAL').sort());
  });

  test('acciones visibles por rol y estado', () => {
    const p = (role) => backendPermissions.permissionsOf(role);
    expect(municipalModel.availableActions(p('TITULAR_DEPENDENCIA'), 'EN_TRAMITE').map((a) => a.action)).toEqual(['TURNAR', 'ASIGNAR', 'ESPERAR_CIUDADANO', 'CERRAR', 'CANCELAR']);
    expect(municipalModel.availableActions(p('AUDITOR_MUNICIPAL'), 'EN_TRAMITE')).toEqual([]);
    expect(municipalModel.availableActions(p('TITULAR_DEPENDENCIA'), 'CERRADA')).toEqual([]);
    expect(municipalModel.validateAction('CERRAR', { note: 'ok' }).note).toMatch(/5 caracteres/);
  });
});

describe('F1-13 — detalle con autorización real', () => {
  test('titular: folio, datos, historial cronológico con actor y documentos descargables', async () => {
    const ctx = await setup('u_tit_obp');
    const { findByTestId, getByTestId, queryByTestId } = renderDetail(ctx, ctx.world.folios.r1);
    expect(await findByTestId('detail-folio')).toHaveTextContent('SJH-OBP-SOL-2026-000001');
    expect(getByTestId('detail-subject')).toHaveTextContent('Reparación de luminaria');
    expect(getByTestId('detail-status')).toHaveTextContent('En trámite');
    expect(getByTestId('detail-owner')).toHaveTextContent('Obras Públicas');
    expect(getByTestId('detail-citizen')).toHaveTextContent('Ciudadano Sintético 001');
    expect(getByTestId('history-0').props.accessibilityLabel).toMatch(/^Registro, estado Registrada, .* por Funcionario ···/);
    expect(getByTestId('history-1').props.accessibilityLabel).toMatch(/^Turnado, de Registrada a En trámite/);
    expect(getByTestId('history-2').props.accessibilityLabel).toMatch(/^Asignación de responsable/);
    expect(queryByTestId('history-3')).toBeNull();
    const docs = within(getByTestId('detail-documents'));
    expect(docs.getAllByText('Descargar')).toHaveLength(2);
  });

  test('descarga pasa por el servicio y entrega exactamente el PDF autorizado', async () => {
    const ctx = await setup('u_tit_obp');
    const { findByTestId, getAllByText, findByText } = renderDetail(ctx, ctx.world.folios.r1);
    await findByTestId('detail-documents');
    fireEvent.press(getAllByText('Descargar')[0]);
    expect(await findByText(/Descarga iniciada: Oficio de inspeccion\.pdf|Descarga iniciada: Oficio de inspección\.pdf/)).toBeTruthy();
    expect(ctx.saved).toHaveLength(1);
    expect(Buffer.from(ctx.saved[0].bytes).toString('latin1')).toMatch(/^%PDF-1\.4/);
    expect(ctx.saved[0].headers['Cache-Control']).toBe('no-store');
  });

  test('CONSULTA: documento confidencial restringido sin botón; sin acciones', async () => {
    const ctx = await setup('u_consulta_obp');
    const { findByTestId, getByTestId, getByText } = renderDetail(ctx, ctx.world.folios.r1);
    await findByTestId('detail-documents');
    expect(getByText('Documento restringido (Confidencial)')).toBeTruthy();
    expect(within(getByTestId('detail-documents')).getAllByText('Descargar')).toHaveLength(1);
    expect(getByTestId('detail-no-actions')).toBeTruthy();
  });

  test('AUDITOR: solo metadatos; no pide historial ni documentos', async () => {
    const ctx = await setup('u_aud');
    const spyHistory = jest.spyOn(ctx.api, 'getRequestHistory');
    const { findByTestId, queryByTestId } = renderDetail(ctx, ctx.world.folios.r1);
    expect(await findByTestId('detail-meta-only')).toBeTruthy();
    for (const id of ['detail-subject', 'detail-description', 'detail-citizen', 'detail-history', 'detail-documents', 'detail-actions']) expect(queryByTestId(id)).toBeNull();
    expect(spyHistory).not.toHaveBeenCalled();
  });

  test('expediente de otra dependencia, de otro municipio o inexistente: mismo mensaje, sin datos', async () => {
    const ctx = await setup('u_op_tes');
    const messages = [];
    for (const folio of [ctx.world.folios.r1, ctx.world.folios.z1, 'SJH-OBP-SOL-2026-000999']) {
      const view = renderDetail(ctx, folio);
      const el = await view.findByTestId('detail-error-message');
      expect(el).toHaveTextContent('Expediente no encontrado o sin acceso.');
      messages.push('Expediente no encontrado o sin acceso.');
      expect(view.queryByTestId('detail-subject')).toBeNull();
      expect(view.queryByTestId('detail-retry')).toBeNull();
      view.unmount();
    }
    expect(new Set(messages)).toEqual(new Set(['Expediente no encontrado o sin acceso.']));
  });

  test('membresía revocada: mensaje de membresía, sin datos', async () => {
    const ctx = await setup('u_tit_obp');
    await ctx.world.revoke('u_tit_obp');
    const { findByTestId } = renderDetail(ctx, ctx.world.folios.r1);
    expect(await findByTestId('detail-error-message')).toHaveTextContent(/membresía municipal vigente/);
  });

  test('error de red al cargar → reintentar recupera', async () => {
    const ctx = await setup('u_tit_obp', { failFirst: ['getRequest'] });
    const { findByTestId, getByTestId } = renderDetail(ctx, ctx.world.folios.r1);
    expect(await findByTestId('detail-error-message')).toHaveTextContent(/No fue posible comunicarse/);
    fireEvent.press(getByTestId('detail-retry'));
    expect(await findByTestId('detail-folio')).toHaveTextContent(ctx.world.folios.r1);
  });

  test('concluir: nota obligatoria, confirmación y registro en historial', async () => {
    const ctx = await setup('u_tit_obp');
    const { findByTestId, getByTestId, findByText } = renderDetail(ctx, ctx.world.folios.r1);
    fireEvent.press(await findByTestId('action-CERRAR'));
    fireEvent.press(getByTestId('action-continue'));
    expect(await findByText('Escriba una nota de al menos 5 caracteres.')).toBeTruthy();
    fireEvent.changeText(getByTestId('action-note'), 'Reparada por cuadrilla sintética');
    fireEvent.press(getByTestId('action-continue'));
    expect(await findByTestId('action-confirm')).toBeTruthy();
    fireEvent.press(getByTestId('action-confirm-button'));
    expect(await findByTestId('detail-notice-success')).toHaveTextContent('Acción registrada: Concluir.');
    await waitFor(() => expect(getByTestId('detail-status')).toHaveTextContent('Concluida'));
    expect(getByTestId('history-3').props.accessibilityLabel).toMatch(/^Conclusión, de En trámite a Concluida/);
    expect(getByTestId('detail-no-actions')).toBeTruthy();
  });

  test('conflicto de versión: el servidor rechaza (409), se avisa y se recarga', async () => {
    const ctx = await setup('u_tit_obp');
    const other = ctx.world.apiFor('u_tit_obp');
    const { findByTestId, getByTestId } = renderDetail(ctx, ctx.world.folios.r1);
    fireEvent.press(await findByTestId('action-ESPERAR_CIUDADANO'));
    await other.transitionRequest(ctx.world.folios.r1, { action: 'ESPERAR_CIUDADANO', version: 2 });
    fireEvent.press(getByTestId('action-continue'));
    fireEvent.press(await findByTestId('action-confirm-button'));
    expect(await findByTestId('detail-notice-error')).toHaveTextContent(/cambió/);
    await waitFor(() => expect(getByTestId('detail-status')).toHaveTextContent('En espera del ciudadano'));
  });

  test('asignar: responsables desde listMemberships de la dependencia', async () => {
    const ctx = await setup('u_tit_obp');
    const { findByTestId, getByTestId } = renderDetail(ctx, ctx.world.folios.r2);
    fireEvent.press(await findByTestId('action-ASIGNAR'));
    const option = await findByTestId(`action-user-${ctx.world.fx.USERS.u_op_obp}`);
    fireEvent.press(option);
    fireEvent.press(getByTestId('action-continue'));
    fireEvent.press(await findByTestId('action-confirm-button'));
    expect(await findByTestId('detail-notice-success')).toHaveTextContent('Asignar responsable');
    await waitFor(() => expect(getByTestId('detail-status')).toHaveTextContent('En trámite'));
  });

  test('desde la lista del espacio de trabajo se abre el detalle y se vuelve', async () => {
    const ctx = await setup('u_tit_obp');
    const { findByTestId, getByTestId } = render(<MunicipalWorkspaceScreen api={ctx.api} />);
    fireEvent.press(await findByTestId(`request-${ctx.world.folios.r2}`));
    expect(await findByTestId('detail-folio')).toHaveTextContent(ctx.world.folios.r2);
    expect(getByTestId('municipal-mock-banner')).toHaveTextContent(/servicio municipal real/);
    fireEvent.press(getByTestId('detail-back'));
    expect(await findByTestId('municipal-workspace')).toBeTruthy();
  });

  test('auditor sin permiso de ciudadanos ni de alta: el espacio de trabajo carga igual', async () => {
    const ctx = await setup('u_aud');
    const { findByTestId, getByTestId } = render(<MunicipalWorkspaceScreen api={ctx.api} />);
    expect(await findByTestId('municipal-workspace')).toBeTruthy();
    expect(getByTestId('municipal-intake-unavailable')).toBeTruthy();
  });
});

describe('F1-13 — cliente HTTP real (sin red: cliente simulado)', () => {
  test('rutas y URL base del contrato; errores normalizados sin detalles', async () => {
    expect(municipalBaseUrl('https://erp-dep.onrender.com/api/v1')).toBe('https://erp-dep.onrender.com/api/municipal/v1');
    const calls = [];
    const client = {
      defaults: { baseURL: 'http://localhost:5000/api/v1' },
      get: jest.fn(async (url, config) => {
        calls.push({ url, config });
        if (url.endsWith('/history')) throw { response: { status: 404, data: { success: false, error: 'No encontrado', code: 'NOT_FOUND' } } };
        return { data: { success: true, data: { folio: 'SJH-OBP-SOL-2026-000001', version: 0 } }, headers: { etag: '"0"' } };
      }),
    };
    const api = createMunicipalApi({ client, platform: 'web' });
    const r = await api.getRequest('SJH-OBP-SOL-2026-000001');
    expect(r).toEqual({ data: { folio: 'SJH-OBP-SOL-2026-000001', version: 0 }, etag: '"0"' });
    expect(calls[0]).toEqual({ url: '/municipalities/SJH/requests/SJH-OBP-SOL-2026-000001', config: { baseURL: 'http://localhost:5000/api/municipal/v1' } });
    await expect(api.getRequestHistory('SJH-OBP-SOL-2026-000001')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'No encontrado' });
  });
});
