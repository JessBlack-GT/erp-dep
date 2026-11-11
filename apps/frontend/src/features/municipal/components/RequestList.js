/**
 * MuniERP IA — lista de solicitudes en alcance (RQ03). Cada fila es un botón con etiqueta completa
 * para lector de pantalla y estado en texto (no solo color).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Badge } from '../../../components/common';
import { spacing } from '../../../theme';
import { statusInfo, requestAccessibilityLabel, formatDate } from '../model';

export function RequestStatusBadge({ status }) {
  const info = statusInfo(status);
  return <Badge variant={info.variant} label={info.label} />;
}

export function RequestList({ items, onSelect, testID = 'municipal-request-list' }) {
  if (!items || items.length === 0)
    // F1-15a: sin EmptyState común, cuyo título se expone como <h1> en web y rompía la jerarquía.
    return (
      <View style={styles.empty} testID={`${testID}-empty`}>
        <Text weight="bold">Sin solicitudes</Text>
        <Text color="secondary">No hay solicitudes en su alcance para los filtros elegidos.</Text>
      </View>
    );
  return (
    <View testID={testID} accessibilityRole="list">
      {items.map((r) => (
        <Card
          key={r.folio}
          onPress={onSelect ? () => onSelect(r) : undefined}
          // C-18: la etiqueta va en Card SOLO si es interactiva (botón). En modo estático va en el
          // elemento interior: así no se duplica cuando se integre el Card corregido por Codex (que ya
          // reenvía accessibilityLabel) y sigue funcionando con el Card actual (que la descarta).
          accessibilityLabel={onSelect ? requestAccessibilityLabel(r) : undefined}
          style={styles.row}
          testID={onSelect ? `request-${r.folio}` : undefined}
        >
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
  empty: { paddingVertical: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: spacing.xs },
});

export default RequestList;
