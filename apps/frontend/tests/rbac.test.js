import React from 'react';
import { render, waitFor, cleanup, act } from '@testing-library/react-native';
import { AuthContext } from '../src/context/AuthContext';
import { CustomerList } from '../src/features/customers/CustomersScreen';
import { CustomerDetailScreen } from '../src/features/customers/CustomerDetailScreen';
import { CustomerForm } from '../src/features/customers/CustomerForm';
import { customerService } from '../src/services/api';
jest.mock('../src/services/api',()=>({customerService:{getAll:jest.fn(),getById:jest.fn()}}));
const session=(permissions,child)=><AuthContext.Provider value={{isAuthenticated:true,user:{permissions}}}>{child}</AuthContext.Provider>;
beforeEach(()=>{
  jest.resetAllMocks();jest.useFakeTimers();
  customerService.getAll.mockResolvedValue({data:{data:[]}});
  customerService.getById.mockResolvedValue({data:{data:{_id:'qa',name:'QA',email:'qa@example.com',status:'active'}}});
});
afterEach(async()=>{cleanup();await act(async()=>jest.runOnlyPendingTimers());jest.useRealTimers();});
test('user without read permission sees denial and sends no customer query',()=>{
  const ui=render(session([],<CustomerList navigation={{}}/>));
  expect(ui.getByText('Sin permiso para consultar clientes')).toBeTruthy();expect(customerService.getAll).not.toHaveBeenCalled();
});
test('auditor sees list without create action',async()=>{
  const ui=render(session(['customers.read'],<CustomerList navigation={{}}/>));
  await waitFor(()=>expect(ui.getByText('No se encontraron clientes')).toBeTruthy());expect(ui.queryByText('+')).toBeNull();
});
test('sales can create but cannot delete',async()=>{
  const permissions=['customers.read','customers.create','customers.update'];
  const list=render(session(permissions,<CustomerList navigation={{}}/>));
  await waitFor(()=>expect(list.getByText('+')).toBeTruthy());list.unmount();
  const detail=render(session(permissions,<CustomerDetailScreen route={{params:{id:'qa'}}} navigation={{}}/>));
  await waitFor(()=>expect(detail.getByText('Editar')).toBeTruthy());
  expect(detail.getByText('Desactivar')).toBeTruthy();expect(detail.queryByText('Eliminar')).toBeNull();
});
test('auditor detail hides edit, status and delete actions',async()=>{
  const ui=render(session(['customers.read'],<CustomerDetailScreen route={{params:{id:'qa'}}} navigation={{}}/>));
  await waitFor(()=>expect(ui.getByText('ACTIVE')).toBeTruthy());
  for(const action of ['Editar','Desactivar','Eliminar'])expect(ui.queryByText(action)).toBeNull();
});
test('direct form navigation without permission is denied',()=>{
  const ui=render(session(['customers.read'],<CustomerForm route={{params:{customerId:'qa'}}} navigation={{}}/>));
  expect(ui.getByText('Sin permiso para guardar clientes')).toBeTruthy();expect(customerService.getById).not.toHaveBeenCalled();
});
test('backend-granted full permission set exposes all detail actions',async()=>{
  const ui=render(session(['customers.read','customers.create','customers.update','customers.delete'],<CustomerDetailScreen route={{params:{id:'qa'}}} navigation={{}}/>));
  await waitFor(()=>expect(ui.getByText('Eliminar')).toBeTruthy());expect(ui.getByText('Editar')).toBeTruthy();
});
