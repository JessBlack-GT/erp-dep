/**
 * ============================================
 * ERP-SYSTEM - Contexto de Autenticación
 * ============================================
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/api';
import { STORAGE_KEYS } from '../constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Verificar sesión guardada al iniciar
  React.useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error al verificar sesión:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email, password) => {
    const response = await authService.login(email, password);
    const result = response.data.data;
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.ACCESS_TOKEN, result.accessToken],
      [STORAGE_KEYS.REFRESH_TOKEN, result.refreshToken],
      [STORAGE_KEYS.USER, JSON.stringify(result.user)],
    ]);
    setToken(result.accessToken);
    setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
      ]);
      setToken(null);
      setUser(null);
    }
  }, []);

  const register = useCallback(async (userData) => {
    const result = await authService.register(userData);
    return result;
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const storedRefresh = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const response = await authService.refreshToken(storedRefresh);
      const result = response.data.data;
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.accessToken);
      setToken(result.accessToken);
    } catch (error) {
      await logout();
    }
  }, [logout]);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{
      user, token, loading, isAuthenticated,
      login, logout, register, refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}

export { AuthContext };
