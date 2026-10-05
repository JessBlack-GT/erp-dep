import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, ActivityIndicator } from 'react-native';
import { Button } from '../../components/common/Button';
import { salesService } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { SaleTotals } from './SaleTotals';
import {
  styles,
  states,
  dateText,
  tracked,
  salesError,
  screenProps,
} from './shared';

export function SaleDetailScreen({ route, navigation }) {
  const id = route?.params?.id,
    can = usePermissions(),
    allowed = can('commercial.read');
  const [sale, setSale] = useState(null),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [intent, setIntent] = useState(null),
    [verified, setVerified] = useState(false);
  const latest = useRef(0),
    writing = useRef(false);
  async function load() {
    if (!allowed || !id || writing.current) return;
    const seq = ++latest.current;
    setBusy(true);
    setVerified(false);
    setError('');
    setIntent(null);
    try {
      const r = await salesService.getById(id);
      if (seq === latest.current) {
        setSale(r.data.data);
        setVerified(true);
      }
    } catch (e) {
      if (seq === latest.current) {
        setSale(null);
        setError(salesError(e));
      }
    } finally {
      if (seq === latest.current) setBusy(false);
    }
  }
  useEffect(() => {
    setSale(null);
    load();
    const unsubscribe = navigation?.addListener?.('focus', load);
    return () => {
      latest.current++;
      unsubscribe?.();
    };
  }, [id, allowed, navigation]);
  const missingWarehouse = sale?.lines.some(
    (line) => tracked(line.snapshot) && !line.warehouseId,
  );
  async function execute() {
    if (
      !allowed ||
      !intent ||
      !can(`commercial.${intent}`) ||
      writing.current ||
      busy ||
      !verified
    )
      return;
    if (intent === 'confirm' && (sale.status !== 'draft' || missingWarehouse))
      return;
    if (intent === 'cancel' && !['draft', 'confirmed'].includes(sale.status))
      return;
    writing.current = true;
    latest.current++;
    setBusy(true);
    setError('');
    try {
      const result = await salesService[intent](id, {
        expectedRevision: sale.revision,
      });
      setSale(result.data.data);
      setVerified(true);
    } catch (e) {
      setError(salesError(e));
      setVerified(false);
      // Nunca repetir una mutación: consultar el estado, incluso si la respuesta se perdió.
      try {
        const result = await salesService.getById(id);
        setSale(result.data.data);
        setVerified(true);
      } catch (readError) {
        setError(
          `${salesError(e)} ${salesError(readError)} Estado sin verificar; consulta de nuevo.`,
        );
      }
    } finally {
      writing.current = false;
      setBusy(false);
      setIntent(null);
    }
  }
  if (!allowed) return <Text>No tienes permiso para consultar ventas.</Text>;
  return (
    <View style={styles.page}>
      {busy && <ActivityIndicator accessibilityLabel="Cargando venta" />}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Button
        label="Consultar estado"
        variant="secondary"
        disabled={busy}
        onPress={load}
      />
      {sale && (
        <>
          <Text style={styles.heading}>{sale.number}</Text>
          <Text>
            {dateText(sale.date)} · {sale.entity.name}
          </Text>
          <Text>{verified ? states[sale.status] : 'Estado sin verificar'}</Text>
          {sale.lines.map((line, i) => (
            <View key={line._id || i} style={styles.card}>
              <Text>
                {line.snapshot.name} · {line.snapshot.sku}
              </Text>
              <Text>
                {line.snapshot.type} · {line.snapshot.unit}
              </Text>
              <Text>
                Cantidad: {line.quantity} · Precio: {line.unitPrice}{' '}
                {sale.currency}
              </Text>
              <Text>
                Descuento: {line.discountRate}% · Impuesto: {line.taxRate}%
              </Text>
              <SaleTotals sale={{ ...line, currency: sale.currency }} />
              {tracked(line.snapshot) && (
                <>
                  <Text>
                    Almacén: {line.warehouseId || 'Pendiente de seleccionar'}
                  </Text>
                  {line.exitMovementId && (
                    <Text>Salida: {line.exitMovementId}</Text>
                  )}
                  {line.reversalMovementId && (
                    <Text>Reversión: {line.reversalMovementId}</Text>
                  )}
                </>
              )}
            </View>
          ))}
          <SaleTotals sale={sale} />
          {verified && (
            <View style={styles.row}>
              {sale.status === 'draft' && can('commercial.update') && (
                <Button
                  label="Editar borrador"
                  disabled={busy}
                  onPress={() => navigation.navigate('SaleForm', { id })}
                />
              )}
              {sale.status === 'draft' && can('commercial.confirm') && (
                <Button
                  label="Confirmar venta"
                  disabled={busy || missingWarehouse}
                  onPress={() => setIntent('confirm')}
                />
              )}
              {['draft', 'confirmed'].includes(sale.status) &&
                can('commercial.cancel') && (
                <Button
                  label="Cancelar venta"
                  disabled={busy}
                  variant="secondary"
                  onPress={() => setIntent('cancel')}
                />
              )}
            </View>
          )}
          {sale.status === 'draft' && missingWarehouse && (
            <Text>
              Selecciona un almacén en cada producto con inventario antes de
              confirmar.
            </Text>
          )}
        </>
      )}
      <Button
        label="Volver a ventas"
        variant="secondary"
        disabled={busy}
        onPress={() => navigation.navigate('Sales')}
      />
      <Modal
        visible={!!intent}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!writing.current) setIntent(null);
        }}
      >
        <View style={styles.modal}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text>
              {intent === 'confirm'
                ? '¿Confirmar esta venta? El backend comprobará y descontará las existencias correspondientes.'
                : '¿Cancelar esta venta? Si está confirmada, se revertirán los movimientos correspondientes.'}
            </Text>
            <Button
              label="Aceptar operación"
              disabled={busy}
              onPress={execute}
            />
            <Button
              label="Volver sin cambios"
              variant="secondary"
              disabled={busy}
              onPress={() => setIntent(null)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
SaleDetailScreen.propTypes = screenProps;
