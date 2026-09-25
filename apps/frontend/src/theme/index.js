/**
 * ============================================
 * YJ NEXO ERP - Design System Central Theme
 * ============================================
 */

import { colors, brandPalette, neutralPalette, semanticColors } from './colors';
import { typography, typographyScale, fontFamilies, fontWeights, fontSizes, lineHeights } from './typography';
import { spacing, spacingScale } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';
import { breakpoints, mediaQueries } from './breakpoints';
import { zIndex } from './zIndex';
import { componentTokens } from './components';

export {
  colors,
  brandPalette,
  neutralPalette,
  semanticColors,
  typography,
  typographyScale,
  fontFamilies,
  fontWeights,
  fontSizes,
  lineHeights,
  spacing,
  spacingScale,
  radius,
  shadows,
  breakpoints,
  mediaQueries,
  zIndex,
  componentTokens,
};

export const theme = {
  colors,
  brandPalette,
  neutralPalette,
  semanticColors,
  typography,
  typographyScale,
  spacing,
  spacingScale,
  radius,
  shadows,
  breakpoints,
  mediaQueries,
  zIndex,
  components: componentTokens,
};

export default theme;
