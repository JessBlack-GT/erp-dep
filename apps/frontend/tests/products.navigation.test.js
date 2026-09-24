import React from 'react';
import { render } from '@testing-library/react-native';
import { useAuth } from '../src/context/AuthContext';
import { MainNavigator } from '../src/app/navigation/MainNavigator';

jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return {
      Navigator: ({ children }) => <View>{children}</View>,
      Screen: ({ name, component }) => (
        <Text>{`${name}:${typeof component}`}</Text>
      ),
    };
  },
}));

describe('M05 registration in MainNavigator (native navigation mocked)', () => {
  it('registers all product screens for an authenticated session', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
    const screen = render(<MainNavigator />);
    for (const name of ['Products', 'ProductDetail', 'ProductForm'])
      expect(screen.getByText(`${name}:function`)).toBeTruthy();
  });
  it('does not expose product screens while unauthenticated or loading', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
    const screen = render(<MainNavigator />);
    expect(screen.queryByText('Products:function')).toBeNull();
    useAuth.mockReturnValue({ isAuthenticated: false, loading: true });
    screen.rerender(<MainNavigator />);
    expect(screen.toJSON()).toBeNull();
  });
});
