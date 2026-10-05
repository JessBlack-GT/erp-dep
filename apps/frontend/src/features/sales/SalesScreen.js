import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { salesService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import {
  styles,
  states,
  dateText,
  salesError,
  validDate,
  screenProps,
} from './shared';

export function SalesScreen({ navigation }) {
  const can = usePermissions(),
    allowed = can('commercial.read');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    from: '',
    to: '',
  });
  const [query, setQuery] = useState({ page: 1, limit: 20 });
  const [rows, setRows] = useState([]),
    [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const latest = useRef(0);
  async function load() {
    if (!allowed) return;
    const seq = ++latest.current;
    setLoading(true);
    setError('');
    setRows([]);
    setPagination(null);
    try {
      const result = await salesService.getAll(query);
      if (seq !== latest.current) return;
      setRows(result.data.data);
      setPagination(result.data.pagination);
    } catch (e) {
      if (seq === latest.current) setError(salesError(e));
    } finally {
      if (seq === latest.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const unsubscribe = navigation?.addListener?.('focus', load);
    return () => {
      latest.current++;
      unsubscribe?.();
    };
  }, [query, allowed, navigation]);
  function apply() {
    if (
      (filters.from && !validDate(filters.from)) ||
      (filters.to && !validDate(filters.to)) ||
      (filters.from && filters.to && filters.from > filters.to)
    ) {
      setError(
        'Revisa las fechas del filtro: AAAA-MM-DD y desde anterior a hasta.',
      );
      return;
    }
    setQuery({
      page: 1,
      limit: 20,
      ...Object.fromEntries(
        Object.entries(filters)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => [k, v.trim()]),
      ),
    });
  }
  if (!allowed) return <Text>No tienes permiso para consultar ventas.</Text>;
  return (
    <View style={styles.page}>
      <Text style={styles.heading}>Ventas</Text>
      <View style={styles.row}>
        {can('commercial.create') && (
          <Button
            label="Nueva venta"
            onPress={() => navigation.navigate('SaleForm', { id: null })}
          />
        )}
        <Button
          label="Actualizar ventas"
          variant="secondary"
          disabled={loading}
          onPress={load}
        />
      </View>
      <View style={styles.card}>
        <Input
          label="Buscar ventas"
          accessibilityLabel="Buscar ventas"
          value={filters.search}
          maxLength={100}
          onChangeText={(search) => setFilters({ ...filters, search })}
        />
        <Text>Estado: {states[filters.status] || 'Todos'}</Text>
        <View style={styles.row}>
          {Object.entries({ '': 'Todos', ...states }).map(([status, label]) => (
            <Button
              key={status}
              label={label}
              variant={filters.status === status ? 'primary' : 'secondary'}
              onPress={() => setFilters({ ...filters, status })}
            />
          ))}
        </View>
        {['from', 'to'].map((field) => (
          <Input
            key={field}
            label={
              field === 'from' ? 'Desde (AAAA-MM-DD)' : 'Hasta (AAAA-MM-DD)'
            }
            accessibilityLabel={field === 'from' ? 'Desde' : 'Hasta'}
            value={filters[field]}
            onChangeText={(value) => setFilters({ ...filters, [field]: value })}
          />
        ))}
        <Button label="Aplicar filtros" onPress={apply} />
        <Button
          label="Limpiar filtros"
          variant="secondary"
          onPress={() => {
            setFilters({ search: '', status: '', from: '', to: '' });
            setQuery({ page: 1, limit: 20 });
          }}
        />
      </View>
      {loading && <ActivityIndicator accessibilityLabel="Cargando ventas" />}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title="Sin ventas"
          message="No hay ventas para los filtros seleccionados."
        />
      )}
      {rows.map((sale) => (
        <View key={sale._id} style={styles.card}>
          <Text>{sale.number}</Text>
          <Text>{dateText(sale.date)}</Text>
          <Text>{sale.entity.name}</Text>
          <Text>
            {sale.total} {sale.currency}
          </Text>
          <Text>{states[sale.status]}</Text>
          <Button
            label={`Ver ${sale.number}`}
            variant="secondary"
            onPress={() => navigation.navigate('SaleDetail', { id: sale._id })}
          />
        </View>
      ))}
      {pagination && (
        <View style={styles.row}>
          <Button
            label="Página anterior"
            disabled={loading || query.page <= 1}
            onPress={() => setQuery({ ...query, page: query.page - 1 })}
          />
          <Text>
            Página {pagination.page} · {pagination.total} ventas
          </Text>
          <Button
            label="Página siguiente"
            disabled={loading || query.page >= pagination.pages}
            onPress={() => setQuery({ ...query, page: query.page + 1 })}
          />
        </View>
      )}
    </View>
  );
}
SalesScreen.propTypes = screenProps;
