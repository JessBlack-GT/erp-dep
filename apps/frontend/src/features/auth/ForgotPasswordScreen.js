import React, { useRef, useState } from 'react';
import { Text, Input, Button } from '../../components/common';
import { authService } from '../../services/api';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submitting = useRef(false);
  async function submit() {
    if (submitting.current || sent) return;
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
      setError('Introduce un correo electrónico válido.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await authService.forgotPassword(value);
      setSent(true);
    } catch (err) {
      setError(
        err?.response?.status === 429
          ? 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.'
          : 'No pudimos enviar la solicitud. Inténtalo de nuevo más tarde.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <Text variant="heading1">Recuperar contraseña</Text>
      {sent ? (
        <Text accessibilityLiveRegion="polite">
          Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.
        </Text>
      ) : (
        <>
          <Text color="secondary">
            Introduce tu correo electrónico y te enviaremos instrucciones para restablecer tu
            contraseña.
          </Text>
          <Input
            size="large"
            label="Correo electrónico"
            accessibilityLabel="Correo electrónico"
            accessibilityRole={undefined}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            disabled={busy}
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          {!!error && <Text accessibilityRole="alert">{error}</Text>}
          <Button
            label="Enviar instrucciones"
            size="large"
            fullWidth
            loading={busy}
            onPress={submit}
          />
        </>
      )}
      <Button
        variant="ghost"
        label="Volver a iniciar sesión"
        disabled={busy}
        onPress={() => navigation.navigate('Login')}
      />
    </AuthLayout>
  );
}
