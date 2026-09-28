/**
 * ============================================
 * YJ NEXO ERP - ScrollableContent Component
 * ============================================
 * Scrollable layout wrapper.
 */

import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { semanticColors, spacing } from '../../theme';

export function ScrollableContent({ children, style, contentContainerStyle, testID }) {
  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      testID={testID || 'scrollable-content'}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.background.primary,
  },
  content: {
    padding: spacing.md,
    flexGrow: 1,
  },
});

export default ScrollableContent;
