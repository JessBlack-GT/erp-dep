import React from 'react';
import PropTypes from 'prop-types';
import { View, Text } from 'react-native';
import { styles } from './shared';
export function SaleTotals({ sale, dirty = false }) {
  if (!sale)
    return <Text>Los totales se calcularán al guardar el borrador.</Text>;
  return (
    <View style={styles.card}>
      <Text>
        {dirty
          ? 'Totales del último guardado; guarda para actualizar.'
          : 'Totales de la venta'}
      </Text>
      {[
        ['subtotal', 'Subtotal'],
        ['discount', 'Descuento'],
        ['tax', 'Impuestos'],
        ['total', 'Total'],
      ].map(([key, label]) => (
        <Text key={key}>
          {label}: {sale[key]} {sale.currency}
        </Text>
      ))}
    </View>
  );
}
SaleTotals.propTypes = { sale: PropTypes.object, dirty: PropTypes.bool };
