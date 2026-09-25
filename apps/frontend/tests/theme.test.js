/**
 * ============================================
 * YJ NEXO ERP - Design Tokens & Theme Unit Tests
 * ============================================
 */

import {
  theme,
  colors,
  brandPalette,
  semanticColors,
  typography,
  spacing,
  radius,
  shadows,
  breakpoints,
  zIndex,
} from '../src/theme';
import { brandAssets } from '../src/assets';

describe('YJ Nexo Design Tokens & Theme Foundation', () => {
  test('exports official brand colors extracted from PNG master assets', () => {
    expect(brandPalette.navy).toBe('#101D36');
    expect(brandPalette.blue).toBe('#316BDF');
    expect(brandPalette.blueDark).toBe('#64A0FF');
    expect(brandPalette.white).toBe('#FFFFFF');
    expect(brandPalette.slateNavy).toBe('#2E394F');
    expect(brandPalette.borderAccent).toBe('#E0E0E5');
  });

  test('provides semantic colors mapped correctly to brand identity', () => {
    expect(semanticColors.brand.navy).toBe('#101D36');
    expect(semanticColors.brand.blue).toBe('#316BDF');
    expect(semanticColors.text.primary).toBe('#101D36');
    expect(semanticColors.border.default).toBe('#E0E0E5');
  });

  test('maintains backward compatibility for legacy color properties', () => {
    expect(colors.primary).toBeDefined();
    expect(colors.secondary).toBeDefined();
    expect(colors.background).toBeDefined();
    expect(colors.surface).toBeDefined();
    expect(colors.text).toBeDefined();
  });

  test('defines complete typography scale', () => {
    expect(typography.display).toBeDefined();
    expect(typography.heading1).toBeDefined();
    expect(typography.heading2).toBeDefined();
    expect(typography.body).toBeDefined();
    expect(typography.caption).toBeDefined();
  });

  test('defines consistent spacing scale', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(16);
    expect(spacing.lg).toBe(24);
    expect(spacing.xl).toBe(32);
  });

  test('defines border radius and cross-platform shadows', () => {
    expect(radius.small).toBe(4);
    expect(radius.medium).toBe(8);
    expect(radius.pill).toBe(9999);

    expect(shadows.small).toBeDefined();
    expect(shadows.medium).toBeDefined();
    expect(shadows.large).toBeDefined();
  });

  test('defines breakpoints and zIndex levels', () => {
    expect(breakpoints.mobile).toBe(0);
    expect(breakpoints.tablet).toBe(768);
    expect(breakpoints.desktop).toBe(1024);

    expect(zIndex.modal).toBe(400);
    expect(zIndex.toast).toBe(500);
  });

  test('exports brand assets module correctly', () => {
    expect(brandAssets.horizontalLight).toBeDefined();
    expect(brandAssets.horizontalDark).toBeDefined();
    expect(brandAssets.appIcon).toBeDefined();
    expect(brandAssets.monochrome).toBeDefined();
  });

  test('central theme object combines all tokens', () => {
    expect(theme.colors).toEqual(colors);
    expect(theme.spacing).toEqual(spacing);
    expect(theme.typography).toEqual(typography);
    expect(theme.radius).toEqual(radius);
    expect(theme.shadows).toEqual(shadows);
  });
});
