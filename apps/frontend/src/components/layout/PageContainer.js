/**
 * ============================================
 * YJ NEXO ERP - PageContainer Component
 * ============================================
 * Central responsive content container.
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { semanticColors, spacing } from '../../theme';

export function PageContainer({
  children,
  scrollable = true,
  padding = 'lg',
  maxWidth = 1440,
  style,
  contentContainerStyle,
  testID,
}) {
  const paddingValue = spacing[padding] !== undefined ? spacing[padding] : spacing.lg;

  const innerStyle = [
    styles.inner,
    { padding: paddingValue, maxWidth },
    contentContainerStyle,
  ];

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.scrollContainer, style]}
        contentContainerStyle={innerStyle}
        keyboardShouldPersistTaps="handled"
        testID={testID || 'page-container-scroll'}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.nonScrollContainer, style]} testID={testID || 'page-container-view'}>
      <View style={innerStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: semanticColors.background.primary,
  },
  nonScrollContainer: {
    flex: 1,
    backgroundColor: semanticColors.background.primary,
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
});

export default PageContainer;
