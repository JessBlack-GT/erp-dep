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
  Button,
  Modal,
  Platform,
} from 'react-native';
import { customerService } from '../../services/api';

export function CustomerDetailScreen({ route, navigation }) {
  const { id } = route.params || {};
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
    if (updatingStatus) return;
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
    if (deleting) return;
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  if (error || !customer) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#D32F2F' }}>{error || 'Cliente no encontrado'}</Text>
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
        <Text style={[styles.status, { color: customer.status === 'active' ? '#4CAF50' : '#9E9E9E' }]}>
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
            <Button title="Cancelar" disabled={deleting} onPress={() => setConfirmDelete(false)} />
            <Button title="Confirmar eliminación" disabled={deleting} onPress={deleteCustomer} />
          </View>
        </View>
      </Modal>
      <View style={styles.buttonRow}>
        <Button title={customer.status === 'active' ? 'Desactivar' : 'Activar'} onPress={changeStatus} disabled={updatingStatus} />
        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Text style={styles.editButtonText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  confirmOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.4)' },
  container: { flex: 1, padding: 16, backgroundColor: '#F5F5F5' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#212121', marginBottom: 12 },
  statusContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  status: { fontSize: 14, fontWeight: '600' },
  type: { fontSize: 14, color: '#757575' },
  section: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#424242', marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 8 },
  label: { fontSize: 14, color: '#757575', width: 120 },
  value: { fontSize: 14, color: '#212121', flex: 1 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  editButton: { flex: 1, backgroundColor: '#1976D2', padding: 16, borderRadius: 8, alignItems: 'center' },
  editButtonText: { color: '#FFF', fontWeight: '600' },
  deleteButton: { flex: 1, backgroundColor: '#D32F2F', padding: 16, borderRadius: 8, alignItems: 'center' },
  deleteButtonText: { color: '#FFF', fontWeight: '600' },
  button: { backgroundColor: '#1976D2', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#FFF', fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
