import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { inventoryService as api } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { WarehouseSelector } from './InventorySelector';
import { styles, message, operations } from './shared';
export function InventoryScreen({ navigation }) {
  const can = usePermissions(),
    read = can('inventory.read');
  const [tab, setTab] = useState('balances'),
    [draft, setDraft] = useState({}),
    [warehouse, setWarehouse] = useState(null),
    [query, setQuery] = useState({}),
    [rows, setRows] = useState([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const latest = useRef(0);
  async function load(p = 1) {
    if (!read) return;
    const seq = ++latest.current;
    setLoading(true);
    setError('');
    try {
      const r = await (tab === 'balances' ? api.getBalances : api.getMovements)(
        { ...query, page: p, limit: 20 },
      );
      if (seq !== latest.current) return;
      setRows(r.data.data);
      setTotal(r.data.pagination.total);
      setPage(p);
    } catch (e) {
      if (seq === latest.current) setError(message(e));
    } finally {
      if (seq === latest.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    return () => {
      latest.current++;
    };
  }, [tab, query, read]);
  useEffect(
    () => navigation?.addListener?.('focus', () => load()),
    [navigation, tab, query, read],
  );
  if (!read)
    return (
      <Text accessibilityRole="alert">
        Sin permiso para consultar inventario
      </Text>
    );
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Inventario</Text>
      <View style={styles.row}>
        {Object.entries(operations)
          .filter(([, v]) => can('inventory.' + v[1]))
          .map(([type, v]) => (
            <Button
              key={type}
              title={
                (type === 'ADJUSTMENT' ? 'Nuevo ' : 'Nueva ') +
                v[0].toLowerCase()
              }
              onPress={() =>
                navigation.navigate('InventoryMovementForm', { type })
              }
            />
          ))}
        {can('inventory.warehouse.manage') && (
          <Button
            title="Nuevo almacén"
            onPress={() => navigation.navigate('WarehouseForm')}
          />
        )}
      </View>
      <View style={styles.row}>
        {[
          ['balances', 'Existencias'],
          ['movements', 'Historial'],
        ].map(([key, title]) => (
          <Button
            key={key}
            title={title}
            onPress={() => {
              setTab(key);
              setDraft({});
              setWarehouse(null);
              setQuery({});
            }}
          />
        ))}
      </View>
      <TextInput
        accessibilityLabel="Buscar producto o SKU"
        placeholder="Buscar producto o SKU"
        style={styles.input}
        value={draft.search || ''}
        onChangeText={(search) => setDraft({ ...draft, search })}
      />
      <WarehouseSelector
        label="Almacén del filtro"
        value={warehouse}
        onSelect={setWarehouse}
        activeOnly={false}
      />
      {tab === 'movements' && (
        <View>
          <View style={styles.row}>
            {[
              ['', 'Todos los movimientos'],
              ...Object.entries(operations).map(([k, v]) => [k, v[0]]),
            ].map(([type, title]) => (
              <Button
                key={type}
                title={title + (draft.type === type ? ' ✓' : '')}
                onPress={() => setDraft({ ...draft, type })}
              />
            ))}
          </View>
          {['from', 'to'].map((key, i) => (
            <TextInput
              key={key}
              accessibilityLabel={i ? 'Hasta UTC' : 'Desde UTC'}
              placeholder={(i ? 'Hasta' : 'Desde') + ' YYYY-MM-DDTHH:mm:ssZ'}
              style={styles.input}
              value={draft[key] || ''}
              onChangeText={(value) => setDraft({ ...draft, [key]: value })}
            />
          ))}
        </View>
      )}
      <View style={styles.row}>
        <Button
          title="Aplicar filtros"
          onPress={() =>
            setQuery({
              ...Object.fromEntries(
                Object.entries(draft).filter(([, v]) => v.trim()),
              ),
              ...(warehouse ? { warehouseId: warehouse._id } : {}),
            })
          }
        />
        <Button
          title="Limpiar filtros"
          onPress={() => {
            setDraft({});
            setWarehouse(null);
            setQuery({});
          }}
        />
        <Button title="Actualizar inventario" onPress={() => load(page)} />
      </View>
      {loading && (
        <ActivityIndicator accessibilityLabel="Cargando inventario" />
      )}
      {error && (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
          <Button title="Reintentar" onPress={() => load(page)} />
        </View>
      )}
      {!loading && !error && !rows.length && (
        <Text>Sin registros de inventario</Text>
      )}
      {!error &&
        rows.map((row) => (
          <View key={row._id} style={styles.card}>
            <Text>
              {row.productId?.name || 'Producto no disponible'} ·{' '}
              {row.productId?.sku}
            </Text>
            {tab === 'balances' ? (
              <Text>
                {row.warehouseId?.name} · Disponible: {row.available}{' '}
                {row.productId?.unit}
              </Text>
            ) : (
              <>
                <Text>
                  {operations[row.type]?.[0]} · {row.quantity} ·{' '}
                  {row.sourceWarehouseId?.name || 'Exterior'} →{' '}
                  {row.destinationWarehouseId?.name || 'Exterior'}
                </Text>
                <Text>
                  {row.reason} · {row.reference}
                </Text>
                <Text>
                  {row.createdAt} · Responsable: {row.createdBy}
                </Text>
              </>
            )}
          </View>
        ))}
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
    </ScrollView>
  );
}
export const InventoryBalances = InventoryScreen;
export const InventoryMovements = InventoryScreen;
