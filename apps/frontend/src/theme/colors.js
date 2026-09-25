/**
 * ============================================
 * YJ NEXO ERP - Color Design Tokens
 * ============================================
 * Official brand colors extracted from PNG master assets:
 * - Navy Principal: #101D36 (OFFICIAL BRAND ASSET)
 * - Accent Blue Light: #316BDF (OFFICIAL BRAND ASSET)
 * - Accent Blue Dark: #64A0FF (OFFICIAL BRAND ASSET)
 * - Pure White: #FFFFFF (OFFICIAL BRAND ASSET)
 * - Slate Navy: #2E394F (OFFICIAL BRAND ASSET)
 * - Neutral Border Accent: #E0E0E5 (OFFICIAL BRAND ASSET)
 */

export const brandPalette = {
  navy: '#101D36',
  blue: '#316BDF',
  blueDark: '#64A0FF',
  white: '#FFFFFF',
  slateNavy: '#2E394F',
  borderAccent: '#E0E0E5',
};

export const neutralPalette = {
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',
};

export const semanticColors = {
  brand: {
    navy: brandPalette.navy,
    blue: brandPalette.blue,
    blueDark: brandPalette.blueDark,
    white: brandPalette.white,
    slateNavy: brandPalette.slateNavy,
  },
  background: {
    primary: neutralPalette.gray50,
    secondary: brandPalette.white,
    tertiary: neutralPalette.gray100,
    dark: brandPalette.navy,
  },
  surface: {
    primary: brandPalette.white,
    secondary: neutralPalette.gray50,
    elevated: brandPalette.white,
    overlay: 'rgba(16, 29, 54, 0.5)',
  },
  text: {
    primary: brandPalette.navy,
    secondary: '#4B5568',
    muted: '#878E9A',
    inverse: brandPalette.white,
    link: brandPalette.blue,
  },
  border: {
    default: brandPalette.borderAccent,
    strong: '#C3C6CC',
    focus: brandPalette.blue,
  },
  interactive: {
    primary: brandPalette.blue,
    primaryHover: '#2557C7',
    primaryPressed: '#1D45A8',
    secondary: brandPalette.navy,
    secondaryHover: '#1A2A4A',
    disabled: '#C3C6CC',
  },
  status: {
    success: '#10B981',
    successBg: '#ECFDF5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    info: '#3B82F6',
    infoBg: '#EFF6FF',
  },
};

// Legacy alias mapping for backward compatibility
export const colors = {
  primary: semanticColors.interactive.primary,
  secondary: semanticColors.brand.slateNavy,
  accent: semanticColors.brand.blue,
  success: semanticColors.status.success,
  error: semanticColors.status.error,
  warning: semanticColors.status.warning,
  info: semanticColors.status.info,
  background: semanticColors.background.primary,
  surface: semanticColors.surface.primary,
  text: semanticColors.text.primary,
  textSecondary: semanticColors.text.secondary,
  disabled: semanticColors.interactive.disabled,
  border: semanticColors.border.default,

  // Expose semantic structures
  ...semanticColors,
};

export default colors;
