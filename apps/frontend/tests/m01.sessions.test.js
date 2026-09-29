import React from 'react';
import { Text, Button } from 'react-native';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { authService } from '../src/services/api';
import { sessionEvents } from '../src/services/sessionEvents';
jest.mock('../src/services/api', () => ({
  authService: { getMe: jest.fn(), refreshToken: jest.fn(), logout: jest.fn() },
}));
function Session() {
  const a = useAuth();
  return (
    <>
      <Text>{a.loading ? 'restoring' : a.isAuthenticated ? 'authenticated' : 'anonymous'}</Text>
      <Text>{a.user?.permissions?.join(',') || ''}</Text>
      <Button title="logout" onPress={() => a.logout().catch(() => {})} />
    </>
  );
}
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  authService.refreshToken.mockResolvedValue({ data: { data: { accessToken: 'renewed' } } });
  authService.getMe.mockResolvedValue({
    data: { data: { id: 'qa', permissions: ['users.read'] } },
  });
  authService.logout.mockResolvedValue({});
});
afterEach(cleanup);
test('logout during identity persistence cannot restore authenticated context', async () => {
  await seed();
  const original = AsyncStorage.setItem.getMockImplementation();
  let finish;
  AsyncStorage.setItem.mockImplementation((key, value) =>
    key === 'user'
      ? new Promise((resolve) => {
          finish = async () => {
            await original(key, value);
            resolve();
          };
        })
      : original(key, value),
  );
  try {
    const ui = render(
      <AuthProvider>
        <Session />
      </AuthProvider>,
    );
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.press(ui.getByText('logout'));
    await waitFor(() => expect(authService.logout).toHaveBeenCalled());
    await act(async () => {
      await finish();
    });
    await waitFor(() => expect(ui.getByText('anonymous')).toBeTruthy());
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  } finally {
    AsyncStorage.setItem.mockImplementation(original);
  }
});
async function seed() {
  await AsyncStorage.multiSet([
    ['accessToken', 'old'],
    ['refreshToken', 'refresh'],
    ['user', JSON.stringify({ permissions: ['roles.manage'] })],
  ]);
}
test('restoration waits for server and replaces stale grants', async () => {
  await seed();
  const ui = render(
    <AuthProvider>
      <Session />
    </AuthProvider>,
  );
  expect(ui.getByText('restoring')).toBeTruthy();
  await waitFor(() => expect(ui.getByText('authenticated')).toBeTruthy());
  expect(ui.getByText('users.read')).toBeTruthy();
  expect(ui.queryByText('roles.manage')).toBeNull();
  expect(authService.getMe).toHaveBeenCalled();
});
test('invalid refresh clears all persistence and context', async () => {
  await seed();
  authService.refreshToken.mockRejectedValue({ response: { status: 401 } });
  const ui = render(
    <AuthProvider>
      <Session />
    </AuthProvider>,
  );
  await waitFor(() => expect(ui.getByText('anonymous')).toBeTruthy());
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});
test('deactivated user cannot restore', async () => {
  await seed();
  authService.getMe.mockRejectedValue({ response: { status: 401 } });
  const ui = render(
    <AuthProvider>
      <Session />
    </AuthProvider>,
  );
  await waitFor(() => expect(ui.getByText('anonymous')).toBeTruthy());
});
test('API invalidation clears mounted auth state', async () => {
  await seed();
  const ui = render(
    <AuthProvider>
      <Session />
    </AuthProvider>,
  );
  await waitFor(() => expect(ui.getByText('authenticated')).toBeTruthy());
  await act(async () => sessionEvents.emit('invalid'));
  expect(ui.getByText('anonymous')).toBeTruthy();
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});
test('permission failure refreshes effective grants', async () => {
  await seed();
  const ui = render(
    <AuthProvider>
      <Session />
    </AuthProvider>,
  );
  await waitFor(() => expect(ui.getByText('authenticated')).toBeTruthy());
  authService.getMe.mockResolvedValue({ data: { data: { id: 'qa', permissions: [] } } });
  await act(async () => sessionEvents.emit('permissions'));
  await waitFor(() => expect(ui.queryByText('users.read')).toBeNull());
});
test('logout revokes remotely then clears local session', async () => {
  await seed();
  const ui = render(
    <AuthProvider>
      <Session />
    </AuthProvider>,
  );
  await waitFor(() => expect(ui.getByText('authenticated')).toBeTruthy());
  fireEvent.press(ui.getByText('logout'));
  await waitFor(() => expect(ui.getByText('anonymous')).toBeTruthy());
  expect(authService.logout).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});
test('delayed refresh cannot resurrect session after logout', async () => {
  await seed();
  let finish;
  authService.refreshToken.mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const ui = render(
    <AuthProvider>
      <Session />
    </AuthProvider>,
  );
  await waitFor(() => expect(authService.refreshToken).toHaveBeenCalled());
  fireEvent.press(ui.getByText('logout'));
  await waitFor(() => expect(authService.logout).toHaveBeenCalled());
  await act(async () => finish({ data: { data: { accessToken: 'late' } } }));
  await waitFor(() => expect(ui.getByText('anonymous')).toBeTruthy());
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});
