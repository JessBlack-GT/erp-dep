const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const workspace = path.resolve(__dirname, '../..');
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [workspace],
  resolver: {
    nodeModulesPaths: [path.join(__dirname, 'node_modules'), path.join(workspace, 'node_modules')],
  },
});
