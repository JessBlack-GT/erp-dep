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
import { supplierService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { styles, message } from './shared';
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
      <Text accessibilityRole="alert">
        Sin permiso para consultar proveedores
      </Text>
    );
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Proveedores</Text>
      <TextInput
        accessibilityLabel="Buscar proveedores"
        placeholder="Buscar proveedores"
        style={styles.input}
        value={draft.search}
        onChangeText={(search) => setDraft({ ...draft, search })}
      />
      <View style={styles.row}>
        {[
          ['category', 'Categoría'],
          ['country', 'País (2 letras)'],
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
        {['', 'natural', 'legal'].map((type, i) => (
          <Button
            key={type}
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
        <ActivityIndicator accessibilityLabel="Cargando proveedores" />
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
        <Text>No se encontraron proveedores</Text>
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
            <Text>{item.name}</Text>
            <Text>{item.email || item.tradeName || ''}</Text>
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
export const SupplierList = SuppliersScreen;
