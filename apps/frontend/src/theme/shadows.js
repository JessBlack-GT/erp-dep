/**
 * ============================================
 * YJ NEXO ERP - Shadow Design Tokens
 * ============================================
 * Cross-platform compatible elevation and web box-shadow properties.
 */

import { brandPalette } from './colors';

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    boxShadow: 'none',
  },
  small: {
    shadowColor: brandPalette.navy,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    boxShadow: '0 1px 2px rgba(16, 29, 54, 0.06)',
  },
  medium: {
    shadowColor: brandPalette.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    boxShadow: '0 2px 4px rgba(16, 29, 54, 0.08)',
  },
  large: {
    shadowColor: brandPalette.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    boxShadow: '0 4px 8px rgba(16, 29, 54, 0.12)',
  },
};

export default shadows;
