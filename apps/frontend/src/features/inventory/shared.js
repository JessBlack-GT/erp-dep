import { Platform, StyleSheet } from 'react-native';
import { semanticColors, spacing, radius } from '../../theme';
export const operations = {
  ENTRY: ['Entrada', 'entry'],
  EXIT: ['Salida', 'exit'],
  TRANSFER: ['Transferencia', 'transfer'],
  ADJUSTMENT: ['Ajuste', 'adjust'],
};
export const message = (e) =>
  e.response?.status === 403
    ? 'Sin permiso para esta operación'
    : e.response?.data?.error || 'No se pudo completar la operación';
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: semanticColors.background.primary,
    ...(Platform.OS === 'web' && {
      flex: undefined,
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: semanticColors.background.primary,
    }),
  },
  title: {
    color: semanticColors.brand.navy,
    fontSize: 22,
    fontWeight: '600',
    marginVertical: spacing.sm,
    ...(Platform.OS === 'web' && {
      color: semanticColors.brand.navy,
      fontSize: 22,
      fontWeight: '600',
      marginVertical: spacing.sm,
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
    ...(Platform.OS === 'web' && {
      gap: spacing.sm,
      marginVertical: spacing.xs,
      alignItems: 'center',
    }),
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
      paddingVertical: 10,
    }),
  },
  filterInput: {
    ...(Platform.OS === 'web' && {
      flexGrow: 1,
      flexBasis: 240,
      maxWidth: 440,
    }),
  },
  card: {
    padding: spacing.md,
    backgroundColor: semanticColors.surface.primary,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
    marginVertical: spacing.xs,
    borderRadius: radius.medium,
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
    color: '#A00',
    marginVertical: 8,
    ...(Platform.OS === 'web' && {
      color: '#B42318',
      marginVertical: spacing.sm,
    }),
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
