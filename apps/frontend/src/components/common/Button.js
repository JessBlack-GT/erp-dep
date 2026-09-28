/**
 * ============================================
 * YJ NEXO ERP - Button Component
 * ============================================
 * Multiplatform button supporting primary, secondary, outline, ghost, and danger variants.
 */

import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  View,
  StyleSheet,
} from 'react-native';
import { Text } from './Text';
import { semanticColors, spacing, radius, componentTokens } from '../../theme';

export function Button({
  variant = 'primary',
  size = 'medium',
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  accessibilityLabel,
  testID,
  style,
  textStyle,
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
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  const textColor = getTextColor(variant, disabled);
  const textVariant = size === 'small' ? 'bodySmall' : size === 'large' ? 'title' : 'body';

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={handlePress}
      disabled={!isInteractive}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label || (typeof children === 'string' ? children : undefined)}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      testID={testID}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size={size === 'small' ? 'small' : 'small'}
          color={textColor}
          testID={testID ? `${testID}-loading` : undefined}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          {label ? (
            <Text
              variant={textVariant}
              weight="semibold"
              color={textColor}
              style={[styles.label, textStyle]}
            >
              {label}
            </Text>
          ) : (
            children
          )}
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

function getTextColor(variant, disabled) {
  if (disabled) return semanticColors.text.muted;
  switch (variant) {
    case 'primary':
    case 'secondary':
    case 'danger':
      return semanticColors.text.inverse;
    case 'outline':
    case 'ghost':
    default:
      return semanticColors.brand.navy;
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    backgroundColor: semanticColors.interactive.disabled,
    borderColor: 'transparent',
    opacity: 0.6,
  },

  // Size Styles
  size_small: {
    height: componentTokens.button.heightSmall,
    paddingHorizontal: spacing.sm,
  },
  size_medium: {
    height: componentTokens.button.heightMedium,
    paddingHorizontal: spacing.md,
  },
  size_large: {
    height: componentTokens.button.heightLarge,
    paddingHorizontal: spacing.lg,
  },

  // Variant Styles
  variant_primary: {
    backgroundColor: semanticColors.interactive.primary,
    borderColor: semanticColors.interactive.primary,
  },
  variant_secondary: {
    backgroundColor: semanticColors.brand.navy,
    borderColor: semanticColors.brand.navy,
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderColor: semanticColors.border.strong,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: semanticColors.status.error,
    borderColor: semanticColors.status.error,
  },

  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  label: {
    textAlign: 'center',
  },
});

export default Button;
