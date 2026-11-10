/**
 * MuniERP IA — C-18 con una RÉPLICA DE PRUEBA del Card corregido por Codex (reenvía accessibilityLabel
 * en la variante estática, como en la copia de trabajo revisada el 2026-11-10). El núcleo no se modifica.
 */
import { defineC18Cases } from './municipal-compat-cases';

jest.mock('../src/components/common/Card', () => {
  const React = require('react');
  const { View, TouchableOpacity } = require('react-native');
  function Card({ onPress, children, style, testID, accessibilityLabel, ...props }) {
    if (typeof onPress === 'function')
      return React.createElement(TouchableOpacity, { style, onPress, accessibilityRole: 'button', accessibilityLabel, testID, ...props }, children);
    return React.createElement(View, { style, accessibilityLabel, testID, ...props }, children);
  }
  return { __esModule: true, Card, default: Card };
});

defineC18Cases('corregido (réplica de prueba)');
