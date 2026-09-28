/**
 * ============================================
 * YJ NEXO ERP - WebAppShell Component
 * ============================================
 * Main structural layout shell for the YJ Nexo ERP Web & Mobile experience.
 * Combines Sidebar, Topbar, Breadcrumbs, and PageContainer.
 */

import React, { useState } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { PageContainer } from './PageContainer';
import { semanticColors, breakpoints } from '../../theme';

export function WebAppShell({
  activeRoute = 'Customers',
  title,
  breadcrumbItems,
  onSelectRoute,
  children,
  scrollableContent = true,
  contentPadding = 'lg',
  style,
  testID,
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < breakpoints.tablet;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggleSidebar = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setCollapsed(!collapsed);
    }
  };

  const handleNavigate = (route) => {
    if (onSelectRoute) {
      onSelectRoute(route);
    }
  };

  return (
    <View
      style={[styles.rootContainer, style]}
      testID={testID || 'web-app-shell-root'}
    >
      <View style={styles.bodyRow}>
        {/* Desktop Sidebar */}
        {!isMobile && (
          <Sidebar
            activeRoute={activeRoute}
            onSelectRoute={handleNavigate}
            collapsed={collapsed}
            isMobile={false}
          />
        )}

        {/* Mobile Drawer Sidebar */}
        {isMobile && (
          <Sidebar
            activeRoute={activeRoute}
            onSelectRoute={handleNavigate}
            isMobile={true}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
        )}

        {/* Main Application Area */}
        <View style={styles.mainArea}>
          <Topbar
            title={title}
            breadcrumbItems={breadcrumbItems}
            onToggleSidebar={handleToggleSidebar}
            isSidebarCollapsed={collapsed}
            isMobile={isMobile}
            onNavigate={handleNavigate}
          />

          <PageContainer
            scrollable={scrollableContent}
            padding={contentPadding}
            testID="shell-page-container"
          >
            {children}
          </PageContainer>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: semanticColors.background.primary,
  },
  bodyRow: {
    flex: 1,
    flexDirection: 'row',
  },
  mainArea: {
    flex: 1,
    flexDirection: 'column',
    height: '100%',
  },
});

export default WebAppShell;
