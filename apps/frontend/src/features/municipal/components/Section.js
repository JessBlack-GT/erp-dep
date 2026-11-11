/**
 * MuniERP IA — bloques de presentación compartidos por las vistas municipales (detalle F1-13,
 * bitácora F1-14, administración F1-15a).
 *
 * Jerarquía de encabezados (revisión F1-15a): RN Web 0.19 convierte TODO `accessibilityRole="header"`
 * sin `aria-level` en <h1>. Se fija el nivel explícitamente: título de pantalla = 1, sección = 2,
 * subsección = 3. Los botones contiguos se separan con `ButtonRow` (antes quedaban pegados).
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

/** Encabezado con nivel semántico explícito (1–3) y variante visual acorde. */
export function Heading({ level = 2, children, testID, ...props }) {
  const variant = level === 1 ? 'heading2' : 'heading3';
  return (
    <Text variant={variant} accessibilityRole="header" aria-level={level} testID={testID} {...props}>
      {children}
    </Text>
  );
}

export function Section({ title, children, testID, level = 2 }) {
  return (
    <Card style={styles.section} testID={testID}>
      <Heading level={level}>{title}</Heading>
      {children}
    </Card>
  );
}

/** Fila de botones con separación horizontal y vertical (se envuelve en pantallas angostas). */
export function ButtonRow({ children, testID, style }) {
  return (
    <View style={[styles.buttonRow, style]} testID={testID}>
      {React.Children.toArray(children).filter(Boolean).map((child, i) => (
        <View key={i} style={styles.buttonCell}>{child}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  field: { marginTop: spacing.sm },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: spacing.sm, marginHorizontal: -spacing.xs },
  buttonCell: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
});
