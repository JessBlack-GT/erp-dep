/**
 * ============================================
 * YJ NEXO ERP - Breadcrumbs Component
 * ============================================
 * Contextual page navigation path indicator.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../common/Text';
import { semanticColors, spacing } from '../../theme';

export function Breadcrumbs({
  items = [],
  currentTitle,
  onNavigate,
  style,
  testID,
}) {
  const breadcrumbList = items.length > 0
    ? items
    : [
        { label: 'Inicio', route: 'Dashboard' },
        currentTitle ? { label: currentTitle } : null,
      ].filter(Boolean);

  return (
    <View style={[styles.container, style]} testID={testID || 'breadcrumbs-container'}>
      {breadcrumbList.map((item, index) => {
        const isLast = index === breadcrumbList.length - 1;
        return (
          <View key={index} style={styles.itemRow}>
            {index > 0 && (
              <Text variant="caption" color="muted" style={styles.separator}>
                /
              </Text>
            )}
            {!isLast && item.route && onNavigate ? (
              <TouchableOpacity
                onPress={() => onNavigate(item.route)}
                accessibilityRole="button"
                accessibilityLabel={`Ir a ${item.label}`}
              >
                <Text variant="bodySmall" color="link" weight="medium">
                  {item.label}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text
                variant="bodySmall"
                color={isLast ? 'primary' : 'muted'}
                weight={isLast ? 'semibold' : 'regular'}
              >
                {item.label}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    marginHorizontal: spacing.xs,
  },
});

export default Breadcrumbs;
