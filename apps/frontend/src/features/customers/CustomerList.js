/**
 * ============================================
 * ERP-SYSTEM - Componente de Lista de Cliente
 * ============================================
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { semanticColors, spacing, radius, typographyScale } from '../../theme';

export function CustomerListItem({ customer, onPress }) {
  const statusColor =
    customer.status === 'active'
      ? '#047857'
      : '#475569';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.name}>
          {customer.businessName || `${customer.name} ${customer.lastName || ''}`}
        </Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>
      <Text style={styles.email}>{customer.email}</Text>
      <Text style={styles.type}>
        {customer.type === 'legal' ? 'Empresa' : 'Persona'} · {customer.status}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: semanticColors.surface.primary,
    borderRadius: radius.medium,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
    ...(Platform.OS === 'web' && {
      elevation: 0,
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: semanticColors.text.primary,
    flex: 1,
    ...(Platform.OS === 'web' && {
      ...typographyScale.subtitle,
    }),
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  email: {
    fontSize: 14,
    color: semanticColors.text.secondary,
    marginTop: spacing.xs,
  },
  type: {
    fontSize: 12,
    color: '#475569',
    marginTop: spacing.xs,
  },
});
