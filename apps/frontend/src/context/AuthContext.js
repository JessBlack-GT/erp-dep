import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/api';
import { sessionEvents } from '../services/sessionEvents';
import { STORAGE_KEYS } from '../constants';
const AuthContext = createContext(null);
const keys = [STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN, STORAGE_KEYS.USER];
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [token, setToken] = useState(null),
    [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const clear = useCallback(async () => {
    generation.current += 1;
    setUser(null);
    setToken(null);
    await AsyncStorage.multiRemove(keys);
  }, []);
  const refreshSession = useCallback(async () => {
    const version = generation.current;
    try {
      const refresh = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refresh) {
        await clear();
        return;
      }
      const response = await authService.refreshToken(refresh);
      if (version !== generation.current) return;
      const access = response.data.data.accessToken;
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access);
      const me = (await authService.getMe()).data.data;
      if (version !== generation.current) {
        await AsyncStorage.multiRemove(keys);
        return;
      }
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(me));
      if (version !== generation.current) {
        await AsyncStorage.multiRemove(keys);
        return;
      }
      setToken(access);
      setUser(me);
    } catch (_) {
      await clear();
    }
  }, [clear]);
  useEffect(() => {
    let active = true;
    refreshSession().finally(() => {
      if (active) setLoading(false);
    });
    const unsubscribe = sessionEvents.subscribe((type) => {
      if (type === 'invalid') {
        clear();
        return;
      }
      const version = generation.current;
      authService
        .getMe()
        .then(async (response) => {
          if (version !== generation.current || !active) return;
          setUser(response.data.data);
          await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data.data));
        })
        .catch(() => clear());
    });
    return () => {
      active = false;
      generation.current += 1;
      unsubscribe();
    };
  }, [clear, refreshSession]);
  const login = useCallback(async (email, password) => {
    const version = ++generation.current;
    const result = (await authService.login(email, password)).data.data;
    if (version !== generation.current) return;
    await AsyncStorage.multiSet([
      [keys[0], result.accessToken],
      [keys[1], result.refreshToken],
      [keys[2], JSON.stringify(result.user)],
    ]);
    if (version !== generation.current) {
      await AsyncStorage.multiRemove(keys);
      return;
    }
    setToken(result.accessToken);
    setUser(result.user);
    return result;
  }, []);
  const logout = useCallback(async () => {
    generation.current += 1;
    try {
      await authService.logout();
    } finally {
      await clear();
    }
  }, [clear]);
  const register = useCallback((data) => authService.register(data), []);
  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        register,
        refreshSession,
        clearSession: clear,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  return context;
}
export { AuthContext };
