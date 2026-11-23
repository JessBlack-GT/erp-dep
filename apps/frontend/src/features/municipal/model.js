/**
 * MuniERP IA — modelo de presentación (puro, sin red). Etiquetas accesibles y reglas de formulario
 * espejo del contrato docs/munierp/contracts/municipal-v1.openapi.yaml (draft.1).
 * El estado nunca se comunica solo con color: siempre hay texto (RQ06, WCAG 1.4.1).
 */

export const STATUS = {
  REGISTRADA: { label: 'Registrada', variant: 'info' },
  EN_TRAMITE: { label: 'En trámite', variant: 'warning' },
  EN_ESPERA_CIUDADANO: { label: 'En espera del ciudadano', variant: 'neutral' },
  CERRADA: { label: 'Concluida', variant: 'success' },
  CANCELADA: { label: 'Cancelada', variant: 'error' },
};

export const CHANNELS = [
  { value: 'PRESENCIAL', label: 'Presencial (ventanilla)' },
  { value: 'TELEFONO', label: 'Teléfono' },
  { value: 'WEB_FUNCIONARIO', label: 'Captura interna' },
];

export const CONFIDENTIALITY = [
  { value: 'PUBLICA', label: 'Pública' },
  { value: 'RESERVADA', label: 'Reservada' },
  { value: 'CONFIDENCIAL', label: 'Confidencial' },
];

export const FOLIO_PATTERN = /^[A-Z]{3}-[A-Z]{3}-[A-Z]{3}-\d{4}-\d{6}$/;

export function statusInfo(status) {
  return STATUS[status] || { label: status ? String(status) : 'Desconocido', variant: 'neutral' };
}

/** Folio legible por lector de pantalla: "S J H, O B P, …, 000042" se lee grupo por grupo. */
export function spokenFolio(folio) {
  return typeof folio === 'string' ? folio.split('-').map((g) => (/^\d+$/.test(g) ? String(Number(g)) : g.split('').join(' '))).join(', ') : '';
}

export function requestAccessibilityLabel(r) {
  return `Folio ${spokenFolio(r.folio)}. Estado ${statusInfo(r.status).label}. Dependencia ${r.ownerDependency || 'sin asignar'}.`;
}

const CURP = /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/i;

/**
 * Validación local del registro en ventanilla (la autoridad es el servidor).
 * @returns {Record<string, string>} errores por campo
 */
export function validateIntake(values) {
  const errors = {};
  const subject = (values.subject || '').trim();
  if (subject.length < 5 || subject.length > 200) errors.subject = 'El asunto debe tener entre 5 y 200 caracteres.';
  if ((values.description || '').length > 5000) errors.description = 'La descripción admite hasta 5000 caracteres.';
  if (CURP.test(values.subject || '') || CURP.test(values.description || ''))
    errors.description = 'No capture CURP ni datos de identificación oficial.';
  if (!values.ownerDependency) errors.ownerDependency = 'Seleccione la dependencia responsable.';
  if (!values.citizenId) errors.citizenId = 'Seleccione o registre al ciudadano.';
  if (!CHANNELS.some((c) => c.value === values.channel)) errors.channel = 'Seleccione el canal de atención.';
  return errors;
}

