/**
 * Babel configuration for Pip (Expo + React Native).
 *
 * Extends Expo's default preset and ADDS a single production-only
 * transform that strips console.log / console.warn / console.debug
 * calls from the bundle. console.error is preserved so error
 * reporting (Crashlytics, Sentry) still captures developer-emitted
 * error events.
 *
 * The plugin is well-vetted (used by React Native CLI's own
 * remove-console rule) but it must be installed as a devDependency
 * BEFORE the next production build:
 *
 *   npm install --save-dev babel-plugin-transform-remove-console
 *
 * Until installed, the plugin reference below is a no-op in
 * development (development.plugins is empty) and a build error in
 * production (which is the desired loud signal — install the
 * package then re-run `eas build --profile production`).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    env: {
      production: {
        plugins: [
          // Strip console.log / console.warn / console.debug / console.info
          // from the production bundle. Keeps console.error for crash
          // reporters. ~45 stray console.log calls in src/ go away on
          // the production build with zero individual edits.
          ['transform-remove-console', { exclude: ['error'] }],
        ],
      },
    },
  };
};
