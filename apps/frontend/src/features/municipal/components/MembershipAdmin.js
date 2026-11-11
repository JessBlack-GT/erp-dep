/**
 * MuniERP IA — membresías y permisos municipales (F1-15a, RQ05).
 *
 * Operaciones de draft.3: listMemberships (filtros role, dependency, status y paginación),
 * createMembership (usuario EXISTENTE de YJ Nexo, por su identificador central) y updateMembership
 * (rol, dependencias y estado; revocar = INACTIVA con efecto inmediato).
 *
 * Seguridad (la decide el servidor; la interfaz solo evita ofrecer lo que el contrato prohíbe):
 *  - no se ofrece el rol ADMIN_MUNICIPAL ni se editan membresías de administrador;
 *  - no se ofrece editar la propia membresía (el servidor responde 403 si se intenta);
 *  - el usuario debe existir y estar activo en la identidad central (404 si no);
 *  - TITULAR solo ve las membresías de sus dependencias (alcance D del servidor).
 * No se muestran nombres ni correos: el contrato entrega solo `userId` (propuesta X-01).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Badge, Button, Input, LoadingSpinner } from '../../../components/common';
import { spacing } from '../../../theme';
import { OptionGroup } from './OptionGroup';
import { CheckboxGroup } from './CheckboxGroup';
import { Heading, Section, ButtonRow } from './Section';
import {
  ACTIVE_STATUS_LABELS, ASSIGNABLE_ROLES, MEMBERSHIP_PERMISSIONS, ROLE_LABELS, roleLabel, userLabel,
  validateMembershipForm, describeAdminError, formatDate,
} from '../model';

const PAGE_SIZE = 10;
const EMPTY_FORM = { userId: '', role: 'OPERADOR_DEPENDENCIA', dependencies: [] };
const ROLE_FILTERS = [{ value: '', label: 'Todos' }, ...Object.keys(ROLE_LABELS).map((r) => ({ value: r, label: ROLE_LABELS[r] }))];
const STATUS_FILTERS = [{ value: '', label: 'Todas' }, { value: 'ACTIVA', label: 'Activas' }, { value: 'INACTIVA', label: 'Inactivas' }];

export function MembershipAdmin({ api, membership, dependencies = [], testID = 'municipal-memberships' }) {
  const canManage = !!membership && (membership.permissions || []).includes(MEMBERSHIP_PERMISSIONS.manage);
  const [filters, setFilters] = useState({ role: '', status: '', dependency: '', page: 1 });
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, error: '' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null); // { id, role, dependencies }
  const [revoking, setRevoking] = useState(null); // id pendiente de confirmar
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ kind: '', text: '' });

  const load = useCallback(async (f) => {
    setState((s) => ({ ...s, status: 'loading', error: '' }));
    const query = { page: f.page, limit: PAGE_SIZE };
    if (f.role) query.role = f.role;
    if (f.status) query.status = f.status;
    if (f.dependency) query.dependency = f.dependency;
    try {
      const r = await api.listMembershipPage(query);
      setState({ status: r.items.length ? 'ready' : 'empty', items: r.items, pagination: r.pagination, error: '' });
    } catch (e) {
      const d = describeAdminError(e);
      const denied = d.kind === 'forbidden' || d.kind === 'membership';
      setState({ status: denied ? 'denied' : 'error', items: [], pagination: null, error: d.kind === 'forbidden' ? 'Su rol municipal no permite consultar membresías.' : d.message });
    }
  }, [api]);

  useEffect(() => { load(filters); }, [filters, load]);

  const depName = (code) => (dependencies.find((d) => d.code === code) || {}).name || code;
  const depOptions = dependencies.filter((d) => d.status !== 'INACTIVA').map((d) => ({ value: d.code, label: d.name }));
  const setFilter = (field) => (v) => setFilters((f) => ({ ...f, [field]: v, page: 1 }));
  const after = async (text) => { setNotice({ kind: 'ok', text }); await load(filters); };

  async function create() {
    const { errors: found, body } = validateMembershipForm(form, { creating: true });
    setErrors(found);
    setNotice({ kind: '', text: '' });
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const saved = await api.createMembership(body);
      setForm(EMPTY_FORM);
      await after(`Membresía creada: ${userLabel(saved.userId)} como ${roleLabel(saved.role)}.`);
    } catch (e) {
      setNotice({ kind: 'error', text: describeAdminError(e).message });
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    const { errors: found, body } = validateMembershipForm(editing, { creating: false });
    setErrors(found);
    setNotice({ kind: '', text: '' });
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const saved = await api.updateMembership(editing.id, body);
      setEditing(null);
      await after(`Membresía de ${userLabel(saved.userId)} actualizada: ${roleLabel(saved.role)}.`);
    } catch (e) {
      setNotice({ kind: 'error', text: describeAdminError(e).message });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(m, status) {
    setNotice({ kind: '', text: '' });
    setBusy(true);
    try {
      const saved = await api.updateMembership(m.id, { status });
      setRevoking(null);
      await after(status === 'INACTIVA' ? `Membresía de ${userLabel(saved.userId)} revocada. El acceso se retira de inmediato.` : `Membresía de ${userLabel(saved.userId)} reactivada.`);
    } catch (e) {
      setNotice({ kind: 'error', text: describeAdminError(e).message });
    } finally {
      setBusy(false);
    }
  }

  const title = <Heading level={1} testID="memberships-title">Membresías y permisos</Heading>;
  if (state.status === 'denied')
    return (
      <View testID={`${testID}-denied`}>
        {title}
        <Text color="error" accessibilityRole="alert" testID="memberships-denied-message">{state.error}</Text>
      </View>
    );

  const p = state.pagination;
  return (
    <View testID={testID}>
      {title}
      <Text variant="caption" color="secondary">
        {canManage
          ? 'Asigne usuarios existentes de YJ Nexo al municipio. No se crean usuarios ni administradores municipales, y no puede modificar su propia membresía.'
          : 'Solo consulta: su rol no administra membresías.'}
      </Text>
      {notice.text ? (
        <Text color={notice.kind === 'ok' ? 'success' : 'error'} accessibilityRole={notice.kind === 'ok' ? undefined : 'alert'} accessibilityLiveRegion="polite" testID="memberships-notice">{notice.text}</Text>
      ) : null}

      <Section title="Filtros" testID="memberships-filters">
        <OptionGroup label="Rol" options={ROLE_FILTERS} value={filters.role} onChange={setFilter('role')} testID="memberships-filter-role" />
        <OptionGroup label="Estado" options={STATUS_FILTERS} value={filters.status} onChange={setFilter('status')} testID="memberships-filter-status" />
        <OptionGroup label="Dependencia" options={[{ value: '', label: 'Todas' }, ...dependencies.map((d) => ({ value: d.code, label: d.name }))]} value={filters.dependency} onChange={setFilter('dependency')} testID="memberships-filter-dependency" />
      </Section>

      <Section title="Membresías" testID="memberships-results">
        {state.status === 'loading' ? <LoadingSpinner label="Cargando membresías…" testID="memberships-loading" /> : null}
        {state.status === 'error' ? (
          <View>
            <Text color="error" accessibilityRole="alert" testID="memberships-error">{state.error}</Text>
            <Button variant="secondary" label="Reintentar" onPress={() => load(filters)} testID="memberships-retry" />
          </View>
        ) : null}
        {state.status === 'empty' ? <Text testID="memberships-empty">No hay membresías para los filtros seleccionados.</Text> : null}
        {state.status === 'ready' ? (
          <>
            <Text variant="caption" accessibilityLiveRegion="polite" testID="memberships-summary">{`Página ${p.page} de ${Math.max(p.pages, 1)} · ${p.total} membresía(s)`}</Text>
            <View accessibilityRole="list" testID="memberships-list">
              {state.items.map((m) => {
                const st = ACTIVE_STATUS_LABELS[m.status] || { label: m.status, variant: 'neutral' };
                const own = membership && m.id === membership.id;
                const isAdmin = m.role === 'ADMIN_MUNICIPAL';
                const editable = canManage && !own && !isAdmin;
                const isEditing = editing && editing.id === m.id;
                const deps = (m.dependencies || []).map(depName).join(', ') || 'Todo el municipio';
                const label = `${userLabel(m.userId)}, ${roleLabel(m.role)}, ${deps}, ${st.label}, ${m.effective ? 'vigente' : 'sin efecto'}`;
                return (
                  <View key={m.id} accessibilityRole="listitem" accessibilityLabel={label} style={styles.item} testID={`membership-${m.id}`}>
                    <View style={styles.itemHeader}>
                      <Text weight="bold">{`${userLabel(m.userId)} · ${roleLabel(m.role)}`}</Text>
                      <Badge label={st.label} variant={st.variant} />
                    </View>
                    <Text>{`Dependencias: ${deps}`}</Text>
                    <Text variant="caption" color="secondary">
                      {`${m.effective ? 'Vigente' : 'Sin efecto'} · desde ${formatDate(m.validFrom)}${m.validTo ? ` · hasta ${formatDate(m.validTo)}` : ''}`}
                      {own ? ' · Su membresía' : ''}
                      {isAdmin ? ' · Gestionada por la operación del sistema' : ''}
                    </Text>
                    {editable && !isEditing && revoking !== m.id ? (
                      <ButtonRow>
                        {m.status === 'ACTIVA' ? (
                          <Button variant="secondary" size="small" label="Editar" accessibilityLabel={`Editar membresía de ${userLabel(m.userId)}`} onPress={() => { setErrors({}); setNotice({ kind: '', text: '' }); setEditing({ id: m.id, role: m.role, dependencies: m.dependencies || [] }); }} testID={`membership-edit-${m.id}`} />
                        ) : null}
                        {m.status === 'ACTIVA' ? (
                          <Button variant="danger" size="small" label="Revocar" accessibilityLabel={`Revocar membresía de ${userLabel(m.userId)}`} onPress={() => { setNotice({ kind: '', text: '' }); setRevoking(m.id); }} testID={`membership-revoke-${m.id}`} />
                        ) : (
                          <Button variant="secondary" size="small" label="Reactivar" accessibilityLabel={`Reactivar membresía de ${userLabel(m.userId)}`} onPress={() => setStatus(m, 'ACTIVA')} loading={busy} testID={`membership-reactivate-${m.id}`} />
                        )}
                      </ButtonRow>
                    ) : null}
                    {revoking === m.id ? (
                      <View style={styles.editor} testID="membership-revoke-confirm">
                        <Text accessibilityRole="alert">{`¿Revocar la membresía de ${userLabel(m.userId)}? Perderá el acceso municipal de inmediato. Podrá reactivarse después.`}</Text>
                        <ButtonRow>
                          <Button variant="danger" label="Confirmar revocación" onPress={() => setStatus(m, 'INACTIVA')} loading={busy} testID="membership-revoke-confirm-button" />
                          <Button variant="ghost" label="Cancelar" onPress={() => setRevoking(null)} testID="membership-revoke-cancel" />
                        </ButtonRow>
                      </View>
                    ) : null}
                    {isEditing ? (
                      <View style={styles.editor} testID="membership-editor">
                        <OptionGroup label="Rol" options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} value={editing.role} onChange={(v) => setEditing((x) => ({ ...x, role: v }))} error={errors.role} testID="membership-edit-role" />
                        <CheckboxGroup label="Dependencias" options={depOptions} values={editing.dependencies} onChange={(v) => setEditing((x) => ({ ...x, dependencies: v }))} error={errors.dependencies} testID="membership-edit-deps" />
                        {notice.kind === 'error' ? <Text color="error" testID="membership-edit-error">{notice.text}</Text> : null}
                        <ButtonRow>
                          <Button label="Guardar cambios" onPress={saveEdit} loading={busy} testID="membership-edit-save" />
                          <Button variant="ghost" label="Cancelar" onPress={() => { setEditing(null); setErrors({}); }} testID="membership-edit-cancel" />
                        </ButtonRow>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
            <ButtonRow>
              <Button variant="secondary" label="Página anterior" onPress={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} disabled={p.page <= 1} testID="memberships-prev" />
              <Button variant="secondary" label="Página siguiente" onPress={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} disabled={p.page >= p.pages} testID="memberships-next" />
            </ButtonRow>
          </>
        ) : null}
      </Section>

      {canManage ? (
        <Section title="Asignar usuario al municipio" testID="membership-create">
          <Input
            label="Identificador del usuario central"
            helperText="24 caracteres; el usuario debe existir y estar activo en YJ Nexo."
            value={form.userId}
            onChangeText={(v) => setForm((f) => ({ ...f, userId: v }))}
            error={errors.userId}
            autoCapitalize="none"
            testID="membership-user"
          />
          <OptionGroup label="Rol municipal" options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} error={errors.role} testID="membership-role" />
          <CheckboxGroup label="Dependencias" hint="Titular, operador y consulta requieren al menos una." options={depOptions} values={form.dependencies} onChange={(v) => setForm((f) => ({ ...f, dependencies: v }))} error={errors.dependencies} testID="membership-deps" />
          {notice.kind === 'error' && !editing && !revoking ? <Text color="error" testID="membership-create-error">{notice.text}</Text> : null}
          <ButtonRow>
            <Button label="Asignar membresía" onPress={create} loading={busy} testID="membership-create-submit" />
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

export default MembershipAdmin;