/** Clave de idempotencia estable por formulario: un reintento no duplica el folio (RQ01/RQ06). */
export function newIdempotencyKey() {
  const bytes = new Uint8Array(16);
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return 'muni-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Columnas de la cuadrícula de indicadores según ancho (tokens de breakpoints del ERP). */
export function indicatorColumns(width) {
  if (width >= 1024) return 4;
  if (width >= 768) return 2;
  return 1;
}

/** Opciones orientativas del formulario. El servidor vuelve a comprobar el alcance al registrar. */
export function intakeDependencies(dependencies, membership) {
  const scoped = ['TITULAR_DEPENDENCIA', 'OPERADOR_DEPENDENCIA'].includes(membership?.role);
  const allowed = new Set(membership?.dependencies || []);
  return dependencies.filter((d) => d.status !== 'INACTIVA' && (!scoped || allowed.has(d.code)));
}

/** Un folio confirmado por el POST no se pierde si falla la consulta posterior del acuse. */
export async function receiptOrConfirmation(api, created) {
  try {
    const receipt = await api.getReceipt(created.folio);
    if (receipt?.folio === created.folio) return receipt;
  } catch {
    // El resultado de la lectura no cambia el resultado de la escritura.
  }
  return { folio: created.folio, confirmationOnly: true };
}

export function describeIntakeFailure(error) {
  const status = error?.status ?? error?.response?.status;
  if (status === 400) return { message: error.message || 'Revise los datos de la solicitud.' };
  if (status === 401) return { message: 'Su sesión expiró. Inicie sesión nuevamente.' };
  if (status === 403) return { message: 'No tiene permiso para registrar en esa dependencia.' };
  if (status === 404) return { message: 'No se encontró el recurso para registrar. Revise el municipio y los datos.' };
  if (status === 429) return { message: 'Demasiados intentos. Espere un momento antes de reintentar.', retry: true };
  if (status === 409) return { message: 'Hubo un conflicto al registrar. Reintente con los mismos datos.', retry: true };
  return { message: 'No se pudo confirmar el registro. Puede reintentar sin cambiar los datos y sin duplicar el folio.', retry: true };
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', year: 'numeric', month: 'short', day: '2-digit' });
}

/* ------------------------------ F1-13: detalle de expediente ------------------------------ */

export const REQUEST_TYPES = { SOL: 'Solicitud general' };

export const CONFIDENTIALITY_LABELS = { PUBLICA: 'Pública', RESERVADA: 'Reservada', CONFIDENCIAL: 'Confidencial' };

export const CHANNEL_LABELS = { PRESENCIAL: 'Presencial (ventanilla)', TELEFONO: 'Teléfono', WEB_FUNCIONARIO: 'Captura interna' };

export const HISTORY_LABELS = {
  REGISTRAR: 'Registro',
  EDITAR: 'Edición',
  TURNAR: 'Turnado',
  ASIGNAR: 'Asignación de responsable',
  ESPERAR_CIUDADANO: 'En espera del ciudadano',
  REANUDAR: 'Reanudación',
  CERRAR: 'Conclusión',
  CANCELAR: 'Cancelación',
};

/**
 * Acciones de transición del contrato (x-permission-by-action). Debe coincidir con
 * apps/backend/src/modules/municipal/domain/request-state.js#ACTIONS; una prueba de paridad lo
 * verifica. La interfaz solo OCULTA acciones; el servidor vuelve a autorizar cada una.
 */
export const TRANSITIONS = {
  TURNAR: { permission: 'municipal.requests.assign', from: ['REGISTRADA', 'EN_TRAMITE'], label: 'Turnar a otra dependencia', needs: 'dependency' },
  ASIGNAR: { permission: 'municipal.requests.assignUser', from: ['REGISTRADA', 'EN_TRAMITE', 'EN_ESPERA_CIUDADANO'], label: 'Asignar responsable', needs: 'user' },
  ESPERAR_CIUDADANO: { permission: 'municipal.requests.update', from: ['EN_TRAMITE'], label: 'Poner en espera del ciudadano', needs: null },
  REANUDAR: { permission: 'municipal.requests.update', from: ['EN_ESPERA_CIUDADANO'], label: 'Reanudar trámite', needs: null },
  CERRAR: { permission: 'municipal.requests.close', from: ['EN_TRAMITE', 'EN_ESPERA_CIUDADANO'], label: 'Concluir', needs: 'note' },
  CANCELAR: { permission: 'municipal.requests.cancel', from: ['REGISTRADA', 'EN_TRAMITE', 'EN_ESPERA_CIUDADANO'], label: 'Cancelar', needs: 'note' },
};

/** Acciones visibles: permiso de la membresía + estado actual. Sin permisos → ninguna. */
export function availableActions(permissions, status) {
  const granted = new Set(Array.isArray(permissions) ? permissions : []);
  return Object.entries(TRANSITIONS)
    .filter(([, t]) => granted.has(t.permission) && t.from.includes(status))
    .map(([action, t]) => ({ action, ...t }));
}

/** Validación local de una acción (la autoridad sigue siendo el servidor). */
export function validateAction(action, values) {
  const t = TRANSITIONS[action];
  if (!t) return { action: 'Acción no reconocida.' };
  const errors = {};
  if (t.needs === 'note' && (values.note || '').trim().length < 5) errors.note = 'Escriba una nota de al menos 5 caracteres.';
  if ((values.note || '').length > 2000) errors.note = 'La nota admite hasta 2000 caracteres.';
  if (t.needs === 'dependency' && !values.dependency) errors.dependency = 'Seleccione la dependencia destino.';
  if (t.needs === 'user' && !values.userId) errors.userId = 'Seleccione el responsable.';
  return errors;
}

/** El contrato draft.3 solo entrega actorId; se muestra un identificador abreviado (ver doc 13, propuesta actorName). */
export function actorLabel(actorId) {
  return typeof actorId === 'string' && actorId.length >= 6 ? `Funcionario ···${actorId.slice(-6)}` : 'Funcionario';
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Mensaje para errores de la API municipal. 404 no distingue "no existe" de "no autorizado"
 * (política de no revelación del servidor); 403 MUNICIPAL_MEMBERSHIP_REQUIRED indica falta de membresía.
 */
export function describeApiError(error) {
  const status = error && (error.status || (error.response && error.response.status));
  const code = error && (error.code || (error.response && error.response.data && error.response.data.code));
  if (code === 'PRIVATE_DOCUMENTS_UNAVAILABLE') return { kind: 'unsupported', message: (error && error.message) || 'La descarga de documentos privados no está disponible en esta plataforma.' };
  if (code === 'DOCUMENT_INTEGRITY') return { kind: 'integrity', message: 'El documento recibido no superó la verificación y no se guardó. Intente de nuevo o avise al área responsable.' };
  if (status === 401) return { kind: 'auth', message: 'Su sesión expiró. Inicie sesión nuevamente.' };
  if (status === 403 && code === 'MUNICIPAL_MEMBERSHIP_REQUIRED') return { kind: 'membership', message: 'No tiene una membresía municipal vigente para este municipio.' };
  if (status === 403) return { kind: 'forbidden', message: 'Su rol no permite esta operación.' };
  if (status === 404) return { kind: 'notFound', message: 'Expediente no encontrado o sin acceso.' };
  if (status === 409) return { kind: 'conflict', message: 'El expediente cambió mientras lo consultaba. Se recargó la información.' };
  if (status === 400) return { kind: 'validation', message: (error && error.message) || 'Revise los datos capturados.' };
  return { kind: 'network', message: 'No fue posible comunicarse con el servidor. Intente de nuevo.' };
}

/* ------------------------------ F1-14: bitácora de auditoría ------------------------------ */

/** Permiso del contrato para GET /audit-events (matriz vigente: solo AUDITOR_MUNICIPAL). */
export const AUDIT_PERMISSION = 'municipal.audit.read';

const transitionLabel = (action) => (TRANSITIONS[action] ? TRANSITIONS[action].label : null);

/** Nombre legible de cada `action` que registra el servidor. Las desconocidas se muestran con su código. */
export const AUDIT_ACTION_LABELS = {
  REQUEST_CREATED: 'Registro de solicitud',
  REQUEST_UPDATED: 'Edición de solicitud',
  ...Object.fromEntries(Object.keys(TRANSITIONS).map((a) => [`REQUEST_${a}`, `Transición: ${transitionLabel(a)}`])),
  DOCUMENT_UPLOADED: 'Documento adjuntado',
  DOCUMENT_DOWNLOADED: 'Documento descargado',
  DOCUMENT_INTEGRITY_FAILED: 'Documento con integridad fallida',
  ACCESS_DENIED: 'Acceso denegado',
  DEPENDENCY_CREATED: 'Alta de dependencia',
  DEPENDENCY_UPDATED: 'Cambio de dependencia',
  MEMBERSHIP_CREATED: 'Alta de membresía',
  MEMBERSHIP_UPDATED: 'Cambio de membresía',
  MEMBERSHIP_REVOKED: 'Revocación de membresía',
  CITIZEN_CREATED: 'Alta de ciudadano',
  GRANT_CREATED: 'Acceso compartido',
  GRANT_REVOKED: 'Acceso compartido revocado',
};

export const AUDIT_ENTITY_LABELS = { Request: 'Expediente', Document: 'Documento', Citizen: 'Ciudadano', Grant: 'Acceso compartido', Dependency: 'Dependencia', Membership: 'Membresía' };
export const AUDIT_RESULT_LABELS = { success: { label: 'Permitido', variant: 'success' }, denied: { label: 'Denegado', variant: 'error' } };
export const AUDIT_PAGE_SIZES = [10, 20, 50];

export function auditActionLabel(action) {
  return AUDIT_ACTION_LABELS[action] || `Acción registrada (${String(action || 'sin código')})`;
}

/** Recurso afectado sin exponer identificadores completos: folio si existe; si no, id abreviado. */
export function auditResourceLabel(e) {
  const entity = AUDIT_ENTITY_LABELS[e.entity] || e.entity || 'Recurso';
  if (e.folio) return `${entity} ${e.folio}`;
  if (typeof e.entityId === 'string' && e.entityId.length >= 6) return `${entity} ···${e.entityId.slice(-6)}`;
  return entity;
}

/** Dependencia derivada del folio (formato público MUN-DEP-TIPO-AAAA-NNNNNN), nunca inferida de otra forma. */
export function dependencyFromFolio(folio, dependencies = []) {
  if (typeof folio !== 'string' || !FOLIO_PATTERN.test(folio)) return null;
  const code = folio.split('-')[1];
  const dep = dependencies.find((d) => d.code === code);
  return dep ? dep.name : code;
}

/** Etiqueta accesible de una fila (no incluye IP ni requestId). */
export function auditEventAccessibilityLabel(e, dependencies = []) {
  const dep = dependencyFromFolio(e.folio, dependencies);
  const result = (AUDIT_RESULT_LABELS[e.result] || { label: e.result || '' }).label;
  return [auditActionLabel(e.action), auditResourceLabel(e), dep ? `dependencia ${dep}` : null, result, formatDateTime(e.at), `por ${actorLabel(e.actorId)}`].filter(Boolean).join(', ');
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID_RE = /^[0-9a-f]{24}$/;
/** Inicio del día en Ciudad de México (UTC−6, sin horario de verano desde 2022) en ISO. */
const mxStartOfDay = (date) => new Date(`${date}T00:00:00-06:00`);

/**
 * Filtros del contrato: folio, entityId, from, to, page, limit. Las fechas se capturan como
 * AAAA-MM-DD; «Hasta» es inclusivo en la interfaz (se envía el inicio del día siguiente, ya que el
 * servidor usa `to` exclusivo). Devuelve { errors, query }.
 */
export function buildAuditQuery(values = {}) {
  const errors = {};
  const query = {};
  const folio = (values.folio || '').trim().toUpperCase();
  const entityId = (values.entityId || '').trim().toLowerCase();
  const from = (values.from || '').trim();
  const to = (values.to || '').trim();
  if (folio) { if (FOLIO_PATTERN.test(folio)) query.folio = folio; else errors.folio = 'Folio con formato MUN-DEP-TIPO-AAAA-NNNNNN.'; }
  if (entityId) { if (OBJECT_ID_RE.test(entityId)) query.entityId = entityId; else errors.entityId = 'Identificador de 24 caracteres hexadecimales.'; }
  const valid = (d) => DATE_RE.test(d) && !Number.isNaN(mxStartOfDay(d).getTime()) && mxStartOfDay(d).toISOString().slice(0, 10) === d;
  if (from) { if (valid(from)) query.from = mxStartOfDay(from).toISOString(); else errors.from = 'Fecha con formato AAAA-MM-DD.'; }
  if (to) {
    if (valid(to)) query.to = new Date(mxStartOfDay(to).getTime() + 24 * 3600 * 1000).toISOString();
    else errors.to = 'Fecha con formato AAAA-MM-DD.';
  }
  if (query.from && query.to && query.from >= query.to) errors.to = '«Hasta» debe ser igual o posterior a «Desde».';
  const limit = Number(values.limit) || 10;
  query.limit = AUDIT_PAGE_SIZES.includes(limit) ? limit : 10;
  query.page = Math.max(Number(values.page) || 1, 1);
  return { errors, query };
}

/* --------------------------- F1-15a: dependencias y membresías --------------------------- */

export const DEPENDENCY_PERMISSIONS = { read: 'municipal.dependencies.read', manage: 'municipal.dependencies.manage' };
export const MEMBERSHIP_PERMISSIONS = { read: 'municipal.memberships.read', manage: 'municipal.memberships.manage' };

export const ROLE_LABELS = {
  ADMIN_MUNICIPAL: 'Administrador municipal',
  SUPERVISOR_MUNICIPAL: 'Supervisor municipal',
  TITULAR_DEPENDENCIA: 'Titular de dependencia',
  OPERADOR_DEPENDENCIA: 'Operador de dependencia',
  VENTANILLA: 'Ventanilla',
  AUDITOR_MUNICIPAL: 'Auditor municipal',
  CONSULTA: 'Consulta',
};

/**
 * Roles que la interfaz OFRECE al asignar. Espejo de la regla del contrato («no puede crear
 * ADMIN_MUNICIPAL») y de backend `MUNICIPAL_ROLES_ASSIGNABLE`; una prueba de paridad lo verifica.
 * Solo oculta opciones: el servidor vuelve a decidir con `canAssignRole` en cada alta o cambio.
 */
export const ASSIGNABLE_ROLES = ['SUPERVISOR_MUNICIPAL', 'TITULAR_DEPENDENCIA', 'OPERADOR_DEPENDENCIA', 'VENTANILLA', 'AUDITOR_MUNICIPAL', 'CONSULTA'];
/** Roles que requieren al menos una dependencia (backend DEPENDENCY_SCOPED_ROLES; prueba de paridad). */
export const DEPENDENCY_SCOPED_ROLES = ['TITULAR_DEPENDENCIA', 'OPERADOR_DEPENDENCIA', 'CONSULTA'];
export const ACTIVE_STATUS_LABELS = { ACTIVA: { label: 'Activa', variant: 'success' }, INACTIVA: { label: 'Inactiva', variant: 'neutral' } };

export function roleLabel(role) {
  return ROLE_LABELS[role] || String(role || 'Sin rol');
}

/** El contrato solo entrega `userId` (identidad central); se abrevia como en la bitácora (propuesta X-01). */
export function userLabel(userId) {
  return typeof userId === 'string' && userId.length >= 6 ? `Usuario ···${userId.slice(-6)}` : 'Usuario';
}

const DEP_CODE_RE = /^[A-Z]{3}$/;

/** Validación de FORMA del alta/edición de dependencia (la autoridad y las reglas son del servidor). */
export function validateDependencyForm(values = {}, { creating = true } = {}) {
  const errors = {};
  const code = (values.code || '').trim().toUpperCase();
  const name = (values.name || '').trim();
  if (creating && !DEP_CODE_RE.test(code)) errors.code = 'Código de 3 letras mayúsculas (por ejemplo, OBP).';
  if (name.length < 3 || name.length > 150) errors.name = 'El nombre debe tener entre 3 y 150 caracteres.';
  const parentCode = (values.parentCode || '').trim().toUpperCase();
  if (creating && parentCode && !DEP_CODE_RE.test(parentCode)) errors.parentCode = 'Seleccione una dependencia superior válida.';
  const body = creating ? { code, name, ...(parentCode ? { parentCode } : {}) } : { name };
  return { errors, body };
}

/** Validación de FORMA de una membresía (el servidor decide rol asignable, usuario central y dependencias). */
export function validateMembershipForm(values = {}, { creating = true } = {}) {
  const errors = {};
  const userId = (values.userId || '').trim().toLowerCase();
  if (creating && !OBJECT_ID_RE.test(userId)) errors.userId = 'Identificador de usuario central de 24 caracteres hexadecimales.';
  if (!ASSIGNABLE_ROLES.includes(values.role)) errors.role = 'Seleccione un rol asignable.';
  const dependencies = Array.isArray(values.dependencies) ? values.dependencies : [];
  if (DEPENDENCY_SCOPED_ROLES.includes(values.role) && dependencies.length === 0) errors.dependencies = 'Este rol requiere al menos una dependencia.';
  const body = creating ? { userId, role: values.role, dependencies } : { role: values.role, dependencies };
  return { errors, body };
}

/** Mensaje para operaciones administrativas: los 4xx traen un mensaje del servidor apto para el usuario. */
export function describeAdminError(error) {
  const base = describeApiError(error);
  const status = error && error.status;
  if ([400, 403, 404, 409].includes(status) && base.kind !== 'membership' && error.message) return { ...base, message: error.message };
  return base;
}

/**
 * Secciones de navegación de la aplicación municipal (F1-15a). Visibles según los permisos que
 * informa /me/memberships (solo UX); cada pantalla vuelve a consultar al servidor, que autoriza.
 */
export const NAV_SECTIONS = [
  { key: 'home', label: 'Panel principal', permission: null },
  { key: 'intake', label: 'Registrar solicitud', permission: 'municipal.requests.create' },
  { key: 'requests', label: 'Solicitudes', permission: 'municipal.requests.read' },
  { key: 'dependencies', label: 'Dependencias', permission: DEPENDENCY_PERMISSIONS.read },
  { key: 'memberships', label: 'Membresías y permisos', permission: MEMBERSHIP_PERMISSIONS.read },
  { key: 'audit', label: 'Auditoría', permission: AUDIT_PERMISSION },
];

export function navSections(permissions) {
  const granted = new Set(Array.isArray(permissions) ? permissions : []);
  return NAV_SECTIONS.filter((s) => !s.permission || granted.has(s.permission));
}

/** Filtros del listado (contrato listRequests: status, dependency, page, limit). */
export function buildRequestQuery(values = {}) {
  const query = { page: Math.max(Number(values.page) || 1, 1), limit: 10 };
  if (values.status && STATUS[values.status]) query.status = values.status;
  if (values.dependency && DEP_CODE_RE.test(values.dependency)) query.dependency = values.dependency;
  return query;
}
