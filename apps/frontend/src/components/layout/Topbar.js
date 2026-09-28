/**
 * ============================================
 * YJ NEXO ERP - Topbar Component
 * ============================================
 * Header bar containing sidebar toggle, page context/title, and UserMenu.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton } from '../common/IconButton';
import { Text } from '../common/Text';
import { Breadcrumbs } from './Breadcrumbs';
import { UserMenu } from './UserMenu';
import { semanticColors, spacing, zIndex, shadows } from '../../theme';

export function Topbar({
  title,
  breadcrumbItems,
  onToggleSidebar,
  isSidebarCollapsed = false,
  isMobile = false,
  onNavigate,
  style,
  testID,
}) {
  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="header"
      testID={testID || 'topbar-container'}
    >
      <View style={styles.leftSection}>
        <IconButton
          variant="ghost"
          size="medium"
          icon={<Text variant="title">☰</Text>}
          onPress={onToggleSidebar}
          accessibilityLabel={isMobile ? 'Abrir menú de navegación' : isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          testID="sidebar-toggle-btn"
        />

        <View style={styles.contextArea}>
          {breadcrumbItems && breadcrumbItems.length > 0 ? (
            <Breadcrumbs items={breadcrumbItems} onNavigate={onNavigate} />
          ) : title ? (
            <Text variant="heading3" weight="bold" color="primary" numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <Text variant="heading3" weight="bold" color="primary">
              YJ Nexo ERP
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightSection}>
        <UserMenu onNavigate={onNavigate} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    backgroundColor: semanticColors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: semanticColors.border.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    zIndex: zIndex.sticky,
    ...shadows.small,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contextArea: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default Topbar;
