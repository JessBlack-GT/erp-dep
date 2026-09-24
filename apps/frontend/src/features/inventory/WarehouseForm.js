import React, { useState } from 'react';
import { ScrollView, Text, TextInput, Button } from 'react-native';
import { inventoryService as api } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { styles, message } from './shared';
export function WarehouseForm({ navigation }) {
  const can = usePermissions(),
    [data, setData] = useState({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  if (!can('inventory.warehouse.manage'))
    return <Text>Sin permiso para administrar almacenes</Text>;
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.createWarehouse(data);
      navigation.goBack();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Nuevo almacén</Text>
      {[
        ['code', 'Código'],
        ['name', 'Nombre del almacén'],
        ['description', 'Descripción'],
        ['location', 'Ubicación'],
      ].map(([key, label]) => (
        <TextInput
          key={key}
          accessibilityLabel={label}
          placeholder={label}
          style={styles.input}
          value={data[key] || ''}
          onChangeText={(value) => setData({ ...data, [key]: value })}
        />
      ))}
      {error && <Text accessibilityRole="alert">{error}</Text>}
      <Button title="Guardar almacén" disabled={busy} onPress={save} />
    </ScrollView>
  );
}
