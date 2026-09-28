/**
 * ============================================
 * YJ NEXO ERP - StatCard Component
 * ============================================
 * KPI summary card for dashboards and overview modules.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card } from './Card';
import { Text } from './Text';
import { semanticColors, spacing } from '../../theme';

export function StatCard({
  label,
  value,
  description,
  icon,
  trend,
  status = 'default',
  onPress,
  style,
  testID,
}) {
  const isInteractive = typeof onPress === 'function';

  const trendColor = trend?.direction === 'up'
    ? semanticColors.status.success
    : trend?.direction === 'down'
    ? semanticColors.status.error
    : semanticColors.text.muted;

  const statusBorder = status !== 'default' && semanticColors.status[status]
    ? semanticColors.status[status]
    : undefined;

  return (
    <Card
      variant={isInteractive ? 'interactive' : 'elevated'}
      onPress={onPress}
      style={[
        styles.card,
        statusBorder ? { borderLeftWidth: 4, borderLeftColor: statusBorder } : null,
        style,
      ]}
      testID={testID}
    >
      <View style={styles.headerRow}>
        <Text variant="caption" color="muted" numberOfLines={1} style={styles.label}>
          {label}
        </Text>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
      </View>

      <Text variant="heading1" color="primary" weight="bold" style={styles.value}>
        {value}
      </Text>

      {(description || trend) && (
        <View style={styles.footerRow}>
          {trend && (
            <Text variant="caption" style={{ color: trendColor, fontWeight: '600', marginRight: spacing.xs }}>
              {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.value}
            </Text>
          )}
          {description && (
            <Text variant="caption" color="muted" numberOfLines={1}>
              {description}
            </Text>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 160,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  iconContainer: {
    marginLeft: spacing.xs,
  },
  value: {
    marginVertical: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
});

export default StatCard;
