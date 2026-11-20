import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Button, LoadingSpinner, Text } from '../../components/common';
import { spacing } from '../../theme';
import { MunicipalApp } from './MunicipalApp';
import { useMunicipalAccess } from './MunicipalAccess';
import { createMunicipalApi } from './municipalApi';

export function MunicipalScreen() {
  const { memberships, loading, error, reload, synthetic } = useMunicipalAccess();
  const [selected, setSelected] = useState(null);
  const focused = useIsFocused();
  const membership = memberships.find((item) => item.id === selected) || memberships[0];
  const mun = membership?.municipality?.code;
  const api = useMemo(() => (mun ? createMunicipalApi({ mun }) : null), [mun]);

  if (!focused) return null;
  if (loading) return <LoadingSpinner label="Consultando su acceso municipal…" />;
  if (error) return (
    <View>
      <Text accessibilityRole="alert">No se pudo consultar su acceso municipal.</Text>
      <Button label="Reintentar" onPress={reload} />
    </View>
  );
  if (!api) return (
    <Text testID="municipal-access-denied">No hay una membresía municipal disponible para esta sesión.</Text>
  );

  return (
    <View style={styles.root}>
      {memberships.length > 1 && (
        <View style={styles.municipalities} accessibilityLabel="Municipios disponibles">
          {memberships.map((item) => (
            <Button
              key={item.id}
              label={item.municipality.name}
              variant={item.id === membership.id ? 'primary' : 'secondary'}
              onPress={() => setSelected(item.id)}
              testID={`municipality-${item.municipality.code}`}
            />
          ))}
        </View>
      )}
      <MunicipalApp
        key={membership.id}
        api={api}
        membershipId={membership.id}
        modeLabel={synthetic ? 'DEMOSTRACIÓN LOCAL · HTTP real · datos sintéticos en memoria' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1 },
  municipalities: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.sm },
});
