/**
 * ============================================
 * ERP-SYSTEM - Contexto de API
 * ============================================
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { apiClient } from '../services/api';

const ApiContext = createContext(null);

export function ApiProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (config) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient(config);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <ApiContext.Provider value={{ request, loading, error, clearError }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi debe ser usado dentro de un ApiProvider');
  }
  return context;
}

export { ApiContext };
