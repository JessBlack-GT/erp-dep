import React, { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text, Input, Button } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { spacing, radius, semanticColors } from '../../theme';

// Logotipo aprobado en Figma: M de precisión / Horizontal / Color (nodo 2:444).
export function MunicipalStandaloneLogin() {
  const { login } = useAuth();
  const inFlight = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (inFlight.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
      setError('Introduce un correo válido y una contraseña.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e?.response?.status === 401
        ? 'Credenciales incorrectas.'
        : 'No fue posible iniciar sesión. Comprueba tu conexión e inténtalo nuevamente.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.card} testID="munierp-login">
          <View style={styles.brand}>
            <Image source={require('../../assets/munierp-horizontal-approved.png')} resizeMode="contain" accessibilityLabel="MuniERP IA" style={styles.logo} />
            <Text color="secondary">Gestión municipal</Text>
          </View>
          <View style={styles.form}>
            <Text variant="heading2">Acceso al sistema</Text>
            <Text color="secondary">Inicia sesión con tus credenciales autorizadas.</Text>
            <Input label="Correo electrónico" value={email} onChangeText={setEmail}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              autoComplete="email" disabled={busy} testID="munierp-email" />
            <Input label="Contraseña" value={password} onChangeText={setPassword}
              secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="current-password"
              disabled={busy} testID="munierp-password"
              rightElement={<Button variant="ghost" label={showPassword ? 'Ocultar' : 'Mostrar'}
                onPress={() => setShowPassword((v) => !v)} disabled={busy} />} />
            {!!error && <Text color="error" accessibilityRole="alert" testID="munierp-login-error">{error}</Text>}
            <Button label="Iniciar sesión" onPress={submit} loading={busy} fullWidth testID="munierp-login-submit" />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semanticColors.background.primary },
  screen: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 510, backgroundColor: '#ffffff', borderRadius: radius.large,
    borderColor: semanticColors.border.default, borderWidth: 1, overflow: 'hidden' },
  brand: { backgroundColor: '#FFFFFF', padding: spacing.xl, gap: spacing.xs, alignItems: 'center' },
  logo: { width: '100%', maxWidth: 405, height: 96 },
  form: { padding: spacing.xl, gap: spacing.md },
});
