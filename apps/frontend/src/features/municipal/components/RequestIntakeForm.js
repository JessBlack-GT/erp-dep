/**
 * MuniERP IA — registro de solicitud en ventanilla (RQ01, RQ06).
 * - Orden de tabulación natural: dependencia → ciudadano → canal → asunto → descripción → enviar.
 * - Una clave de idempotencia por formulario: si la red falla y el funcionario reintenta, el
 *   servidor devuelve el mismo folio en lugar de crear otro.
 * - No solicita CURP ni identificación oficial.
 */
import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Input, TextArea, Button } from '../../../components/common';
import { spacing } from '../../../theme';
import { OptionGroup } from './OptionGroup';
import { CHANNELS, validateIntake, newIdempotencyKey, describeIntakeFailure } from '../model';

export function RequestIntakeForm({ api, dependencies, citizens, onCreated, testID = 'municipal-intake', headingLevel = 2 }) {
  const [values, setValues] = useState({ ownerDependency: '', citizenId: '', channel: 'PRESENCIAL', subject: '', description: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState('');
  const [retryBody, setRetryBody] = useState(null);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const inFlight = useRef(false);
  const set = (field) => (v) => setValues((prev) => ({ ...prev, [field]: v }));
  const locked = submitting || Boolean(retryBody);

  async function submit() {
    if (inFlight.current) return;
    let body = retryBody;
    if (!body) {
      const found = validateIntake(values);
      setErrors(found);
      setFailure('');
      if (Object.keys(found).length) return;
      body = { type: 'SOL', ownerDependency: values.ownerDependency, citizenId: values.citizenId, channel: values.channel, subject: values.subject.trim() };
      if (values.description.trim()) body.description = values.description.trim();
    }
    inFlight.current = true;
    setFailure('');
    setSubmitting(true);
    try {
      let res;
      try {
        res = await api.createRequest(body, idempotencyKey);
      } catch (error) {
        const outcome = describeIntakeFailure(error);
        setFailure(outcome.message);
        if (outcome.retry) setRetryBody(body);
        return;
      }
      setRetryBody(null);
      if (onCreated) await onCreated(res.data);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <View testID={testID} style={styles.form}>
      <Text variant="heading3" accessibilityRole="header" aria-level={headingLevel}>Registrar solicitud</Text>
      <OptionGroup
        label="Dependencia responsable"
        options={dependencies.map((d) => ({ value: d.code, label: d.name }))}
        value={values.ownerDependency}
        onChange={set('ownerDependency')}
        disabled={locked}
        error={errors.ownerDependency}
        testID="intake-dependency"
      />
      <OptionGroup
        label="Ciudadano solicitante"
        options={citizens.map((c) => ({ value: c.id, label: c.fullName }))}
        value={values.citizenId}
        onChange={set('citizenId')}
        disabled={locked}
        error={errors.citizenId}
        testID="intake-citizen"
      />
      <OptionGroup label="Canal de atención" options={CHANNELS} value={values.channel} onChange={set('channel')} error={errors.channel} disabled={locked} testID="intake-channel" />
      <Input label="Asunto" required value={values.subject} onChangeText={set('subject')} error={errors.subject} disabled={locked} testID="intake-subject" />
      <TextArea label="Descripción (opcional)" value={values.description} onChangeText={set('description')} error={errors.description} disabled={locked} testID="intake-description" />
      {failure ? <Text color="error" accessibilityRole="alert" testID="intake-failure">{failure}</Text> : null}
      <Button label={retryBody ? 'Reintentar registro' : 'Registrar y emitir folio'} onPress={submit} loading={submitting} testID="intake-submit" />
    </View>
  );
}

const styles = StyleSheet.create({ form: { paddingVertical: spacing.md } });

export default RequestIntakeForm;
