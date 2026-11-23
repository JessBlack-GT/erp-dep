import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AuthContext } from '../src/context/AuthContext';
import { MunicipalAccessProvider, useMunicipalAccess } from '../src/features/municipal/MunicipalAccess';
import { MunicipalScreen } from '../src/features/municipal/MunicipalScreen';
import { createMunicipalApi } from '../src/features/municipal/municipalApi';

jest.mock('../src/features/municipal/municipalApi', () => ({ createMunicipalApi: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../src/features/municipal/MunicipalApp', () => ({
  MunicipalApp: ({ membershipId, api, modeLabel }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'active-membership' }, [membershipId, api.mun, modeLabel].join(' / '));
  },
}));

const membership = (code) => ({ id: 'm-' + code, municipality: { code, name: code } });
const session = (token, synthetic = false) => ({
  isAuthenticated: !!token, token, user: token && { id: token, syntheticMunicipalDemo: synthetic },
});
const wrap = (auth, children) => (
  <AuthContext.Provider value={auth}>
    <MunicipalAccessProvider>{children}</MunicipalAccessProvider>
  </AuthContext.Provider>
);

test('recalcula el municipio del cliente HTTP al cambiar de membresía', async () => {
  createMunicipalApi.mockImplementation(({ mun } = {}) => ({
    mun, myMemberships: async () => [membership('SJH'), membership('ZZZ')],
  }));
  const view = render(wrap(session('actor', true), <MunicipalScreen />));
  expect(await view.findByTestId('active-membership')).toHaveTextContent('m-SJH / SJH');
  fireEvent.press(view.getByTestId('municipality-ZZZ'));
  expect(view.getByTestId('active-membership')).toHaveTextContent('m-ZZZ / ZZZ');
});

test('no conserva acceso de una sesión anterior aun si su consulta termina tarde', async () => {
  let finishFirst;
  const past = new Promise((resolve) => { finishFirst = resolve; });
  const myMemberships = jest.fn().mockReturnValueOnce(past).mockResolvedValueOnce([]);
  createMunicipalApi.mockReturnValue({ myMemberships });
  const Status = () => {
    const { memberships, loading } = useMunicipalAccess();
    return <Text testID="access-summary">{loading ? 'cargando' : memberships.length}</Text>;
  };
  const view = render(wrap(session('old'), <Status />));
  expect(view.getByTestId('access-summary')).toHaveTextContent('cargando');
  view.rerender(wrap(session('new'), <Status />));
  await act(async () => finishFirst([membership('SJH')]));
  expect(myMemberships.mock.calls[0][0].signal.aborted).toBe(true);
  expect(view.getByTestId('access-summary')).toHaveTextContent('0');
});

test('identifica Atlas QA sin anunciar almacenamiento en memoria', async () => {
  createMunicipalApi.mockImplementation(({ mun } = {}) => ({
    mun, myMemberships: async () => [membership('SJH')],
  }));
  const auth = session('atlas-user', true);
  auth.user.syntheticMunicipalPersistence = 'atlas-qa';
  const view = render(wrap(auth, <MunicipalScreen />));
  const label = await view.findByTestId('active-membership');
  expect(label).not.toHaveTextContent(/QA LOCAL|datos sintéticos|Atlas/);
  expect(label).not.toHaveTextContent('en memoria');
});
