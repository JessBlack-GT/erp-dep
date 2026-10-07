/**
 * ============================================
 * ERP-SYSTEM - Pantalla de Lista de Clientes
 * ============================================
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { usePermissions } from '../../hooks/usePermissions';
import { customerService } from '../../services/api';
import { formatDate, truncate } from '../../utils';
import { semanticColors, spacing, radius, typographyScale } from '../../theme';
import { Text as ThemedText } from '../../components/common/Text';

export function CustomerList({ navigation }) {
  const can = usePermissions();
  const canRead = can('customers.read');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const latestRequest = useRef(0);

  useEffect(() => {
    if (navigation?.addListener) return navigation.addListener('focus', () => loadCustomers(1, search));
  }, [navigation, search]);

  useEffect(() => {
    loadCustomers(1, '');
    return () => { latestRequest.current += 1; };
  }, []);

  const loadCustomers = async (requestedPage = 1, query = search, append = false) => {
    if (!canRead) { setLoading(false); return; }
    const requestId = ++latestRequest.current;
    try {
      setLoading(true);
      const result = await customerService.getAll({
        page: requestedPage,
        limit: 20,
        search: query,
      });
      if (requestId !== latestRequest.current) return;
      const rows = result.data?.data || [];
      setCustomers(previous => append ? [...previous, ...rows] : rows);
      setPage(requestedPage);
      setHasMore(rows.length === 20);
      setError(null);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(err.response?.data?.message || 'Error al cargar clientes');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  const handleSearch = (query) => {
    setSearch(query);
    setPage(1);
    loadCustomers(1, query);
  };

  const handleRefresh = () => {
    setPage(1);
    loadCustomers(1, search);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadCustomers(page + 1, search, true);
    }
  };

  const renderCustomer = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CustomerDetail', { id: item._id || item.id })}
    >
      <Text style={styles.cardTitle}>{item.businessName || `${item.name} ${item.lastName || ''}`.trim()}</Text>
      <Text style={styles.cardSubtitle}>{item.email}</Text>
      <Text style={styles.cardMeta}>
        {item.type === 'legal' ? 'Empresa' : 'Persona'} · {item.status}
      </Text>
    </TouchableOpacity>
  );

  if (!canRead) return <Text accessibilityRole="alert" style={styles.feedback}>Sin permiso para consultar clientes</Text>;

  if (loading && customers.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size="large"
          color={semanticColors.brand.blue}
        />
        <Text style={styles.feedback}>Cargando clientes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={handleRefresh}>
          <Text style={styles.buttonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText variant="heading2" style={styles.pageTitle}>
        Clientes
      </ThemedText>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar clientes..."
        placeholderTextColor={Platform.OS === 'web' ? undefined : '#64748B'}
        value={search}
        onChangeText={handleSearch}
        autoCapitalize="none"
      />
      {customers.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No se encontraron clientes</Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => (item._id || item.id).toString()}
          renderItem={renderCustomer}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loading && <ActivityIndicator style={{ marginVertical: 16 }} />}
          refreshing={loading}
          onRefresh={handleRefresh}
        />
      )}
      {can('customers.create') && <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Crear cliente"
        style={styles.fab}
        onPress={() => navigation.navigate('CustomerForm')}
      >
        <Text style={styles.fabText}>{Platform.OS === 'web' ? 'Crear cliente' : '+'}</Text>
      </TouchableOpacity>}
    </View>
  );
}

export const CustomersScreen = CustomerList;
export default CustomersScreen;

const styles = StyleSheet.create({
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
  pageTitle: {
    color: semanticColors.brand.navy,
    marginBottom: spacing.sm,
  },
  searchInput: {
    color: semanticColors.text.primary,
    backgroundColor: semanticColors.surface.primary,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: semanticColors.border.strong,
    minHeight: 44,
    ...(Platform.OS === 'web' && {
      minHeight: 40,
      paddingVertical: 12,
      outlineStyle: 'none',
    }),
  },
  card: {
    backgroundColor: semanticColors.surface.primary,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
    borderRadius: radius.medium,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...(Platform.OS === 'web' && {
      shadowOpacity: 0,
    }),
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: semanticColors.text.primary,
    ...(Platform.OS === 'web' && {
      ...typographyScale.subtitle,
    }),
  },
  cardSubtitle: {
    fontSize: 14,
    color: semanticColors.text.secondary,
    marginTop: spacing.xs,
  },
  cardMeta: {
    fontSize: 12,
    color: '#475569',
    marginTop: spacing.xs,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  feedback: {
    color: Platform.OS === 'web' ? '#000' : semanticColors.text.secondary,
    marginTop: Platform.OS === 'web' ? 16 : spacing.sm,
  },
  emptyText: {
    color: Platform.OS === 'web' ? '#757575' : semanticColors.text.secondary,
  },
  errorText: {
    color: Platform.OS === 'web' ? '#D32F2F' : '#B42318',
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: semanticColors.interactive.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.medium,
  },
  buttonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: semanticColors.interactive.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    ...(Platform.OS === 'web' && {
      backgroundColor: semanticColors.interactive.primary,
      position: 'relative',
      alignSelf: 'flex-end',
      bottom: undefined,
      right: undefined,
      width: 'auto',
      minWidth: 40,
      height: 40,
      paddingHorizontal: spacing.md,
      borderRadius: radius.medium,
      boxShadow: '0 2px 8px rgba(16, 29, 54, 0.15)',
    }),
  },
  fabText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
});
