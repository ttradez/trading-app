/**
 * Crash-reporting integration for Pip.
 *
 * Uses Firebase Crashlytics via @react-native-firebase/crashlytics.
 * Crashlytics auto-captures uncaught native crashes AND JS errors when
 * paired with the React Native error utilities. We wrap it in a thin
 * facade here so the rest of the app calls one stable API and we can
 * swap providers (Sentry, Bugsnag) without touching every caller.
 *
 * Required setup BEFORE crash reporting actually works in a build:
 *
 *  1. Install the native modules:
 *       npx expo install @react-native-firebase/app @react-native-firebase/crashlytics
 *
 *  2. Drop the Firebase service config files into the project root:
 *       trading-app/GoogleService-Info.plist     (iOS, from Firebase Console)
 *       trading-app/google-services.json         (Android, from Firebase Console)
 *
 *  3. Wire the @react-native-firebase/app + crashlytics plugins into
 *     app.json's `expo.plugins` array (they auto-detect the service
 *     files).
 *
 *  4. Rebuild via EAS — Crashlytics requires a native rebuild, hot-reload
 *     does NOT pick it up.
 *
 * Until #1-#4 are done, this module no-ops gracefully (the dynamic
 * require throws but is caught; the wrapper functions become
 * pass-through). Callers don't have to special-case the dev case.
 */

let crashlytics: any = null;

try {
  // Dynamic require so the build doesn't fail before the package is
  // installed. Once @react-native-firebase/crashlytics is in
  // node_modules, this resolves and the facade below starts emitting
  // events to Crashlytics.
  crashlytics = require('@react-native-firebase/crashlytics').default;
} catch {
  // Package not installed yet — leave crashlytics as null. All facade
  // functions will short-circuit harmlessly.
}

/**
 * Initialize crash reporting once on app start. Safe to call before
 * Firebase is ready — under the hood Crashlytics queues until the
 * native module is up.
 */
export function initCrashReporting(): void {
  if (!crashlytics) return;
  try {
    // Auto-collection: ON in production builds, OFF in dev so the
    // developer's local crashes don't pollute the production
    // dashboard. __DEV__ is the React Native global.
    crashlytics().setCrashlyticsCollectionEnabled(!__DEV__);
  } catch {
    // Best-effort — don't fail app start over a crash-reporter init.
  }
}

/**
 * Tag the current Crashlytics session with the signed-in user's uid
 * so a crash report can be tied back to one user without exposing
 * email or personally identifying info. Call this from the auth-state
 * listener after sign-in, and with null on sign-out.
 */
export function setCrashUser(uid: string | null): void {
  if (!crashlytics) return;
  try {
    crashlytics().setUserId(uid ?? '');
  } catch {
    // ignore
  }
}

/**
 * Log a non-fatal error (caught exception) to Crashlytics. The error
 * appears in the dashboard alongside any subsequent fatal crash, with
 * the surrounding breadcrumbs. Use this for caught errors that you
 * want visibility on without crashing the app — e.g. unexpected API
 * payload shapes, image-decode failures, etc.
 */
export function logHandledError(err: unknown, context?: string): void {
  // Always print to dev console too — local debugging.
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.error(`[crash] handled: ${context ?? ''}`, err);
  }
  if (!crashlytics) return;
  try {
    if (context) crashlytics().log(context);
    crashlytics().recordError(err instanceof Error ? err : new Error(String(err)));
  } catch {
    // ignore
  }
}

/**
 * Drop a human-readable breadcrumb into the current Crashlytics
 * session. Breadcrumbs are attached to the next crash report — they
 * let you reconstruct what the user was doing before a crash. Cheap
 * to call from key user-flow points (session-start, trade-open,
 * timeframe-switch, journal-save).
 */
export function breadcrumb(message: string): void {
  if (!crashlytics) return;
  try {
    crashlytics().log(message);
  } catch {
    // ignore
  }
}
