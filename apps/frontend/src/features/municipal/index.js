/**
 * MuniERP IA — feature municipal (prototipo Fase 1). NO registrada en la navegación del ERP.
 */
export { MunicipalWorkspaceScreen } from './MunicipalWorkspaceScreen';
export { RequestIntakeForm } from './components/RequestIntakeForm';
export { RequestList, RequestStatusBadge } from './components/RequestList';
export { IndicatorsPanel } from './components/IndicatorsPanel';
export { ReceiptView } from './components/ReceiptView';
export { RequestDetail } from './components/RequestDetail';
export { AuditLog } from './components/AuditLog';
export { MunicipalApp } from './MunicipalApp';
export { DependencyAdmin } from './components/DependencyAdmin';
export { MembershipAdmin } from './components/MembershipAdmin';
export { RequestBrowser } from './components/RequestBrowser';
export { CheckboxGroup } from './components/CheckboxGroup';
export { createMunicipalApi, municipalBaseUrl } from './municipalApi';
export { OptionGroup } from './components/OptionGroup';
export { createMockMunicipalApi } from './mockApi';
import * as municipalModel from './model';

export { municipalModel };
