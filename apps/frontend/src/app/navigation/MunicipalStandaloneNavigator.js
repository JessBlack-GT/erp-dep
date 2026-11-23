import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { MunicipalStandaloneLogin } from '../municipal/MunicipalStandaloneLogin';
import { MunicipalStandaloneShell } from '../municipal/MunicipalStandaloneShell';

const Stack = createNativeStackNavigator();

export function MunicipalStandaloneNavigator() {
  const { loading, isAuthenticated } = useAuth();
  if (loading) {
    return <View style={styles.loading} testID="munierp-boot"><ActivityIndicator size="large" /></View>;
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Municipal" component={MunicipalStandaloneShell} options={{ title: 'MuniERP IA' }} />
      ) : (
        <Stack.Screen name="Login" component={MunicipalStandaloneLogin} options={{ title: 'Acceso a MuniERP IA' }} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
