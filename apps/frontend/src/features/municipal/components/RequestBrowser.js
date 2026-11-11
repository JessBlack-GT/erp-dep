/**
 * MuniERP IA — listado y búsqueda de solicitudes (F1-15a; RQ03).
 *
 * El contrato draft.3 (listRequests) filtra por estado y dependencia con paginación; no hay búsqueda
 * de texto. La «búsqueda por folio» abre el expediente con getRequest: el servidor decide si existe y
 * si está en el alcance (404 indistinguible). Reutiliza RequestList (F1-11/F1-13).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text, Button, Input, LoadingSpinner } from '../../../components/common';
import { spacing } from '../../../theme';
import { OptionGroup } from './OptionGroup';
import { RequestList } from './RequestList';
import { Heading, Section, ButtonRow } from './Section';
import { STATUS, FOLIO_PATTERN, buildRequestQuery, describeApiError } from '../model';

const STATUS_OPTIONS = [{ value: '', label: 'Todos' }, ...Object.keys(STATUS).map((s) => ({ value: s, label: STATUS[s].label }))];

export function RequestBrowser({ api, dependencies = [], onOpen, testID = 'municipal-requests' }) {
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  const [filters, setFilters] = useState({ status: '', dependency: '', page: 1 });
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, error: '' });
  const [folio, setFolio] = useState('');
  const [folioError, setFolioError] = useState('');

  const load = useCallback(async (f) => {
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    try {
      const r = await api.listRequests(buildRequestQuery(f));
      setState({ status: 'ready', items: r.items, pagination: r.pagination, error: '' });
    } catch (e) {
      const d = describeApiError(e);
      setState({ status: 'error', items: [], pagination: null, error: d.kind === 'forbidden' ? 'Su rol municipal no permite consultar solicitudes.' : d.message });
    }
  }, [api]);

  useEffect(() => { load(filters); }, [filters, load]);

  const setFilter = (field) => (v) => setFilters((f) => ({ ...f, [field]: v, page: 1 }));
  const search = () => {
    const value = folio.trim().toUpperCase();
    if (!FOLIO_PATTERN.test(value)) { setFolioError('Folio con formato MUN-DEP-TIPO-AAAA-NNNNNN, por ejemplo SJH-OBP-SOL-2026-000001.'); return; }
    setFolioError('');
    onOpen(value);
  };
  const p = state.pagination;

  return (
    <View testID={testID}>
      <Heading level={1} testID="requests-title">Solicitudes</Heading>
      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={[styles.column, wide && styles.columnFilters]}>
          <Section title="Buscar por folio" testID="requests-search">
            <Input label="Folio" value={folio} onChangeText={setFolio} error={folioError} autoCapitalize="characters" placeholder="SJH-OBP-SOL-2026-000001" testID="requests-folio" />
            <ButtonRow>
              <Button label="Abrir expediente" onPress={search} testID="requests-folio-open" />
            </ButtonRow>
          </Section>
          <Section title="Filtros" testID="requests-filters">
            <OptionGroup label="Estado" options={STATUS_OPTIONS} value={filters.status} onChange={setFilter('status')} testID="requests-filter-status" />
            <OptionGroup label="Dependencia responsable" options={[{ value: '', label: 'Todas' }, ...dependencies.map((d) => ({ value: d.code, label: d.name }))]} value={filters.dependency} onChange={setFilter('dependency')} testID="requests-filter-dependency" />
          </Section>
        </View>
        <View style={[styles.column, wide && styles.columnResults]}>
          <Section title="Resultados" testID="requests-results">
            {state.status === 'loading' ? <LoadingSpinner label="Cargando solicitudes…" testID="requests-loading" /> : null}
            {state.status === 'error' ? (
              <View>
                <Text color="error" accessibilityRole="alert" testID="requests-error">{state.error}</Text>
                <Button variant="secondary" label="Reintentar" onPress={() => load(filters)} testID="requests-retry" />
              </View>
            ) : null}
            {state.status === 'ready' ? (
              <>
                <Text variant="caption" accessibilityLiveRegion="polite" testID="requests-summary">{`Página ${p.page} de ${Math.max(p.pages, 1)} · ${p.total} solicitud(es)`}</Text>
                <RequestList items={state.items} onSelect={(r) => onOpen(r.folio)} />
                <ButtonRow>
                  <Button variant="secondary" label="Página anterior" onPress={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} disabled={p.page <= 1} testID="requests-prev" />
                  <Button variant="secondary" label="Página siguiente" onPress={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} disabled={p.page >= p.pages} testID="requests-next" />
                </ButtonRow>
              </>
            ) : null}
          </Section>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'column', marginTop: spacing.sm },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { width: '100%' },
  columnFilters: { width: '35%', paddingRight: spacing.sm },
  columnResults: { width: '65%', paddingLeft: spacing.sm },
});

export default RequestBrowser;
