import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MunicipalApp } from '../src/features/municipal/MunicipalApp';
import { RequestIntakeForm } from '../src/features/municipal/components/RequestIntakeForm';
import { intakeDependencies } from '../src/features/municipal/model';
import { createServiceBackedWorld } from '../qa/service-backed-api';

const { ROLES, scopeFor } = require('../../backend/src/modules/municipal/policy/permissions');
const NAME = 'Persona Sintética Registro QA';
const SUBJECT = 'Solicitud de prueba QA en Obras';
const OTHER = 'Otra solicitud de prueba QA en Obras';
const depId = 'intake-dependency-OBP';
const submitId = 'intake-submit';
const subjectId = 'intake-subject';

async function openIntake(api) {
  const view = render(<MunicipalApp api={api} />);
  fireEvent.press(await view.findByTestId('nav-intake'));
  await view.findByTestId(depId);
  return view;
}

function fillAndSend(view, citizen, subject) {
  fireEvent.press(view.getByTestId(depId));
  fireEvent.press(view.getByTestId(`intake-citizen-${citizen.id}`));
  fireEvent.changeText(view.getByTestId(subjectId), subject);
  fireEvent.press(view.getByTestId(submitId));
}

test('las dependencias activas del formulario corresponden a la matriz de alta', () => {
  const deps = [{ code: 'OBP' }, { code: 'TES' }, { code: 'NOS', status: 'INACTIVA' }];
  for (const role of ROLES.filter((r) => scopeFor(r, 'municipal.requests.create'))) {
    expect(intakeDependencies(deps, { role, dependencies: ['OBP'] }).map((d) => d.code))
      .toEqual(scopeFor(role, 'municipal.requests.create') === 'D' ? ['OBP'] : ['OBP', 'TES']);
  }
});

test('Obras: el ciudadano aparece sin recarga y un registro nuevo conserva el folio previo', async () => {
  const world = await createServiceBackedWorld();
  const api = world.apiFor('u_tit_obp');
  const search = jest.spyOn(api, 'searchCitizens');
  const post = jest.spyOn(api, 'createRequest');
  const view = await openIntake(api);
  expect(view.queryByTestId('intake-dependency-TES')).toBeNull();
  fireEvent.changeText(view.getByTestId(subjectId), SUBJECT);
  fireEvent.press(view.getByTestId('intake-new-citizen'));
  fireEvent.changeText(view.getByTestId('intake-citizen-name'), NAME);
  fireEvent.press(view.getByTestId('intake-save-citizen'));
  expect(await view.findByText(NAME)).toBeTruthy();
  expect(search).toHaveBeenCalledTimes(1);
  expect(view.getByTestId(subjectId).props.value).toBe(SUBJECT);

  const citizen = (await api.searchCitizens()).find((c) => c.fullName === NAME);
  fillAndSend(view, citizen, SUBJECT);
  const firstReceipt = await view.findByTestId('receipt-folio');
  const firstNew = (await api.listRequests()).items.find((r) => r.subject === SUBJECT);
  expect(firstReceipt).toHaveTextContent(firstNew.folio);
  fireEvent.press(view.getByTestId('receipt-done'));
  fillAndSend(view, citizen, OTHER);
  const secondReceipt = await view.findByTestId('receipt-folio');
  const second = (await api.listRequests()).items.find((r) => r.subject === OTHER);
  expect(secondReceipt).toHaveTextContent(second.folio);
  expect(second.folio).not.toBe(firstNew.folio);
  expect(post.mock.calls[0][1]).not.toBe(post.mock.calls[1][1]);
  expect((await api.getRequest(world.folios.r1)).data.folio).toBe(world.folios.r1);
});

test('si el alta fue confirmada y falla la lectura del acuse, muestra el folio y no reenvía el alta', async () => {
  const world = await createServiceBackedWorld();
  const api = world.apiFor('u_tit_obp', { failFirst: ['getReceipt'] });
  const post = jest.spyOn(api, 'createRequest');
  const citizen = (await api.searchCitizens())[0];
  const view = await openIntake(api);
  fillAndSend(view, citizen, SUBJECT);
  expect(await view.findByTestId('receipt-unavailable')).toHaveTextContent('La solicitud se registró');
  const created = (await api.listRequests()).items.find((r) => r.subject === SUBJECT);
  expect(view.getByTestId('receipt-folio')).toHaveTextContent(created.folio);
  expect(view.queryByTestId(submitId)).toBeNull();
  expect(post).toHaveBeenCalledTimes(1);
});

test('si se pierde la respuesta de un alta guardada, el reintento recupera el mismo folio', async () => {
  const world = await createServiceBackedWorld();
  const api = world.apiFor('u_tit_obp');
  const citizen = (await api.searchCitizens())[0];
  const original = api.createRequest;
  let saved;
  const post = jest.spyOn(api, 'createRequest').mockImplementationOnce(async (...args) => {
    saved = await original(...args);
    throw new Error('Respuesta perdida');
  });
  const view = await openIntake(api);
  fillAndSend(view, citizen, SUBJECT);
  expect(await view.findByTestId('intake-failure')).toHaveTextContent('No se pudo confirmar el registro');
  expect(view.getByTestId(subjectId).props.editable).toBe(false);
  fireEvent.press(view.getByTestId(submitId));
  expect(await view.findByTestId('receipt-folio')).toHaveTextContent(saved.data.folio);
  expect(post.mock.calls[0]).toEqual(post.mock.calls[1]);
  expect((await api.listRequests()).items.filter((r) => r.subject === SUBJECT)).toHaveLength(1);
});

test('un 403 explica la falta de permiso y deja el formulario editable', async () => {
  const citizen = { id: 'a'.repeat(24), fullName: NAME };
  const api = { createRequest: jest.fn().mockRejectedValue(Object.assign(new Error('FORBIDDEN'), { status: 403 })) };
  const view = render(<RequestIntakeForm api={api} dependencies={[{ code: 'OBP', name: 'Obras' }]} citizens={[citizen]} />);
  fillAndSend(view, citizen, SUBJECT);
  expect(await view.findByTestId('intake-failure')).toHaveTextContent('No tiene permiso');
  expect(view.getByTestId(subjectId).props.editable).toBe(true);
  expect(view.queryByText('Reintentar registro')).toBeNull();
});
