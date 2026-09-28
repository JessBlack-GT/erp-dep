/**
 * ============================================
 * YJ NEXO ERP - Badge Component
 * ============================================
 * Semantic status tag/badge.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { semanticColors, spacing, radius } from '../../theme';

export function Badge({
  variant = 'neutral',
  size = 'medium',
  label,
  children,
  style,
  textStyle,
  testID,
}) {
  const { bg, text } = getBadgeColors(variant);
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.base,
        styles[`size_${size}`],
        { backgroundColor: bg },
        style,
      ]}
      testID={testID}
    >
      {label ? (
        <Text
          variant={isSmall ? 'caption' : 'bodySmall'}
          weight="semibold"
          style={[{ color: text }, textStyle]}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

function getBadgeColors(variant) {
  switch (variant) {
    case 'primary':
      return { bg: '#EFF6FF', text: semanticColors.brand.blue };
    case 'success':
      return { bg: semanticColors.status.successBg, text: semanticColors.status.success };
    case 'warning':
      return { bg: semanticColors.status.warningBg, text: '#D97706' };
    case 'error':
      return { bg: semanticColors.status.errorBg, text: semanticColors.status.error };
    case 'info':
      return { bg: semanticColors.status.infoBg, text: semanticColors.status.info };
    case 'neutral':
    default:
      return { bg: semanticColors.background.tertiary, text: semanticColors.text.secondary };
  }
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.small,
  },
  size_small: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  size_medium: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
});

export default Badge;
