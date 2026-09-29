module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [require.resolve('./scripts/inline-public-api.cjs')],
};
