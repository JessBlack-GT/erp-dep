/**
 * ============================================
 * YJ NEXO ERP - StatusBadge Component
 * ============================================
 * Specialized badge for ERP entity statuses (active, inactive, deleted, pending, completed, etc.).
 * Does NOT modify business rules; translates received status strings visually.
 */

import React from 'react';
import { Badge } from './Badge';

const STATUS_CONFIG = {
  active: { variant: 'success', label: 'Activo' },
  activo: { variant: 'success', label: 'Activo' },
  inactive: { variant: 'warning', label: 'Inactivo' },
  inactivo: { variant: 'warning', label: 'Inactivo' },
  deleted: { variant: 'error', label: 'Eliminado' },
  eliminado: { variant: 'error', label: 'Eliminado' },
  pending: { variant: 'info', label: 'Pendiente' },
  pendiente: { variant: 'info', label: 'Pendiente' },
  completed: { variant: 'success', label: 'Completado' },
  completado: { variant: 'success', label: 'Completado' },
  cancelled: { variant: 'neutral', label: 'Cancelado' },
  cancelado: { variant: 'neutral', label: 'Cancelado' },
  archived: { variant: 'neutral', label: 'Archivado' },
  archivado: { variant: 'neutral', label: 'Archivado' },
};

export function StatusBadge({
  status,
  customLabel,
  size = 'medium',
  style,
  testID,
}) {
  const normalizedKey = typeof status === 'string' ? status.trim().toLowerCase() : '';
  const config = STATUS_CONFIG[normalizedKey] || {
    variant: 'neutral',
    label: customLabel || (status ? String(status) : 'Desconocido'),
  };

  const displayLabel = customLabel || config.label;

  return (
    <Badge
      variant={config.variant}
      size={size}
      label={displayLabel}
      style={style}
      testID={testID}
    />
  );
}

export default StatusBadge;
