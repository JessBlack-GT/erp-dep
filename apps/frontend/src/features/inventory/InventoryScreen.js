import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ActionButton as Button } from '../../components/common/ActionButton';
import { EmptyState } from '../../components/common/EmptyState';
import { inventoryService as api, reportService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { WarehouseSelector } from './InventorySelector';
import { styles, message, operations } from './shared';
import { canDownloadFile, downloadFile } from '../../utils/downloadFile';
import { semanticColors } from '../../theme';
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
    [error, setError] = useState(''),
    [exporting, setExporting] = useState('');
  const latest = useRef(0);
  const Content = Platform.OS === 'web' ? View : ScrollView;
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
  async function exportReport(format) {
    if (exporting) return;
    setExporting(format);
    setError('');
    try {
      const response =
        Platform.OS === 'web'
          ? await reportService.exportInventory(tab, format, query)
          : await reportService.getInventoryExportRequest(tab, format, query);
      downloadFile(response, `inventario-${tab}.${format}`);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || message(e));
    } finally {
      setExporting('');
    }
  }
  if (!read)
    return (
      <Text accessibilityRole="alert" style={styles.body}>
        Sin permiso para consultar inventario
      </Text>
    );
  return (
    <Content style={styles.container}>
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
            variant={tab === key ? 'primary' : 'secondary'}
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
      {canDownloadFile() && (
        <View style={styles.row}>
          {['pdf', 'xlsx'].map((format) => (
            <Button
              key={format}
              variant="secondary"
              title={
                exporting === format
                  ? `Generando ${format === 'xlsx' ? 'Excel' : 'PDF'}…`
                  : `Exportar ${format === 'xlsx' ? 'Excel' : 'PDF'}`
              }
              disabled={!!exporting}
              onPress={() => exportReport(format)}
            />
          ))}
        </View>
      )}
      <Text style={styles.fieldLabel}>Buscar producto o SKU</Text>
      <TextInput
        accessibilityLabel="Buscar producto o SKU"
        placeholder="Buscar producto o SKU"
        placeholderTextColor={Platform.OS === 'web' ? undefined : '#64748B'}
        style={[styles.input, styles.filterInput]}
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
                variant={draft.type === type ? 'primary' : 'secondary'}
                title={title + (draft.type === type ? ' ✓' : '')}
                onPress={() => setDraft({ ...draft, type })}
              />
            ))}
          </View>
          {['from', 'to'].map((key, i) => (
            <View key={key}>
              <Text style={styles.fieldLabel}>
                {i ? 'Hasta UTC' : 'Desde UTC'}
              </Text>
              <TextInput
                accessibilityLabel={i ? 'Hasta UTC' : 'Desde UTC'}
                placeholder={(i ? 'Hasta' : 'Desde') + ' YYYY-MM-DDTHH:mm:ssZ'}
                placeholderTextColor={Platform.OS === 'web' ? undefined : '#64748B'}
                style={styles.input}
                value={draft[key] || ''}
                onChangeText={(value) => setDraft({ ...draft, [key]: value })}
              />
            </View>
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
          variant="secondary"
          title="Limpiar filtros"
          onPress={() => {
            setDraft({});
            setWarehouse(null);
            setQuery({});
          }}
        />
        <Button
          variant="secondary"
          title="Actualizar inventario"
          onPress={() => load(page)}
        />
      </View>
      {loading && (
        <ActivityIndicator
          accessibilityLabel="Cargando inventario"
          color={Platform.OS === 'web' ? undefined : semanticColors.brand.blue}
        />
      )}
      {error && (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
          <Button
            variant="secondary"
            title="Reintentar"
            onPress={() => load(page)}
          />
        </View>
      )}
      {!loading && !error && !rows.length && (
        <EmptyState title="Sin registros de inventario" message="" />
      )}
      {!error &&
        rows.map((row) => (
          <View key={row._id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {row.productId?.name || 'Producto no disponible'} ·{' '}
              {row.productId?.sku}
            </Text>
            {tab === 'balances' ? (
              <Text style={styles.cardMeta}>
                {row.warehouseId?.name} · Disponible: {row.available}{' '}
                {row.productId?.unit}
              </Text>
            ) : (
              <>
                <Text style={styles.cardMeta}>
                  {operations[row.type]?.[0]} · {row.quantity} ·{' '}
                  {row.sourceWarehouseId?.name || 'Exterior'} →{' '}
                  {row.destinationWarehouseId?.name || 'Exterior'}
                </Text>
                <Text style={styles.cardMeta}>
                  {row.reason} · {row.reference}
                </Text>
                <Text style={styles.cardMeta}>
                  {row.createdAt} · Responsable: {row.createdBy}
                </Text>
              </>
            )}
          </View>
        ))}
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
    </Content>
  );
}
export const InventoryBalances = InventoryScreen;
export const InventoryMovements = InventoryScreen;
InventoryScreen.propTypes = {
  navigation: PropTypes.shape({
    addListener: PropTypes.func,
    navigate: PropTypes.func,
  }),
};
