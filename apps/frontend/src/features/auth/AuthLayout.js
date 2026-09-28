import React from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../../components/common';
import { brandAssets } from '../../assets';
import { breakpoints, semanticColors, spacing, radius } from '../../theme';

export function AuthLayout({ children }) {
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.tablet;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.page, wide && styles.columns]} keyboardShouldPersistTaps="handled">
        <View testID="auth-brand-panel" style={[styles.brand, wide && styles.brandWide, width >= breakpoints.desktop && styles.brandDesktop]}>
          <Image source={brandAssets.horizontalDark} resizeMode="contain" accessibilityLabel="YJ Nexo" style={styles.logo} />
          {wide && <View style={styles.message}>
            <View style={styles.accent} />
            <Text variant="display" color="inverse">Tu operación, conectada.</Text>
            <Text variant="subtitle" color="inverse">Clientes, proveedores e inventario en un mismo lugar.</Text>
            <View style={styles.modules}>
              {['Organiza', 'Conecta', 'Avanza'].map(label => <View key={label} style={styles.module}><Text color="inverse">{label}</Text></View>)}
            </View>
          </View>}
          {wide && <Text variant="bodySmall" color="inverse">YJ Nexo · Gestión empresarial</Text>}
        </View>
        <View style={[styles.formArea, wide && styles.formWide]}>
          <View style={styles.form}>{children}</View>
          <Text variant="bodySmall" color="secondary" style={styles.footer}>YJ Nexo ERP</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semanticColors.surface.primary },
  page: { flexGrow: 1 },
  columns: { flexDirection: 'row' },
  brand: { backgroundColor: semanticColors.brand.navy, padding: spacing.lg, gap: spacing.xl },
  brandWide: { width: '42%', padding: spacing.xl, justifyContent: 'space-between', minHeight: 640 },
  brandDesktop: { width: '48%', padding: spacing.xxl },
  logo: { width: '100%', maxWidth: 260, height: 80, alignSelf: 'flex-start' },
  message: { gap: spacing.lg, maxWidth: 420, paddingVertical: spacing.xxl },
  accent: { width: spacing.xxl, height: spacing.xs, backgroundColor: semanticColors.brand.blueDark },
  modules: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  module: { padding: spacing.sm, borderRadius: radius.medium, backgroundColor: semanticColors.brand.slateNavy },
  formArea: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  formWide: { flex: 1, padding: spacing.xl },
  form: { width: '100%', maxWidth: 420, gap: spacing.lg },
  footer: { marginTop: spacing.xxl },
});
