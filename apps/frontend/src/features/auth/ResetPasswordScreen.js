import React, { useRef, useState } from 'react';
import { Text, Input, Button } from '../../components/common';
import { authService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AuthLayout } from './AuthLayout';

// Works in React Native without depending on browser TextEncoder or Node Buffer.
function utf8Bytes(value) {
  return Array.from(value).reduce((size, char) => {
    const point = char.codePointAt(0);
    return size + (point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4);
  }, 0);
}
const invalidLink = 'El enlace de recuperación no es válido o ha expirado.';

export function ResetPasswordScreen({ route, navigation }) {
  const token = route?.params?.token;
  const validToken = typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
  const { clearSession } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submitting = useRef(false);
  async function submit() {
    if (submitting.current || done) return;
    if (!validToken) {
      setError(invalidLink);
      return;
    }
    if (password.length < 12 || utf8Bytes(password) > 72) {
      setError('La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas deben coincidir.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      setPassword('');
      setConfirmation('');
      navigation.setParams({ token: undefined });
      // Reset revokes existing sessions; discard the local session without auto-login.
      await clearSession();
    } catch (err) {
      setError(
        [400, 401].includes(err?.response?.status)
          ? invalidLink
          : err?.response?.status === 429
            ? 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.'
            : 'No pudimos restablecer la contraseña. Inténtalo de nuevo más tarde.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <Text variant="heading1">Restablecer contraseña</Text>
      {done ? (
        <Text accessibilityLiveRegion="polite">Tu contraseña se restableció correctamente.</Text>
      ) : !validToken ? (
        <Text accessibilityRole="alert">{invalidLink}</Text>
      ) : (
        <>
          <Text color="secondary">Escribe tu nueva contraseña.</Text>
          <Text color="secondary">Mínimo 12 caracteres y máximo 72 bytes UTF-8.</Text>
          <Input
            size="large"
            label="Nueva contraseña"
            accessibilityLabel="Nueva contraseña"
            accessibilityRole={undefined}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setError('');
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            disabled={busy}
          />
          <Input
            size="large"
            label="Confirmar contraseña"
            accessibilityLabel="Confirmar contraseña"
            accessibilityRole={undefined}
            value={confirmation}
            onChangeText={(value) => {
              setConfirmation(value);
              setError('');
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            disabled={busy}
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          {!!error && <Text accessibilityRole="alert">{error}</Text>}
          <Button
            label="Restablecer contraseña"
            accessibilityLabel="Restablecer contraseña"
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
        onPress={async () => {
          await clearSession();
          navigation.navigate('Login');
        }}
      />
    </AuthLayout>
  );
}
