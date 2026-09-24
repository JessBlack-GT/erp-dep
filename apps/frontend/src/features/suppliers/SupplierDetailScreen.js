import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Button,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { supplierService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { fields, styles, message } from './shared';
export function SupplierDetailScreen({ route, navigation }) {
  const id = route.params?.id,
    can = usePermissions(),
    read = can('suppliers.read');
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [confirm, setConfirm] = useState(false);
  async function load() {
    if (!read) return;
    setLoading(true);
    try {
      const r = await supplierService.getById(id);
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
    if (busy || !can(remove ? 'suppliers.delete' : 'suppliers.update')) return;
    setBusy(true);
    setError(null);
    try {
      if (remove) {
        await supplierService.delete(id);
        setConfirm(false);
        navigation.navigate('Suppliers');
      } else {
        const r = await supplierService.changeStatus(
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
        Sin permiso para consultar proveedores
      </Text>
    );
  if (loading)
    return <ActivityIndicator accessibilityLabel="Cargando proveedor" />;
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
          <Text>{data.type === 'legal' ? 'Empresa' : 'Persona'}</Text>
          {fields
            .filter(([key]) => key !== 'name' && data[key])
            .map(([key, label]) => (
              <View style={styles.card} key={key}>
                <Text>{label}</Text>
                <Text>{data[key]}</Text>
              </View>
            ))}
          <View style={styles.row}>
            {can('suppliers.update') && (
              <>
                <Button
                  title="Editar proveedor"
                  disabled={busy}
                  onPress={() =>
                    navigation.navigate('SupplierForm', { supplierId: id })
                  }
                />
                <Button
                  title={
                    data.status === 'active'
                      ? 'Desactivar proveedor'
                      : 'Activar proveedor'
                  }
                  disabled={busy}
                  onPress={() => action()}
                />
              </>
            )}
            {can('suppliers.delete') && (
              <Button
                title="Eliminar proveedor"
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
                <Text>¿Eliminar lógicamente este proveedor?</Text>
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
