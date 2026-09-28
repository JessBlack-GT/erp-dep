/**
 * ============================================
 * YJ NEXO ERP - Footer Component
 * ============================================
 * Application footer.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../common/Text';
import { semanticColors, spacing } from '../../theme';

export function Footer({ style, testID }) {
  return (
    <View style={[styles.container, style]} testID={testID || 'footer-container'}>
      <Text variant="caption" color="muted" align="center">
        YJ Nexo ERP © {new Date().getFullYear()} · Todos los derechos reservados.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: semanticColors.border.default,
    backgroundColor: semanticColors.surface.primary,
  },
});

export default Footer;
