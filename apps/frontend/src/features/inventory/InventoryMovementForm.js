import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { inventoryService as api } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { InventorySelector, WarehouseSelector } from './InventorySelector';
import { styles, message, operations } from './shared';
export function InventoryMovementForm({ route, navigation }) {
  const type = route?.params?.type || 'ENTRY',
    operation = operations[type],
    can = usePermissions();
  const [product, setProduct] = useState(null),
    [source, setSource] = useState(null),
    [destination, setDestination] = useState(null),
    [quantity, setQuantity] = useState(''),
    [reason, setReason] = useState(''),
    [reference, setReference] = useState(''),
    [notes, setNotes] = useState(''),
    [error, setError] = useState(''),
    [confirmation, setConfirmation] = useState(false),
    [loading, setLoading] = useState(false),
    [result, setResult] = useState(null);
  const attempt = useRef(null),
    busy = useRef(false);
  const negative = quantity.startsWith('-'),
    needsSource =
      ['EXIT', 'TRANSFER'].includes(type) ||
      (type === 'ADJUSTMENT' && negative),
    needsDestination =
      ['ENTRY', 'TRANSFER'].includes(type) ||
      (type === 'ADJUSTMENT' && !negative);
  if (!operation || !can('inventory.' + operation[1]))
    return (
      <Text accessibilityRole="alert">
        Sin permiso para registrar este movimiento
      </Text>
    );
  function payload() {
    return {
      type,
      productId: product?._id,
      quantity,
      reason: reason.trim(),
      reference: reference.trim(),
      notes: notes.trim(),
      ...(needsSource ? { sourceWarehouseId: source?._id } : {}),
      ...(needsDestination ? { destinationWarehouseId: destination?._id } : {}),
    };
  }
  function review() {
    setError('');
    if (
      !product ||
      !reason.trim() ||
      (needsSource && !source) ||
      (needsDestination && !destination)
    ) {
      setError('Completa producto, almacén y motivo');
      return;
    }
    if (
      !/^-?(0|[1-9]\d{0,8})(\.\d{1,4})?$/.test(quantity) ||
      Number(quantity) === 0 ||
      Math.abs(Number(quantity)) > 100000000 ||
      (type !== 'ADJUSTMENT' && negative)
    ) {
      setError('Cantidad inválida: hasta cuatro decimales, sin cero');
      return;
    }
    if (type === 'TRANSFER' && source._id === destination._id) {
      setError('Origen y destino deben ser distintos');
      return;
    }
    setConfirmation(true);
  }
  async function submit() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError('');
    const data = payload(),
      signature = JSON.stringify(data);
    // Keep the same key across network errors; edits create a new logical operation.
    if (attempt.current?.signature !== signature)
      attempt.current = {
        signature,
        key:
          'ui_' +
          Date.now().toString(36) +
          '_' +
          Math.random().toString(36).slice(2) +
          '_' +
          Math.random().toString(36).slice(2),
      };
    try {
      const r = await api.createMovement({
        ...data,
        idempotencyKey: attempt.current.key,
      });
      setResult(r.data.data);
      setConfirmation(false);
    } catch (e) {
      setError(message(e));
      setConfirmation(false);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  const summary =
    operation[0] +
    ' · ' +
    (product?.name || '') +
    ' · ' +
    quantity +
    ' · ' +
    (needsSource ? source?.name : 'Exterior') +
    ' → ' +
    (needsDestination ? destination?.name : 'Exterior');
  if (result)
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Movimiento aplicado</Text>
        <Text>{summary}</Text>
        <Text>
          Registrado: {result.quantity} · {result._id}
        </Text>
        <Button
          title="Volver a inventario"
          onPress={() => navigation.navigate('Inventory')}
        />
      </View>
    );
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{operation[0]} de inventario</Text>
      <InventorySelector
        kind="products"
        label="Producto"
        value={product}
        onSelect={setProduct}
      />
      <TextInput
        accessibilityLabel="Cantidad"
        placeholder={
          type === 'ADJUSTMENT'
            ? 'Delta positivo o negativo'
            : 'Cantidad positiva'
        }
        style={styles.input}
        value={quantity}
        onChangeText={setQuantity}
      />
      {needsSource && (
        <WarehouseSelector label="Origen" value={source} onSelect={setSource} />
      )}
      {needsDestination && (
        <WarehouseSelector
          label="Destino"
          value={destination}
          onSelect={setDestination}
        />
      )}
      {[
        ['Motivo', reason, setReason, 500],
        ['Referencia', reference, setReference, 200],
        ['Notas', notes, setNotes, 2000],
      ].map(([label, value, set, max]) => (
        <TextInput
          key={label}
          accessibilityLabel={label}
          placeholder={label}
          style={styles.input}
          value={value}
          maxLength={max}
          onChangeText={set}
        />
      ))}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {loading && (
        <ActivityIndicator accessibilityLabel="Aplicando movimiento" />
      )}
      <Button title="Revisar movimiento" disabled={loading} onPress={review} />
      <Modal
        visible={confirmation}
        transparent
        onRequestClose={() => !loading && setConfirmation(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>Confirmar movimiento</Text>
            <Text>{summary}</Text>
            <Text>Motivo: {reason}</Text>
            <Text>
              Se registrará de forma permanente. Las correcciones requieren otro
              movimiento.
            </Text>
            <Button
              title="Confirmar y aplicar"
              disabled={loading}
              onPress={submit}
            />
            <Button
              title="Cancelar"
              disabled={loading}
              onPress={() => setConfirmation(false)}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
export const InventoryTransferForm = InventoryMovementForm;
