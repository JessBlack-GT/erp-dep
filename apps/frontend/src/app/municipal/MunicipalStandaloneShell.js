import React, { useState } from 'react';
import { Image, ScrollView, View, StyleSheet } from 'react-native';
import { Button, Text } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { MunicipalScreen } from '../../features/municipal/MunicipalScreen';
import { spacing, semanticColors } from '../../theme';

export function MunicipalStandaloneShell() {
  const { user, logout } = useAuth();
  const [closing, setClosing] = useState(false);
  const signOut = async () => {
    if (closing) return;
    setClosing(true);
    try { await logout(); } finally { setClosing(false); }
  };
  return (
    <View style={styles.root} testID="munierp-standalone-shell">
      <View style={styles.topbar}>
        <Image source={require('../../assets/munierp-horizontal-approved.png')} resizeMode="contain" accessibilityLabel="MuniERP IA" style={styles.logo} />
        <View style={styles.account}>
          <Text variant="caption" numberOfLines={1}>{user?.email || 'Usuario'}</Text>
          <Button variant="secondary" label="Cerrar sesión" disabled={closing} loading={closing} onPress={signOut} testID="munierp-logout" />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <MunicipalScreen />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semanticColors.background.primary },
  topbar: { padding: spacing.md, backgroundColor: '#FFFFFF', borderBottomColor: semanticColors.border.default, borderBottomWidth: 1, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  logo: { width: 244, height: 56 },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  content: { flexGrow: 1, width: '100%' },
});
