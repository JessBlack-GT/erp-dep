/**
 * ============================================
 * YJ NEXO ERP - Spacing Design Tokens
 * ============================================
 */

export const spacingScale = {
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
};

// Legacy compatibility and semantic aliases
export const spacing = {
  none: spacingScale['0'],
  xs: spacingScale['1'],
  sm: spacingScale['2'],
  md: spacingScale['4'],
  lg: spacingScale['6'],
  xl: spacingScale['8'],
  xxl: spacingScale['12'],
  ...spacingScale,
};

export default spacing;
