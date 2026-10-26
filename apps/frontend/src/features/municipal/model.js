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
