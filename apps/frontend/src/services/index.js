/**
 * ============================================
 * ERP-SYSTEM - Servicios Compartidos
 * ============================================
 */

// Exportar todos los servicios
export { authService, userService, customerService, productService, inventoryService, salesService, reportService } from './api';

/**
 * Utilidad para formatear fechas
 */
export function formatDate(dateString, locale = 'es-ES') {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Utilidad para formatear moneda
 */
export function formatCurrency(amount, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Utilidad para formatear números
 */
export function formatNumber(number, decimals = 2) {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number);
}

/**
 * Utilidad para truncar texto
 */
export function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Utilidad para debounce
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Utilidad para generar ID único
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
