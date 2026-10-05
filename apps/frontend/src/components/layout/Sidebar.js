/**
 * ============================================
 * YJ NEXO ERP - Sidebar Component
 * ============================================
 * Enterprise YJ Nexo Navy sidebar navigation.
 * Respects RBAC permissions, active route, expanded/collapsed, and mobile drawer modes.
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { Text } from '../common/Text';
import { IconButton } from '../common/IconButton';
import { brandAssets } from '../../assets';
import { usePermissions } from '../../hooks/usePermissions';
import { semanticColors, spacing, radius, zIndex } from '../../theme';

export const NAV_ITEMS = [
  { id: 'Sales', label: 'Ventas', icon: '🧾', permission: 'commercial.read', route: 'Sales' },
  { id: 'Users', label: 'Usuarios', icon: '👤', permission: 'users.read', route: 'Users' },
  { id: 'Roles', label: 'Roles y permisos', icon: '🔐', permission: 'roles.read', route: 'Roles' },
  { id: 'Password', label: 'Mi seguridad', icon: '🔑', permission: null, route: 'Password' },
  // Dashboard pendiente: agregar el enlace cuando exista una pantalla registrada.
  {
    id: 'Customers',
    label: 'Clientes',
    icon: '👥',
    permission: 'customers.read',
    route: 'Customers',
  },
  {
    id: 'Suppliers',
    label: 'Proveedores',
    icon: '🏭',
    permission: 'suppliers.read',
    route: 'Suppliers',
  },
  {
    id: 'Products',
    label: 'Productos y Servicios',
    icon: '📦',
    permission: 'products.read',
    route: 'Products',
  },
  {
    id: 'Inventory',
    label: 'Inventario',
    icon: '🏢',
    permission: 'inventory.read',
    route: 'Inventory',
  },
];

export function Sidebar({
  activeRoute = 'Customers',
  onSelectRoute,
  collapsed = false,
  isMobile = false,
  mobileOpen = false,
  onCloseMobile,
  style,
  testID,
}) {
  const can = usePermissions();

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  const handleItemPress = (route) => {
    if (onSelectRoute) {
      onSelectRoute(route);
    }
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderContent = () => (
    <View style={styles.innerContainer}>
      {/* Brand Header */}
      <View style={[styles.brandHeader, collapsed && styles.brandHeaderCollapsed]}>
        {collapsed ? (
          <Image
            source={brandAssets.appIcon}
            style={styles.logoIconOnly}
            resizeMode="contain"
            accessibilityLabel="YJ Nexo Icon"
          />
        ) : (
          <View style={styles.brandRow}>
            <Image
              source={brandAssets.horizontalDark}
              style={styles.logoHorizontal}
              resizeMode="contain"
              accessibilityLabel="YJ Nexo Logo"
            />
          </View>
        )}
        {isMobile && (
          <IconButton
            variant="ghost"
            size="small"
            icon={<Text color="inverse">✕</Text>}
            onPress={onCloseMobile}
            accessibilityLabel="Cerrar menú"
          />
        )}
      </View>

      <View style={styles.divider} />

      {/* Navigation Links List */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {visibleNavItems.map((item) => {
          const isActive = activeRoute === item.route;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.navItem,
                collapsed && styles.navItemCollapsed,
                isActive && styles.navItemActive,
              ]}
              onPress={() => handleItemPress(item.route)}
              activeOpacity={0.7}
              accessibilityRole="menuitem"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
              testID={`nav-item-${item.id}`}
            >
              <Text variant="title" style={styles.itemIcon}>
                {item.icon}
              </Text>
              {!collapsed && (
                <Text
                  variant="body"
                  color="inverse"
                  weight={isActive ? 'semibold' : 'regular'}
                  style={[styles.itemLabel, isActive && styles.itemLabelActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // Mobile Drawer Mode
  if (isMobile) {
    return (
      <Modal visible={mobileOpen} transparent animationType="fade" onRequestClose={onCloseMobile}>
        <TouchableWithoutFeedback onPress={onCloseMobile}>
          <View style={styles.mobileBackdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[styles.sidebarBase, styles.mobileDrawer]}
                accessibilityRole="navigation"
                testID={testID || 'sidebar-mobile-drawer'}
              >
                {renderContent()}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }

  // Desktop / Tablet Sidebar
  return (
    <View
      style={[
        styles.sidebarBase,
        collapsed ? styles.sidebarCollapsed : styles.sidebarExpanded,
        style,
      ]}
      accessibilityRole="navigation"
      testID={testID || 'sidebar-container'}
    >
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebarBase: {
    backgroundColor: semanticColors.brand.navy,
    height: '100%',
    zIndex: zIndex.sticky,
  },
  sidebarExpanded: {
    width: 240,
  },
  sidebarCollapsed: {
    width: 72,
  },
  mobileDrawer: {
    width: 280,
    height: '100%',
  },
  mobileBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
  },
  innerContainer: {
    flex: 1,
  },
  brandHeader: {
    height: 64,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandHeaderCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoHorizontal: {
    width: 140,
    height: 36,
  },
  logoIconOnly: {
    width: 36,
    height: 36,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.medium,
    marginBottom: spacing.xs,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  navItemActive: {
    backgroundColor: semanticColors.brand.slateNavy,
    borderLeftWidth: 3,
    borderLeftColor: semanticColors.brand.blue,
  },
  itemIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  itemLabel: {
    opacity: 0.85,
    flex: 1,
  },
  itemLabelActive: {
    opacity: 1,
  },
});

export default Sidebar;
