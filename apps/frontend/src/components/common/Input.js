/**
 * ============================================
 * YJ NEXO ERP - Input Component
 * ============================================
 * Form text input with label, helper text, error handling, and visual states.
 */

import React, { useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  StyleSheet,
} from 'react-native';
import { Text } from './Text';
import { semanticColors, spacing, radius, componentTokens } from '../../theme';

export function Input({
  label,
  value,
  placeholder,
  onChangeText,
  helperText,
  error,
  disabled = false,
  required = false,
  leftElement,
  rightElement,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  testID,
  accessibilityLabel,
  style,
  inputStyle,
  errorStyle,
  size = 'medium',
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
          <Text variant="label" color={disabled ? 'muted' : 'primary'} style={styles.labelText}>
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
          size === 'large' && { height: componentTokens.button.heightLarge },
          { borderColor: wrapperBorderColor, backgroundColor: wrapperBg },
          isFocused && styles.focusedGlow,
        ]}
      >
        {leftElement && <View style={styles.elementLeft}>{leftElement}</View>}

        <RNTextInput
          style={[
            styles.textInput,
            disabled && styles.disabledInput,
            inputStyle,
          ]}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={semanticColors.text.muted}
          onChangeText={onChangeText}
          editable={!disabled}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityRole="search"
          accessibilityLabel={accessibilityLabel || label || placeholder}
          accessibilityState={{ disabled, invalid: hasError }}
          testID={testID}
          {...props}
        />

        {rightElement && <View style={styles.elementRight}>{rightElement}</View>}
      </View>

      {hasError ? (
        <Text
          variant="caption"
          color="error"
          style={[styles.errorText, errorStyle]}
          accessibilityRole="alert"
          testID={testID ? `${testID}-error` : undefined}
        >
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
  labelText: {
    marginRight: 2,
  },
  requiredStar: {
    fontWeight: 'bold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: componentTokens.input.height,
    borderWidth: 1,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.sm,
  },
  focusedGlow: {
    borderWidth: 1.5,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: semanticColors.text.primary,
    paddingVertical: 0,
  },
  disabledInput: {
    color: semanticColors.text.muted,
  },
  elementLeft: {
    marginRight: spacing.xs,
  },
  elementRight: {
    marginLeft: spacing.xs,
  },
  errorText: {
    marginTop: 4,
  },
  helperText: {
    marginTop: 4,
  },
});

export default Input;
