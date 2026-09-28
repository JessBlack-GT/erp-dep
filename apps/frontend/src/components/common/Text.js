/**
 * ============================================
 * YJ NEXO ERP - Text Component
 * ============================================
 * Reusable typography component connected to the YJ Nexo Design Tokens.
 * Supports web, iOS, and Android platforms.
 */

import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { typographyScale, fontWeights, semanticColors } from '../../theme';

const COLOR_MAP = {
  primary: semanticColors.text.primary,
  secondary: semanticColors.text.secondary,
  muted: semanticColors.text.muted,
  inverse: semanticColors.text.inverse,
  link: semanticColors.text.link,
  error: semanticColors.status.error,
  success: semanticColors.status.success,
  warning: semanticColors.status.warning,
  info: semanticColors.status.info,
};

const HEADER_VARIANTS = ['display', 'heading1', 'heading2', 'heading3', 'title'];

export function Text({
  variant = 'body',
  color = 'primary',
  align = 'left',
  weight,
  numberOfLines,
  style,
  children,
  accessibilityRole,
  testID,
  ...props
}) {
  const variantStyle = typographyScale[variant] || typographyScale.body;
  const resolvedColor = COLOR_MAP[color] || color;
  const resolvedWeight = weight ? fontWeights[weight] || weight : variantStyle.fontWeight;

  const isHeader = HEADER_VARIANTS.includes(variant);
  const role = accessibilityRole || (isHeader ? 'header' : 'text');

  const combinedStyles = [
    styles.base,
    variantStyle,
    {
      color: resolvedColor,
      textAlign: align,
      fontWeight: resolvedWeight,
    },
    style,
  ];

  return (
    <RNText
      style={combinedStyles}
      numberOfLines={numberOfLines}
      accessibilityRole={role}
      testID={testID}
      {...props}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: 'System',
    includeFontPadding: false,
  },
});

export default Text;
