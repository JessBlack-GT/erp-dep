import fs from 'fs';
import path from 'path';
import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { MunicipalApp } from '../src/features/municipal/MunicipalApp';
import { createServiceBackedWorld } from '../qa/service-backed-api';

// Jest no ejecuta BaseViewManager. Lee la lista del Android nativo instalado para comprobar
// las props de los nodos que React Native enviaría al setter que lanza IllegalArgumentException.
const nativeDelegate = fs.readFileSync(path.join(
  path.dirname(require.resolve('react-native/package.json')),
  'ReactAndroid/src/main/java/com/facebook/react/uimanager/ReactAccessibilityDelegate.java',
), 'utf8');
const nativeRoles = new Set(nativeDelegate.match(/enum AccessibilityRole\s*\{([^;]+);/)[1]
  .match(/[A-Z][A-Z_]+/g).map((name) => name.toLowerCase()));

function expectAndroidRoles(view) {
  const invalid = new Set();
  const inspect = (node) => {
    if (Array.isArray(node)) return node.forEach(inspect);
    if (!node || typeof node !== 'object') return;
    const role = node.props?.accessibilityRole;
    if (role && !nativeRoles.has(role.toLowerCase())) invalid.add(role);
    (node.children || []).forEach(inspect);
  };
  inspect(view.toJSON());
  expect([...invalid].sort()).toEqual([]);
}

const defaultPlatform = Platform.OS;
afterEach(() => { Platform.OS = defaultPlatform; });

async function openMunierp(persona) {
  const world = await createServiceBackedWorld({ demo: true });
  const view = render(<MunicipalApp api={world.apiFor(persona)} />);
  await view.findByTestId('app-home');
  return { view, folio: world.folios.r1 };
}

async function openTab(view, tab, readyId) {
  fireEvent.press(view.getByTestId(`nav-${tab}`));
  await view.findByTestId(readyId);
}

test('Android: Obras puede cambiar a solicitudes, abrir el detalle y regresar', async () => {
  Platform.OS = 'android';
  const { view, folio } = await openMunierp('u_tit_obp');
  await view.findByTestId('home-recent-list');
  expectAndroidRoles(view);
  await openTab(view, 'intake', 'app-intake');
  expectAndroidRoles(view);
  await openTab(view, 'requests', 'requests-summary');
  expectAndroidRoles(view);
  fireEvent.press(view.getByTestId(`request-${folio}`));
  expect(await view.findByTestId('detail-folio')).toHaveTextContent(folio);
  await view.findByTestId('history-0');
  expectAndroidRoles(view);
  fireEvent.press(view.getByTestId('detail-back'));
  await view.findByTestId('requests-summary');
  expectAndroidRoles(view);
});

test('Android: listas de dependencias, membresías y auditoría respetan los roles nativos', async () => {
  Platform.OS = 'android';
  const { view: admin } = await openMunierp('u_admin_mun');
  await openTab(admin, 'dependencies', 'dependency-OBP');
  expectAndroidRoles(admin);
  await openTab(admin, 'memberships', 'memberships-list');
  expect(admin.getByTestId('membership-deps-OBP').props.accessibilityRole).toBe('checkbox');
  expectAndroidRoles(admin);
  admin.unmount();

  const { view: auditor } = await openMunierp('u_aud');
  await openTab(auditor, 'audit', 'audit-event-0');
  expectAndroidRoles(auditor);
});

test('web: conserva los roles de navegación, contenido principal, fila y grupo', async () => {
  Platform.OS = 'web';
  const { view } = await openMunierp('u_admin_mun');
  expect(view.getByTestId('app-nav').props.accessibilityRole).toBe('navigation');
  expect(view.getByTestId('app-main').props.accessibilityRole).toBe('main');
  await openTab(view, 'dependencies', 'dependency-OBP');
  expect(view.getByTestId('dependency-OBP').props.accessibilityRole).toBe('listitem');
  await openTab(view, 'memberships', 'memberships-list');
  expect(view.getByTestId('membership-deps').props.accessibilityRole).toBe('group');
});
