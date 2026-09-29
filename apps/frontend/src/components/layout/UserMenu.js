/**
 * ============================================
 * YJ NEXO ERP - UserMenu Component
 * ============================================
 * Topbar user menu dropdown with avatar, identity info, and real logout action.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { Text } from '../common/Text';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { semanticColors, spacing, radius, shadows, zIndex } from '../../theme';

export function UserMenu({ onNavigate, style, testID }) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const userName = user?.name || user?.email?.split('@')[0] || 'Usuario';
  const userEmail = user?.email || '';
  const userRole = user?.role ? String(user.role).toUpperCase() : 'USUARIO';

  const initials =
    userName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  const handleToggle = () => setIsOpen(!isOpen);

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await logout();
    } catch (err) {
      // Axios errors can contain authorization headers; never log the object.
      console.warn('No se pudo confirmar el cierre remoto de sesión.');
    }
  };

  return (
    <View style={[styles.container, style]} testID={testID || 'user-menu-container'}>
      <TouchableOpacity
        style={styles.trigger}
        onPress={handleToggle}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Menú de usuario ${userName}`}
        accessibilityState={{ expanded: isOpen }}
        testID="user-menu-trigger"
      >
        <View style={styles.avatar}>
          <Text variant="caption" color="inverse" weight="bold">
            {initials}
          </Text>
        </View>
        <View style={styles.userSummary}>
          <Text variant="bodySmall" weight="semibold" color="primary" numberOfLines={1}>
            {userName}
          </Text>
          <Text variant="caption" color="muted" numberOfLines={1}>
            {userRole}
          </Text>
        </View>
        <Text variant="caption" color="muted" style={styles.chevron}>
          {isOpen ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <Modal
          transparent
          visible={isOpen}
          onRequestClose={() => setIsOpen(false)}
          animationType="fade"
        >
          <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.dropdownCard} testID="user-menu-dropdown">
                  <View style={styles.dropdownHeader}>
                    <View style={styles.largeAvatar}>
                      <Text variant="title" color="inverse" weight="bold">
                        {initials}
                      </Text>
                    </View>
                    <View style={styles.dropdownInfo}>
                      <Text variant="body" weight="bold" color="primary" numberOfLines={1}>
                        {userName}
                      </Text>
                      {userEmail ? (
                        <Text variant="caption" color="muted" numberOfLines={1}>
                          {userEmail}
                        </Text>
                      ) : null}
                      <View style={styles.badgeRow}>
                        <Badge variant="primary" size="small" label={userRole} />
                      </View>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.menuActions}>
                    <Button
                      variant="danger"
                      size="medium"
                      label="Cerrar sesión"
                      onPress={handleLogout}
                      fullWidth
                      testID="user-menu-logout-btn"
                    />
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.medium,
    backgroundColor: semanticColors.surface.secondary,
    borderWidth: 1,
    borderColor: semanticColors.border.default,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: semanticColors.brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userSummary: {
    marginHorizontal: spacing.xs,
    maxWidth: 120,
  },
  chevron: {
    fontSize: 10,
    marginLeft: spacing.xs,
  },

  // Dropdown Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: spacing.lg,
  },
  dropdownCard: {
    width: 280,
    backgroundColor: semanticColors.surface.primary,
    borderRadius: radius.large,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    padding: spacing.md,
    ...shadows.large,
    zIndex: zIndex.dropdown,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  largeAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: semanticColors.brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  badgeRow: {
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: semanticColors.border.default,
    marginVertical: spacing.md,
  },
  menuActions: {
    width: '100%',
  },
});

export default UserMenu;
