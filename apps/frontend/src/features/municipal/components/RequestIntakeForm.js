/**
 * MuniERP IA — registro de solicitud en ventanilla (RQ01, RQ06).
 * - Orden de tabulación natural: dependencia → ciudadano → canal → asunto → descripción → enviar.
 * - Una clave de idempotencia por formulario: si la red falla y el funcionario reintenta, el
 *   servidor devuelve el mismo folio en lugar de crear otro.
 * - No solicita CURP ni identificación oficial.
 */
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Input, TextArea, Button } from '../../../components/common';
import { spacing } from '../../../theme';
import { OptionGroup } from './OptionGroup';
import { CHANNELS, validateIntake, newIdempotencyKey } from '../model';

export function RequestIntakeForm({ api, dependencies, citizens, onCreated, testID = 'municipal-intake' }) {
  const [values, setValues] = useState({ ownerDependency: '', citizenId: '', channel: 'PRESENCIAL', subject: '', description: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState('');
  const idempotencyKey = useMemo(() => newIdempotencyKey(), []);
  const set = (field) => (v) => setValues((prev) => ({ ...prev, [field]: v }));

  async function submit() {
    const found = validateIntake(values);
    setErrors(found);
    setFailure('');
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      const body = { type: 'SOL', ownerDependency: values.ownerDependency, citizenId: values.citizenId, channel: values.channel, subject: values.subject.trim() };
      if (values.description.trim()) body.description = values.description.trim();
      const res = await api.createRequest(body, idempotencyKey);
      if (onCreated) onCreated(res.data);
    } catch (e) {
      setFailure('No se pudo registrar. Puede reintentar sin riesgo de duplicar el folio.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View testID={testID} style={styles.form}>
      <Text variant="heading3">Registrar solicitud</Text>
      <OptionGroup
        label="Dependencia responsable"
        options={dependencies.map((d) => ({ value: d.code, label: d.name }))}
        value={values.ownerDependency}
        onChange={set('ownerDependency')}
        error={errors.ownerDependency}
        testID="intake-dependency"
      />
      <OptionGroup
        label="Ciudadano solicitante"
        options={citizens.map((c) => ({ value: c.id, label: c.fullName }))}
        value={values.citizenId}
        onChange={set('citizenId')}
        error={errors.citizenId}
        testID="intake-citizen"
      />
      <OptionGroup label="Canal de atención" options={CHANNELS} value={values.channel} onChange={set('channel')} error={errors.channel} testID="intake-channel" />
      <Input label="Asunto" required value={values.subject} onChangeText={set('subject')} error={errors.subject} testID="intake-subject" />
      <TextArea label="Descripción (opcional)" value={values.description} onChangeText={set('description')} error={errors.description} testID="intake-description" />
      {failure ? <Text color="error" accessibilityRole="alert" testID="intake-failure">{failure}</Text> : null}
      <Button label={failure ? 'Reintentar registro' : 'Registrar y emitir folio'} onPress={submit} loading={submitting} testID="intake-submit" />
    </View>
  );
}

const styles = StyleSheet.create({ form: { paddingVertical: spacing.md } });

export default RequestIntakeForm;
