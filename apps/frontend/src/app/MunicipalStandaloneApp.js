import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ApiProvider } from '../context/ApiContext';
import { MunicipalAccessProvider } from '../features/municipal/MunicipalAccess';
import { MunicipalStandaloneNavigator } from './navigation/MunicipalStandaloneNavigator';

// El cliente web y el cliente Android son MuniERP IA, no una sección del menú comercial.
export default function MunicipalStandaloneApp() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ApiProvider>
          <NavigationContainer>
            <MunicipalAccessProvider>
              <MunicipalStandaloneNavigator />
            </MunicipalAccessProvider>
          </NavigationContainer>
        </ApiProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
