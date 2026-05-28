// Learn more https://docs.expo.io/guides/customizing-metro
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

const extraAssetExts = ['html', 'css', 'woff', 'woff2', 'ttf'];
for (const ext of extraAssetExts) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

module.exports = config;
