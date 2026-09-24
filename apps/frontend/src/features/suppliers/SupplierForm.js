import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Button,
  ActivityIndicator,
} from 'react-native';
import { supplierService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { fields, styles, message } from './shared';
export function SupplierForm({ route, navigation }) {
  const id = route.params?.supplierId,
    can = usePermissions(),
    allowed = can(id ? 'suppliers.update' : 'suppliers.create');
  const [data, setData] = useState({ type: 'legal' }),
    [loading, setLoading] = useState(!!id),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(null),
    [loaded, setLoaded] = useState(!id);
  async function load() {
    setLoading(true);
    try {
      const r = await supplierService.getById(id);
      setData(
        Object.fromEntries([
          ...fields.map(([key]) => [key, r.data.data[key] || '']),
          ['type', r.data.data.type],
        ]),
      );
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (id && allowed) load();
  }, [id, allowed]);
  async function save() {
    if (!allowed || saving || !loaded) return;
    if (!data.name?.trim()) {
      setError('Nombre requerido');
      return;
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      setError('Email inválido');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (id) {
        await supplierService.update(id, data);
        navigation.goBack();
      } else {
        const r = await supplierService.create(data);
        navigation.replace('SupplierDetail', { id: r.data.data._id });
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  if (!allowed)
    return (
      <Text accessibilityRole="alert">
        Sin permiso para guardar proveedores
      </Text>
    );
  if (loading)
    return <ActivityIndicator accessibilityLabel="Cargando proveedor" />;
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {id ? 'Editar proveedor' : 'Nuevo proveedor'}
      </Text>
      {fields.map(([key, label, maxLength]) => (
        <View key={key}>
          <Text>
            {label}
            {key === 'name' ? ' *' : ''}
          </Text>
          <TextInput
            accessibilityLabel={label}
            placeholder={label}
            style={styles.input}
            value={data[key] || ''}
            maxLength={maxLength}
            multiline={['notes', 'address'].includes(key)}
            autoCapitalize={key === 'email' ? 'none' : 'sentences'}
            onChangeText={(value) => setData({ ...data, [key]: value })}
          />
        </View>
      ))}
      <View style={styles.row}>
        {['natural', 'legal'].map((type, i) => (
          <Button
            key={type}
            title={['Persona', 'Empresa'][i] + (data.type === type ? ' ✓' : '')}
            onPress={() => setData({ ...data, type })}
          />
        ))}
      </View>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!loaded && <Button title="Reintentar" onPress={load} />}
      {saving && <ActivityIndicator accessibilityLabel="Guardando proveedor" />}
      <Button
        title={id ? 'Guardar cambios' : 'Registrar proveedor'}
        disabled={saving || !loaded}
        onPress={save}
      />
    </ScrollView>
  );
}
