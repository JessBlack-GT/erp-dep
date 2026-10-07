import React from 'react';
import PropTypes from 'prop-types';
import { View, Text } from 'react-native';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { SalesSelector } from './SalesSelector';
import { styles, tracked } from './shared';
export function SaleLineEditor({ line, number, onChange, onRemove, disabled }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Línea {number}</Text>
      <SalesSelector
        kind="product"
        label={`Producto ${number}`}
        value={line.product}
        disabled={disabled}
        onSelect={(product) =>
          onChange({
            ...line,
            product,
            warehouse: null,
            unitPrice: product?.price != null ? String(product.price) : '',
          })
        }
      />
      {line.product && (
        <Text style={styles.muted}>
          {line.product.sku} · {line.product.type} · {line.product.unit}
        </Text>
      )}
      {[
        ['quantity', 'Cantidad'],
        ['unitPrice', 'Precio'],
        ['discountRate', 'Descuento %'],
        ['taxRate', 'Impuesto %'],
      ].map(([key, label]) => (
        <Input
          key={key}
          label={`${label} ${number}`}
          accessibilityLabel={`${label} ${number}`}
          keyboardType="decimal-pad"
          value={line[key]}
          disabled={disabled}
          onChangeText={(value) => onChange({ ...line, [key]: value })}
        />
      ))}
      {tracked(line.product) && (
        <>
          <Text style={styles.muted}>
            Almacén obligatorio para confirmar. Puede quedar pendiente en el
            borrador.
          </Text>
          <SalesSelector
            kind="warehouse"
            label={`Almacén ${number}`}
            value={line.warehouse}
            disabled={disabled}
            onSelect={(warehouse) => onChange({ ...line, warehouse })}
          />
        </>
      )}
      <Button
        label={`Eliminar línea ${number}`}
        variant="secondary"
        disabled={disabled}
        onPress={onRemove}
      />
    </View>
  );
}
SaleLineEditor.propTypes = {
  line: PropTypes.object.isRequired,
  number: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
