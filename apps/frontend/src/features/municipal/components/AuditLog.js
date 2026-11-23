/**
 * MuniERP IA — bitácora de auditoría municipal (F1-14, RQ02/RQ05), solo lectura.
 *
 * - Consulta GET /municipalities/{mun}/audit-events con los filtros del contrato draft.3 (folio,
 *   entityId, from, to, page, limit). El servidor aplica la política: hoy solo AUDITOR_MUNICIPAL tiene
 *   `municipal.audit.read`. La interfaz no decide el acceso: siempre pregunta y muestra la respuesta
 *   (403 → acceso denegado), aunque la entrada del menú solo aparece con el permiso.
 * - Orden del servidor: más recientes primero. Paginación del contrato.
 * - Protección de datos: no se muestran IP ni requestId (aunque el contrato los entrega); el actor y
 *   los identificadores se abrevian; no hay contenido de expedientes en la bitácora.
 * - La dependencia se deriva solo del folio (formato público), nunca de otros datos.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { webAccessibilityRole } from '../accessibility';
import { Text, Badge, Button, Input, LoadingSpinner } from '../../../components/common';
import { spacing } from '../../../theme';
import { OptionGroup } from './OptionGroup';
import { Section, ButtonRow } from './Section';
import {
  AUDIT_PAGE_SIZES, AUDIT_RESULT_LABELS, auditActionLabel, auditResourceLabel, auditEventAccessibilityLabel,
  dependencyFromFolio, buildAuditQuery, actorLabel, formatDateTime, describeApiError,
} from '../model';

const EMPTY_FILTERS = { folio: '', entityId: '', from: '', to: '', limit: 10 };

function denialMessage(error) {
  const d = describeApiError(error);
  if (d.kind === 'membership') return d.message;
  if (d.kind === 'forbidden') return 'Su rol municipal no tiene acceso a la bitácora de auditoría.';
  return null;
}

export function AuditLog({ api, membership, dependencies = [], onBack, testID = 'municipal-audit' }) {
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState({ ...EMPTY_FILTERS, page: 1 });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, error: null });
  const requestSeq = useRef(0);

  const load = useCallback(async (filters) => {
    const { errors: found, query } = buildAuditQuery(filters);
    if (Object.keys(found).length) { setErrors(found); return; }
    setErrors({});
    const seq = ++requestSeq.current;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const r = await api.listAuditEvents(query);
      if (seq !== requestSeq.current) return;
      setState({ status: r.items.length ? 'ready' : 'empty', items: r.items, pagination: r.pagination, error: null });
    } catch (error) {
      if (seq !== requestSeq.current) return;
      const denied = denialMessage(error);
      setState({ status: denied ? 'denied' : 'error', items: [], pagination: null, error: denied || describeApiError(error).message });
    }
  }, [api]);

  useEffect(() => { load(applied); }, [applied, load]);

  const set = (field) => (v) => setDraft((d) => ({ ...d, [field]: v }));
  const apply = () => {
    const { errors: found } = buildAuditQuery(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    setApplied({ ...draft, page: 1 });
  };
  const clear = () => { setDraft(EMPTY_FILTERS); setErrors({}); setApplied({ ...EMPTY_FILTERS, page: 1 }); };
  const goTo = (page) => setApplied((a) => ({ ...a, page }));

  const back = onBack ? <Button variant="ghost" label="← Volver a expedientes" onPress={onBack} testID="audit-back" /> : null;
  const munName = membership && membership.municipality ? membership.municipality.name : '';

  if (state.status === 'denied')
    return (
      <View style={styles.page} testID={`${testID}-denied`}>
        {back}
        <Text variant="heading2" accessibilityRole="header" aria-level={1}>Bitácora de auditoría</Text>
        <Text color="error" accessibilityRole="alert" testID="audit-denied-message">{state.error}</Text>
      </View>
    );

  const p = state.pagination;
  const filterErrors = Object.values(errors);

  return (
    <View style={styles.page} testID={testID}>
      {back}
      <Text variant="heading2" accessibilityRole="header" aria-level={1} testID="audit-title">{`Bitácora de auditoría${munName ? ` · ${munName}` : ''}`}</Text>
      <Text variant="caption" color="secondary">Solo lectura. Más recientes primero. No se muestran direcciones IP ni identificadores técnicos de la petición.</Text>

      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={[styles.column, wide && styles.columnFilters]}>
          <Section title="Filtros" testID="audit-filters">
            <Input label="Folio" value={draft.folio} onChangeText={set('folio')} error={errors.folio} autoCapitalize="characters" placeholder="SJH-OBP-SOL-2026-000001" testID="audit-filter-folio" />
            <Input label="Identificador del recurso" value={draft.entityId} onChangeText={set('entityId')} error={errors.entityId} autoCapitalize="none" placeholder="24 caracteres" testID="audit-filter-entity" />
            <Input label="Desde (AAAA-MM-DD)" value={draft.from} onChangeText={set('from')} error={errors.from} autoCapitalize="none" testID="audit-filter-from" />
            <Input label="Hasta, inclusive (AAAA-MM-DD)" value={draft.to} onChangeText={set('to')} error={errors.to} autoCapitalize="none" testID="audit-filter-to" />
            <OptionGroup
              label="Eventos por página"
              options={AUDIT_PAGE_SIZES.map((n) => ({ value: n, label: String(n) }))}
              value={draft.limit}
              onChange={(v) => setDraft((d) => ({ ...d, limit: v }))}
              testID="audit-filter-limit"
            />
            {filterErrors.length ? <Text color="error" accessibilityRole="alert" testID="audit-filter-errors">{`Revise los filtros: ${filterErrors.length} error(es).`}</Text> : null}
            <ButtonRow>
              <Button label="Aplicar filtros" onPress={apply} testID="audit-apply" />
              <Button variant="secondary" label="Limpiar" onPress={clear} testID="audit-clear" />
            </ButtonRow>
          </Section>
        </View>

        <View style={[styles.column, wide && styles.columnResults]}>
          <Section title="Eventos" testID="audit-results">
            {state.status === 'loading' ? <LoadingSpinner label="Cargando bitácora…" testID="audit-loading" /> : null}
            {state.status === 'error' ? (
              <View testID="audit-error">
                <Text color="error" accessibilityRole="alert" testID="audit-error-message">{state.error}</Text>
                <Button variant="secondary" label="Reintentar" onPress={() => load(applied)} testID="audit-retry" />
              </View>
            ) : null}
            {state.status === 'empty' ? <Text testID="audit-empty">No hay eventos para los filtros seleccionados.</Text> : null}
            {state.status === 'ready' ? (
              <>
                <Text variant="caption" accessibilityLiveRegion="polite" testID="audit-summary">{`Página ${p.page} de ${Math.max(p.pages, 1)} · ${p.total} evento(s)`}</Text>
                <View accessibilityRole="list" testID="audit-list">
                  {state.items.map((e, i) => {
                    const result = AUDIT_RESULT_LABELS[e.result] || { label: e.result, variant: 'neutral' };
                    const dep = dependencyFromFolio(e.folio, dependencies);
                    return (
                      <View key={`${e.at}-${i}`} accessibilityRole={webAccessibilityRole('listitem')} accessibilityLabel={auditEventAccessibilityLabel(e, dependencies)} style={styles.item} testID={`audit-event-${i}`}>
                        <View style={styles.itemHeader}>
                          <Text weight="bold">{auditActionLabel(e.action)}</Text>
                          <Badge label={result.label} variant={result.variant} />
                        </View>
                        <Text>{auditResourceLabel(e)}{dep ? ` · ${dep}` : ''}</Text>
                        <Text variant="caption" color="secondary">{`${formatDateTime(e.at)} · ${actorLabel(e.actorId)}`}</Text>
                      </View>
                    );
                  })}
                </View>
                <ButtonRow>
                  <Button variant="secondary" label="Página anterior" onPress={() => goTo(p.page - 1)} disabled={p.page <= 1} testID="audit-prev" />
                  <Button variant="secondary" label="Página siguiente" onPress={() => goTo(p.page + 1)} disabled={p.page >= p.pages} testID="audit-next" />
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
  page: { padding: spacing.md },
  columns: { flexDirection: 'column', marginTop: spacing.sm },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { width: '100%' },
  columnFilters: { width: '35%', paddingRight: spacing.sm },
  columnResults: { width: '65%', paddingLeft: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  item: { marginTop: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: '#d9e2ec' },
  itemHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
});

export default AuditLog;
