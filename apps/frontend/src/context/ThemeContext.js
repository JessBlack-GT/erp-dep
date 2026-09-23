/**
 * ============================================
 * ERP-SYSTEM - Contexto de Tema
 * ============================================
 */

import React, { createContext, useContext } from 'react';
import { theme } from '../theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children, customTheme }) {
  const mergedTheme = customTheme ? { ...theme, ...customTheme } : theme;

  return (
    <ThemeContext.Provider value={{ theme: mergedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser usado dentro de un ThemeProvider');
  }
  return context;
}

export { ThemeContext };
