/**
 * ============================================
 * ERP-SYSTEM - Punto de Entrada de la Aplicación
 * ============================================
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './app/providers/AuthProvider';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { ApiProvider } from './app/providers/ApiProvider';
import { MainNavigator } from './app/navigation/MainNavigator';
import { LoadingScreen } from './app/components/feedback/LoadingScreen';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ApiProvider>
          <NavigationContainer>
            <MainNavigator />
          </NavigationContainer>
        </ApiProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
