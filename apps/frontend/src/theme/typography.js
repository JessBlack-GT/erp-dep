/**
 * ============================================
 * YJ NEXO ERP - Typography Design Tokens
 * ============================================
 */

export const fontFamilies = {
  sans: 'System, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const fontSizes = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
};

export const lineHeights = {
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
};

export const typographyScale = {
  display: {
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.bold,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  heading1: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  heading2: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  heading3: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: 28,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    lineHeight: 22,
  },
  body: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: 16,
  },
  label: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    lineHeight: 18,
  },
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    lineHeight: 14,
  },
};

// Legacy compatibility mapping
export const typography = {
  h1: typographyScale.display,
  h2: typographyScale.heading2,
  h3: typographyScale.heading3,
  body: typographyScale.body,
  caption: typographyScale.caption,
  button: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: 20,
  },
  ...typographyScale,
};

export default typography;
