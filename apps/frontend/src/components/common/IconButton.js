/**
 * ============================================
 * YJ NEXO ERP - IconButton Component
 * ============================================
 * Compact button for icon-only actions.
 */

import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { semanticColors, spacing, radius } from '../../theme';

export function IconButton({
  variant = 'default',
  size = 'medium',
  icon,
  onPress,
  disabled = false,
  loading = false,
  accessibilityLabel = 'Acción',
  testID,
  style,
  children,
  ...props
}) {
  const isInteractive = !disabled && !loading;

  const handlePress = (e) => {
    if (isInteractive && onPress) {
      onPress(e);
    }
  };

  const containerStyles = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    disabled && styles.disabled,
    style,
  ];

  const spinnerColor = getIconColor(variant, disabled);

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={handlePress}
      disabled={!isInteractive}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      testID={testID}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        icon || children
      )}
    </TouchableOpacity>
  );
}

function getIconColor(variant, disabled) {
  if (disabled) return semanticColors.text.muted;
  switch (variant) {
    case 'danger':
      return semanticColors.status.error;
    case 'outline':
    case 'ghost':
    case 'default':
    default:
      return semanticColors.brand.navy;
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },

  // Sizes
  size_small: {
    width: 32,
    height: 32,
    borderRadius: radius.small,
  },
  size_medium: {
    width: 40,
    height: 40,
    borderRadius: radius.medium,
  },
  size_large: {
    width: 48,
    height: 48,
    borderRadius: radius.large,
  },

  // Variants
  variant_default: {
    backgroundColor: semanticColors.surface.secondary,
    borderColor: semanticColors.border.default,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderColor: semanticColors.border.strong,
  },
  variant_danger: {
    backgroundColor: semanticColors.status.errorBg,
    borderColor: semanticColors.status.error,
  },
});

export default IconButton;
