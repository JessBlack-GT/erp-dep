import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Text,
  Input,
  Button,
  Card,
  Badge,
  EmptyState,
  LoadingSpinner,
} from '../../components/common';
import { semanticColors, spacing } from '../../theme';
import { roleService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
const styles = StyleSheet.create({
  page: { gap: spacing.md, maxWidth: 1000, width: '100%', alignSelf: 'center' },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  form: { gap: spacing.sm, width: '100%', maxWidth: 720, alignSelf: 'center' },
  roleCard: { gap: spacing.sm },
  error: { color: semanticColors.status.error },
  muted: { color: semanticColors.text.secondary },
});
export function RolesScreen() {
  const can = usePermissions(),
    [roles, setRoles] = useState([]),
    [catalog, setCatalog] = useState([]),
    [form, setForm] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    if (!can('roles.read')) return;
    setLoading(true);
    setError('');
    Promise.all([roleService.getAll(), roleService.permissions()])
      .then(([a, b]) => {
        if (active) {
          setRoles(a.data.data);
          setCatalog(b.data.data);
        }
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar los roles.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload, can('roles.read')]);
  const save = async () => {
    if (lock.current) return;
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(form.name)) {
      setError('Usa un nombre de rol con letras minúsculas, números o guion bajo.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const data = { description: form.description, permissions: form.permissions };
      if (form.editing) await roleService.update(form.name, { ...data, status: form.status });
      else await roleService.create({ name: form.name, ...data });
      setForm(null);
      setReload((n) => n + 1);
    } catch (e) {
      setError(
        e?.response?.status === 409
          ? 'El rol ya existe.'
          : 'No se pudo guardar el rol. Revisa los permisos y los datos.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!can('roles.read')) return <Text style={styles.error}>Sin permiso para consultar roles.</Text>;
  return (
    <View style={styles.page}>
      <Text variant="heading2">Roles y permisos</Text>
      <Text style={styles.muted}>
        Los roles del sistema están protegidos. Los roles personalizados solo pueden conceder
        permisos dentro de tu ámbito.
      </Text>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {can('roles.manage') && !form && (
        <Button
          label="Crear rol"
          onPress={() => setForm({ name: '', description: '', permissions: [], status: 'active' })}
        />
      )}
      {form ? (
        <Card>
          <View style={styles.form}>
            <Input
              accessibilityRole={undefined}
              label="Nombre del rol"
              value={form.name}
              disabled={form.editing || busy}
              onChangeText={(name) => setForm({ ...form, name })}
              autoCapitalize="none"
            />
            <Input
              accessibilityRole={undefined}
              label="Descripción"
              value={form.description}
              disabled={busy}
              onChangeText={(description) => setForm({ ...form, description })}
            />
            <Text style={styles.muted}>Permisos seleccionados: {form.permissions.length}</Text>
            <View style={styles.row}>
              {catalog.map((p) => (
                <Button
                  key={p}
                  label={p}
                  variant={form.permissions.includes(p) ? 'primary' : 'outline'}
                  disabled={busy}
                  accessibilityState={{ selected: form.permissions.includes(p) }}
                  onPress={() =>
                    setForm({
                      ...form,
                      permissions: form.permissions.includes(p)
                        ? form.permissions.filter((x) => x !== p)
                        : [...form.permissions, p],
                    })
                  }
                />
              ))}
            </View>
            {form.editing && (
              <Button
                label={form.status === 'active' ? 'Desactivar rol' : 'Activar rol'}
                disabled={busy}
                onPress={() =>
                  setForm({ ...form, status: form.status === 'active' ? 'inactive' : 'active' })
                }
              />
            )}
            <Text style={styles.muted}>
              Estado: {form.status}. Los cambios se aplican a todas las personas con este rol.
            </Text>
            <Button label="Guardar rol" loading={busy} onPress={save} />
            <Button
              label="Cancelar"
              variant="ghost"
              disabled={busy}
              onPress={() => setForm(null)}
            />
          </View>
        </Card>
      ) : loading ? (
        <LoadingSpinner label="Cargando roles…" />
      ) : (
        roles.length ? (
          roles.map((r) => (
            <Card key={r.name}>
              <View style={styles.roleCard}>
                <Text variant="title" weight="semibold">
                  {r.name}
                </Text>
                <View style={styles.row}>
                  <Badge
                    label={r.isSystem ? 'Sistema protegido' : 'Personalizado'}
                    variant={r.isSystem ? 'neutral' : 'primary'}
                  />
                  <Badge
                    label={r.status}
                    variant={r.status === 'active' ? 'success' : 'neutral'}
                  />
                </View>
                <Text style={styles.muted}>{r.description}</Text>
                <Text style={styles.muted}>
                  {r.permissions.join(', ') || 'Sin permisos'}
                </Text>
                {r.editable && can('roles.manage') && (
                  <Button
                    variant="outline"
                    label={'Editar rol ' + r.name}
                    onPress={() => setForm({ ...r, editing: true })}
                  />
                )}
              </View>
            </Card>
          ))
        ) : (
          <EmptyState title="No hay roles disponibles." message="" />
        )
      )}
      {!loading && error && !form && (
        <Button label="Reintentar" onPress={() => setReload((n) => n + 1)} />
      )}
    </View>
  );
}
