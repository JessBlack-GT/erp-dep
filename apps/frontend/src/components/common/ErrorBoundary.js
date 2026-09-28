/**
 * ============================================
 * YJ NEXO ERP - ErrorBoundary Component
 * ============================================
 * React Error Boundary catching JavaScript errors in child component trees.
 */

import React, { Component } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { semanticColors, spacing } from '../../theme';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container} testID={this.props.testID || 'error-boundary'}>
          <Text variant="heading3" color="error" align="center" style={styles.title}>
            Ocurrió un error en la aplicación
          </Text>
          <Text variant="body" color="muted" align="center" style={styles.message}>
            {this.state.error?.message || 'Se produjo un error inesperado al renderizar este componente.'}
          </Text>
          <Button
            variant="primary"
            label="Reintentar"
            onPress={this.handleRetry}
            style={styles.button}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.primary,
    margin: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  message: {
    marginBottom: spacing.md,
    maxWidth: 400,
  },
  button: {
    marginTop: spacing.xs,
  },
});

export default ErrorBoundary;
