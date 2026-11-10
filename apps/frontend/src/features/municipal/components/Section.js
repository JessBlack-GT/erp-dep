/**
 * MuniERP IA — bloques de presentación compartidos por las vistas municipales (detalle F1-13,
 * bitácora F1-14): sección con encabezado accesible y campo etiqueta/valor.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from '../../../components/common';
import { spacing } from '../../../theme';

export function Field({ label, value, testID }) {
  return (
    <View style={styles.field} testID={testID}>
      <Text variant="caption" color="secondary">{label}</Text>
      <Text>{value || '—'}</Text>
    </View>
  );
}

export function Section({ title, children, testID }) {
  return (
    <Card style={styles.section} testID={testID}>
      <Text variant="heading3" accessibilityRole="header">{title}</Text>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  field: { marginTop: spacing.sm },
});
