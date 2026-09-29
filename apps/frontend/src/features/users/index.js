import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Input, Button, Card } from '../../components/common';
import { spacing } from '../../theme';
import { userService, roleService, authService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../context/AuthContext';
const s = StyleSheet.create({
  page: { gap: spacing.md, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  field: { flexGrow: 1, flexBasis: 260 },
  card: { gap: spacing.sm },
  form: { width: '100%', maxWidth: 640, gap: spacing.md },
});
const ErrorText = ({ children }) =>
  children ? <Text accessibilityRole="alert">{children}</Text> : null;
const errorMessage = (error) =>
  ({
    400: 'Revisa los datos introducidos.',
    401: 'La sesión ya no es válida.',
    403: 'No tienes permiso para esta operación.',
    404: 'El registro ya no existe.',
    409: 'El correo o nombre ya está registrado.',
  })[error?.response?.status] || 'No se pudo completar la operación. Inténtalo nuevamente.';
export function UserList({ items, onSelect }) {
  return items.length ? (
    items.map((item) => (
      <Card key={item._id}>
        <View style={s.card}>
          <Text weight="semibold">
            {item.firstName} {item.lastName}
          </Text>
          <Text>{item.email}</Text>
          <Text>
            {item.role} · {item.status}
          </Text>
          <Button
            variant="outline"
            label={'Ver ' + item.email}
            onPress={() => onSelect(item._id)}
          />
        </View>
      </Card>
    ))
  ) : (
    <Text>No hay usuarios para estos filtros.</Text>
  );
}
export function UsersScreen({ navigation, route }) {
  const can = usePermissions();
  const [search, setSearch] = useState(''),
    [role, setRole] = useState(''),
    [status, setStatus] = useState(''),
    [query, setQuery] = useState({ page: 1 }),
    [data, setData] = useState({ items: [], pagination: { pages: 0 } }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!can('users.read')) return;
    setLoading(true);
    setError('');
    userService
      .getAll({ ...query, limit: 10 })
      .then((r) => {
        if (active) setData(r.data.data);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, route?.params?.refresh, can('users.read')]);
  if (!can('users.read')) return <Text>Sin permiso para consultar usuarios.</Text>;
  return (
    <View style={s.page}>
      <Text variant="heading2">Usuarios</Text>
      <View style={s.row}>
        {can('users.create') && (
          <Button
            label="Crear usuario"
            onPress={() => navigation.navigate('UserForm', { id: null })}
          />
        )}
        {can('roles.read') && (
          <Button
            variant="outline"
            label="Roles y permisos"
            onPress={() => navigation.navigate('Roles')}
          />
        )}
      </View>
      <View style={s.row}>
        <Input
          accessibilityRole={undefined}
          style={s.field}
          label="Buscar usuarios"
          value={search}
          onChangeText={setSearch}
        />
        <Input
          accessibilityRole={undefined}
          style={s.field}
          label="Filtrar por rol"
          value={role}
          onChangeText={setRole}
          autoCapitalize="none"
        />
      </View>
      <View style={s.row}>
        {[
          ['', 'Todos'],
          ['active', 'Activos'],
          ['inactive', 'Inactivos'],
        ].map(([value, label]) => (
          <Button
            key={label}
            variant={status === value ? 'primary' : 'outline'}
            label={label}
            onPress={() => {
              setStatus(value);
              setQuery({
                page: 1,
                ...(search ? { search } : {}),
                ...(role ? { role } : {}),
                ...(value ? { status: value } : {}),
              });
            }}
          />
        ))}
        <Button
          label="Aplicar filtros"
          onPress={() =>
            setQuery({
              page: 1,
              ...(search ? { search } : {}),
              ...(role ? { role } : {}),
              ...(status ? { status } : {}),
            })
          }
        />
      </View>
      <ErrorText>{error}</ErrorText>
      {loading ? (
        <Text accessibilityLiveRegion="polite">Cargando usuarios…</Text>
      ) : (
        !error && (
          <UserList
            items={data.items}
            onSelect={(id) => navigation.navigate('UserDetail', { id })}
          />
        )
      )}
      {error && <Button label="Reintentar" onPress={() => setQuery({ ...query })} />}
      <View style={s.row}>
        <Button
          label="Anterior"
          disabled={loading || query.page <= 1}
          onPress={() => setQuery({ ...query, page: query.page - 1 })}
        />
        <Text>
          Página {query.page} de {Math.max(1, data.pagination.pages)}
        </Text>
        <Button
          label="Siguiente"
          disabled={loading || query.page >= data.pagination.pages}
          onPress={() => setQuery({ ...query, page: query.page + 1 })}
        />
      </View>
    </View>
  );
}
export function UserForm({ navigation, route }) {
  const id = route?.params?.id,
    can = usePermissions();
  const [fields, setFields] = useState({
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      password: '',
      role: 'user',
    }),
    [roles, setRoles] = useState([]),
    [loading, setLoading] = useState(!!id),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setError('');
    setLoading(!!id);
    setFields({ email: '', firstName: '', lastName: '', phone: '', password: '', role: 'user' });
    if (id)
      userService
        .getById(id)
        .then((r) => {
          if (active) setFields({ ...r.data.data, password: '' });
        })
        .catch((e) => {
          if (active) setError(errorMessage(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    if (!id && can('roles.read') && can('users.assignRole'))
      roleService
        .getAll()
        .then((r) => {
          if (active) setRoles(r.data.data.filter((x) => x.assignable));
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);
  const save = async () => {
    if (lock.current) return;
    if (
      !fields.firstName.trim() ||
      !fields.lastName.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()) ||
      (!id && fields.password.length < 12)
    ) {
      setError(
        'Completa nombre, apellido, correo válido y una contraseña de al menos 12 caracteres.',
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const data = {
        email: fields.email.trim(),
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        ...(fields.phone ? { phone: fields.phone } : {}),
      };
      const response = id
        ? await userService.update(id, data)
        : await userService.create({ ...data, password: fields.password, role: fields.role });
      setFields((f) => ({ ...f, password: '' }));
      navigation.navigate('UserDetail', { id: response.data.data._id, refresh: Date.now() });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!can(id ? 'users.update' : 'users.create'))
    return <Text>Sin permiso para administrar usuarios.</Text>;
  if (loading) return <Text>Cargando usuario…</Text>;
  return (
    <View style={s.form}>
      <Text variant="heading2">{id ? 'Editar usuario' : 'Nuevo usuario'}</Text>
      <ErrorText>{error}</ErrorText>
      {[
        ['firstName', 'Nombre'],
        ['lastName', 'Apellido'],
        ['email', 'Correo'],
        ['phone', 'Teléfono'],
        ...(!id ? [['password', 'Contraseña inicial']] : []),
      ].map(([key, label]) => (
        <Input
          accessibilityRole={undefined}
          key={key}
          label={label}
          value={fields[key] || ''}
          disabled={busy}
          secureTextEntry={key === 'password'}
          autoCapitalize={key === 'email' ? 'none' : 'sentences'}
          onChangeText={(value) => setFields({ ...fields, [key]: value })}
        />
      ))}
      {!id && (
        <>
          <Text>Rol: {fields.role}</Text>
          <View style={s.row}>
            {roles.map((r) => (
              <Button
                key={r.name}
                label={'Asignar ' + r.name}
                variant={fields.role === r.name ? 'primary' : 'outline'}
                disabled={busy}
                onPress={() => setFields({ ...fields, role: r.name })}
              />
            ))}
          </View>
        </>
      )}
      <Button label="Guardar usuario" loading={busy} onPress={save} />
      <Button
        variant="ghost"
        label="Volver a usuarios"
        onPress={() => navigation.navigate('Users', { refresh: Date.now() })}
      />
    </View>
  );
}
export function UserDetail({ navigation, route }) {
  const id = route?.params?.id,
    can = usePermissions(),
    { user } = useAuth();
  const [item, setItem] = useState(null),
    [roles, setRoles] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setItem(null);
    setError('');
    userService
      .getById(id)
      .then((r) => {
        if (active) setItem(r.data.data);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    if (can('roles.read'))
      roleService
        .getAll()
        .then((r) => {
          if (active) setRoles(r.data.data);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, route?.params?.refresh]);
  if (!can('users.read')) return <Text>Sin permiso para consultar usuarios.</Text>;
  const currentRole = roles.find((r) => r.name === item?.role);
  const within =
    user?.isSuperadmin ||
    (currentRole && currentRole.permissions.every((p) => user?.permissions?.includes(p)));
  const own = item?._id === user?.id,
    superTarget = ['superadmin', 'super_admin'].includes(item?.role);
  const editable = item && item.status !== 'deleted' && within && (!superTarget || own);
  const lifecycle = editable && !own && !superTarget;
  const confirm = async () => {
    if (lock.current || !pending) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const response =
        pending.kind === 'role'
          ? await userService.assignRole(id, pending.value)
          : await userService.changeStatus(id, pending.value);
      setItem(response.data.data);
      setPending(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={s.page}>
      <Text variant="heading2">Detalle de usuario</Text>
      <ErrorText>{error}</ErrorText>
      {!item && !error && <Text>Cargando usuario…</Text>}
      {item && (
        <Card>
          <View style={s.card}>
            <Text>
              {item.firstName} {item.lastName}
            </Text>
            <Text>{item.email}</Text>
            <Text>Rol: {item.role}</Text>
            <Text>Estado: {item.status}</Text>
            {superTarget && <Text>Cuenta del sistema protegida.</Text>}
            {editable && can('users.update') && (
              <Button
                label="Editar usuario"
                onPress={() => navigation.navigate('UserForm', { id })}
              />
            )}
            {lifecycle && can('users.status') && (
              <Button
                label={item.status === 'active' ? 'Desactivar usuario' : 'Activar usuario'}
                disabled={busy}
                onPress={() =>
                  setPending({
                    kind: 'status',
                    value: item.status === 'active' ? 'inactive' : 'active',
                  })
                }
              />
            )}
            {lifecycle && can('users.assignRole') && (
              <View style={s.row}>
                {roles
                  .filter((r) => r.assignable && r.name !== item.role)
                  .map((r) => (
                    <Button
                      key={r.name}
                      variant="outline"
                      label={'Cambiar rol a ' + r.name}
                      disabled={busy}
                      onPress={() => setPending({ kind: 'role', value: r.name })}
                    />
                  ))}
              </View>
            )}
          </View>
        </Card>
      )}
      {pending && (
        <Card>
          <Text>Confirmar cambio a {pending.value}. Se cerrarán las sesiones del usuario.</Text>
          <Button label="Confirmar cambio" loading={busy} onPress={confirm} />
          <Button
            label="Cancelar cambio"
            variant="ghost"
            disabled={busy}
            onPress={() => setPending(null)}
          />
        </Card>
      )}
      <Button
        label="Volver a usuarios"
        variant="outline"
        onPress={() => navigation.navigate('Users', { refresh: Date.now() })}
      />
    </View>
  );
}
export function PasswordScreen() {
  const { clearSession } = useAuth();
  const [current, setCurrent] = useState(''),
    [next, setNext] = useState(''),
    [confirm, setConfirm] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const save = async () => {
    if (lock.current) return;
    if (!current || next.length < 12 || next !== confirm) {
      setError('Verifica la contraseña actual, un mínimo de 12 caracteres y la confirmación.');
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await authService.changePassword({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      await clearSession();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={s.form}>
      <Text variant="heading2">Cambiar contraseña</Text>
      <Text>Al guardar se cerrarán todas tus sesiones.</Text>
      <ErrorText>{error}</ErrorText>
      <Input
        accessibilityRole={undefined}
        label="Contraseña actual"
        secureTextEntry
        value={current}
        onChangeText={setCurrent}
        disabled={busy}
      />
      <Input
        accessibilityRole={undefined}
        label="Nueva contraseña"
        secureTextEntry
        value={next}
        onChangeText={setNext}
        disabled={busy}
      />
      <Input
        accessibilityRole={undefined}
        label="Confirmar contraseña"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        disabled={busy}
      />
      <Button label="Actualizar contraseña" loading={busy} onPress={save} />
    </View>
  );
}
