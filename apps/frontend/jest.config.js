module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  setupFiles: ['./tests/setup.js'],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-.*|@react-navigation/.*|react-native-vector-icons|@react-native-async-storage/async-storage))',
  ],
};
