/**
 * MuniERP IA — grupo de opciones accesible (radio). Objetivos táctiles ≥ 44 px, estado comunicado con
 * texto, accessibilityState y aria-checked; foco visible heredado de RN Web. Verificación con teclado: MT-90 (E2E).
 *
 * Hallazgos de Playwright (2026-11-09) corregidos aquí:
 *  - RN Web 0.19 no traduce accessibilityState.checked a aria-checked → atributo explícito.
 *  - Espacio no activaba un role="radio" en RN Web (solo Enter) → manejo explícito de Espacio en web.
 */

/** Espacio/Enter activan la opción en web; en Android onKeyDown no existe y no tiene efecto. */
function keyActivates(e) {
  const key = e && e.nativeEvent ? e.nativeEvent.key : undefined;
  return key === ' ' || key === 'Spacebar';
}
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../../components/common';
import { semanticColors, spacing, radius } from '../../../theme';

export function OptionGroup({ label, options, value, onChange, error, testID }) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label} testID={testID}>
      <Text variant="label" weight="bold">{label}</Text>
      <View style={styles.row}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              onKeyDown={(e) => {
                if (!keyActivates(e)) return;
                if (e.preventDefault) e.preventDefault();
                onChange(o.value);
              }}
              style={[styles.option, selected && styles.selected]}
              testID={testID ? `${testID}-${o.value}` : undefined}
            >
              <Text color={selected ? 'inverse' : 'primary'}>{selected ? `✓ ${o.label}` : o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text color="error" accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  option: {
    minHeight: 44, minWidth: 44, paddingHorizontal: spacing.md, justifyContent: 'center',
    borderWidth: 1, borderColor: semanticColors.border.default, borderRadius: radius.medium,
    marginRight: spacing.sm, marginBottom: spacing.sm, backgroundColor: semanticColors.surface.primary,
  },
  selected: { backgroundColor: semanticColors.brand.blue, borderColor: semanticColors.brand.blue },
});

export default OptionGroup;
