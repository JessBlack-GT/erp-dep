import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { View, Text, TextInput, ActivityIndicator, Platform } from 'react-native';
import { ActionButton as Button } from '../../components/common/ActionButton';
import { inventoryService as api } from '../../services/api';
import { styles, message } from './shared';
export function InventorySelector({
  kind,
  label,
  value,
  onSelect,
  activeOnly = true,
  fetchOptions,
  formatOption,
  isEligible,
  errorMessage = message,
  disabled = false,
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(''),
    [rows, setRows] = useState([]),
    [page, setPage] = useState(1),
    [hasNext, setHasNext] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const latest = useRef(0);
  const load = async (p = 1) => {
    const seq = ++latest.current;
    setLoading(true);
    setError('');
    setRows([]);
    try {
      const r = await (
        fetchOptions ||
        (kind === 'products' ? api.getProducts : api.getWarehouses)
      )({
        page: p,
        limit: 10,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(kind === 'warehouses' && activeOnly ? { status: 'active' } : {}),
      });
      if (seq !== latest.current) return;
      setRows(
        r.data.data.filter(
          isEligible ||
            ((x) =>
              kind !== 'products' ||
              (x.type === 'PRODUCT' &&
                x.trackInventory &&
                x.status === 'active')),
        ),
      );
      setHasNext(
        r.data.pagination
          ? p * 10 < r.data.pagination.total
          : r.data.data.length === 10,
      );
      setPage(p);
    } catch (e) {
      if (seq === latest.current) setError(errorMessage(e));
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
      <Text style={styles.body}>
        {label}: {value?.name || 'Sin seleccionar'}
      </Text>
      <Button
        disabled={disabled}
        title={'Seleccionar ' + label}
        onPress={() => setOpen(!open)}
      />
      {open && !disabled && (
        <View>
          {Platform.OS !== 'web' && (
            <Text style={styles.fieldLabel}>Búsqueda de {label}</Text>
          )}
          <TextInput
            accessibilityLabel={'Buscar ' + label}
            placeholder={'Buscar ' + label}
            placeholderTextColor={Platform.OS === 'web' ? undefined : '#64748B'}
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
            <Text style={styles.body}>Sin opciones elegibles</Text>
          )}
          {rows.map((row) => (
            <Button
              key={row._id}
              title={
                formatOption
                  ? formatOption(row)
                  : row.name + ' · ' + (row.sku || row.code)
              }
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
              disabled={loading || !hasNext}
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
InventorySelector.propTypes = {
  kind: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.object,
  onSelect: PropTypes.func.isRequired,
  activeOnly: PropTypes.bool,
  fetchOptions: PropTypes.func,
  formatOption: PropTypes.func,
  isEligible: PropTypes.func,
  errorMessage: PropTypes.func,
  disabled: PropTypes.bool,
};
