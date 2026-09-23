module.exports = {
  presets: ['babel-preset-expo'],
  env: {
    development: {
      plugins: ['react-native-web/babel-plugin'],
    },
  },
  plugins: [
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-proposal-object-rest-spread', { useBuiltIns: true }],
  ],
};
