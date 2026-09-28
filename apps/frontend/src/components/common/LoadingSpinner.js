/**
 * ============================================
 * YJ NEXO ERP - LoadingSpinner Component
 * ============================================
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from './Text';
import { semanticColors, spacing } from '../../theme';

export function LoadingSpinner({
  size = 'large',
  label = 'Cargando...',
  color = semanticColors.brand.blue,
  style,
  testID,
}) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <ActivityIndicator size={size} color={color} />
      {label ? (
        <Text variant="bodySmall" color="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: spacing.xs,
  },
});

export default LoadingSpinner;
