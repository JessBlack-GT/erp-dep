import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Input, Button } from '../../components/common';
import { semanticColors, spacing, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { AuthLayout } from './AuthLayout';

export function LoginScreen() {
  const { login } = useAuth();
  const submitting = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');

  async function submit() {
    if (submitting.current) return;
    const next = {};
    if (!email.trim()) next.email = 'Introduce tu correo electrónico.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Introduce un correo electrónico válido.';
    if (!password) next.password = 'Introduce tu contraseña.';
    setFields(next);
    setError('');
    if (Object.keys(next).length) return;
    submitting.current = true;
    setBusy(true);
    try { await login(email.trim(), password); }
    catch (err) {
      const status = err?.response?.status;
      setError(status === 401
        ? 'Credenciales inválidas'
        : !err?.response && ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(err?.code)
          ? 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'
          : 'No se pudo iniciar sesión. Inténtalo de nuevo más tarde.');
    } finally { submitting.current = false; setBusy(false); }
  }
  function change(field, value) {
    (field === 'email' ? setEmail : setPassword)(value);
    setFields(current => ({ ...current, [field]: '' }));
    setError('');
  }
  return <AuthLayout>
    <View style={styles.heading}>
      <Text variant="heading1">Bienvenido</Text>
      <Text color="secondary">Inicia sesión para continuar con tu equipo.</Text>
    </View>
    <Input size="large" errorStyle={styles.fieldError} label="Correo electrónico" accessibilityLabel="Correo electrónico" accessibilityRole={undefined}
      value={email} onChangeText={value => change('email', value)} error={fields.email}
      autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address"
      disabled={busy} onSubmitEditing={submit} returnKeyType="go" testID="login-email" />
    <Input size="large" errorStyle={styles.fieldError} label="Contraseña" accessibilityRole={undefined} value={password}
      onChangeText={value => change('password', value)} error={fields.password} secureTextEntry={!visible}
      autoCapitalize="none" autoCorrect={false} autoComplete="current-password" disabled={busy}
      onSubmitEditing={submit} returnKeyType="go" testID="login-password"
      rightElement={<Button variant="ghost" size="large" label={visible ? 'Ocultar' : 'Mostrar'}
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        disabled={busy} onPress={() => setVisible(current => !current)} />} />
    {!!error && <View style={styles.error}><Text accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text></View>}
    <Button label="Iniciar sesión" accessibilityLabel={busy ? 'Iniciando sesión' : 'Iniciar sesión'}
      size="large" fullWidth loading={busy} onPress={submit} testID="login-submit" />
    {busy && <Text accessibilityLiveRegion="polite" color="secondary">Iniciando sesión…</Text>}
  </AuthLayout>;
}
const styles = StyleSheet.create({
  fieldError: { color: semanticColors.text.primary },
  heading: { gap: spacing.sm, marginBottom: spacing.sm },
  error: { backgroundColor: semanticColors.status.errorBg, borderLeftWidth: 3, borderColor: semanticColors.status.error, padding: spacing.md, borderRadius: radius.medium },
});
