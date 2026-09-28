/**
 * ============================================
 * YJ NEXO ERP - EmptyState Component
 * ============================================
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { spacing } from '../../theme';

export function EmptyState({
  title = 'No hay datos disponibles',
  message = 'No se encontraron registros para mostrar.',
  icon,
  actionLabel,
  onAction,
  style,
  testID,
}) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text variant="heading3" align="center" style={styles.title}>
        {title}
      </Text>
      {message && (
        <Text variant="body" color="muted" align="center" style={styles.message}>
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button
          variant="primary"
          label={actionLabel}
          onPress={onAction}
          style={styles.actionButton}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  message: {
    marginBottom: spacing.md,
    maxWidth: 360,
  },
  actionButton: {
    marginTop: spacing.xs,
  },
});

export default EmptyState;
