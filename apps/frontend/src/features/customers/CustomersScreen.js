/**
 * ============================================
 * ERP-SYSTEM - Pantalla de Lista de Clientes
 * ============================================
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { customerService } from '../../services/api';
import { formatDate, truncate } from '../../utils';

export function CustomerList({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const result = await customerService.getAll({
        page,
        limit: 20,
        search,
      });
      setCustomers(result.data?.data || []);
      setHasMore((result.data?.data?.pagination?.page || page) < (result.data?.data?.pagination?.totalPages || 1));
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    setSearch(query);
    setPage(1);
    // Debounce search
    setTimeout(() => loadCustomers(), 300);
  };

  const handleRefresh = () => {
    setPage(1);
    loadCustomers();
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      setPage((prev) => prev + 1);
      loadCustomers();
    }
  };

  const renderCustomer = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CustomerDetail', { id: item.id })}
    >
      <Text style={styles.cardTitle}>{item.getFullName ? item.getFullName() : item.name}</Text>
      <Text style={styles.cardSubtitle}>{item.email}</Text>
      <Text style={styles.cardMeta}>
        {item.type === 'legal' ? 'Empresa' : 'Persona'} · {item.status}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1976D2" />
        <Text style={{ marginTop: 16 }}>Cargando clientes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#D32F2F', marginBottom: 16 }}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={handleRefresh}>
          <Text style={styles.buttonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar clientes..."
        value={search}
        onChangeText={handleSearch}
        autoCapitalize="none"
      />
      {customers.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ color: '#757575' }}>No se encontraron clientes</Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          renderItem={renderCustomer}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loading && <ActivityIndicator style={{ marginVertical: 16 }} />}
          refreshing={loading}
          onRefresh={handleRefresh}
        />
      )}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CustomerForm')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F5F5F5' },
  searchInput: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#212121' },
  cardSubtitle: { fontSize: 14, color: '#757575', marginTop: 4 },
  cardMeta: { fontSize: 12, color: '#9E9E9E', marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  button: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
});
