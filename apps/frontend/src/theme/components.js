/**
 * ============================================
 * YJ NEXO ERP - Component Default Tokens
 * ============================================
 */

import { spacing } from './spacing';
import { radius } from './radius';

export const componentTokens = {
  button: {
    heightSmall: 32,
    heightMedium: 40,
    heightLarge: 48,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
  },
  input: {
    height: 40,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.medium,
  },
  table: {
    headerHeight: 44,
    rowHeight: 48,
  },
};

export default componentTokens;
