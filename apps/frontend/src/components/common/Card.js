/**
 * ============================================
 * YJ NEXO ERP - Card Component
 * ============================================
 * Container card supporting default, outlined, elevated, and interactive variants.
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { semanticColors, spacing, radius, shadows } from '../../theme';

export function Card({
  variant = 'default',
  padding = 'md',
  onPress,
  children,
  style,
  testID,
  accessibilityLabel,
  ...props
}) {
  const isInteractive = typeof onPress === 'function';
  const paddingValue = spacing[padding] !== undefined ? spacing[padding] : spacing.md;

  const cardStyles = [
    styles.base,
    styles[`variant_${variant}`],
    { padding: paddingValue },
    style,
  ];

  if (isInteractive) {
    return (
      <TouchableOpacity
        style={cardStyles}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyles} testID={testID} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.medium,
    backgroundColor: semanticColors.surface.primary,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
  },

  // Variants
  variant_default: {
    backgroundColor: semanticColors.surface.primary,
    borderColor: semanticColors.border.default,
  },
  variant_outlined: {
    backgroundColor: 'transparent',
    borderColor: semanticColors.border.strong,
  },
  variant_elevated: {
    backgroundColor: semanticColors.surface.elevated,
    borderColor: semanticColors.border.default,
    ...shadows.small,
  },
  variant_interactive: {
    backgroundColor: semanticColors.surface.primary,
    borderColor: semanticColors.border.default,
    ...shadows.small,
  },
});

export default Card;
