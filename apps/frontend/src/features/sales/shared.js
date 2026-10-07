import { StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { semanticColors, spacing, radius } from '../../theme';

export const screenProps = {
  route: PropTypes.shape({ params: PropTypes.shape({ id: PropTypes.string }) }),
  navigation: PropTypes.shape({
    navigate: PropTypes.func,
    replace: PropTypes.func,
    addListener: PropTypes.func,
  }),
};
export const states = {
  draft: 'Borrador',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};
export const stateVariants = {
  draft: 'warning',
  confirmed: 'success',
  cancelled: 'error',
};
export const active = (row) =>
  row?.status === 'active' && !row.deletedAt && !row.isDeleted;
export const tracked = (row) =>
  row?.type === 'PRODUCT' && row.trackInventory === true;
export const dateText = (value) => String(value || '').slice(0, 10);
export function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(new Date(value).getTime()) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}
export function salesError(error) {
  return (
    {
      400: 'Revisa los datos de la venta. Hay campos inválidos.',
      401: 'Tu sesión ha caducado. Inicia sesión nuevamente.',
      403: 'No tienes permiso para realizar esta operación.',
      404: 'La venta o un registro relacionado ya no está disponible.',
      409: 'La venta cambió o no cumple las condiciones actuales. Revisa su estado, productos, almacenes y existencias.',
      500: 'No se pudo completar la operación. Consulta el estado de la venta.',
      503: 'El servicio no está disponible. Consulta el estado antes de volver a intentar.',
    }[error?.response?.status] ||
    'No se pudo conectar. Consulta el estado antes de volver a intentar.'
  );
}
export const uncertain = (e) => !e?.response || e.response.status >= 500;
export function blankLine(key) {
  return {
    key,
    product: null,
    quantity: '1',
    unitPrice: '',
    discountRate: '0',
    taxRate: '0',
    warehouse: null,
  };
}
export function formError(data) {
  if (!validDate(data.date)) return 'Introduce una fecha válida: AAAA-MM-DD.';
  if (!/^[A-Z]{3}$/.test(data.currency))
    return 'Introduce una moneda de tres letras, por ejemplo GTQ.';
  if (!active(data.customer)) return 'Selecciona un cliente activo.';
  if (!data.lines.length) return 'Agrega al menos una línea.';
  for (const line of data.lines) {
    if (!active(line.product))
      return 'Selecciona un producto o servicio activo en cada línea.';
    for (const field of ['quantity', 'unitPrice', 'discountRate', 'taxRate']) {
      const value = String(line[field]).trim();
      if (
        !/^\d+(\.\d+)?$/.test(value) ||
        !isFinite(Number(value)) ||
        (field === 'quantity' && Number(value) <= 0) ||
        (['discountRate', 'taxRate'].includes(field) && Number(value) > 100)
      ) {
        return 'Revisa las líneas: cantidad mayor que cero, precio no negativo y porcentajes entre 0 y 100.';
      }
    }
  }
  return '';
}
// Whitelist explícita: nunca enviar snapshots, totales ni referencias de inventario.
export function editablePayload(data) {
  return {
    date: data.date,
    currency: data.currency,
    entityId: data.customer._id,
    lines: data.lines.map((line) => ({
      productId: line.product._id,
      quantity: line.quantity.trim(),
      unitPrice: line.unitPrice.trim(),
      discountRate: line.discountRate.trim(),
      taxRate: line.taxRate.trim(),
      ...(tracked(line.product) && line.warehouse
        ? { warehouseId: line.warehouse._id }
        : {}),
    })),
  };
}
export const styles = StyleSheet.create({
  page: {
    gap: spacing.md,
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
  },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: semanticColors.surface.primary,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
    borderRadius: radius.medium,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    color: semanticColors.brand.navy,
  },
  title: {
    color: semanticColors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    color: semanticColors.text.primary,
    fontSize: 14,
  },
  muted: {
    color: semanticColors.text.secondary,
    fontSize: 14,
  },
  error: {
    color: semanticColors.status.error,
    fontSize: 14,
  },
  total: {
    color: semanticColors.brand.navy,
    fontSize: 16,
    fontWeight: '600',
  },
  filterLabel: {
    color: semanticColors.text.secondary,
    fontSize: 14,
  },
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  dialog: {
    backgroundColor: semanticColors.background.primary,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
