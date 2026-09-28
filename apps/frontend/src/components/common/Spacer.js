/**
 * ============================================
 * YJ NEXO ERP - Spacer Component
 * ============================================
 */

import React from 'react';
import { View } from 'react-native';
import { spacing as spacingTokens } from '../../theme';

export function Spacer({ size = 'md', width, height, horizontal = false, style }) {
  const tokenValue = spacingTokens[size] !== undefined ? spacingTokens[size] : spacingTokens.md;

  const resolvedWidth = width !== undefined ? width : horizontal ? tokenValue : undefined;
  const resolvedHeight = height !== undefined ? height : !horizontal ? tokenValue : undefined;

  return <View style={[{ width: resolvedWidth, height: resolvedHeight }, style]} />;
}

export default Spacer;
