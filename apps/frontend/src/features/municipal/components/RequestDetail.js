/**
 * MuniERP IA — detalle de expediente (F1-13, RQ02/RQ03/RQ05).
 *
 * Muestra solo lo que el servidor entrega para la membresía del usuario:
 *  - Request completo → datos, historial, documentos y acciones permitidas.
 *  - RequestSummary (alcance META, auditor) → solo folio, estado y fechas; no pide historial ni documentos.
 * Los errores 404 no distinguen "inexistente" de "sin acceso" (política del servidor).
 * Las descargas siempre pasan por `api.downloadDocument`, que llama al endpoint autorizado.
 * Las acciones visibles dependen de los permisos de la membresía; el servidor vuelve a autorizarlas.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text, Badge, Button, TextArea, LoadingSpinner } from '../../../components/common';
import { spacing } from '../../../theme';
import { OptionGroup } from './OptionGroup';
import { RequestStatusBadge } from './RequestList';
import { Field, Section, ButtonRow } from './Section';
import {
  REQUEST_TYPES, CONFIDENTIALITY_LABELS, CHANNEL_LABELS, HISTORY_LABELS, statusInfo, spokenFolio,
  availableActions, validateAction, actorLabel, formatDateTime, describeApiError,
} from '../model';


export function historyItemLabel(h) {
  const from = h.fromStatus ? statusInfo(h.fromStatus).label : null;
  const to = statusInfo(h.toStatus).label;
  const transition = from && from !== to ? `de ${from} a ${to}` : `estado ${to}`;
  return `${HISTORY_LABELS[h.action] || h.action}, ${transition}, ${formatDateTime(h.at)}, por ${actorLabel(h.actorId)}`;
}

export function RequestDetail({ api, folio, membership, dependencies = [], onBack, testID = 'municipal-detail' }) {
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  const permissions = (membership && membership.permissions) || [];
  const can = (p) => permissions.includes(p);
  const depName = (code) => (dependencies.find((d) => d.code === code) || {}).name || code;

  const [state, setState] = useState({ status: 'loading', error: null, request: null, history: null, documents: null, historyError: null, documentsError: null });
  const [notice, setNotice] = useState(null); // { kind: 'success'|'error', text }
  const [panel, setPanel] = useState(null); // { action, values, errors, confirming, submitting, users }
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const { data: request } = await api.getRequest(folio);
      const summaryOnly = request.version === undefined; // RequestSummary (META)
      const [history, documents] = summaryOnly
        ? [{ status: 'skipped' }, { status: 'skipped' }]
        : await Promise.allSettled([
          api.getRequestHistory(folio),
          can('municipal.documents.read') ? api.listDocuments(folio) : Promise.resolve(null),
        ]);
      if (!mounted.current) return;
      setState({
        status: 'ready',
        error: null,
        request,
        history: history.status === 'fulfilled' ? history.value : null,
        historyError: history.status === 'rejected' ? describeApiError(history.reason).message : null,
        documents: documents.status === 'fulfilled' ? documents.value : null,
        documentsError: documents.status === 'rejected' ? describeApiError(documents.reason).message : null,
      });
    } catch (error) {
      if (mounted.current) setState((s) => ({ ...s, status: 'error', error: describeApiError(error) }));
    }
  }, [api, folio]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const request = state.request;
  const actions = useMemo(() => (request && request.version !== undefined ? availableActions(permissions, request.status) : []), [request, permissions]);

  async function openAction(action) {
    setNotice(null);
    const next = { action, values: { note: '', dependency: '', userId: '' }, errors: {}, confirming: false, submitting: false, users: null };
    setPanel(next);
    if (action === 'ASIGNAR') {
      try {
        const users = await api.listMemberships({ dependency: request.ownerDependency, status: 'ACTIVA' });
        setPanel((p) => p && { ...p, users: users.filter((u) => u.effective && ASSIGNABLE_ROLES[u.role]) });
      } catch (error) {
        setPanel((p) => p && { ...p, users: [], errors: { userId: describeApiError(error).message } });
      }
    }
  }

  function setValue(field, value) {
    setPanel((p) => ({ ...p, values: { ...p.values, [field]: value }, errors: { ...p.errors, [field]: undefined } }));
  }

  function review() {
    const errors = validateAction(panel.action, panel.values);
    setPanel((p) => ({ ...p, errors, confirming: Object.keys(errors).length === 0 }));
  }

  async function submit() {
    const { action, values } = panel;
    const body = { action, version: request.version };
    if (values.dependency) body.toDependencies = [values.dependency];
    if (values.userId) body.assignedUserId = values.userId;
    if (values.note.trim()) body.note = values.note.trim();
    setPanel((p) => ({ ...p, submitting: true }));
    try {
      await api.transitionRequest(folio, body);
      setPanel(null);
      setNotice({ kind: 'success', text: `Acción registrada: ${actions.find((a) => a.action === action)?.label || action}.` });
      await load();
    } catch (error) {
      const e = describeApiError(error);
      setPanel(null);
      setNotice({ kind: 'error', text: e.message });
      if (e.kind === 'conflict' || e.kind === 'notFound') await load();
    }
  }

  async function download(doc) {
    setNotice(null);
    try {
      await api.downloadDocument(folio, doc);
      setNotice({ kind: 'success', text: `Descarga iniciada: ${doc.filename}.` });
    } catch (error) {
      setNotice({ kind: 'error', text: describeApiError(error).message });
    }
  }

  const back = onBack ? <Button variant="ghost" label="← Volver a la lista" onPress={onBack} testID="detail-back" /> : null;

  if (state.status === 'loading' && !request)
    return <View style={styles.page} testID={`${testID}-loading`}>{back}<LoadingSpinner label="Cargando expediente…" /></View>;

  if (state.status === 'error')
    return (
      <View style={styles.page} testID={`${testID}-error`}>
        {back}
        <Text color="error" accessibilityRole="alert" testID="detail-error-message">{state.error.message}</Text>
        {['network'].includes(state.error.kind) ? <Button label="Reintentar" onPress={load} testID="detail-retry" /> : null}
      </View>
    );

  const summaryOnly = request.version === undefined;
  const conf = request.confidentiality || 'PUBLICA';

  return (
    <View style={styles.page} testID={testID}>
      {back}
      <View style={styles.header}>
        <Text variant="heading1" accessibilityRole="header" aria-level={1} accessibilityLabel={`Expediente ${spokenFolio(request.folio)}`} testID="detail-folio" selectable>
          {request.folio}
        </Text>
        <View style={styles.badges}>
          <RequestStatusBadge status={request.status} />
          <Badge variant={conf === 'PUBLICA' ? 'neutral' : 'warning'} label={CONFIDENTIALITY_LABELS[conf] || conf} />
        </View>
      </View>

      {notice ? (
        <Text color={notice.kind === 'error' ? 'error' : 'success'} accessibilityRole="alert" accessibilityLiveRegion="polite" testID={`detail-notice-${notice.kind}`}>
          {notice.text}
        </Text>
      ) : null}

      {summaryOnly ? (
        <Text accessibilityRole="alert" testID="detail-meta-only">
          Vista de metadatos: su rol consulta folio, estado, dependencia y fechas; no el contenido, el historial ni los documentos.
        </Text>
      ) : null}

      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={[styles.column, wide && styles.columnMain]}>
          <Section title="Datos de la solicitud" testID="detail-data">
            <Field label="Tipo" value={REQUEST_TYPES[request.type] || request.type} />
            {!summaryOnly ? <Field label="Asunto" value={request.subject} testID="detail-subject" /> : null}
            {!summaryOnly ? <Field label="Descripción" value={request.description || 'Sin descripción'} testID="detail-description" /> : null}
            <Field label="Estado actual" value={statusInfo(request.status).label} testID="detail-status" />
            <Field label="Municipio" value={membership && membership.municipality ? membership.municipality.name : ''} />
            <Field label="Dependencia responsable" value={depName(request.ownerDependency)} testID="detail-owner" />
            {request.assignedDependencies && request.assignedDependencies.length ? (
              <Field label="Turnado a" value={request.assignedDependencies.map(depName).join(', ')} />
            ) : null}
            <Field label="Canal" value={CHANNEL_LABELS[request.channel] || request.channel} />
            {!summaryOnly && request.citizen ? <Field label="Ciudadano solicitante" value={request.citizen.fullName} testID="detail-citizen" /> : null}
            <Field label="Registrado" value={formatDateTime(request.createdAt)} />
            <Field label="Última actualización" value={formatDateTime(request.updatedAt)} />
          </Section>

          {!summaryOnly ? (
            <Section title="Historial" testID="detail-history">
              {state.historyError ? <Text color="error" accessibilityRole="alert">{state.historyError}</Text> : null}
              {state.history && state.history.length === 0 ? <Text testID="detail-history-empty">Sin movimientos registrados.</Text> : null}
              {state.history ? (
                <View accessibilityRole="list">
                  {state.history.map((h, i) => (
                    <View key={`${h.at}-${i}`} accessibilityRole="listitem" accessibilityLabel={historyItemLabel(h)} style={styles.historyItem} testID={`history-${i}`}>
                      <Text weight="bold">{HISTORY_LABELS[h.action] || h.action}</Text>
                      <Text variant="caption" color="secondary">{`${formatDateTime(h.at)} · ${actorLabel(h.actorId)}`}</Text>
                      <Text>{h.fromStatus && h.fromStatus !== h.toStatus ? `${statusInfo(h.fromStatus).label} → ${statusInfo(h.toStatus).label}` : statusInfo(h.toStatus).label}</Text>
                      {h.toDependencies ? <Text variant="caption">{`Turnado a: ${h.toDependencies.map(depName).join(', ')}`}</Text> : null}
                      {h.note ? <Text variant="caption">{`Nota: ${h.note}`}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </Section>
          ) : null}
        </View>

        <View style={[styles.column, wide && styles.columnSide]}>
          {!summaryOnly ? (
            <Section title="Documentos" testID="detail-documents">
              {!can('municipal.documents.read') ? <Text testID="detail-documents-forbidden">Su rol no consulta documentos.</Text> : null}
              {state.documentsError ? <Text color="error" accessibilityRole="alert">{state.documentsError}</Text> : null}
              {state.documents && state.documents.length === 0 ? <Text testID="detail-documents-empty">Sin documentos adjuntos.</Text> : null}
              {state.documents ? (
                <View accessibilityRole="list">
                  {state.documents.map((d) => (d.restricted ? (
                    <View key={d.id} accessibilityRole="listitem" style={styles.docItem} testID={`document-${d.id}`}>
                      <Text>{`Documento restringido (${CONFIDENTIALITY_LABELS[d.confidentiality] || d.confidentiality})`}</Text>
                      <Text variant="caption" color="secondary">Su alcance no permite ver ni descargar este documento.</Text>
                    </View>
                  ) : (
                    <View key={d.id} accessibilityRole="listitem" style={styles.docItem} testID={`document-${d.id}`}>
                      <Text weight="bold">{d.filename}</Text>
                      <Text variant="caption" color="secondary">{`${d.mimeType} · ${Math.max(1, Math.round(d.size / 1024))} KB · ${CONFIDENTIALITY_LABELS[d.confidentiality] || d.confidentiality}`}</Text>
                      <Button variant="secondary" size="small" label="Descargar" accessibilityLabel={`Descargar ${d.filename}`} onPress={() => download(d)} testID={`download-${d.id}`} />
                    </View>
                  )))}
                </View>
              ) : null}
            </Section>
          ) : null}

          {!summaryOnly ? (
            <Section title="Acciones" testID="detail-actions">
              {actions.length === 0 ? <Text testID="detail-no-actions">Su rol no tiene acciones disponibles en este estado.</Text> : null}
              {!panel && actions.length ? (
                <ButtonRow>
                  {actions.map((a) => (
                    <Button key={a.action} variant={a.action === 'CANCELAR' ? 'danger' : 'secondary'} label={a.label} onPress={() => openAction(a.action)} testID={`action-${a.action}`} />
                  ))}
                </ButtonRow>
              ) : null}
              {panel ? (
                <View testID="action-panel">
                  <Text weight="bold">{actions.find((a) => a.action === panel.action)?.label}</Text>
                  {panel.action === 'TURNAR' ? (
                    <OptionGroup
                      label="Dependencia destino"
                      options={dependencies.filter((d) => d.code !== request.ownerDependency).map((d) => ({ value: d.code, label: d.name }))}
                      value={panel.values.dependency}
                      onChange={(v) => setValue('dependency', v)}
                      error={panel.errors.dependency}
                      testID="action-dependency"
                    />
                  ) : null}
                  {panel.action === 'ASIGNAR' ? (
                    panel.users === null ? <LoadingSpinner label="Cargando responsables…" /> : (
                      <OptionGroup
                        label="Responsable"
                        options={panel.users.map((u) => ({ value: u.userId, label: `${ASSIGNABLE_ROLES[u.role]} ···${u.userId.slice(-6)}` }))}
                        value={panel.values.userId}
                        onChange={(v) => setValue('userId', v)}
                        error={panel.errors.userId}
                        testID="action-user"
                      />
                    )
                  ) : null}
                  <TextArea
                    label={TRANSITION_NEEDS_NOTE(panel.action) ? 'Nota (obligatoria)' : 'Nota (opcional)'}
                    value={panel.values.note}
                    onChangeText={(v) => setValue('note', v)}
                    error={panel.errors.note}
                    testID="action-note"
                  />
                  {panel.confirming ? (
                    <View accessibilityRole="alert" testID="action-confirm">
                      <Text>{`¿Confirma «${actions.find((a) => a.action === panel.action)?.label}» para el expediente ${request.folio}? Quedará registrado en el historial con su usuario.`}</Text>
                      <ButtonRow>
                        <Button label="Confirmar" onPress={submit} loading={panel.submitting} testID="action-confirm-button" />
                        <Button variant="ghost" label="Volver" onPress={() => setPanel((p) => ({ ...p, confirming: false }))} testID="action-confirm-back" />
                      </ButtonRow>
                    </View>
                  ) : (
                    <ButtonRow>
                      <Button label="Continuar" onPress={review} testID="action-continue" />
                      <Button variant="ghost" label="Cerrar" onPress={() => setPanel(null)} testID="action-cancel" />
                    </ButtonRow>
                  )}
                </View>
              ) : null}
            </Section>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const TRANSITION_NEEDS_NOTE = (action) => action === 'CERRAR' || action === 'CANCELAR';
/** Roles a los que la interfaz ofrece asignar un expediente (el servidor valida la acción). */
const ASSIGNABLE_ROLES = { TITULAR_DEPENDENCIA: 'Titular', OPERADOR_DEPENDENCIA: 'Operador' };

const styles = StyleSheet.create({
  page: { padding: spacing.md },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap' },
  section: { marginBottom: spacing.md },
  field: { marginTop: spacing.sm },
  historyItem: { marginTop: spacing.sm, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: '#9aa5b1' },
  docItem: { marginTop: spacing.sm },
  actionButton: { marginTop: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  columns: { flexDirection: 'column' },
  columnsWide: { flexDirection: 'row' },
  column: { width: '100%' },
  columnMain: { width: '60%', paddingRight: spacing.sm },
  columnSide: { width: '40%', paddingLeft: spacing.sm },
});

export default RequestDetail;
