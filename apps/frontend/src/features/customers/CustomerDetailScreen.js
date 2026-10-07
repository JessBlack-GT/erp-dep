/**
 * ============================================
 * ERP-SYSTEM - Pantalla de Detalle de Cliente
 * ============================================
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { ActionButton as Button } from '../../components/common/ActionButton';
import { usePermissions } from '../../hooks/usePermissions';
import { customerService } from '../../services/api';
import { semanticColors, spacing, radius, typographyScale } from '../../theme';

export function CustomerDetailScreen({ route, navigation }) {
  const { id } = route.params || {};
  const can = usePermissions();
  const canRead = can('customers.read');
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (navigation?.addListener) return navigation.addListener('focus', loadCustomer);
  }, [navigation, id]);

  useEffect(() => {
    loadCustomer();
  }, [id]);

  const loadCustomer = async () => {
    if (!canRead) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await customerService.getById(id);
      setCustomer(result.data?.data || result.data);
      setError(null);
    } catch (err) {
      setError('No se pudo cargar el cliente');
    } finally {
      setLoading(false);
    }
  };

  const changeStatus = async () => {
    if (updatingStatus || !can('customers.update')) return;
    setUpdatingStatus(true);
    try {
      const status = customer.status === 'active' ? 'inactive' : 'active';
      const response = await customerService.changeStatus(id, status);
      setCustomer(response.data.data);
    } catch (err) {
      setActionError('No se pudo cambiar el estado');
      Alert.alert('Error', err.response?.data?.error || 'No se pudo cambiar el estado');
    } finally { setUpdatingStatus(false); }
  };

  const handleEdit = () => {
    navigation.navigate('CustomerForm', { customerId: id });
  };

  const deleteCustomer = async () => {
    if (deleting || !can('customers.delete')) return;
    setDeleting(true);
    setActionError(null);
    try {
      await customerService.delete(id);
      setConfirmDelete(false);
      navigation.goBack();
    } catch (err) {
      setConfirmDelete(false);
      setActionError('No se pudo eliminar el cliente');
    } finally { setDeleting(false); }
  };

  const handleDelete = () => {
    if (!can('customers.delete')) return;
    if (Platform.OS === 'web') { setConfirmDelete(true); return; }
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de eliminar este cliente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: deleteCustomer,
        },
      ]
    );
  };

  if (!canRead) return <Text accessibilityRole="alert">Sin permiso para consultar clientes</Text>;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size="large"
          color={semanticColors.brand.blue}
        />
      </View>
    );
  }

  if (error || !customer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadError}>
          {error || 'Cliente no encontrado'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={loadCustomer}>
          <Text style={styles.buttonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {customer.businessName || `${customer.name} ${customer.lastName || ''}`}
      </Text>
      <View style={styles.statusContainer}>
        <Text style={[styles.status, { color: customer.status === 'active' ? '#047857' : '#475569' }]}>
          {customer.status.toUpperCase()}
        </Text>
        <Text style={styles.type}>
          {customer.type === 'legal' ? 'Empresa' : 'Persona'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información de Contacto</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{customer.email}</Text>
        </View>
        {customer.phone && (
          <View style={styles.row}>
            <Text style={styles.label}>Teléfono:</Text>
            <Text style={styles.value}>{customer.phone}</Text>
          </View>
        )}
        {customer.documentNumber && (
          <View style={styles.row}>
            <Text style={styles.label}>Documento:</Text>
            <Text style={styles.value}>{customer.documentNumber}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dirección</Text>
        {customer.address && (
          <Text style={styles.value}>{customer.address}</Text>
        )}
        {customer.city && (
          <View style={styles.row}>
            <Text style={styles.label}>Ciudad:</Text>
            <Text style={styles.value}>{customer.city}</Text>
          </View>
        )}
        {customer.zipCode && (
          <View style={styles.row}>
            <Text style={styles.label}>Código Postal:</Text>
            <Text style={styles.value}>{customer.zipCode}</Text>
          </View>
        )}
      </View>

      {customer.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notas</Text>
          <Text style={styles.value}>{customer.notes}</Text>
        </View>
      )}

      {actionError && <Text accessibilityRole="alert">{actionError}</Text>}
      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => !deleting && setConfirmDelete(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.section} accessibilityViewIsModal>
            <Text style={styles.sectionTitle}>¿Estás seguro de eliminar este cliente?</Text>
            <Button variant={Platform.OS === 'web' ? 'primary' : 'secondary'} title="Cancelar" disabled={deleting} onPress={() => setConfirmDelete(false)} />
            <Button variant={Platform.OS === 'web' ? 'primary' : 'danger'} title="Confirmar eliminación" disabled={deleting} onPress={deleteCustomer} />
          </View>
        </View>
      </Modal>
      <View style={styles.buttonRow}>
        {can('customers.update') && <Button style={styles.actionButton} title={customer.status === 'active' ? 'Desactivar' : 'Activar'} onPress={changeStatus} disabled={updatingStatus} />}
        {can('customers.update') && <TouchableOpacity activeOpacity={0.75} style={styles.editButton} onPress={handleEdit}>
          <Text style={styles.editButtonText}>Editar</Text>
        </TouchableOpacity>}
        {can('customers.delete') && <TouchableOpacity activeOpacity={0.75} style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Eliminar</Text>
        </TouchableOpacity>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  confirmOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    ...(Platform.OS === 'web' && {
      padding: spacing.md,
      backgroundColor: semanticColors.surface.overlay,
    }),
  },
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: semanticColors.background.primary,
    ...(Platform.OS === 'web' && {
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: semanticColors.background.primary,
    }),
  },
  title: {
    ...typographyScale.heading2,
    color: semanticColors.brand.navy,
    marginBottom: spacing.sm,
    ...(Platform.OS === 'web' && {
    }),
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    ...(Platform.OS === 'web' && {
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    }),
  },
  status: { fontSize: 14, fontWeight: '600' },
  type: {
    fontSize: 14,
    color: semanticColors.text.secondary,
  },
  section: {
    backgroundColor: semanticColors.surface.primary,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
    borderRadius: radius.medium,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...(Platform.OS === 'web' && {
    }),
  },
  sectionTitle: {
    ...typographyScale.title,
    color: semanticColors.text.primary,
    marginBottom: spacing.sm,
    ...(Platform.OS === 'web' && {
    }),
  },
  row: { flexDirection: 'row', marginBottom: 8 },
  label: {
    fontSize: 14,
    color: semanticColors.text.secondary,
    width: 120,
  },
  value: {
    fontSize: 14,
    color: semanticColors.text.primary,
    flex: 1,
  },
  loadError: { color: Platform.OS === 'web' ? '#D32F2F' : '#B42318' },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
    ...(Platform.OS === 'web' && {
      gap: spacing.sm,
      marginTop: spacing.md,
    }),
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 120,
  },
  editButton: {
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 120,
    backgroundColor: semanticColors.interactive.primary,
    padding: spacing.md,
    borderRadius: radius.medium,
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      minWidth: 120,
      minHeight: 40,
      justifyContent: 'center',
    }),
  },
  editButtonText: { color: '#FFF', fontWeight: '600' },
  deleteButton: {
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 120,
    backgroundColor: '#B42318',
    padding: spacing.md,
    borderRadius: radius.medium,
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      minWidth: 120,
      minHeight: 40,
      justifyContent: 'center',
    }),
  },
  deleteButtonText: { color: '#FFF', fontWeight: '600' },
  button: {
    backgroundColor: semanticColors.interactive.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    borderRadius: radius.medium,
  },
  buttonText: { color: '#FFF', fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
