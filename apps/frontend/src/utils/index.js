/**
 * ============================================
 * ERP-SYSTEM - Utilidades del Frontend
 * ============================================
 */

/**
 * Formatear fecha local
 */
export function formatDate(date, format = 'DD/MM/YYYY') {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return format.replace('DD', day).replace('MM', month).replace('YYYY', year);
}

/**
 * Formatear moneda
 */
export function formatCurrency(amount, currency = 'PEN') {
  const num = parseFloat(amount);
  if (isNaN(num)) return '-';
  return `${num.toFixed(2)} ${currency}`;
}

/**
 * Formatear número
 */
export function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined) return '-';
  return Number(num).toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Validar email
 */
export function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validar teléfono peruano
 */
export function isValidPhone(phone) {
  const regex = /^\+?51\d{9}$/;
  return regex.test(phone.replace(/\s/g, ''));
}

/**
 * Obtener iniciales de nombre
 */
export function getInitials(firstName, lastName) {
  const first = firstName ? firstName.charAt(0).toUpperCase() : '';
  const last = lastName ? lastName.charAt(0).toUpperCase() : '';
  return `${first}${last}`;
}

/**
 * Truncar texto
 */
export function truncate(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Clase condicional
 */
export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Obtener color según estado
 */
export function getStatusColor(status) {
  const colors = {
    active: '#4CAF50',
    inactive: '#9E9E9E',
    pending: '#FF9800',
    archived: '#607D8B',
    deleted: '#F44336',
  };
  return colors[status] || '#9E9E9E';
}

/**
 * Diferencia de días entre fechas
 */
export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Obtener diferencia de tiempo relativa
 */
export function timeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Hace unos segundos';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
  const days = Math.floor(seconds / 86400);
  if (days < 30) return `Hace ${days} día${days > 1 ? 's' : ''}`;
  return formatDate(dateString);
}
