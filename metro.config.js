// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Pocket Trade Metro config.
 *
 * Extends Metro's default `assetExts` so the TradingView Advanced
 * Charts bundle (HTML host, web fonts, CSS) ships as static assets
 * with the JS bundle and can be resolved by expo-asset.
 *
 * @type {import('expo/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

const extraAssetExts = ['html', 'css', 'woff', 'woff2', 'ttf', 'map'];
for (const ext of extraAssetExts) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

// Phase 1.7: treat TradingView library .js files as assets so they ship
// in the binary instead of being parsed as source modules. Narrowly
// scoped via the charting_library path check so normal .js source
// resolution everywhere else is untouched.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.includes('charting_library') && moduleName.endsWith('.js')) {
    return {
      type: 'assetFiles',
      filePaths: [path.resolve(path.dirname(context.originModulePath), moduleName)],
    };
  }
  // Fall through to Metro's default resolver (context.resolveRequest is
  // the default when no custom one was previously set).
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
