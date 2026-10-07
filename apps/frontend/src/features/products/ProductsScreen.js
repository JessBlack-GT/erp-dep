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
import { productService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { styles, message } from './shared';
import { semanticColors } from '../../theme';
export function ProductsScreen({ navigation }) {
  const can = usePermissions(),
    read = can('products.read');
  const [draft, setDraft] = useState({
    search: '',
    category: '',
    currency: '',
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
      const r = await productService.getAll({ ...q, page: p, limit: 20 });
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
        Sin permiso para consultar elementos
      </Text>
    );
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Productos y servicios</Text>
      <Text style={styles.fieldLabel}>Buscar elementos</Text>
      <TextInput
        accessibilityLabel="Buscar elementos"
        placeholder="Buscar elementos"
        placeholderTextColor={Platform.OS === 'web' ? undefined : '#64748B'}
        style={styles.input}
        value={draft.search}
        onChangeText={(search) => setDraft({ ...draft, search })}
      />
      <View style={styles.row}>
        {[
          ['category', 'Categoría'],
          ['currency', 'Moneda (3 letras)'],
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
        {['', 'PRODUCT', 'SERVICE'].map((type, i) => (
          <Button
            key={type}
            variant={draft.type === type ? 'primary' : 'secondary'}
            title={
              ['Todos los tipos', 'Producto', 'Servicio'][i] +
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
              currency: '',
              type: '',
              status: '',
            });
            setQuery({});
          }}
        />
        {can('products.create') && (
          <Button
            title="Crear elemento"
            onPress={() => navigation.navigate('ProductForm')}
          />
        )}
      </View>
      {loading && (
        <ActivityIndicator
          accessibilityLabel="Cargando elementos"
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
        <EmptyState title="No se encontraron elementos" message="" />
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
              navigation.navigate('ProductDetail', { id: item._id })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>{item.type + ' · ' + item.sku}</Text>
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
export const ProductList = ProductsScreen;
