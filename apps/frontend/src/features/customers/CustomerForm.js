/**
 * ============================================
 * ERP-SYSTEM - Pantalla de Formulario de Cliente
 * ============================================
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { usePermissions } from '../../hooks/usePermissions';
import { customerService } from '../../services/api';
import { isValidEmail } from '../../utils';

export function CustomerForm({ route, navigation }) {
  const { customerId } = route.params || {};
  const can = usePermissions();
  const canSubmit = can(customerId ? 'customers.update' : 'customers.create');
  const [loading, setLoading] = useState(!!customerId);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    businessName: '',
    type: 'natural',
    email: '',
    phone: '',
    documentType: '',
    documentNumber: '',
    address: '',
    city: '',
    country: 'Peru',
    zipCode: '',
    notes: '',
  });

  useEffect(() => {
    if (customerId && canSubmit) {
      loadCustomer(customerId);
    }
  }, [customerId]);

  const loadCustomer = async (id) => {
    try {
      const result = await customerService.getById(id);
      const customer = result.data?.data || result.data;
      setFormData({
        name: customer.name || '',
        lastName: customer.lastName || '',
        businessName: customer.businessName || '',
        type: customer.type || 'natural',
        email: customer.email || '',
        phone: customer.phone || '',
        documentType: customer.documentType || '',
        documentNumber: customer.documentNumber || '',
        address: customer.address || '',
        city: customer.city || '',
        country: customer.country || 'Peru',
        zipCode: customer.zipCode || '',
        notes: customer.notes || '',
      });
    } catch (err) {
      setSubmitError('No se pudo cargar el cliente');
      Alert.alert('Error', 'No se pudo cargar el cliente');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!isValidEmail(formData.email)) {
      newErrors.email = 'Formato de email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    if (!validateForm()) {
      Alert.alert('Error', 'Por favor, corrige los campos marcados');
      return;
    }

    try {
      setSubmitting(true);
      if (customerId) {
        await customerService.update(customerId, formData);
        Alert.alert('Éxito', 'Cliente actualizado correctamente');
      } else {
        await customerService.create(formData);
        Alert.alert('Éxito', 'Cliente registrado correctamente');
      }
      navigation.goBack();
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || 'Error al guardar';
      setSubmitError(typeof message === 'string' ? message : 'Error al guardar');
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canSubmit) return <Text accessibilityRole="alert">Sin permiso para guardar clientes</Text>;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {customerId ? 'Editar Cliente' : 'Nuevo Cliente'}
      </Text>

      <Text style={styles.label}>Nombre *</Text>
      <TextInput
        style={[styles.input, errors.name && styles.inputError]}
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
        placeholder="Nombre del cliente"
      />
      {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

      <Text style={styles.label}>Apellido</Text>
      <TextInput
        style={styles.input}
        value={formData.lastName}
        onChangeText={(text) => setFormData({ ...formData, lastName: text })}
        placeholder="Apellido"
      />

      <Text style={styles.label}>Razón Social</Text>
      <TextInput
        style={styles.input}
        value={formData.businessName}
        onChangeText={(text) => setFormData({ ...formData, businessName: text })}
        placeholder="Razón social (si es empresa)"
      />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.row}>
        {['natural', 'legal'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeButton,
              formData.type === type && styles.typeButtonActive,
            ]}
            onPress={() => setFormData({ ...formData, type })}
          >
            <Text style={[
              styles.typeButtonText,
              formData.type === type && styles.typeButtonTextActive,
            ]}>
              {type === 'natural' ? 'Persona' : 'Empresa'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Email *</Text>
      <TextInput
        style={[styles.input, errors.email && styles.inputError]}
        value={formData.email}
        onChangeText={(text) => setFormData({ ...formData, email: text })}
        placeholder="email@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

      <Text style={styles.label}>Teléfono</Text>
      <TextInput
        style={styles.input}
        value={formData.phone}
        onChangeText={(text) => setFormData({ ...formData, phone: text })}
        placeholder="+51 999 999 999"
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Tipo de Documento</Text>
      <TextInput
        style={styles.input}
        value={formData.documentType}
        onChangeText={(text) => setFormData({ ...formData, documentType: text })}
        placeholder="DNI, RUC, Pasaporte"
      />

      <Text style={styles.label}>Número de Documento</Text>
      <TextInput
        style={styles.input}
        value={formData.documentNumber}
        onChangeText={(text) => setFormData({ ...formData, documentNumber: text })}
        placeholder="Número de documento"
      />

      <Text style={styles.label}>Dirección</Text>
      <TextInput
        style={styles.input}
        value={formData.address}
        onChangeText={(text) => setFormData({ ...formData, address: text })}
        placeholder="Dirección completa"
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Ciudad</Text>
      <TextInput
        style={styles.input}
        value={formData.city}
        onChangeText={(text) => setFormData({ ...formData, city: text })}
        placeholder="Ciudad"
      />

      <Text style={styles.label}>Código Postal</Text>
      <TextInput
        style={styles.input}
        value={formData.zipCode}
        onChangeText={(text) => setFormData({ ...formData, zipCode: text })}
        placeholder="Código postal"
      />

      <Text style={styles.label}>Notas</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={formData.notes}
        onChangeText={(text) => setFormData({ ...formData, notes: text })}
        placeholder="Notas adicionales"
        multiline
        numberOfLines={4}
      />

      {submitError && <Text accessibilityRole="alert" style={styles.errorText}>{submitError}</Text>}
      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.submitButtonText}>
            {customerId ? 'Actualizar' : 'Registrar'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F5F5F5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, color: '#212121' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#424242', marginTop: 16 },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
  },
  inputError: { borderColor: '#D32F2F' },
  multilineInput: { height: 100, textAlignVertical: 'top' },
  errorText: { color: '#D32F2F', fontSize: 12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
  },
  typeButtonActive: { backgroundColor: '#1976D2' },
  typeButtonText: { color: '#424242', fontWeight: '600' },
  typeButtonTextActive: { color: '#FFF' },
  submitButton: {
    backgroundColor: '#1976D2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
