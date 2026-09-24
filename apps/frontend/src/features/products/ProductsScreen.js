import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { productService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { styles, message } from './shared';
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
      <Text accessibilityRole="alert">
        Sin permiso para consultar elementos
      </Text>
    );
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Productos y servicios</Text>
      <TextInput
        accessibilityLabel="Buscar elementos"
        placeholder="Buscar elementos"
        style={styles.input}
        value={draft.search}
        onChangeText={(search) => setDraft({ ...draft, search })}
      />
      <View style={styles.row}>
        {[
          ['category', 'Categoría'],
          ['currency', 'Moneda (3 letras)'],
        ].map(([key, label]) => (
          <TextInput
            key={key}
            accessibilityLabel={'Filtro ' + label}
            placeholder={label}
            style={styles.input}
            value={draft[key]}
            onChangeText={(value) => setDraft({ ...draft, [key]: value })}
          />
        ))}
      </View>
      <View style={styles.row}>
        {['', 'active', 'inactive'].map((status, i) => (
          <Button
            key={status}
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
      {loading && <ActivityIndicator accessibilityLabel="Cargando elementos" />}
      {error && (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
          <Button title="Reintentar" onPress={() => load()} />
        </View>
      )}
      {!loading && !error && data.length === 0 && (
        <Text>No se encontraron elementos</Text>
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
            <Text>{item.name}</Text>
            <Text>{item.type + ' · ' + item.sku}</Text>
            <Text>
              {item.status === 'active' ? 'Activo' : 'Inactivo'} ·{' '}
              {item.category || 'Sin categoría'}
            </Text>
          </TouchableOpacity>
        )}
      />
      <Text>
        Página {page} · Total {total}
      </Text>
      <View style={styles.row}>
        <Button
          title="Anterior"
          disabled={loading || page <= 1}
          onPress={() => load(page - 1)}
        />
        <Button
          title="Siguiente"
          disabled={loading || page * 20 >= total}
          onPress={() => load(page + 1)}
        />
      </View>
    </View>
  );
}
export const ProductList = ProductsScreen;
