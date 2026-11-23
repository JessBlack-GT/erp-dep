/**
 * MuniERP IA — acuse para el ciudadano (RQ06, canal presencial). Solo folio, fecha, dependencia,
 * asunto y estado; nunca datos de contacto. En web ofrece impresión del navegador.
 */
import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Text, Card, Button } from '../../../components/common';
import { spacing } from '../../../theme';
import { statusInfo, formatDate } from '../model';
import { ButtonRow } from './Section';

export function ReceiptView({ receipt, onDone, testID = 'municipal-receipt' }) {
  if (!receipt) return null;
  const canPrint = Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function';
  return (
    // C-18: sin accessibilityLabel en el contenedor. Con el Card corregido, una etiqueta en el contenedor
    // se anunciaría además del contenido (folio dos veces) y podría agrupar los botones hijos. La
    // estructura accesible la da el encabezado; el folio se lee como texto (sin aria-label en un
    // elemento genérico, que los lectores de pantalla web ignoran).
    <Card testID={testID}>
      <Text variant="heading3" accessibilityRole="header" aria-level={2}>{receipt.confirmationOnly ? 'Folio confirmado' : 'Acuse de solicitud'}</Text>
      {!receipt.confirmationOnly ? <Text>{receipt.municipality}</Text> : null}
      <View style={styles.folio}>
        <Text variant="caption">Folio</Text>
        {/* F1-15a: el folio es un dato destacado, no un encabezado (antes RN Web lo exponía como <h1>). */}
        <Text variant="heading2" accessibilityRole="text" testID="receipt-folio" selectable>{receipt.folio}</Text>
      </View>
      {receipt.confirmationOnly ? (
        <Text accessibilityRole="alert" testID="receipt-unavailable">La solicitud se registró, pero no se pudo cargar el acuse. Conserve el folio para consultar el expediente.</Text>
      ) : (
        <>
          <Text>{`Dependencia: ${receipt.dependency}`}</Text>
          <Text>{`Asunto: ${receipt.subject}`}</Text>
          <Text>{`Estado: ${statusInfo(receipt.status).label}`}</Text>
          <Text>{`Fecha de registro: ${formatDate(receipt.registeredAt)}`}</Text>
          <Text variant="caption">{receipt.instructions}</Text>
        </>
      )}
      <ButtonRow style={styles.actions}>
        {canPrint && !receipt.confirmationOnly ? <Button variant="secondary" label="Imprimir acuse" onPress={() => window.print()} testID="receipt-print" /> : null}
        {onDone ? <Button variant="ghost" label="Registrar otra solicitud" onPress={onDone} testID="receipt-done" /> : null}
      </ButtonRow>
    </Card>
  );
}

const styles = StyleSheet.create({
  folio: { marginVertical: spacing.sm },
  actions: { marginTop: spacing.md },
});

export default ReceiptView;
