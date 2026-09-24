import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Button,
  ActivityIndicator,
} from 'react-native';
import { productService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { fields, styles, message } from './shared';
export function ProductForm({ route, navigation }) {
  const id = route.params?.productId,
    can = usePermissions(),
    allowed = can(id ? 'products.update' : 'products.create');
  const [data, setData] = useState({ type: 'PRODUCT', trackInventory: false }),
    [loading, setLoading] = useState(!!id),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(null),
    [loaded, setLoaded] = useState(!id);
  async function load() {
    setLoading(true);
    try {
      const r = await productService.getById(id);
      setData(
        Object.fromEntries([
          ...fields.map(([key]) => [key, r.data.data[key] || '']),
          ['type', r.data.data.type],
          ['trackInventory', !!r.data.data.trackInventory],
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
    if (!data.sku?.trim()) {
      setError('SKU requerido');
      return;
    }
    for (const key of ['price', 'cost'])
      if (
        data[key] &&
        !/^(0|[1-9]\d{0,11})(\.\d{1,4})?$/.test(data[key].trim())
      ) {
        setError('Importe inválido');
        return;
      }
    setSaving(true);
    setError(null);
    try {
      if (id) {
        await productService.update(id, data);
        navigation.goBack();
      } else {
        const r = await productService.create(data);
        navigation.replace('ProductDetail', { id: r.data.data._id });
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  if (!allowed)
    return (
      <Text accessibilityRole="alert">Sin permiso para guardar elementos</Text>
    );
  if (loading)
    return <ActivityIndicator accessibilityLabel="Cargando elemento" />;
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {id ? 'Editar elemento' : 'Nuevo elemento'}
      </Text>
      {fields
        .filter(([key]) => data.type === 'PRODUCT' || key !== 'barcode')
        .map(([key, label, maxLength]) => (
          <View key={key}>
            <Text>
              {label}
              {['name', 'sku'].includes(key) ? ' *' : ''}
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
        {['PRODUCT', 'SERVICE'].map((type, i) => (
          <Button
            key={type}
            title={
              ['Producto', 'Servicio'][i] + (data.type === type ? ' ✓' : '')
            }
            onPress={() =>
              setData({
                ...data,
                type,
                ...(type === 'SERVICE'
                  ? { barcode: '', trackInventory: false }
                  : {}),
              })
            }
          />
        ))}
      </View>
      {data.type === 'PRODUCT' && (
        <Button
          title={
            'Seguimiento futuro de inventario: ' +
            (data.trackInventory ? 'Sí' : 'No')
          }
          onPress={() =>
            setData({ ...data, trackInventory: !data.trackInventory })
          }
        />
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!loaded && <Button title="Reintentar" onPress={load} />}
      {saving && <ActivityIndicator accessibilityLabel="Guardando elemento" />}
      <Button
        title={id ? 'Guardar cambios' : 'Registrar elemento'}
        disabled={saving || !loaded}
        onPress={save}
      />
    </ScrollView>
  );
}
