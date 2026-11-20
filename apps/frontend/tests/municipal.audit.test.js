/**
 * MuniERP IA — F1-14 bitácora de auditoría con el servicio municipal REAL en memoria (API simulada,
 * datos sintéticos; sin HTTP, JWT ni MongoDB). La autorización la decide el servicio.
 */
import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { AuditLog, MunicipalWorkspaceScreen, municipalModel, createMunicipalApi } from '../src/features/municipal';
import { createServiceBackedWorld } from '../qa/service-backed-api';

jest.setTimeout(30000);
const backendPermissions = require('../../backend/src/modules/municipal/policy/permissions');

async function setup(persona, options) {
  const world = await createServiceBackedWorld({});
  const api = world.apiFor(persona, options);
  const [membership] = await api.myMemberships();
  const dependencies = membership ? await api.listDependencies().catch(() => []) : [];
  return { world, api, membership, dependencies };
}
const renderAudit = (ctx) => render(<AuditLog api={ctx.api} membership={ctx.membership} dependencies={ctx.dependencies} />);

describe('F1-14 — modelo', () => {
  test('el permiso de la interfaz coincide con la matriz del servidor (hoy solo AUDITOR_MUNICIPAL)', () => {
    const roles = backendPermissions.ROLES.filter((r) => backendPermissions.scopeFor(r, municipalModel.AUDIT_PERMISSION, { allowUnknown: true }));
    expect(roles).toEqual(['AUDITOR_MUNICIPAL']);
  });

  test('filtros del contrato: validación, «hasta» inclusivo y tamaño de página permitido', () => {
    const { errors, query } = municipalModel.buildAuditQuery({ folio: 'sjh-obp-sol-2026-000001', from: '2026-10-05', to: '2026-10-05', limit: 20, page: 2 });
    expect(errors).toEqual({});
    expect(query).toEqual({ folio: 'SJH-OBP-SOL-2026-000001', from: '2026-10-05T06:00:00.000Z', to: '2026-10-06T06:00:00.000Z', limit: 20, page: 2 });
    const bad = municipalModel.buildAuditQuery({ folio: 'X', entityId: 'zz', from: '2026-02-30', to: '05/10/2026', limit: 999 });
    expect(Object.keys(bad.errors).sort()).toEqual(['entityId', 'folio', 'from', 'to']);
    expect(bad.query.limit).toBe(10);
    expect(municipalModel.buildAuditQuery({ from: '2026-10-06', to: '2026-10-05' }).errors.to).toMatch(/posterior/);
  });

  test('etiquetas: acción y recurso legibles, dependencia solo desde el folio, sin IP ni requestId', () => {
    const e = { at: '2026-10-05T16:00:00.000Z', actorId: '0000000000000000000000cf', action: 'REQUEST_TURNAR', entity: 'Request', entityId: '0000000000000000000009aa', folio: 'SJH-OBP-SOL-2026-000001', result: 'success', ip: '10.1.2.3', requestId: 'req-secreto' };
    const label = municipalModel.auditEventAccessibilityLabel(e, [{ code: 'OBP', name: 'Obras Públicas' }]);
    expect(label).toMatch(/^Transición: Turnar a otra dependencia, Expediente SJH-OBP-SOL-2026-000001, dependencia Obras Públicas, Permitido, .+, por Funcionario ···0000cf$/);
    expect(label).not.toMatch(/10\.1\.2\.3|req-secreto/);
    expect(municipalModel.auditActionLabel('ALGO_NUEVO')).toBe('Acción registrada (ALGO_NUEVO)');
    expect(municipalModel.auditResourceLabel({ entity: 'Membership', entityId: '0000000000000000000003a4' })).toBe('Membresía ···0003a4');
  });
});

