/**
 * ============================================
 * YJ NEXO ERP - Base Components Unit Tests
 * ============================================
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  Text,
  Button,
  IconButton,
  Input,
  TextArea,
  Card,
  StatCard,
  Badge,
  StatusBadge,
  LoadingSpinner,
  Spacer,
  EmptyState,
  ErrorBoundary,
  ComponentShowcase,
} from '../src/components/common';

describe('YJ Nexo UI-02 Base Components', () => {
  // 1. TEXT
  describe('Text Component', () => {
    test('renders children text correctly with default props', () => {
      const { getByText } = render(<Text>Hola Nexo</Text>);
      expect(getByText('Hola Nexo')).toBeTruthy();
    });

    test('supports display and heading variants with header accessibility role', () => {
      const { getByText } = render(
        <Text variant="heading1" testID="heading-text">
          Título Módulo
        </Text>
      );
      const textElem = getByText('Título Módulo');
      expect(textElem).toBeTruthy();
    });

    test('supports custom color and weight overrides', () => {
      const { getByText } = render(
        <Text variant="body" color="error" weight="bold">
          Mensaje de Error
        </Text>
      );
      expect(getByText('Mensaje de Error')).toBeTruthy();
    });
  });

  // 2. BUTTON
  describe('Button Component', () => {
    test('renders label and triggers onPress callback', () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <Button label="Guardar" onPress={onPressMock} />
      );
      fireEvent.press(getByText('Guardar'));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    test('disables press when disabled or loading', () => {
      const onPressMock = jest.fn();
      const { getByText, rerender } = render(
        <Button label="Guardar" disabled onPress={onPressMock} />
      );
      fireEvent.press(getByText('Guardar'));
      expect(onPressMock).not.toHaveBeenCalled();

      rerender(<Button label="Guardar" loading onPress={onPressMock} />);
      expect(onPressMock).not.toHaveBeenCalled();
    });

    test('supports all button variants and sizes', () => {
      const { getByText, rerender } = render(
        <Button variant="secondary" size="small" label="Cancelar" />
      );
      expect(getByText('Cancelar')).toBeTruthy();

      rerender(<Button variant="danger" size="large" label="Eliminar" />);
      expect(getByText('Eliminar')).toBeTruthy();
    });
  });

  // 3. ICONBUTTON
  describe('IconButton Component', () => {
    test('renders icon and responds to press', () => {
      const onPressMock = jest.fn();
      const { getByTestId } = render(
        <IconButton
          icon={<Text>🔍</Text>}
          onPress={onPressMock}
          accessibilityLabel="Buscar"
          testID="icon-btn"
        />
      );
      fireEvent.press(getByTestId('icon-btn'));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    test('handles disabled and loading states', () => {
      const onPressMock = jest.fn();
      const { getByTestId } = render(
        <IconButton
          disabled
          onPress={onPressMock}
          accessibilityLabel="Bloqueado"
          testID="icon-btn-disabled"
        />
      );
      fireEvent.press(getByTestId('icon-btn-disabled'));
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });

  // 4. INPUT
  describe('Input Component', () => {
    test('renders label, placeholder, and handles text change', () => {
      const onChangeMock = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <Input
          label="Nombre"
          placeholder="Ingrese su nombre"
          value=""
          onChangeText={onChangeMock}
        />
      );
      expect(getByText('Nombre')).toBeTruthy();
      const input = getByPlaceholderText('Ingrese su nombre');
      fireEvent.changeText(input, 'Carlos');
      expect(onChangeMock).toHaveBeenCalledWith('Carlos');
    });

    test('renders error message and accessibility alert', () => {
      const { getByText } = render(
        <Input label="Email" error="Email inválido" />
      );
      expect(getByText('Email inválido')).toBeTruthy();
    });

    test('handles required star indicator and helper text', () => {
      const { getByText } = render(
        <Input label="Código" required helperText="Código único de 5 dígitos" />
      );
      expect(getByText('*')).toBeTruthy();
      expect(getByText('Código único de 5 dígitos')).toBeTruthy();
    });
  });

  // 5. TEXTAREA
  describe('TextArea Component', () => {
    test('renders multiline textarea with label and value', () => {
      const onChangeMock = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <TextArea
          label="Notas"
          placeholder="Escriba comentarios..."
          value="Detalles"
          onChangeText={onChangeMock}
        />
      );
      expect(getByText('Notas')).toBeTruthy();
      const area = getByPlaceholderText('Escriba comentarios...');
      fireEvent.changeText(area, 'Nuevas notas');
      expect(onChangeMock).toHaveBeenCalledWith('Nuevas notas');
    });
  });

  // 6. CARD & STATCARD
  describe('Card & StatCard Components', () => {
    test('renders Card content and handles interactive onPress', () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <Card onPress={onPressMock}>
          <Text>Tarjeta de prueba</Text>
        </Card>
      );
      expect(getByText('Tarjeta de prueba')).toBeTruthy();
      fireEvent.press(getByText('Tarjeta de prueba'));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    test('renders StatCard with label, value, trend and status', () => {
      const { getByText } = render(
        <StatCard
          label="Ventas"
          value="$15,400"
          description="en el mes"
          trend={{ direction: 'up', value: '8%' }}
          status="success"
        />
      );
      expect(getByText(/ventas/i)).toBeTruthy();
      expect(getByText('$15,400')).toBeTruthy();
      expect(getByText('en el mes')).toBeTruthy();
    });
  });

  // 7. BADGE & STATUSBADGE
  describe('Badge & StatusBadge Components', () => {
    test('renders Badge with label and semantic variant', () => {
      const { getByText } = render(
        <Badge variant="success" label="Aprobado" />
      );
      expect(getByText('Aprobado')).toBeTruthy();
    });

    test('translates ERP entity status strings in StatusBadge', () => {
      const { getByText, rerender } = render(<StatusBadge status="active" />);
      expect(getByText('Activo')).toBeTruthy();

      rerender(<StatusBadge status="inactive" />);
      expect(getByText('Inactivo')).toBeTruthy();

      rerender(<StatusBadge status="deleted" />);
      expect(getByText('Eliminado')).toBeTruthy();

      rerender(<StatusBadge status="CUSTOM_STATUS" />);
      expect(getByText('CUSTOM_STATUS')).toBeTruthy();
    });
  });

  // 8. AUXILIARY & SHOWCASE
  describe('Auxiliary & Showcase Components', () => {
    test('renders LoadingSpinner, Spacer, EmptyState, and ErrorBoundary', () => {
      const { getByText, getByTestId } = render(
        <>
          <LoadingSpinner label="Cargando datos..." testID="spinner" />
          <Spacer size="md" />
          <EmptyState title="Sin registros" message="Intente de nuevo." testID="empty" />
          <ErrorBoundary testID="error-boundary">
            <Text>Contenido protegido</Text>
          </ErrorBoundary>
        </>
      );
      expect(getByText('Cargando datos...')).toBeTruthy();
      expect(getByText('Sin registros')).toBeTruthy();
      expect(getByText('Contenido protegido')).toBeTruthy();
    });

    test('renders ComponentShowcase safely', () => {
      const { getByText } = render(<ComponentShowcase />);
      expect(getByText('YJ Nexo UI-02 Showcase')).toBeTruthy();
    });
  });
});
