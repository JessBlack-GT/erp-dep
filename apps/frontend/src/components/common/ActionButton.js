import React from 'react';
import PropTypes from 'prop-types';
import { Platform } from 'react-native';
import { Button as ThemedButton } from './Button';

export function ActionButton({
  title,
  label = title,
  variant = 'primary',
  ...props
}) {
  return (
    <ThemedButton
      label={label}
      variant={variant}
      inferAccessibilityLabel={Platform.OS !== 'web'}
      {...props}
    />
  );
}

ActionButton.propTypes = {
  title: PropTypes.string,
  label: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'ghost', 'danger']),
};

export default ActionButton;
