import { Platform, StyleSheet } from 'react-native';
import { semanticColors, spacing, radius } from '../../theme';
export const fields = [
  ['name', 'Nombre', 255],
  ['sku', 'SKU', 80],
  ['description', 'Descripción', 2000],
  ['barcode', 'Código de barras', 80],
  ['category', 'Categoría', 100],
  ['unit', 'Unidad', 40],
  ['price', 'Precio base', 17],
  ['cost', 'Costo base', 17],
  ['currency', 'Moneda (3 letras)', 3],
  ['taxCategory', 'Referencia fiscal', 80],
  ['notes', 'Notas', 2000],
];
export const message = (error) =>
  error.response?.status === 403
    ? 'Sin permiso para esta operación'
    : error.response?.data?.error || 'No se pudo completar la operación';
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: semanticColors.background.primary,
    ...(Platform.OS === 'web' && {
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: semanticColors.background.primary,
    }),
  },
  title: {
    color: semanticColors.brand.navy,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: spacing.sm,
    ...(Platform.OS === 'web' && {
      color: semanticColors.brand.navy,
      fontSize: 22,
      fontWeight: '600',
      marginBottom: spacing.sm,
    }),
  },
  fieldLabel: {
    color: semanticColors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  cardTitle: {
    color: semanticColors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  cardMeta: {
    color: semanticColors.text.secondary,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  detailLabel: {
    color: Platform.OS === 'web' ? '#000' : semanticColors.text.secondary,
    fontSize: 14,
    marginBottom: Platform.OS === 'web' ? 0 : spacing.xs,
  },
  detailValue: {
    color: Platform.OS === 'web' ? '#000' : semanticColors.text.primary,
    fontSize: Platform.OS === 'web' ? 14 : 16,
    fontWeight: Platform.OS === 'web' ? '400' : '600',
  },
  status: {
    color: Platform.OS === 'web' ? '#000' : semanticColors.text.secondary,
    fontSize: 14,
  },
  input: {
    color: semanticColors.text.primary,
    backgroundColor: semanticColors.surface.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: semanticColors.border.strong,
    borderRadius: radius.medium,
    fontSize: 16,
    minHeight: 44,
    marginVertical: spacing.xs,
    ...(Platform.OS === 'web' && {
      fontSize: 14,
      minHeight: 40,
      paddingVertical: 12,
    }),
  },
  filterInput: {
    ...(Platform.OS === 'web' && {
      width: '100%',
    }),
  },
  filterField: {
    ...(Platform.OS === 'web' && {
      flexGrow: 1,
      flexBasis: 240,
      maxWidth: 440,
    }),
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginVertical: 8,
    ...(Platform.OS === 'web' && {
      gap: spacing.sm,
      marginVertical: spacing.xs,
      alignItems: 'center',
    }),
  },
  card: {
    padding: spacing.md,
    backgroundColor: semanticColors.surface.primary,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
    borderRadius: radius.medium,
    marginVertical: spacing.xs,
  },
  body: {
    color: Platform.OS === 'web' ? '#000' : semanticColors.text.primary,
    fontSize: 14,
  },
  pagination: {
    color: Platform.OS === 'web' ? '#000' : semanticColors.text.secondary,
    fontSize: 14,
    marginVertical: spacing.sm,
  },
  error: {
    color: '#B42318',
    marginVertical: spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
    ...(Platform.OS === 'web' && {
      backgroundColor: semanticColors.surface.overlay,
      padding: spacing.md,
    }),
  },
});
