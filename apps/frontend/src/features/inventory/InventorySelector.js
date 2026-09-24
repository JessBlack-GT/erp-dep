import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator } from 'react-native';
import { inventoryService as api } from '../../services/api';
import { styles, message } from './shared';
export function InventorySelector({
  kind,
  label,
  value,
  onSelect,
  activeOnly = true,
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(''),
    [rows, setRows] = useState([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const latest = useRef(0);
  const load = async (p = 1) => {
    const seq = ++latest.current;
    setLoading(true);
    setError('');
    try {
      const r = await (
        kind === 'products' ? api.getProducts : api.getWarehouses
      )({
        page: p,
        limit: 10,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(kind === 'warehouses' && activeOnly ? { status: 'active' } : {}),
      });
      if (seq !== latest.current) return;
      setRows(
        r.data.data.filter(
          (x) =>
            kind !== 'products' ||
            (x.type === 'PRODUCT' && x.trackInventory && x.status === 'active'),
        ),
      );
      setTotal(r.data.pagination.total);
      setPage(p);
    } catch (e) {
      if (seq === latest.current) setError(message(e));
    } finally {
      if (seq === latest.current) setLoading(false);
    }
  };
  useEffect(() => {
    if (open) load();
    return () => {
      latest.current++;
    };
  }, [open]);
  return (
    <View style={styles.card}>
      <Text>
        {label}: {value?.name || 'Sin seleccionar'}
      </Text>
      <Button title={'Seleccionar ' + label} onPress={() => setOpen(!open)} />
      {open && (
        <View>
          <TextInput
            accessibilityLabel={'Buscar ' + label}
            placeholder={'Buscar ' + label}
            style={styles.input}
            value={search}
            onChangeText={setSearch}
          />
          <Button title={'Buscar ' + label} onPress={() => load(1)} />
          {loading && (
            <ActivityIndicator accessibilityLabel={'Cargando ' + label} />
          )}
          {error && <Text accessibilityRole="alert">{error}</Text>}
          {!loading && !rows.length && !error && (
            <Text>Sin opciones elegibles</Text>
          )}
          {rows.map((row) => (
            <Button
              key={row._id}
              title={row.name + ' · ' + (row.sku || row.code)}
              onPress={() => {
                onSelect(row);
                setOpen(false);
              }}
            />
          ))}
          <View style={styles.row}>
            <Button
              title={'Anterior ' + label}
              disabled={loading || page <= 1}
              onPress={() => load(page - 1)}
            />
            <Button
              title={'Siguiente ' + label}
              disabled={loading || page * 10 >= total}
              onPress={() => load(page + 1)}
            />
            <Button
              title={'Limpiar ' + label}
              onPress={() => {
                onSelect(null);
                setOpen(false);
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}
export const WarehouseSelector = (props) => (
  <InventorySelector {...props} kind="warehouses" />
);
