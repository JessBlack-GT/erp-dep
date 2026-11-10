/**
 * MuniERP IA — lista de solicitudes en alcance (RQ03). Cada fila es un botón con etiqueta completa
 * para lector de pantalla y estado en texto (no solo color).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Badge, EmptyState } from '../../../components/common';
import { spacing } from '../../../theme';
import { statusInfo, requestAccessibilityLabel, formatDate } from '../model';

export function RequestStatusBadge({ status }) {
  const info = statusInfo(status);
  return <Badge variant={info.variant} label={info.label} />;
}

export function RequestList({ items, onSelect, testID = 'municipal-request-list' }) {
  if (!items || items.length === 0)
    return <EmptyState title="Sin solicitudes" message="No hay solicitudes en su alcance para los filtros elegidos." testID={`${testID}-empty`} />;
  return (
    <View testID={testID} accessibilityRole="list">
      {items.map((r) => (
        <Card
          key={r.folio}
          onPress={onSelect ? () => onSelect(r) : undefined}
          accessibilityLabel={requestAccessibilityLabel(r)}
          style={styles.row}
          testID={onSelect ? `request-${r.folio}` : undefined}
        >
          {/* Card (componente común del ERP) descarta accessibilityLabel cuando no es interactiva
              (hallazgo Playwright 2026-11-09, C-18); en ese caso la etiqueta va en este elemento. */}
          <View
            accessibilityRole={onSelect ? undefined : 'listitem'}
            accessibilityLabel={onSelect ? undefined : requestAccessibilityLabel(r)}
            testID={onSelect ? undefined : `request-${r.folio}`}
          >
          <View style={styles.header}>
            <Text weight="bold">{r.folio}</Text>
            <RequestStatusBadge status={r.status} />
          </View>
          {r.subject ? <Text numberOfLines={2}>{r.subject}</Text> : null}
          <Text variant="caption" color="secondary">
            {`${r.ownerDependency || ''} · ${formatDate(r.createdAt)}`}
          </Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: spacing.xs },
});

export default RequestList;
