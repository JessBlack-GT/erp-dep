/* eslint-env es2020 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { semanticColors } from '../../theme';
import {
  salesService,
  customerService,
  productService,
} from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { SalesSelector } from './SalesSelector';
import { SaleLineEditor } from './SaleLineEditor';
import { SaleTotals } from './SaleTotals';
import {
  styles,
  screenProps,
  today,
  dateText,
  blankLine,
  formError,
  editablePayload,
  salesError,
  uncertain,
} from './shared';

export function SaleForm({ route, navigation }) {
  const id = route?.params?.id,
    can = usePermissions();
  const allowed =
    can('commercial.read') &&
    can(id ? 'commercial.update' : 'commercial.create');
  const [form, setForm] = useState({
    date: today(),
    currency: '',
    customer: null,
    lines: [blankLine(0)],
  });
  const [sale, setSale] = useState(null),
    [loaded, setLoaded] = useState(!id);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false),
    [dirty, setDirty] = useState(false);
  const writing = useRef(false),
    latest = useRef(0),
    key = useRef(1);
  async function load() {
    if (!id || !allowed || writing.current) return;
    const seq = ++latest.current;
    setBusy(true);
    setLoaded(false);
    setError('');
    try {
      const {
        data: { data: document },
      } = await salesService.getById(id);
      if (seq !== latest.current) return;
      setSale(document);
      if (document.status !== 'draft') {
        setLoaded(true);
        setBlocked(false);
        return;
      }
      // Los snapshots no prueban que el catálogo siga activo; verificar antes de editar.
      const [customer, products] = await Promise.all([
        can('customers.read')
          ? customerService
            .getById(document.entity.id)
            .then((r) => r.data.data)
            .catch(() => null)
          : null,
        Promise.all(
          document.lines.map((line) =>
            can('products.read')
              ? productService
                .getById(line.productId)
                .then((r) => r.data.data)
                .catch(() => null)
              : null,
          ),
        ),
      ]);
      if (seq !== latest.current) return;
      setForm({
        date: dateText(document.date),
        currency: document.currency,
        customer,
        lines: document.lines.map((line, i) => ({
          ...blankLine(key.current++),
          product: products[i],
          quantity: String(line.quantity),
          unitPrice: String(line.unitPrice),
          discountRate: String(line.discountRate),
          taxRate: String(line.taxRate),
          warehouse: line.warehouseId
            ? { _id: line.warehouseId, name: line.warehouseId }
            : null,
        })),
      });
      if (!customer || products.some((p) => !p))
        setError(
          'No se pudo verificar parte del catálogo. Selecciona de nuevo los registros disponibles.',
        );
      setLoaded(true);
      setBlocked(false);
      setDirty(false);
    } catch (e) {
      if (seq === latest.current) setError(salesError(e));
    } finally {
      if (seq === latest.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (id && allowed) load();
    else if (!id) {
      setForm({
        date: today(),
        currency: '',
        customer: null,
        lines: [blankLine(key.current++)],
      });
      setSale(null);
      setLoaded(true);
      setBlocked(false);
      setDirty(false);
      setError('');
      setBusy(false);
    }
    return () => {
      latest.current++;
    };
  }, [id, allowed]);
  function change(next) {
    setForm(next);
    setDirty(true);
  }
  async function save() {
    if (
      !allowed ||
      writing.current ||
      busy ||
      !loaded ||
      blocked ||
      (id && sale?.status !== 'draft')
    )
      return;
    const invalid = formError(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    writing.current = true;
    setBusy(true);
    setError('');
    try {
      const payload = editablePayload(form);
      const result = id
        ? await salesService.update(id, {
          ...payload,
          expectedRevision: sale.revision,
        })
        : await salesService.create(payload);
      setSale(result.data.data);
      setDirty(false);
      setBlocked(true);
      navigation.replace('SaleDetail', { id: result.data.data._id });
    } catch (e) {
      setError(salesError(e));
      if (e.response?.status === 409 || uncertain(e)) {
        setBlocked(true);
        if (id) {
          try {
            const result = await salesService.getById(id);
            setSale(result.data.data);
            setError(
              `${salesError(e)} Se consultó el estado actual. Recarga antes de editar; se descartarán los cambios sin guardar.`,
            );
          } catch (readError) {
            setError(
              `${salesError(readError)} El resultado sigue sin verificar. Recarga antes de editar.`,
            );
          }
        } else {
          setError(
            'El resultado del guardado es incierto. Revisa el listado antes de crear otra venta; no se repetirá el envío.',
          );
        }
      }
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  if (!allowed)
    return (
      <Text style={styles.body}>No tienes permiso para {id ? 'editar' : 'crear'} ventas.</Text>
    );
  const locked = busy || blocked || !loaded || (id && sale?.status !== 'draft');
  return (
    <View style={styles.page}>
      <Text style={styles.heading}>
        {id ? 'Editar borrador' : 'Nueva venta'}
      </Text>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {busy && (
        <LoadingSpinner
          label="Procesando venta"
          color={semanticColors.brand.blue}
        />
      )}
      {id && (
        <Button
          label="Recargar y descartar cambios"
          variant="secondary"
          disabled={busy}
          onPress={load}
        />
      )}
      {id && sale && sale.status !== 'draft' && (
        <Text style={styles.muted}>Esta venta ya no es un borrador y no puede editarse.</Text>
      )}
      {loaded && (!id || sale?.status === 'draft') && (
        <>
          <Input
            label="Fecha (AAAA-MM-DD)"
            accessibilityLabel="Fecha"
            value={form.date}
            disabled={locked}
            onChangeText={(date) => change({ ...form, date })}
          />
          <Input
            label="Moneda"
            accessibilityLabel="Moneda"
            value={form.currency}
            maxLength={3}
            disabled={locked}
            autoCapitalize="characters"
            onChangeText={(currency) =>
              change({ ...form, currency: currency.toUpperCase() })
            }
          />
          <SalesSelector
            kind="customer"
            label="Cliente"
            value={form.customer}
            disabled={locked}
            onSelect={(customer) => change({ ...form, customer })}
          />
          {form.lines.map((line, index) => (
            <SaleLineEditor
              key={line.key}
              line={line}
              number={index + 1}
              disabled={locked}
              onChange={(next) =>
                change({
                  ...form,
                  lines: form.lines.map((x) => (x.key === line.key ? next : x)),
                })
              }
              onRemove={() =>
                change({
                  ...form,
                  lines: form.lines.filter((x) => x.key !== line.key),
                })
              }
            />
          ))}
          <Button
            label="Agregar línea"
            variant="secondary"
            disabled={locked}
            onPress={() =>
              change({
                ...form,
                lines: [...form.lines, blankLine(key.current++)],
              })
            }
          />
          <SaleTotals sale={sale} dirty={dirty} />
          <Button label="Guardar borrador" disabled={locked} onPress={save} />
        </>
      )}
      <Button
        label="Volver a ventas"
        variant="secondary"
        disabled={busy}
        onPress={() => navigation.navigate('Sales')}
      />
    </View>
  );
}
SaleForm.propTypes = screenProps;
