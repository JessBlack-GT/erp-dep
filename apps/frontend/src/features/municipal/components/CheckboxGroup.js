/**
 * MuniERP IA — grupo de casillas accesible (selección múltiple), gemelo de OptionGroup (F1-15a).
 * role="checkbox" con aria-checked explícito (RN Web 0.19 no lo traduce desde accessibilityState) y
 * Espacio para alternar en web. Objetivos táctiles ≥ 44 px; estado también en texto (✓).
 */
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../../components/common';
import { semanticColors, spacing, radius } from '../../../theme';

const isSpace = (e) => {
  const key = e && e.nativeEvent ? e.nativeEvent.key : undefined;
  return key === ' ' || key === 'Spacebar';
};

export function CheckboxGroup({ label, options, values = [], onChange, error, testID, hint }) {
  const toggle = (v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <View style={styles.group} accessibilityRole="group" accessibilityLabel={label} testID={testID}>
      <Text variant="label" weight="bold">{label}</Text>
      {hint ? <Text variant="caption" color="secondary">{hint}</Text> : null}
      <View style={styles.row}>
        {options.map((o) => {
          const checked = values.includes(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              aria-checked={checked}
              accessibilityLabel={o.label}
              onPress={() => toggle(o.value)}
              onKeyDown={(e) => {
                if (!isSpace(e)) return;
                if (e.preventDefault) e.preventDefault();
                toggle(o.value);
              }}
              style={[styles.option, checked && styles.checked]}
              testID={testID ? `${testID}-${o.value}` : undefined}
            >
              <Text color={checked ? 'inverse' : 'primary'}>{checked ? `☑ ${o.label}` : `☐ ${o.label}`}</Text>
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
  checked: { backgroundColor: semanticColors.brand.blue, borderColor: semanticColors.brand.blue },
});

export default CheckboxGroup;