describe('F1-14 — vista con el servicio real en memoria', () => {
  test('auditor: lista eventos del municipio, más recientes primero, sin IP, requestId ni datos de expediente', async () => {
    const ctx = await setup('u_aud');
    const view = renderAudit(ctx);
    await waitFor(() => expect(view.getByTestId('audit-list')).toBeTruthy());
    expect(view.getByTestId('audit-summary')).toHaveTextContent(/Página 1 de \d+ · \d+ evento/);
    const labels = view.getAllByTestId(/^audit-event-\d+$/).map((n) => n.props.accessibilityLabel);
    expect(labels.length).toBe(10);
    expect(labels.join(' ')).not.toMatch(/ZZZ-|127\.0\.0\.1|qa-ui|Ciudadano Sintético|Luminaria/);
    const raw = await ctx.api.listAuditEvents({ page: 1, limit: 50 });
    const times = raw.items.map((e) => e.at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  test('paginación: siguiente/anterior y límites deshabilitados', async () => {
    const ctx = await setup('u_aud');
    const view = renderAudit(ctx);
    await waitFor(() => expect(view.getByTestId('audit-summary')).toBeTruthy());
    expect(view.getByTestId('audit-prev').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByTestId('audit-next'));
    await waitFor(() => expect(view.getByTestId('audit-summary')).toHaveTextContent(/Página 2 de/));
    fireEvent.press(view.getByTestId('audit-prev'));
    await waitFor(() => expect(view.getByTestId('audit-summary')).toHaveTextContent(/Página 1 de/));
  });

  test('filtro por folio y estado vacío; validación local sin consultar', async () => {
    const ctx = await setup('u_aud');
    const spy = jest.spyOn(ctx.api, 'listAuditEvents');
    const view = renderAudit(ctx);
    await waitFor(() => expect(view.getByTestId('audit-list')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('audit-filter-folio'), ctx.world.folios.r1);
    fireEvent.press(view.getByTestId('audit-apply'));
    await waitFor(() => expect(view.getAllByTestId(/^audit-event-\d+$/).length).toBeGreaterThan(0));
    view.getAllByTestId(/^audit-event-\d+$/).forEach((n) => expect(n.props.accessibilityLabel).toContain(ctx.world.folios.r1));
    const calls = spy.mock.calls.length;
    fireEvent.changeText(view.getByTestId('audit-filter-folio'), 'no-es-folio');
    fireEvent.press(view.getByTestId('audit-apply'));
    expect(view.getByTestId('audit-filter-errors')).toHaveTextContent('Revise los filtros');
    expect(spy.mock.calls.length).toBe(calls);
    fireEvent.changeText(view.getByTestId('audit-filter-folio'), 'SJH-OBP-SOL-2026-000999');
    fireEvent.press(view.getByTestId('audit-apply'));
    await waitFor(() => expect(view.getByTestId('audit-empty')).toBeTruthy());
  });

  test.each([
    ['administrador municipal (política vigente: sin audit.read)', 'u_admin_mun', undefined, /no tiene acceso a la bitácora/],
    ['titular de dependencia', 'u_tit_obp', undefined, /no tiene acceso a la bitácora/],
    ['usuario sin membresía', 'u_reg', undefined, /membresía municipal vigente/],
    ['auditor consultando otro municipio', 'u_aud', { mun: 'ZZZ' }, /membresía municipal vigente/],
  ])('%s: el servicio deniega y la vista lo muestra', async (_, persona, options, message) => {
    const ctx = await setup(persona, options);
    const view = renderAudit(ctx);
    await waitFor(() => expect(view.getByTestId('audit-denied-message')).toHaveTextContent(message));
    expect(view.queryByTestId('audit-list')).toBeNull();
  });

  test('error de red con reintento', async () => {
    const ctx = await setup('u_aud', { failFirst: ['listAuditEvents'] });
    const view = renderAudit(ctx);
    await waitFor(() => expect(view.getByTestId('audit-error-message')).toHaveTextContent('No fue posible comunicarse'));
    fireEvent.press(view.getByTestId('audit-retry'));
    await waitFor(() => expect(view.getByTestId('audit-list')).toBeTruthy());
  });

  test('espacio de trabajo: la entrada aparece solo con el permiso', async () => {
    const aud = await setup('u_aud');
    const w1 = render(<MunicipalWorkspaceScreen api={aud.api} />);
    await waitFor(() => expect(w1.getByTestId('workspace-open-audit')).toBeTruthy());
    fireEvent.press(w1.getByTestId('workspace-open-audit'));
    await waitFor(() => expect(w1.getByTestId('audit-title')).toHaveTextContent('Bitácora de auditoría · San Juan Huactzinco'));
    const tit = await setup('u_tit_obp');
    const w2 = render(<MunicipalWorkspaceScreen api={tit.api} />);
    await waitFor(() => expect(w2.getByTestId('municipal-workspace')).toBeTruthy());
    expect(w2.queryByTestId('workspace-open-audit')).toBeNull();
  });

  test('cliente HTTP: ruta y parámetros del contrato', async () => {
    const client = { defaults: { baseURL: 'http://localhost:5000/api/v1' }, get: jest.fn(async () => ({ data: { success: true, data: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } } })) };
    const r = await createMunicipalApi({ client, platform: 'web' }).listAuditEvents({ folio: 'SJH-OBP-SOL-2026-000001', page: 1, limit: 10 });
    expect(client.get).toHaveBeenCalledWith('/municipalities/SJH/audit-events', { baseURL: 'http://localhost:5000/api/municipal/v1', municipalRequest: true, params: { folio: 'SJH-OBP-SOL-2026-000001', page: 1, limit: 10 } });
    expect(r).toEqual({ items: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } });
  });
});
