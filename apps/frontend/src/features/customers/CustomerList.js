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
} from 'react-native';

export function CustomerListItem({ customer, onPress }) {
  const statusColor = customer.status === 'active' ? '#4CAF50' : '#9E9E9E';

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
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '600', color: '#212121', flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  email: { fontSize: 14, color: '#757575', marginTop: 4 },
  type: { fontSize: 12, color: '#9E9E9E', marginTop: 4 },
});
