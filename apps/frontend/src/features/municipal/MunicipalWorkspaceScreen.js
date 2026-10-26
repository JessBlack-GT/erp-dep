/**
 * MuniERP IA — espacio de trabajo municipal (prototipo de Fase 1).
 *
 * ⚠️ NO REGISTRADO en MainNavigator ni en Sidebar: añadir la entrada condicionada a membresías es
 * parte de F1-11 y requiere revisión de Codex. Por defecto usa la API simulada (sin red, datos
 * sintéticos). Para la API real se inyecta `api` con la misma interfaz.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text, LoadingSpinner, Button } from '../../components/common';
import { spacing } from '../../theme';
import { createMockMunicipalApi } from './mockApi';
import { IndicatorsPanel } from './components/IndicatorsPanel';
import { RequestList } from './components/RequestList';
import { RequestIntakeForm } from './components/RequestIntakeForm';
import { ReceiptView } from './components/ReceiptView';

export function MunicipalWorkspaceScreen({ api: injected }) {
  const api = useMemo(() => injected || createMockMunicipalApi(), [injected]);
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  const [state, setState] = useState({ loading: true, error: '', memberships: [], dependencies: [], citizens: [], requests: [], indicators: null });
  const [receipt, setReceipt] = useState(null);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const [memberships, dependencies, citizens, list, indicators] = await Promise.all([
        api.myMemberships(), api.listDependencies(), api.searchCitizens(), api.listRequests(), api.getIndicators(),
      ]);
      setState({ loading: false, error: '', memberships, dependencies, citizens, requests: list.items, indicators });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: 'No fue posible cargar la información municipal.' }));
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const onCreated = async (created) => {
    setReceipt(await api.getReceipt(created.folio));
    load();
  };

  if (state.loading) return <LoadingSpinner label="Cargando MuniERP…" testID="municipal-loading" />;
  if (state.error)
    return (
      <View style={styles.page}>
        <Text color="error" accessibilityRole="alert">{state.error}</Text>
        <Button label="Reintentar" onPress={load} />
      </View>
    );
  if (!state.memberships.length)
    return (
      <View style={styles.page} testID="municipal-no-membership">
        <Text>No tiene una membresía municipal vigente. Solicítela al administrador municipal.</Text>
      </View>
    );

  const mun = state.memberships[0].municipality;
  return (
    <ScrollView contentContainerStyle={styles.page} testID="municipal-workspace">
      <Text variant="heading1" accessibilityRole="header">{`MuniERP · ${mun.name}`}</Text>
      {api.isMock ? <Text variant="caption" testID="municipal-mock-banner">Modo prototipo: datos sintéticos, sin conexión al servidor.</Text> : null}
      <IndicatorsPanel data={state.indicators} />
      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={[styles.column, wide && styles.columnHalf]}>
          {receipt ? (
            <ReceiptView receipt={receipt} onDone={() => { setReceipt(null); setFormKey((k) => k + 1); }} />
          ) : (
            <RequestIntakeForm key={formKey} api={api} dependencies={state.dependencies} citizens={state.citizens} onCreated={onCreated} />
          )}
        </View>
        <View style={[styles.column, wide && styles.columnHalf]}>
          <Text variant="heading3">Solicitudes en su alcance</Text>
          <RequestList items={state.requests} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md },
  columns: { flexDirection: 'column' },
  columnsWide: { flexDirection: 'row' },
  column: { width: '100%' },
  columnHalf: { width: '50%', paddingHorizontal: spacing.sm },
});

export default MunicipalWorkspaceScreen;
