import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Button,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { productService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { fields, styles, message } from './shared';
export function ProductDetailScreen({ route, navigation }) {
  const id = route.params?.id,
    can = usePermissions(),
    read = can('products.read');
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [confirm, setConfirm] = useState(false);
  async function load() {
    if (!read) return;
    setLoading(true);
    try {
      const r = await productService.getById(id);
      setData(r.data.data);
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [id, read]);
  useEffect(
    () => navigation?.addListener?.('focus', load),
    [id, read, navigation],
  );
  async function action(remove = false) {
    if (busy || !can(remove ? 'products.delete' : 'products.update')) return;
    setBusy(true);
    setError(null);
    try {
      if (remove) {
        await productService.delete(id);
        setConfirm(false);
        navigation.navigate('Products');
      } else {
        const r = await productService.changeStatus(
          id,
          data.status === 'active' ? 'inactive' : 'active',
        );
        setData(r.data.data);
      }
    } catch (e) {
      setConfirm(false);
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (!read)
    return (
      <Text accessibilityRole="alert">
        Sin permiso para consultar elementos
      </Text>
    );
  if (loading)
    return <ActivityIndicator accessibilityLabel="Cargando elemento" />;
  return (
    <ScrollView style={styles.container}>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!data ? (
        <Button title="Reintentar" onPress={load} />
      ) : (
        <>
          <Text style={styles.title}>{data.name}</Text>
          <Text>{data.status === 'active' ? 'Activo' : 'Inactivo'}</Text>
          <Text>{data.type}</Text>
          {fields
            .filter(([key]) => key !== 'name' && data[key])
            .map(([key, label]) => (
              <View style={styles.card} key={key}>
                <Text>{label}</Text>
                <Text>{data[key]}</Text>
              </View>
            ))}
          <View style={styles.row}>
            {can('products.update') && (
              <>
                <Button
                  title="Editar elemento"
                  disabled={busy}
                  onPress={() =>
                    navigation.navigate('ProductForm', { productId: id })
                  }
                />
                <Button
                  title={
                    data.status === 'active'
                      ? 'Desactivar elemento'
                      : 'Activar elemento'
                  }
                  disabled={busy}
                  onPress={() => action()}
                />
              </>
            )}
            {can('products.delete') && (
              <Button
                title="Eliminar elemento"
                disabled={busy}
                onPress={() => setConfirm(true)}
              />
            )}
          </View>
          <Modal
            visible={confirm}
            transparent
            onRequestClose={() => !busy && setConfirm(false)}
          >
            <View style={styles.overlay}>
              <View style={styles.card}>
                <Text>¿Eliminar lógicamente este elemento?</Text>
                <Button
                  title="Cancelar"
                  disabled={busy}
                  onPress={() => setConfirm(false)}
                />
                <Button
                  title="Confirmar eliminación"
                  disabled={busy}
                  onPress={() => action(true)}
                />
              </View>
            </View>
          </Modal>
        </>
      )}
    </ScrollView>
  );
}
