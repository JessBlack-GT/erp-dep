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
  if (status === 401) return { kind: 'auth', message: 'Su sesión expiró. Inicie sesión nuevamente.' };
  if (status === 403 && code === 'MUNICIPAL_MEMBERSHIP_REQUIRED') return { kind: 'membership', message: 'No tiene una membresía municipal vigente para este municipio.' };
  if (status === 403) return { kind: 'forbidden', message: 'Su rol no permite esta operación.' };
  if (status === 404) return { kind: 'notFound', message: 'Expediente no encontrado o sin acceso.' };
  if (status === 409) return { kind: 'conflict', message: 'El expediente cambió mientras lo consultaba. Se recargó la información.' };
  if (status === 400) return { kind: 'validation', message: (error && error.message) || 'Revise los datos capturados.' };
  return { kind: 'network', message: 'No fue posible comunicarse con el servidor. Intente de nuevo.' };
}
