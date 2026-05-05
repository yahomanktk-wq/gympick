const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// SVG transformer
const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter(ext => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

// Copied from expo-yarn-workspaces
config.transformer.enableBabelRCLookup = false;
config.resolver.assetExts.push('db');
config.resolver.blockList = [
  /\/__tests__\//,
  /\/android\/React(Android|Common)\//,
  /\/versioned-react-native\//,
];

module.exports = config;
