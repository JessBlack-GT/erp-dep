/**
 * MuniERP IA — tablero de indicadores (RQ04). Muestra exactamente las cifras que entrega la API
 * (calculadas sobre el alcance del usuario); no recalcula ni estima en el cliente.
 */
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Card, Text } from '../../../components/common';
import { spacing } from '../../../theme';
import { indicatorColumns } from '../model';

export function IndicatorsPanel({ data, testID = 'municipal-indicators', headingLevel = 2 }) {
  const { width } = useWindowDimensions();
  if (!data) return null;
  const columns = indicatorColumns(width);
  const cards = [
    { key: 'total', label: 'Solicitudes en su alcance', value: data.total },
    { key: 'open', label: 'Abiertas', value: data.open },
    { key: 'closed', label: 'Concluidas en el periodo', value: data.closedInPeriod },
    { key: 'overdue', label: 'Abiertas fuera de plazo', value: data.overdueOpen, status: data.overdueOpen > 0 ? 'warning' : 'default' },
  ];
  return (
    <View testID={testID} accessibilityRole="summary">
      <Text variant="heading3" accessibilityRole="header" aria-level={headingLevel}>Indicadores</Text>
      <View style={styles.grid}>
        {cards.map((c) => (
          <View key={c.key} style={{ width: `${100 / columns}%`, padding: spacing.xs }}>
            {/* F1-15a: tarjeta propia en lugar de StatCard (núcleo), cuyo valor se expone como <h1> en web. */}
            <Card testID={`indicator-${c.key}`}>
              <Text variant="caption" color="secondary">{c.label}</Text>
              <Text variant="heading2" accessibilityRole="text" color={c.status === 'warning' ? 'warning' : 'primary'}>{String(c.value ?? 0)}</Text>
            </Card>
          </View>
        ))}
      </View>
      <Text variant="caption" color="secondary">
        {data.avgResolutionDays == null ? 'Tiempo medio de atención: sin solicitudes concluidas en el periodo.' : `Tiempo medio de atención: ${data.avgResolutionDays} días.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginVertical: spacing.sm },
});

export default IndicatorsPanel;
