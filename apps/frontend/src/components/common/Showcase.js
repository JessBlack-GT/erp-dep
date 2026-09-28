/**
 * ============================================
 * YJ NEXO ERP - Component Showcase
 * ============================================
 * Internal dev showcase for inspecting all UI-02 Base Components.
 * Isolated from production navigation routes.
 */

import React, { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { TextArea } from './TextArea';
import { Card } from './Card';
import { StatCard } from './StatCard';
import { Badge } from './Badge';
import { StatusBadge } from './StatusBadge';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import { Spacer } from './Spacer';
import { semanticColors, spacing } from '../../theme';

export function ComponentShowcase({ onClose }) {
  const [inputValue, setInputValue] = useState('');
  const [textAreaValue, setTextAreaValue] = useState('');
  const [inputError, setInputError] = useState('Valor inválido de prueba');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text variant="heading1" color="primary">
            YJ Nexo UI-02 Showcase
          </Text>
          {onClose && (
            <Button
              variant="outline"
              size="small"
              label="Cerrar Showcase"
              onPress={onClose}
            />
          )}
        </View>
        <Text variant="body" color="muted">
          Catálogo visual de componentes base del Design System YJ Nexo.
        </Text>
      </View>

      {/* 1. TYPOGRAPHY */}
      <Card variant="elevated" style={styles.sectionCard}>
        <Text variant="heading2" color="primary" style={styles.sectionTitle}>
          1. Typography
        </Text>
        <Text variant="display">Display Text (32px)</Text>
        <Spacer size="sm" />
        <Text variant="heading1">Heading 1 (28px)</Text>
        <Spacer size="sm" />
        <Text variant="heading2">Heading 2 (24px)</Text>
        <Spacer size="sm" />
        <Text variant="heading3">Heading 3 (20px)</Text>
        <Spacer size="sm" />
        <Text variant="title">Title (18px)</Text>
        <Spacer size="sm" />
        <Text variant="subtitle">Subtitle (16px)</Text>
        <Spacer size="sm" />
        <Text variant="body">Body text principal (14px)</Text>
        <Spacer size="sm" />
        <Text variant="bodySmall" color="muted">BodySmall metadatos (12px)</Text>
        <Spacer size="sm" />
        <Text variant="label">Label de formulario (14px semibold)</Text>
        <Spacer size="sm" />
        <Text variant="caption" color="muted">Caption hint (11px)</Text>
      </Card>

      {/* 2. BUTTONS */}
      <Card variant="elevated" style={styles.sectionCard}>
        <Text variant="heading2" color="primary" style={styles.sectionTitle}>
          2. Buttons & Variants
        </Text>
        <View style={styles.row}>
          <Button variant="primary" label="Primary" onPress={() => {}} />
          <Button variant="secondary" label="Secondary" onPress={() => {}} />
          <Button variant="outline" label="Outline" onPress={() => {}} />
          <Button variant="ghost" label="Ghost" onPress={() => {}} />
          <Button variant="danger" label="Danger" onPress={() => {}} />
        </View>

        <Text variant="subtitle" style={styles.subTitle}>Tamaños y Estados</Text>
        <View style={styles.row}>
          <Button variant="primary" size="small" label="Small" onPress={() => {}} />
          <Button variant="primary" size="medium" label="Medium" onPress={() => {}} />
          <Button variant="primary" size="large" label="Large" onPress={() => {}} />
          <Button variant="primary" label="Disabled" disabled onPress={() => {}} />
          <Button variant="primary" label="Loading" loading onPress={() => {}} />
        </View>
      </Card>

      {/* 3. ICON BUTTONS */}
      <Card variant="elevated" style={styles.sectionCard}>
        <Text variant="heading2" color="primary" style={styles.sectionTitle}>
          3. IconButtons
        </Text>
        <View style={styles.row}>
          <IconButton variant="default" size="small" icon={<Text variant="body">🔍</Text>} />
          <IconButton variant="default" size="medium" icon={<Text variant="title">⚙️</Text>} />
          <IconButton variant="default" size="large" icon={<Text variant="heading3">✏️</Text>} />
          <IconButton variant="outline" icon={<Text variant="title">➕</Text>} />
          <IconButton variant="ghost" icon={<Text variant="title">🔔</Text>} />
          <IconButton variant="danger" icon={<Text variant="title">🗑️</Text>} />
          <IconButton variant="default" disabled icon={<Text variant="title">🔒</Text>} />
          <IconButton variant="default" loading icon={<Text variant="title">⌛</Text>} />
        </View>
      </Card>

      {/* 4. INPUTS & TEXTAREA */}
      <Card variant="elevated" style={styles.sectionCard}>
        <Text variant="heading2" color="primary" style={styles.sectionTitle}>
          4. Inputs & Forms
        </Text>
        <Input
          label="Nombre de Cliente"
          required
          placeholder="Ej. Empresa ABC"
          value={inputValue}
          onChangeText={setInputValue}
          helperText="Ingresa la razón social completa"
        />
        <Spacer size="md" />
        <Input
          label="Campo con Error"
          required
          placeholder="Escribe algo..."
          value=""
          error={inputError}
          onChangeText={() => setInputError('')}
        />
        <Spacer size="md" />
        <Input
          label="Campo Deshabilitado"
          disabled
          value="Valor no editable"
        />
        <Spacer size="md" />
        <TextArea
          label="Observaciones de Inventario"
          placeholder="Escribe detalles del movimiento..."
          value={textAreaValue}
          onChangeText={setTextAreaValue}
          helperText="Máximo 500 caracteres"
        />
      </Card>

      {/* 5. CARDS & STATCARDS */}
      <Card variant="elevated" style={styles.sectionCard}>
        <Text variant="heading2" color="primary" style={styles.sectionTitle}>
          5. Cards & StatCards
        </Text>
        <View style={styles.statGrid}>
          <StatCard
            label="Clientes Activos"
            value="1,248"
            trend={{ direction: 'up', value: '12%' }}
            description="vs. mes anterior"
            status="success"
            style={styles.statFlex}
          />
          <StatCard
            label="Movimientos Inventario"
            value="452"
            trend={{ direction: 'down', value: '3%' }}
            description="esta semana"
            status="warning"
            style={styles.statFlex}
          />
        </View>
      </Card>

      {/* 6. BADGES & STATUS BADGES */}
      <Card variant="elevated" style={styles.sectionCard}>
        <Text variant="heading2" color="primary" style={styles.sectionTitle}>
          6. Badges & Status Badges
        </Text>
        <Text variant="subtitle" style={styles.subTitle}>Badges Semánticos</Text>
        <View style={styles.row}>
          <Badge variant="neutral" label="Neutral" />
          <Badge variant="primary" label="Primary" />
          <Badge variant="success" label="Success" />
          <Badge variant="warning" label="Warning" />
          <Badge variant="error" label="Error" />
          <Badge variant="info" label="Info" />
        </View>

        <Spacer size="md" />
        <Text variant="subtitle" style={styles.subTitle}>StatusBadges para Entidades ERP</Text>
        <View style={styles.row}>
          <StatusBadge status="active" />
          <StatusBadge status="inactive" />
          <StatusBadge status="pending" />
          <StatusBadge status="completed" />
          <StatusBadge status="cancelled" />
          <StatusBadge status="deleted" />
        </View>
      </Card>

      {/* 7. LOADING & EMPTY STATES */}
      <Card variant="elevated" style={styles.sectionCard}>
        <Text variant="heading2" color="primary" style={styles.sectionTitle}>
          7. Auxiliary Feedback Components
        </Text>
        <LoadingSpinner label="Cargando módulo YJ Nexo..." />
        <Spacer size="lg" />
        <EmptyState
          title="Sin resultados de búsqueda"
          message="Intenta ajustar los filtros o el término de búsqueda ingresado."
          actionLabel="Limpiar Filtros"
          onAction={() => {}}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.background.primary,
  },
  content: {
    padding: spacing.lg,
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  subTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statFlex: {
    flex: 1,
    minWidth: 200,
  },
});

export default ComponentShowcase;
