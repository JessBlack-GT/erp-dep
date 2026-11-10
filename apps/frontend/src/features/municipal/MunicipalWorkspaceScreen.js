/**
 * MuniERP IA — espacio de trabajo municipal (prototipo de Fase 1).
 *
 * F1-13: al elegir una fila se abre el detalle del expediente (RequestDetail) y «Volver» regresa a la lista.
 * F1-14: con `municipal.audit.read` aparece «Bitácora de auditoría» (AuditLog, solo lectura).
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
import { RequestDetail } from './components/RequestDetail';
import { AuditLog } from './components/AuditLog';
import { AUDIT_PERMISSION } from './model';

export function MunicipalWorkspaceScreen({ api: injected }) {
  const api = useMemo(() => injected || createMockMunicipalApi(), [injected]);
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  const [state, setState] = useState({ loading: true, error: '', memberships: [], dependencies: [], citizens: [], requests: [], indicators: null });
  const [receipt, setReceipt] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [selectedFolio, setSelectedFolio] = useState(null);
  const [view, setView] = useState('requests');

  const load = useCallback(async () => {
    try {
      // F1-13: primero la membresía; después solo se piden los recursos que sus permisos autorizan
      // (antes un rol sin `citizens.read` o `indicators.read` hacía fallar toda la carga).
      const memberships = await api.myMemberships();
      if (!memberships.length) {
        setState({ loading: false, error: '', memberships, dependencies: [], citizens: [], requests: [], indicators: null });
        return;
      }
      const perms = new Set(memberships[0].permissions || []);
      const [dependencies, citizens, list, indicators] = await Promise.all([
        api.listDependencies(),
        perms.has('municipal.requests.create') && perms.has('municipal.citizens.read') ? api.searchCitizens() : Promise.resolve([]),
        perms.has('municipal.requests.read') ? api.listRequests() : Promise.resolve({ items: [] }),
        perms.has('municipal.indicators.read') ? api.getIndicators() : Promise.resolve(null),
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
  const canCreate = (state.memberships[0].permissions || []).includes('municipal.requests.create');
  const banner = api.isMock ? (
    <Text variant="caption" testID="municipal-mock-banner">{api.mockLabel || 'Modo prototipo: datos sintéticos, sin conexión al servidor.'}</Text>
  ) : null;
  // F1-14: la entrada solo aparece con el permiso; el servidor vuelve a autorizar cada consulta.
  const canAudit = (state.memberships[0].permissions || []).includes(AUDIT_PERMISSION);
  if (view === 'audit' && canAudit)
    return (
      <ScrollView contentContainerStyle={styles.page} testID="municipal-workspace-audit">
        {banner}
        <AuditLog api={api} membership={state.memberships[0]} dependencies={state.dependencies} onBack={() => setView('requests')} />
      </ScrollView>
    );
  if (selectedFolio)
    return (
      <ScrollView contentContainerStyle={styles.page} testID="municipal-workspace-detail">
        {banner}
        <RequestDetail
          api={api}
          folio={selectedFolio}
          membership={state.memberships[0]}
          dependencies={state.dependencies}
          onBack={() => { setSelectedFolio(null); load(); }}
        />
      </ScrollView>
    );
  return (
    <ScrollView contentContainerStyle={styles.page} testID="municipal-workspace">
      <Text variant="heading1" accessibilityRole="header">{`MuniERP · ${mun.name}`}</Text>
      {banner}
      {canAudit ? <Button variant="secondary" label="Bitácora de auditoría" onPress={() => setView('audit')} testID="workspace-open-audit" /> : null}
      <IndicatorsPanel data={state.indicators} />
      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={[styles.column, wide && styles.columnHalf]}>
          {receipt ? (
            <ReceiptView receipt={receipt} onDone={() => { setReceipt(null); setFormKey((k) => k + 1); }} />
          ) : canCreate ? (
            <RequestIntakeForm key={formKey} api={api} dependencies={state.dependencies} citizens={state.citizens} onCreated={onCreated} />
          ) : (
            <Text testID="municipal-intake-unavailable">Su rol no registra solicitudes.</Text>
          )}
        </View>
        <View style={[styles.column, wide && styles.columnHalf]}>
          <Text variant="heading3">Solicitudes en su alcance</Text>
          <RequestList items={state.requests} onSelect={(r) => setSelectedFolio(r.folio)} />
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
