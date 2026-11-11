/**
 * MuniERP IA — F1-15a administración de dependencias y membresías + aplicación navegable.
 * Servicio municipal REAL en memoria (API simulada, datos sintéticos; sin HTTP, JWT ni MongoDB):
 * la autorización y las reglas son las del servidor. Más una prueba del cliente HTTP (rutas draft.3).
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DependencyAdmin, MembershipAdmin, MunicipalApp, municipalModel, createMunicipalApi } from '../src/features/municipal';
import { createServiceBackedWorld } from '../qa/service-backed-api';

jest.setTimeout(30000);
const backendPermissions = require('../../backend/src/modules/municipal/policy/permissions');
const backendValidation = require('../../backend/src/modules/municipal/domain/validation');

async function setup(persona, options = {}) {
  const world = await createServiceBackedWorld({ demo: !!options.demo });
  const api = world.apiFor(persona, options);
  const [membership] = await api.myMemberships();
  const dependencies = membership ? await api.listDependencies({}).catch(() => []) : [];
  return { world, api, membership, dependencies };
}
const typeIn = (view, testID, text) => fireEvent.changeText(view.getByTestId(testID), text);

describe('F1-15a — paridad con el backend', () => {
  test('roles asignables y roles con dependencia coinciden con el servidor', () => {
    expect([...municipalModel.ASSIGNABLE_ROLES].sort()).toEqual([...backendValidation.MUNICIPAL_ROLES_ASSIGNABLE].sort());
    expect(municipalModel.ASSIGNABLE_ROLES).not.toContain('ADMIN_MUNICIPAL');
    expect(municipalModel.ASSIGNABLE_ROLES.every((r) => backendPermissions.canAssignRole('ADMIN_MUNICIPAL', r))).toBe(true);
    expect([...municipalModel.DEPENDENCY_SCOPED_ROLES].sort()).toEqual([...backendValidation.DEPENDENCY_SCOPED_ROLES].sort());
    expect(Object.keys(municipalModel.ROLE_LABELS).sort()).toEqual([...backendPermissions.ROLES].sort());
  });

  test('navegación por permisos: cada sección corresponde a un permiso real del catálogo', () => {
    municipalModel.NAV_SECTIONS.filter((s) => s.permission).forEach((s) => expect(backendPermissions.PERMISSIONS).toContain(s.permission));
    const keys = (role) => municipalModel.navSections(backendPermissions.permissionsOf(role)).map((s) => s.key);
    expect(keys('ADMIN_MUNICIPAL')).toEqual(['home', 'dependencies', 'memberships']);
    expect(keys('AUDITOR_MUNICIPAL')).toEqual(['home', 'requests', 'dependencies', 'memberships', 'audit']);
    expect(keys('VENTANILLA')).toEqual(['home', 'intake', 'requests', 'dependencies']);
    expect(keys('SUPERVISOR_MUNICIPAL')).not.toContain('audit');
    expect(keys('TITULAR_DEPENDENCIA')).not.toContain('audit');
  });

  test('validación de forma (no reglas de negocio)', () => {
    expect(municipalModel.validateDependencyForm({ code: 'pcv', name: 'Protección Civil' }).body).toEqual({ code: 'PCV', name: 'Protección Civil' });
    expect(Object.keys(municipalModel.validateDependencyForm({ code: 'P1', name: 'x' }).errors).sort()).toEqual(['code', 'name']);
    expect(municipalModel.validateMembershipForm({ userId: 'abc', role: 'ADMIN_MUNICIPAL', dependencies: [] }).errors).toEqual({ userId: expect.any(String), role: expect.any(String) });
    expect(municipalModel.validateMembershipForm({ userId: '0'.repeat(24), role: 'TITULAR_DEPENDENCIA', dependencies: [] }).errors.dependencies).toMatch(/al menos una/);
  });
});

describe('F1-15a — dependencias (servicio real en memoria)', () => {
  test('administrador: crea, edita nombre y el servidor impide desactivar con expedientes abiertos', async () => {
    const ctx = await setup('u_admin_mun');
    const view = render(<DependencyAdmin api={ctx.api} membership={ctx.membership} />);
    await waitFor(() => expect(view.getByTestId('dependencies-list')).toBeTruthy());
    typeIn(view, 'dependency-code', 'pcv');
    typeIn(view, 'dependency-name', 'Protección Civil');
    fireEvent.press(view.getByTestId('dependency-create-submit'));
    await waitFor(() => expect(view.getByTestId('dependencies-notice')).toHaveTextContent('Dependencia PCV · Protección Civil creada.'));
    expect(view.getByTestId('dependency-PCV')).toBeTruthy();
    // Duplicado: 409 del servidor con su mensaje.
    typeIn(view, 'dependency-code', 'PCV');
    typeIn(view, 'dependency-name', 'Otra');
    fireEvent.press(view.getByTestId('dependency-create-submit'));
    await waitFor(() => expect(view.getByTestId('dependencies-notice')).toHaveTextContent(/Ya existe una dependencia con ese código/));
    // OBP tiene expedientes abiertos: el servidor rechaza la desactivación.
    fireEvent.press(view.getByTestId('dependency-edit-OBP'));
    fireEvent.press(view.getByTestId('dependency-edit-status-INACTIVA'));
    fireEvent.press(view.getByTestId('dependency-edit-save'));
    await waitFor(() => expect(view.getByTestId('dependencies-notice')).toHaveTextContent(/expediente\(s\) abierto\(s\)/));
    const all = await ctx.api.listDependencies({});
    expect(all.find((d) => d.code === 'OBP').status).toBe('ACTIVA');
    // La bitácora registra el alta (lo ve el auditor).
    const events = (await ctx.world.apiFor('u_aud').listAuditEvents({ limit: 50 })).items;
    expect(events.some((e) => e.action === 'DEPENDENCY_CREATED' && e.result === 'success')).toBe(true);
  });

  test('roles sin manage: solo consulta (sin controles), y el servidor rechaza escrituras directas', async () => {
    const ctx = await setup('u_sup');
    const view = render(<DependencyAdmin api={ctx.api} membership={ctx.membership} />);
    await waitFor(() => expect(view.getByTestId('dependencies-list')).toBeTruthy());
    expect(view.queryByTestId('dependency-create')).toBeNull();
    expect(view.queryByTestId('dependency-edit-OBP')).toBeNull();
    await expect(ctx.api.createDependency({ code: 'XYZ', name: 'Intento' })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  test('sin membresía: estado denegado', async () => {
    const ctx = await setup('u_reg');
    const view = render(<DependencyAdmin api={ctx.api} membership={ctx.membership} />);
    await waitFor(() => expect(view.getByTestId('municipal-dependencies-denied')).toBeTruthy());
    expect(view.getByTestId('dependencies-denied-message')).toHaveTextContent(/membresía municipal vigente/);
  });
});

describe('F1-15a — membresías (servicio real en memoria)', () => {
  test('administrador: asigna un usuario central existente, edita, revoca y reactiva', async () => {
    const ctx = await setup('u_admin_mun');
    const view = render(<MembershipAdmin api={ctx.api} membership={ctx.membership} dependencies={ctx.dependencies} />);
    await waitFor(() => expect(view.getByTestId('memberships-list')).toBeTruthy());
    expect(view.getByTestId('memberships-summary')).toHaveTextContent('Página 1 de 1 · 10 membresía(s)');
    // Propia y de administrador: sin controles.
    expect(view.queryByTestId(`membership-edit-${ctx.membership.id}`)).toBeNull();
    typeIn(view, 'membership-user', ctx.world.fx.USERS.u_reg);
    fireEvent.press(view.getByTestId('membership-role-OPERADOR_DEPENDENCIA'));
    fireEvent.press(view.getByTestId('membership-deps-OBP'));
    fireEvent.press(view.getByTestId('membership-create-submit'));
    await waitFor(() => expect(view.getByTestId('memberships-notice')).toHaveTextContent(/Membresía creada: Usuario ···0000cb como Operador de dependencia/));
    const created = (await ctx.api.listMembershipPage({ limit: 50 })).items.find((m) => m.userId === ctx.world.fx.USERS.u_reg);
    expect(created).toMatchObject({ role: 'OPERADOR_DEPENDENCIA', dependencies: ['OBP'], status: 'ACTIVA', effective: true });
    // El usuario recién asignado ya tiene acceso municipal (efecto inmediato).
    expect((await ctx.world.apiFor('u_reg').myMemberships())[0].role).toBe('OPERADOR_DEPENDENCIA');

    await waitFor(() => expect(view.getByTestId(`membership-edit-${created.id}`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`membership-edit-${created.id}`));
    fireEvent.press(view.getByTestId('membership-edit-role-CONSULTA'));
    fireEvent.press(view.getByTestId('membership-edit-save'));
    await waitFor(() => expect(view.getByTestId('memberships-notice')).toHaveTextContent(/actualizada: Consulta/));

    fireEvent.press(view.getByTestId(`membership-revoke-${created.id}`));
    expect(view.getByTestId('membership-revoke-confirm')).toHaveTextContent(/Perderá el acceso municipal de inmediato/);
    fireEvent.press(view.getByTestId('membership-revoke-confirm-button'));
    await waitFor(() => expect(view.getByTestId('memberships-notice')).toHaveTextContent(/revocada/));
    expect(await ctx.world.apiFor('u_reg').myMemberships()).toEqual([]);
    await expect(ctx.world.apiFor('u_reg').listRequests()).rejects.toMatchObject({ status: 403, code: 'MUNICIPAL_MEMBERSHIP_REQUIRED' });

    await waitFor(() => expect(view.getByTestId(`membership-reactivate-${created.id}`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`membership-reactivate-${created.id}`));
    await waitFor(() => expect(view.getByTestId('memberships-notice')).toHaveTextContent(/reactivada/));
  });

  test('el servidor sigue decidiendo: ADMIN, autoasignación, usuario inexistente y membresías de administrador', async () => {
    const ctx = await setup('u_admin_mun');
    const U = ctx.world.fx.USERS;
    // ADMIN_MUNICIPAL no es asignable: la validación del servidor lo rechaza antes que la política (400).
    await expect(ctx.api.createMembership({ userId: U.u_reg, role: 'ADMIN_MUNICIPAL', dependencies: [] })).rejects.toMatchObject({ status: 400, message: 'Rol no asignable' });
    await expect(ctx.api.createMembership({ userId: U.u_admin_mun, role: 'CONSULTA', dependencies: ['OBP'] })).rejects.toMatchObject({ status: 403 });
    await expect(ctx.api.createMembership({ userId: '0'.repeat(20) + '9999', role: 'CONSULTA', dependencies: ['OBP'] })).rejects.toMatchObject({ status: 404 });
    await expect(ctx.api.createMembership({ userId: U.u_tit_obp, role: 'CONSULTA', dependencies: ['OBP'] })).rejects.toMatchObject({ status: 409 });
    await expect(ctx.api.updateMembership(ctx.membership.id, { status: 'INACTIVA' })).rejects.toMatchObject({ status: 403 });
    // Un usuario inexistente se informa con el mensaje del servidor en la interfaz.
    const view = render(<MembershipAdmin api={ctx.api} membership={ctx.membership} dependencies={ctx.dependencies} />);
    await waitFor(() => expect(view.getByTestId('memberships-list')).toBeTruthy());
    typeIn(view, 'membership-user', '0'.repeat(20) + '9999');
    fireEvent.press(view.getByTestId('membership-role-CONSULTA'));
    fireEvent.press(view.getByTestId('membership-deps-OBP'));
    fireEvent.press(view.getByTestId('membership-create-submit'));
    await waitFor(() => expect(view.getByTestId('memberships-notice')).toHaveTextContent(/Usuario no encontrado o inactivo en la identidad central/));
  });

  test('titular: solo ve membresías de su dependencia y sin controles; supervisor no puede escribir', async () => {
    const tit = await setup('u_tit_obp');
    const view = render(<MembershipAdmin api={tit.api} membership={tit.membership} dependencies={tit.dependencies} />);
    await waitFor(() => expect(view.getByTestId('memberships-list')).toBeTruthy());
    const page = await tit.api.listMembershipPage({ limit: 50 });
    expect(page.items.every((m) => m.dependencies.includes('OBP'))).toBe(true);
    expect(view.queryByTestId('membership-create')).toBeNull();
    const sup = await setup('u_sup');
    await expect(sup.api.updateMembership(page.items[0].id, { status: 'INACTIVA' })).rejects.toMatchObject({ status: 403 });
  });

  test('operador sin memberships.read: estado denegado', async () => {
    const ctx = await setup('u_op_obp');
    const view = render(<MembershipAdmin api={ctx.api} membership={ctx.membership} dependencies={ctx.dependencies} />);
    await waitFor(() => expect(view.getByTestId('municipal-memberships-denied')).toBeTruthy());
  });
});

describe('F1-15a — aplicación navegable', () => {
  test('navegación por rol: el auditor ve Auditoría; el supervisor no', async () => {
    const aud = await setup('u_aud', { demo: true });
    const a = render(<MunicipalApp api={aud.api} modeLabel="Demostración" />);
    await waitFor(() => expect(a.getByTestId('app-home')).toBeTruthy());
    expect(a.getByTestId('app-mode')).toHaveTextContent('Demostración');
    expect(a.getByTestId('nav-audit')).toBeTruthy();
    fireEvent.press(a.getByTestId('nav-audit'));
    await waitFor(() => expect(a.getByTestId('audit-list')).toBeTruthy());
    const sup = await setup('u_sup', { demo: true });
    const s = render(<MunicipalApp api={sup.api} />);
    await waitFor(() => expect(s.getByTestId('app-home')).toBeTruthy());
    expect(s.queryByTestId('nav-audit')).toBeNull();
    // Indicadores coherentes con las solicitudes del alcance.
    const list = await sup.api.listRequests({ limit: 50 });
    await waitFor(() => expect(s.getByTestId('indicator-total')).toHaveTextContent(String(list.pagination.total)));
  });

  test('ventanilla: registra, ve el folio y abre el expediente', async () => {
    const ctx = await setup('u_vent', { demo: true });
    const v = render(<MunicipalApp api={ctx.api} />);
    await waitFor(() => expect(v.getByTestId('nav-intake')).toBeTruthy());
    fireEvent.press(v.getByTestId('nav-intake'));
    await waitFor(() => expect(v.getByTestId('municipal-intake')).toBeTruthy());
    fireEvent.press(v.getByTestId('intake-dependency-OBP'));
    fireEvent.press(v.getAllByTestId(/^intake-citizen-/)[0]);
    typeIn(v, 'intake-subject', 'Solicitud de prueba de demostración');
    fireEvent.press(v.getByTestId('intake-submit'));
    await waitFor(() => expect(v.getByTestId('receipt-folio')).toHaveTextContent(/^SJH-OBP-SOL-2026-0000\d\d$/));
    fireEvent.press(v.getByTestId('receipt-open'));
    await waitFor(() => expect(v.getByTestId('detail-folio')).toBeTruthy());
  });

  test('listado: filtro por estado y apertura por folio con el 404 indistinguible del servidor', async () => {
    const ctx = await setup('u_tit_obp', { demo: true });
    const v = render(<MunicipalApp api={ctx.api} initialView="requests" />);
    await waitFor(() => expect(v.getByTestId('requests-summary')).toBeTruthy());
    fireEvent.press(v.getByTestId('requests-filter-status-EN_ESPERA_CIUDADANO'));
    await waitFor(() => expect(v.getByTestId('requests-summary')).toHaveTextContent('Página 1 de 1 · 1 solicitud(es)'));
    typeIn(v, 'requests-folio', 'mal');
    fireEvent.press(v.getByTestId('requests-folio-open'));
    expect(v.getByText(/Folio con formato/)).toBeTruthy();
    typeIn(v, 'requests-folio', ctx.world.folios.r4); // Tesorería: fuera del alcance del titular de OBP
    fireEvent.press(v.getByTestId('requests-folio-open'));
    await waitFor(() => expect(v.getByText('Expediente no encontrado o sin acceso.')).toBeTruthy());
  });
});

describe('F1-15a — cliente HTTP (rutas draft.3, sin servidor)', () => {
  test('usa exactamente las operaciones del contrato', async () => {
    const calls = [];
    const ok = (data, extra = {}) => ({ data: { success: true, data, ...extra }, headers: {} });
    const client = {
      defaults: { baseURL: 'http://localhost:5000/api/v1' },
      get: jest.fn(async (url, cfg) => { calls.push(['get', url, cfg.params]); return ok([], { pagination: { page: 1, limit: 10, total: 0, pages: 0 } }); }),
      post: jest.fn(async (url, body) => { calls.push(['post', url, body]); return ok(body); }),
      patch: jest.fn(async (url, body) => { calls.push(['patch', url, body]); return ok(body); }),
    };
    const api = createMunicipalApi({ client, mun: 'SJH', platform: 'web' });
    await api.listDependencies({});
    await api.listDependencies();
    await api.createDependency({ code: 'PCV', name: 'Protección Civil' });
    await api.updateDependency('PCV', { status: 'INACTIVA' });
    await api.listMembershipPage({ role: 'CONSULTA', page: 1, limit: 10 });
    await api.createMembership({ userId: 'a'.repeat(24), role: 'CONSULTA', dependencies: ['OBP'] });
    await api.updateMembership('b'.repeat(24), { status: 'INACTIVA' });
    expect(calls).toEqual([
      ['get', '/municipalities/SJH/dependencies', {}],
      ['get', '/municipalities/SJH/dependencies', { status: 'ACTIVA' }],
      ['post', '/municipalities/SJH/dependencies', { code: 'PCV', name: 'Protección Civil' }],
      ['patch', '/municipalities/SJH/dependencies/PCV', { status: 'INACTIVA' }],
      ['get', '/municipalities/SJH/memberships', { role: 'CONSULTA', page: 1, limit: 10 }],
      ['post', '/municipalities/SJH/memberships', { userId: 'a'.repeat(24), role: 'CONSULTA', dependencies: ['OBP'] }],
      ['patch', `/municipalities/SJH/memberships/${'b'.repeat(24)}`, { status: 'INACTIVA' }],
    ]);
  });
});
