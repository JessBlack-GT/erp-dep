/**
 * MuniERP IA — administración de dependencias municipales (F1-15a, RQ05).
 *
 * Usa solo operaciones de draft.3: listDependencies (todas las del municipio), createDependency y
 * updateDependency (nombre y estado; el código es inmutable). Las reglas viven en el servidor:
 * unicidad del código, superior activa, no desactivar con expedientes abiertos o subordinadas
 * activas, y el permiso `municipal.dependencies.manage` (hoy solo ADMIN_MUNICIPAL). La interfaz
 * oculta los controles de edición sin ese permiso, pero siempre muestra lo que responda el servidor.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { webAccessibilityRole } from '../accessibility';
import { Text, Badge, Button, Input, LoadingSpinner } from '../../../components/common';
import { spacing } from '../../../theme';
import { OptionGroup } from './OptionGroup';
import { Heading, Section, ButtonRow } from './Section';
import { ACTIVE_STATUS_LABELS, DEPENDENCY_PERMISSIONS, validateDependencyForm, describeAdminError } from '../model';

const EMPTY = { code: '', name: '', parentCode: '' };

export function DependencyAdmin({ api, membership, testID = 'municipal-dependencies' }) {
  const canManage = !!membership && (membership.permissions || []).includes(DEPENDENCY_PERMISSIONS.manage);
  const [state, setState] = useState({ status: 'loading', items: [], error: '' });
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null); // { code, name, status }
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ kind: '', text: '' });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    try {
      const items = await api.listDependencies({});
      setState({ status: items.length ? 'ready' : 'empty', items, error: '' });
    } catch (e) {
      const d = describeAdminError(e);
      setState({ status: d.kind === 'forbidden' || d.kind === 'membership' ? 'denied' : 'error', items: [], error: d.kind === 'forbidden' ? 'Su rol municipal no permite consultar dependencias.' : d.message });
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const set = (field) => (v) => setDraft((d) => ({ ...d, [field]: v }));

  async function create() {
    const { errors: found, body } = validateDependencyForm(draft, { creating: true });
    setErrors(found);
    setNotice({ kind: '', text: '' });
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const saved = await api.createDependency(body);
      setDraft(EMPTY);
      setNotice({ kind: 'ok', text: `Dependencia ${saved.code} · ${saved.name} creada.` });
      await load();
    } catch (e) {
      setNotice({ kind: 'error', text: describeAdminError(e).message });
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    const current = state.items.find((d) => d.code === editing.code);
    const { errors: found } = validateDependencyForm(editing, { creating: false });
    setErrors(found);
    setNotice({ kind: '', text: '' });
    if (Object.keys(found).length) return;
    const body = {};
    if (editing.name.trim() !== current.name) body.name = editing.name.trim();
    if (editing.status !== current.status) body.status = editing.status;
    if (!Object.keys(body).length) { setEditing(null); return; }
    setBusy(true);
    try {
      const saved = await api.updateDependency(editing.code, body);
      setEditing(null);
      setNotice({ kind: 'ok', text: `Dependencia ${saved.code} actualizada (${ACTIVE_STATUS_LABELS[saved.status].label.toLowerCase()}).` });
      await load();
    } catch (e) {
      setNotice({ kind: 'error', text: describeAdminError(e).message });
    } finally {
      setBusy(false);
    }
  }

  const title = <Heading level={1} testID="dependencies-title">Dependencias</Heading>;
  if (state.status === 'denied')
    return (
      <View testID={`${testID}-denied`}>
        {title}
        <Text color="error" accessibilityRole="alert" testID="dependencies-denied-message">{state.error}</Text>
      </View>
    );

  const active = state.items.filter((d) => d.status === 'ACTIVA');
  const nameOf = (code) => (state.items.find((d) => d.code === code) || {}).name || code;

  return (
    <View testID={testID}>
      {title}
      <Text variant="caption" color="secondary">
        {canManage ? 'Puede crear dependencias y cambiar su nombre o estado. El código no se modifica.' : 'Solo consulta: su rol no administra dependencias.'}
      </Text>
      {notice.text ? (
        <Text color={notice.kind === 'ok' ? 'success' : 'error'} accessibilityRole={notice.kind === 'ok' ? undefined : 'alert'} accessibilityLiveRegion="polite" testID="dependencies-notice">{notice.text}</Text>
      ) : null}

      <Section title="Dependencias del municipio" testID="dependencies-list-section">
        {state.status === 'loading' ? <LoadingSpinner label="Cargando dependencias…" testID="dependencies-loading" /> : null}
        {state.status === 'error' ? (
          <View>
            <Text color="error" accessibilityRole="alert" testID="dependencies-error">{state.error}</Text>
            <Button variant="secondary" label="Reintentar" onPress={load} testID="dependencies-retry" />
          </View>
        ) : null}
        {state.status === 'empty' ? <Text testID="dependencies-empty">El municipio aún no tiene dependencias registradas.</Text> : null}
        {state.status === 'ready' ? (
          <View accessibilityRole="list" testID="dependencies-list">
            {state.items.map((d) => {
              const st = ACTIVE_STATUS_LABELS[d.status] || { label: d.status, variant: 'neutral' };
              const isEditing = editing && editing.code === d.code;
              return (
                <View key={d.code} accessibilityRole={webAccessibilityRole('listitem')} accessibilityLabel={`${d.name}, código ${d.code.split('').join(' ')}, ${st.label}${d.parentCode ? `, depende de ${nameOf(d.parentCode)}` : ''}`} style={styles.item} testID={`dependency-${d.code}`}>
                  <View style={styles.itemHeader}>
                    <Text weight="bold">{`${d.name} (${d.code})`}</Text>
                    <Badge label={st.label} variant={st.variant} />
                  </View>
                  {d.parentCode ? <Text variant="caption" color="secondary">{`Depende de: ${nameOf(d.parentCode)}`}</Text> : null}
                  {canManage && !isEditing ? (
                    <ButtonRow>
                      <Button variant="secondary" size="small" label="Editar" accessibilityLabel={`Editar ${d.name}`} onPress={() => { setErrors({}); setNotice({ kind: '', text: '' }); setEditing({ code: d.code, name: d.name, status: d.status }); }} testID={`dependency-edit-${d.code}`} />
                    </ButtonRow>
                  ) : null}
                  {isEditing ? (
                    <View style={styles.editor} testID="dependency-editor">
                      <Input label="Nombre de la dependencia" value={editing.name} onChangeText={(v) => setEditing((x) => ({ ...x, name: v }))} error={errors.name} testID="dependency-edit-name" />
                      <OptionGroup
                        label="Estado"
                        options={[{ value: 'ACTIVA', label: 'Activa' }, { value: 'INACTIVA', label: 'Inactiva' }]}
                        value={editing.status}
                        onChange={(v) => setEditing((x) => ({ ...x, status: v }))}
                        testID="dependency-edit-status"
                      />
                      <Text variant="caption" color="secondary">Para desactivar, la dependencia no debe tener expedientes abiertos ni subordinadas activas; el servidor lo verifica.</Text>
                      {/* El aviso principal (región viva) está arriba; aquí se repite junto al formulario, sin volver a anunciarlo. */}
                      {notice.kind === 'error' ? <Text color="error" testID="dependency-edit-error">{notice.text}</Text> : null}
                      <ButtonRow>
                        <Button label="Guardar cambios" onPress={saveEdit} loading={busy} testID="dependency-edit-save" />
                        <Button variant="ghost" label="Cancelar" onPress={() => { setEditing(null); setErrors({}); }} testID="dependency-edit-cancel" />
                      </ButtonRow>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </Section>

      {canManage ? (
        <Section title="Nueva dependencia" testID="dependency-create">
          <Input label="Código (3 letras)" value={draft.code} onChangeText={(v) => set('code')(v.toUpperCase())} error={errors.code} autoCapitalize="characters" placeholder="OBP" testID="dependency-code" />
          <Input label="Nombre" value={draft.name} onChangeText={set('name')} error={errors.name} testID="dependency-name" />
          <OptionGroup
            label="Dependencia superior (opcional)"
            options={[{ value: '', label: 'Ninguna' }, ...active.map((d) => ({ value: d.code, label: d.name }))]}
            value={draft.parentCode}
            onChange={set('parentCode')}
            error={errors.parentCode}
            testID="dependency-parent"
          />
          {notice.kind === 'error' && !editing ? <Text color="error" testID="dependency-create-error">{notice.text}</Text> : null}
          <ButtonRow>
            <Button label="Crear dependencia" onPress={create} loading={busy} testID="dependency-create-submit" />
          </ButtonRow>
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#d9e2ec' },
  itemHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  editor: { marginTop: spacing.sm },
});

export default DependencyAdmin;
