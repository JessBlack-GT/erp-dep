import React, { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) { setError('Introduce email y contraseña'); return; }
    setBusy(true); setError('');
    try { await login(email.trim(), password); }
    catch (err) { setError(err.response?.status === 401 ? 'Credenciales inválidas' : 'No se pudo iniciar sesión'); }
    finally { setBusy(false); }
  }
  return <View style={styles.container}>
    <Text style={styles.title}>ERP · Clientes</Text>
    <TextInput accessibilityLabel="Email" placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} editable={!busy} />
    <TextInput accessibilityLabel="Contraseña" placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} editable={!busy} onSubmitEditing={submit} />
    {!!error && <Text accessibilityRole="alert">{error}</Text>}
    {busy && <ActivityIndicator accessibilityLabel="Iniciando sesión" />}
    <Button title="Entrar" onPress={submit} disabled={busy} />
  </View>;
}
const styles = StyleSheet.create({ container: { padding: 24, width: '100%', maxWidth: 480, alignSelf: 'center', gap: 16 }, title: { fontSize: 24 }, input: { borderWidth: 1, borderColor: '#777', padding: 12, borderRadius: 6 } });
