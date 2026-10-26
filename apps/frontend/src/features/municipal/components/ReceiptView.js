/**
 * MuniERP IA — acuse para el ciudadano (RQ06, canal presencial). Solo folio, fecha, dependencia,
 * asunto y estado; nunca datos de contacto. En web ofrece impresión del navegador.
 */
import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Text, Card, Button } from '../../../components/common';
import { spacing } from '../../../theme';
import { statusInfo, spokenFolio, formatDate } from '../model';

export function ReceiptView({ receipt, onDone, testID = 'municipal-receipt' }) {
  if (!receipt) return null;
  const canPrint = Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function';
  return (
    <Card testID={testID} accessibilityLabel={`Acuse de solicitud, folio ${spokenFolio(receipt.folio)}`}>
      <Text variant="heading3">Acuse de solicitud</Text>
      <Text>{receipt.municipality}</Text>
      <View style={styles.folio}>
        <Text variant="caption">Folio</Text>
        <Text variant="heading2" testID="receipt-folio" selectable>{receipt.folio}</Text>
      </View>
      <Text>{`Dependencia: ${receipt.dependency}`}</Text>
      <Text>{`Asunto: ${receipt.subject}`}</Text>
      <Text>{`Estado: ${statusInfo(receipt.status).label}`}</Text>
      <Text>{`Fecha de registro: ${formatDate(receipt.registeredAt)}`}</Text>
      <Text variant="caption">{receipt.instructions}</Text>
      <View style={styles.actions}>
        {canPrint ? <Button variant="secondary" label="Imprimir acuse" onPress={() => window.print()} testID="receipt-print" /> : null}
        {onDone ? <Button variant="ghost" label="Registrar otra solicitud" onPress={onDone} testID="receipt-done" /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  folio: { marginVertical: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
});

export default ReceiptView;
