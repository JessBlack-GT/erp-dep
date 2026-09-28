/**
 * ============================================
 * YJ NEXO ERP - TextArea Component
 * ============================================
 * Multiline text input reusing Input styling rules.
 */

import React, { useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  StyleSheet,
} from 'react-native';
import { Text } from './Text';
import { semanticColors, spacing, radius } from '../../theme';

export function TextArea({
  label,
  value,
  placeholder,
  onChangeText,
  helperText,
  error,
  disabled = false,
  required = false,
  numberOfLines = 3,
  minHeight = 80,
  maxHeight = 200,
  testID,
  accessibilityLabel,
  style,
  inputStyle,
  onFocus,
  onBlur,
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const hasError = !!error;

  const wrapperBorderColor = disabled
    ? semanticColors.border.default
    : hasError
    ? semanticColors.status.error
    : isFocused
    ? semanticColors.border.focus
    : semanticColors.border.default;

  const wrapperBg = disabled
    ? semanticColors.background.tertiary
    : semanticColors.surface.primary;

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelRow}>
          <Text variant="label" color={disabled ? 'muted' : 'primary'}>
            {label}
          </Text>
          {required && (
            <Text variant="caption" color="error" style={styles.requiredStar}>
              *
            </Text>
          )}
        </View>
      )}

      <View
        style={[
          styles.inputWrapper,
          { borderColor: wrapperBorderColor, backgroundColor: wrapperBg, minHeight, maxHeight },
          isFocused && styles.focusedGlow,
        ]}
      >
        <RNTextInput
          style={[
            styles.textInput,
            { minHeight: minHeight - spacing.sm * 2 },
            disabled && styles.disabledInput,
            inputStyle,
          ]}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={semanticColors.text.muted}
          onChangeText={onChangeText}
          editable={!disabled}
          multiline={true}
          numberOfLines={numberOfLines}
          textAlignVertical="top"
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityLabel={accessibilityLabel || label || placeholder}
          accessibilityState={{ disabled, invalid: hasError }}
          testID={testID}
          {...props}
        />
      </View>

      {hasError ? (
        <Text variant="caption" color="error" style={styles.errorText} accessibilityRole="alert">
          {typeof error === 'string' ? error : 'Campo requerido o inválido'}
        </Text>
      ) : helperText ? (
        <Text variant="caption" color="muted" style={styles.helperText}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  requiredStar: {
    marginLeft: 2,
    fontWeight: 'bold',
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: radius.medium,
    padding: spacing.sm,
  },
  focusedGlow: {
    borderWidth: 1.5,
  },
  textInput: {
    width: '100%',
    fontSize: 14,
    color: semanticColors.text.primary,
    paddingTop: 0,
  },
  disabledInput: {
    color: semanticColors.text.muted,
  },
  errorText: {
    marginTop: 4,
  },
  helperText: {
    marginTop: 4,
  },
});

export default TextArea;
