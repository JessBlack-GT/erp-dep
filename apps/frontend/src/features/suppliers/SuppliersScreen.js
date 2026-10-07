import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ActionButton as Button } from '../../components/common/ActionButton';
import { EmptyState } from '../../components/common/EmptyState';
import { supplierService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { styles, message } from './shared';
import { semanticColors } from '../../theme';
export function SuppliersScreen({ navigation }) {
  const can = usePermissions(),
    read = can('suppliers.read');
  const [draft, setDraft] = useState({
    search: '',
    category: '',
    country: '',
    type: '',
    status: '',
  });
  const [query, setQuery] = useState({});
  const [page, setPage] = useState(1);
  const [data, setData] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(null);
  const latest = useRef(0);
  async function load(p = page, q = query) {
    if (!read) return;
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const r = await supplierService.getAll({ ...q, page: p, limit: 20 });
      if (request !== latest.current) return;
      setData(r.data.data);
      setTotal(r.data.pagination.total);
      setPage(p);
    } catch (e) {
      if (request === latest.current) setError(message(e));
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }
  useEffect(() => {
    load(1, query);
    return () => {
      latest.current++;
    };
  }, [query, read]);
  useEffect(
    () => navigation?.addListener?.('focus', () => load(1, query)),
    [navigation, query, read],
  );
  if (!read)
    return (
      <Text accessibilityRole="alert" style={styles.body}>
        Sin permiso para consultar proveedores
      </Text>
    );
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Proveedores</Text>
      <Text style={styles.fieldLabel}>Buscar proveedores</Text>
      <TextInput
        accessibilityLabel="Buscar proveedores"
        placeholder="Buscar proveedores"
        placeholderTextColor={Platform.OS === 'web' ? undefined : '#64748B'}
        style={[styles.input, styles.filterInput]}
        value={draft.search}
        onChangeText={(search) => setDraft({ ...draft, search })}
      />
      <View style={styles.row}>
        {[
          ['category', 'Categoría'],
          ['country', 'País (2 letras)'],
        ].map(([key, label]) => (
          <View key={key} style={styles.filterField}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
              accessibilityLabel={'Filtro ' + label}
              placeholder={label}
              placeholderTextColor={Platform.OS === 'web' ? undefined : '#64748B'}
              style={[styles.input, styles.filterInput]}
              value={draft[key]}
              onChangeText={(value) => setDraft({ ...draft, [key]: value })}
            />
          </View>
        ))}
      </View>
      <View style={styles.row}>
        {['', 'active', 'inactive'].map((status, i) => (
          <Button
            key={status}
            variant={draft.status === status ? 'primary' : 'secondary'}
            title={
              ['Todos', 'Activos', 'Inactivos'][i] +
              (draft.status === status ? ' ✓' : '')
            }
            onPress={() => setDraft({ ...draft, status })}
          />
        ))}
      </View>
      <View style={styles.row}>
        {['', 'natural', 'legal'].map((type, i) => (
          <Button
            key={type}
            variant={draft.type === type ? 'primary' : 'secondary'}
            title={
              ['Todos los tipos', 'Persona', 'Empresa'][i] +
              (draft.type === type ? ' ✓' : '')
            }
            onPress={() => setDraft({ ...draft, type })}
          />
        ))}
      </View>
      <View style={styles.row}>
        <Button
          title="Buscar / aplicar filtros"
          onPress={() =>
            setQuery(
              Object.fromEntries(
                Object.entries(draft).filter(([, v]) => v.trim()),
              ),
            )
          }
        />
        <Button
          variant="secondary"
          title="Limpiar filtros"
          onPress={() => {
            setDraft({
              search: '',
              category: '',
              country: '',
              type: '',
              status: '',
            });
            setQuery({});
          }}
        />
        {can('suppliers.create') && (
          <Button
            title="Crear proveedor"
            onPress={() => navigation.navigate('SupplierForm')}
          />
        )}
      </View>
      {loading && (
        <ActivityIndicator
          accessibilityLabel="Cargando proveedores"
          color={Platform.OS === 'web' ? undefined : semanticColors.brand.blue}
        />
      )}
      {error && (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
          <Button title="Reintentar" onPress={() => load()} />
        </View>
      )}
      {!loading && !error && data.length === 0 && (
        <EmptyState title="No se encontraron proveedores" message="" />
      )}
      <FlatList
        data={data}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={'Abrir ' + item.name}
            style={styles.card}
            onPress={() =>
              navigation.navigate('SupplierDetail', { id: item._id })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>{item.email || item.tradeName || ''}</Text>
            <Text style={styles.cardMeta}>
              {item.status === 'active' ? 'Activo' : 'Inactivo'} ·{' '}
              {item.category || 'Sin categoría'}
            </Text>
          </TouchableOpacity>
        )}
      />
      <Text style={styles.pagination}>
        Página {page} · Total {total}
      </Text>
      <View style={styles.row}>
        <Button
          variant="secondary"
          title="Anterior"
          disabled={loading || page <= 1}
          onPress={() => load(page - 1)}
        />
        <Button
          variant="secondary"
          title="Siguiente"
          disabled={loading || page * 20 >= total}
          onPress={() => load(page + 1)}
        />
      </View>
    </View>
  );
}
export const SupplierList = SuppliersScreen;
