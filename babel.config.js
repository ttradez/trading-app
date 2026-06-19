/**
 * Babel configuration for Pip (Expo + React Native).
 *
 * Minimal: just the Expo preset. The earlier version of this file
 * added a production-only `transform-remove-console` plugin to
 * strip console.* from production bundles, but that broke the EAS
 * iOS bundle phase (suspected Babel cache vs env interaction).
 *
 * Console.* calls are left in the v1 bundle — not a store-rejection
 * issue, just minor verbosity in the device console. Re-introduce
 * the strip in v1.1 after the launch is stable, paired with
 * `api.cache.using(() => process.env.NODE_ENV)` so env switching
 * actually invalidates the cache.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
