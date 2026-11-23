const fs = require('fs');
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const moduleLocations = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const realModuleLocations = [
  ...new Set(
    moduleLocations
      .filter((location) => fs.existsSync(location))
      .map((location) => fs.realpathSync.native(location))
  ),
];

const workspaceModules = fs.realpathSync.native(
  path.resolve(workspaceRoot, 'node_modules')
);

const config = {
  watchFolders: [
    ...new Set([workspaceRoot, ...realModuleLocations]),
  ],

  cacheVersion: 'munierp-standalone-real-modules-v1',

  resolver: {
    nodeModulesPaths: realModuleLocations,

    extraNodeModules: {
      react: path.join(workspaceModules, 'react'),
      'react-native': path.join(workspaceModules, 'react-native'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
