/**
 * ============================================
 * ERP-SYSTEM - Punto de Entrada de la Aplicación
 * ============================================
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ApiProvider } from '../context/ApiContext';
import { MainNavigator } from './navigation/MainNavigator';

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
