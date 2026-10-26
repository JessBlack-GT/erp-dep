/**
 * MuniERP IA — prototipo de interfaz (Fase 1). Componentes aislados con API simulada y datos
 * sintéticos. No acreditan accesibilidad real con teclado ni ejecución en Android (MT-90/91, E2E).
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import {
  MunicipalWorkspaceScreen,
  RequestIntakeForm,
  RequestList,
  IndicatorsPanel,
  createMockMunicipalApi,
  municipalModel,
} from '../src/features/municipal';

const deps = [{ code: 'OBP', name: 'Obras Públicas' }, { code: 'TES', name: 'Tesorería' }];
const citizens = [{ id: '000000000000000000000190', fullName: 'Ciudadano Sintético 001' }];

describe('MuniERP — modelo de presentación', () => {
  test('el estado siempre tiene texto, no solo color', () => {
    for (const s of ['REGISTRADA', 'EN_TRAMITE', 'EN_ESPERA_CIUDADANO', 'CERRADA', 'CANCELADA'])
      expect(municipalModel.statusInfo(s).label).toMatch(/\w/);
  });
  test('validación local espejo del contrato y bloqueo de CURP', () => {
    const errs = municipalModel.validateIntake({ subject: 'abc', channel: 'FAX' });
    expect(Object.keys(errs).sort()).toEqual(['channel', 'citizenId', 'ownerDependency', 'subject']);
    expect(municipalModel.validateIntake({ subject: 'Asunto válido', description: 'GOMC800101HTLRRR09', ownerDependency: 'OBP', citizenId: 'x', channel: 'PRESENCIAL' }).description).toMatch(/CURP/);
  });
  test('claves de idempotencia únicas y con formato aceptado por el servidor', () => {
    const a = municipalModel.newIdempotencyKey();
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(a).not.toBe(municipalModel.newIdempotencyKey());
  });
  test('cuadrícula adaptable: 1 columna en celular, 2 en tableta, 4 en escritorio', () => {
    expect([360, 800, 1280].map(municipalModel.indicatorColumns)).toEqual([1, 2, 4]);
  });
  test('etiqueta accesible del expediente incluye folio, estado y dependencia', () => {
    const label = municipalModel.requestAccessibilityLabel({ folio: 'SJH-OBP-SOL-2026-000042', status: 'EN_TRAMITE', ownerDependency: 'OBP' });
    expect(label).toContain('En trámite');
    expect(label).toContain('O B P');
    expect(label).toContain('42');
  });
});

describe('MuniERP — componentes', () => {
  test('lista vacía muestra estado vacío y filas con rol de botón', () => {
    const { getByTestId, rerender } = render(<RequestList items={[]} />);
    expect(getByTestId('municipal-request-list-empty')).toBeTruthy();
    const onSelect = jest.fn();
    rerender(<RequestList items={[{ folio: 'SJH-OBP-SOL-2026-000001', status: 'CERRADA', ownerDependency: 'OBP' }]} onSelect={onSelect} />);
    fireEvent.press(getByTestId('request-SJH-OBP-SOL-2026-000001'));
    expect(onSelect).toHaveBeenCalled();
  });

  test('indicadores muestran exactamente las cifras recibidas', () => {
    const { getByTestId, getByText } = render(<IndicatorsPanel data={{ total: 7, open: 3, closedInPeriod: 2, overdueOpen: 1, avgResolutionDays: 3.5 }} />);
    expect(getByTestId('indicator-total')).toHaveTextContent(/7/);
    expect(getByTestId('indicator-overdue')).toHaveTextContent(/1/);
    expect(getByText(/3.5 días/)).toBeTruthy();
  });

  test('el formulario no envía si faltan datos y muestra errores', async () => {
    const api = { createRequest: jest.fn() };
    const { getByTestId, findByText } = render(<RequestIntakeForm api={api} dependencies={deps} citizens={citizens} />);
    fireEvent.press(getByTestId('intake-submit'));
    expect(await findByText(/Seleccione la dependencia/)).toBeTruthy();
    expect(api.createRequest).not.toHaveBeenCalled();
  });

  test('un reintento tras fallo reutiliza la MISMA clave de idempotencia (continuidad)', async () => {
    const api = { createRequest: jest.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce({ status: 201, data: { folio: 'SJH-OBP-SOL-2026-000003' } }) };
    const onCreated = jest.fn();
    const { getByTestId, findByTestId } = render(<RequestIntakeForm api={api} dependencies={deps} citizens={citizens} onCreated={onCreated} />);
    fireEvent.press(getByTestId('intake-dependency-OBP'));
    fireEvent.press(getByTestId('intake-citizen-000000000000000000000190'));
    fireEvent.changeText(getByTestId('intake-subject'), 'Fuga de agua sintética');
    fireEvent.press(getByTestId('intake-submit'));
    expect(await findByTestId('intake-failure')).toBeTruthy();
    fireEvent.press(getByTestId('intake-submit'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ folio: 'SJH-OBP-SOL-2026-000003' }));
    const [k1, k2] = api.createRequest.mock.calls.map((c) => c[1]);
    expect(k1).toBe(k2);
    expect(api.createRequest.mock.calls[0][0]).toEqual({ type: 'SOL', ownerDependency: 'OBP', citizenId: '000000000000000000000190', channel: 'PRESENCIAL', subject: 'Fuga de agua sintética' });
  });
});

describe('MuniERP — espacio de trabajo con API simulada', () => {
  test('flujo de ventanilla: registrar → acuse con folio → volver', async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(<MunicipalWorkspaceScreen api={createMockMunicipalApi()} />);
    expect(await findByTestId('municipal-workspace')).toBeTruthy();
    expect(getByTestId('municipal-mock-banner')).toBeTruthy();
    fireEvent.press(getByTestId('intake-dependency-AGP'));
    fireEvent.press(getByTestId('intake-citizen-000000000000000000000190'));
    fireEvent.changeText(getByTestId('intake-subject'), 'Solicitud de pipa (prueba)');
    fireEvent.press(getByTestId('intake-submit'));
    const folio = await findByTestId('receipt-folio');
    expect(folio).toHaveTextContent('SJH-AGP-SOL-2026-000001');
    expect(queryByTestId('intake-submit')).toBeNull();
    fireEvent.press(getByTestId('receipt-done'));
    expect(await findByTestId('intake-submit')).toBeTruthy();
  });

  test('sin membresía municipal no se muestra el espacio de trabajo', async () => {
    const api = { ...createMockMunicipalApi(), myMemberships: async () => [] };
    const { findByTestId, queryByTestId } = render(<MunicipalWorkspaceScreen api={api} />);
    expect(await findByTestId('municipal-no-membership')).toBeTruthy();
    expect(queryByTestId('municipal-workspace')).toBeNull();
  });
});
