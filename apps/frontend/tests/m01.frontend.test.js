import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import { UsersScreen, UserForm, UserDetail, PasswordScreen } from '../src/features/users';
import { RolesScreen } from '../src/features/roles';
import { userService, roleService, authService } from '../src/services/api';
import { usePermissions } from '../src/hooks/usePermissions';
import { useAuth } from '../src/context/AuthContext';
jest.mock('../src/services/api', () => ({
  userService: {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    assignRole: jest.fn(),
  },
  roleService: { getAll: jest.fn(), permissions: jest.fn(), create: jest.fn(), update: jest.fn() },
  authService: { changePassword: jest.fn() },
}));
jest.mock('../src/hooks/usePermissions', () => ({ usePermissions: jest.fn() }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
const item = {
  _id: 'qa-id',
  email: 'qa@example.com',
  firstName: 'QA',
  lastName: 'User',
  role: 'user',
  status: 'active',
};
const envelope = (data) => ({ data: { data } });
const navigation = { navigate: jest.fn() };
const password = () =>
  Array.from({ length: 24 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(
    '',
  );
beforeEach(() => {
  jest.clearAllMocks();
  usePermissions.mockReturnValue(() => true);
  useAuth.mockReturnValue({ user: { id: 'actor', isSuperadmin: true }, clearSession: jest.fn() });
  userService.getAll.mockResolvedValue(
    envelope({ items: [item], pagination: { pages: 2, total: 11 } }),
  );
  userService.getById.mockResolvedValue(envelope(item));
  userService.create.mockResolvedValue(envelope(item));
  userService.update.mockResolvedValue(envelope(item));
  userService.changeStatus.mockResolvedValue(envelope({ ...item, status: 'inactive' }));
  userService.assignRole.mockResolvedValue(envelope({ ...item, role: 'sales' }));
  roleService.getAll.mockResolvedValue(
    envelope([
      { name: 'user', permissions: [], status: 'active', isSystem: true, assignable: true },
      {
        name: 'sales',
        permissions: ['customers.read'],
        status: 'active',
        isSystem: true,
        assignable: true,
      },
      {
        name: 'qa_custom',
        permissions: [],
        status: 'active',
        isSystem: false,
        editable: true,
        assignable: true,
      },
    ]),
  );
  roleService.permissions.mockResolvedValue(envelope(['customers.read', 'users.read']));
  roleService.create.mockResolvedValue(envelope({}));
  roleService.update.mockResolvedValue(envelope({}));
});
afterEach(cleanup);
test('users loading and list', async () => {
  const ui = render(<UsersScreen navigation={navigation} />);
  expect(ui.getByText('Cargando usuarios…')).toBeTruthy();
  await waitFor(() => expect(ui.getByText(item.email)).toBeTruthy());
});
test('users empty state', async () => {
  userService.getAll.mockResolvedValue(envelope({ items: [], pagination: { pages: 0 } }));
  const ui = render(<UsersScreen navigation={navigation} />);
  await waitFor(() => expect(ui.getByText('No hay usuarios para estos filtros.')).toBeTruthy());
});
test('users safe error and retry', async () => {
  userService.getAll.mockRejectedValueOnce(Error('private'));
  const ui = render(<UsersScreen navigation={navigation} />);
  await waitFor(() => expect(ui.getByText('Reintentar')).toBeTruthy());
  expect(ui.queryByText('private')).toBeNull();
  fireEvent.press(ui.getByText('Reintentar'));
  await waitFor(() => expect(ui.getByText(item.email)).toBeTruthy());
});
test('search and role filter reset page', async () => {
  const ui = render(<UsersScreen navigation={navigation} />);
  await waitFor(() => expect(ui.getByText(item.email)).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('Buscar usuarios'), 'QA');
  fireEvent.changeText(ui.getByLabelText('Filtrar por rol'), 'sales');
  fireEvent.press(ui.getByText('Aplicar filtros'));
  await waitFor(() =>
    expect(userService.getAll).toHaveBeenLastCalledWith({
      page: 1,
      limit: 10,
      search: 'QA',
      role: 'sales',
    }),
  );
});
test('status filter', async () => {
  const ui = render(<UsersScreen navigation={navigation} />);
  await waitFor(() => expect(ui.getByText(item.email)).toBeTruthy());
  fireEvent.press(ui.getByText('Inactivos'));
  await waitFor(() =>
    expect(userService.getAll).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: 'inactive' }),
  );
});
test('pagination advances and returns', async () => {
  const ui = render(<UsersScreen navigation={navigation} />);
  await waitFor(() => expect(ui.getByText(item.email)).toBeTruthy());
  fireEvent.press(ui.getByText('Siguiente'));
  await waitFor(() => expect(userService.getAll).toHaveBeenLastCalledWith({ page: 2, limit: 10 }));
  await waitFor(() => expect(ui.queryByText('Cargando usuarios…')).toBeNull());
  fireEvent.press(ui.getByText('Anterior'));
  await waitFor(() => expect(userService.getAll).toHaveBeenLastCalledWith({ page: 1, limit: 10 }));
});
test('list navigates to detail and creation', async () => {
  const ui = render(<UsersScreen navigation={navigation} />);
  await waitFor(() => expect(ui.getByText(item.email)).toBeTruthy());
  fireEvent.press(ui.getByText('Ver ' + item.email));
  expect(navigation.navigate).toHaveBeenCalledWith('UserDetail', { id: item._id });
  fireEvent.press(ui.getByText('Crear usuario'));
  expect(navigation.navigate).toHaveBeenCalledWith('UserForm', { id: null });
});
test('read-only user cannot see writes', async () => {
  usePermissions.mockReturnValue((p) => p === 'users.read');
  const ui = render(<UsersScreen navigation={navigation} />);
  await waitFor(() => expect(ui.getByText(item.email)).toBeTruthy());
  expect(ui.queryByText('Crear usuario')).toBeNull();
  expect(ui.queryByText('Roles y permisos')).toBeNull();
});
test('denied users do not request list', () => {
  usePermissions.mockReturnValue(() => false);
  const ui = render(<UsersScreen navigation={navigation} />);
  expect(ui.getByText('Sin permiso para consultar usuarios.')).toBeTruthy();
  expect(userService.getAll).not.toHaveBeenCalled();
});
test('form validates before mutation', async () => {
  const ui = render(<UserForm navigation={navigation} />);
  fireEvent.press(ui.getByText('Guardar usuario'));
  expect(userService.create).not.toHaveBeenCalled();
  expect(ui.getByRole('alert')).toBeTruthy();
  await waitFor(() => expect(roleService.getAll).toHaveBeenCalled());
});
test('form creates user and navigates', async () => {
  const ui = render(<UserForm navigation={navigation} />);
  fireEvent.changeText(ui.getByLabelText('Nombre'), 'QA');
  fireEvent.changeText(ui.getByLabelText('Apellido'), 'User');
  fireEvent.changeText(ui.getByLabelText('Correo'), item.email);
  fireEvent.changeText(ui.getByLabelText('Contraseña inicial'), password());
  fireEvent.press(ui.getByText('Guardar usuario'));
  await waitFor(() =>
    expect(navigation.navigate).toHaveBeenCalledWith(
      'UserDetail',
      expect.objectContaining({ id: item._id }),
    ),
  );
  expect(userService.create).toHaveBeenCalledTimes(1);
});
test('form duplicate error sanitized', async () => {
  userService.create.mockRejectedValue({ response: { status: 409, data: 'private' } });
  const ui = render(<UserForm navigation={navigation} />);
  for (const [label, value] of [
    ['Nombre', 'QA'],
    ['Apellido', 'User'],
    ['Correo', item.email],
    ['Contraseña inicial', password()],
  ])
    fireEvent.changeText(ui.getByLabelText(label), value);
  fireEvent.press(ui.getByText('Guardar usuario'));
  await waitFor(() => expect(ui.getByText('El correo o nombre ya está registrado.')).toBeTruthy());
});
test('edit excludes password role and internal fields', async () => {
  const ui = render(<UserForm navigation={navigation} route={{ params: { id: item._id } }} />);
  await waitFor(() => expect(ui.getByLabelText('Nombre')).toBeTruthy());
  expect(ui.queryByLabelText('Contraseña inicial')).toBeNull();
  fireEvent.changeText(ui.getByLabelText('Nombre'), 'New');
  fireEvent.press(ui.getByText('Guardar usuario'));
  await waitFor(() =>
    expect(userService.update).toHaveBeenCalledWith(item._id, {
      email: item.email,
      firstName: 'New',
      lastName: 'User',
    }),
  );
});
test('detail confirms status before sending', async () => {
  const ui = render(<UserDetail navigation={navigation} route={{ params: { id: item._id } }} />);
  await waitFor(() => expect(ui.getByText('Desactivar usuario')).toBeTruthy());
  fireEvent.press(ui.getByText('Desactivar usuario'));
  expect(userService.changeStatus).not.toHaveBeenCalled();
  fireEvent.press(ui.getByText('Confirmar cambio'));
  await waitFor(() => expect(ui.getByText('Estado: inactive')).toBeTruthy());
});
test('detail assigns allowed role', async () => {
  const ui = render(<UserDetail navigation={navigation} route={{ params: { id: item._id } }} />);
  await waitFor(() => expect(ui.getByText('Cambiar rol a sales')).toBeTruthy());
  fireEvent.press(ui.getByText('Cambiar rol a sales'));
  fireEvent.press(ui.getByText('Confirmar cambio'));
  await waitFor(() => expect(userService.assignRole).toHaveBeenCalledWith(item._id, 'sales'));
});
test('protected superadmin has no lifecycle controls', async () => {
  userService.getById.mockResolvedValue(envelope({ ...item, role: 'superadmin' }));
  const ui = render(<UserDetail navigation={navigation} route={{ params: { id: item._id } }} />);
  await waitFor(() => expect(ui.getByText('Cuenta del sistema protegida.')).toBeTruthy());
  expect(ui.queryByText('Desactivar usuario')).toBeNull();
  expect(ui.queryByText('Cambiar rol a sales')).toBeNull();
});
test('roles distinguish protected system and editable custom roles', async () => {
  const ui = render(<RolesScreen />);
  await waitFor(() => expect(ui.getByText('user — Sistema protegido')).toBeTruthy());
  expect(ui.queryByText('Editar rol user')).toBeNull();
  expect(ui.getByText('Editar rol qa_custom')).toBeTruthy();
});
test('roles select registered permissions and create', async () => {
  const ui = render(<RolesScreen />);
  await waitFor(() => expect(ui.getByText('Editar rol qa_custom')).toBeTruthy());
  fireEvent.press(ui.getByText('Crear rol'));
  fireEvent.changeText(ui.getByLabelText('Nombre del rol'), 'qa_new');
  fireEvent.press(ui.getByText('users.read'));
  fireEvent.press(ui.getByText('Guardar rol'));
  await waitFor(() =>
    expect(roleService.create).toHaveBeenCalledWith({
      name: 'qa_new',
      description: '',
      permissions: ['users.read'],
    }),
  );
});
test('roles update custom role only', async () => {
  const ui = render(<RolesScreen />);
  await waitFor(() => expect(ui.getByText('Editar rol qa_custom')).toBeTruthy());
  fireEvent.press(ui.getByText('Editar rol qa_custom'));
  fireEvent.press(ui.getByText('Desactivar rol'));
  fireEvent.press(ui.getByText('Guardar rol'));
  await waitFor(() =>
    expect(roleService.update).toHaveBeenCalledWith('qa_custom', {
      description: undefined,
      permissions: [],
      status: 'inactive',
    }),
  );
});
test('roles read only hides create/edit', async () => {
  usePermissions.mockReturnValue((p) => p === 'roles.read');
  const ui = render(<RolesScreen />);
  await waitFor(() => expect(ui.getByText('user — Sistema protegido')).toBeTruthy());
  expect(ui.queryByText('Crear rol')).toBeNull();
  expect(ui.queryByText('Editar rol qa_custom')).toBeNull();
});
test('password screen validates confirmation', () => {
  const ui = render(<PasswordScreen />);
  fireEvent.press(ui.getByText('Actualizar contraseña'));
  expect(authService.changePassword).not.toHaveBeenCalled();
  expect(ui.getByRole('alert')).toBeTruthy();
});
