/**
 * Crash-reporting facade for Pip.
 *
 * STATUS: stub for v1.0. The real Firebase Crashlytics integration is
 * deferred to v1.1 because Metro's static bundler doesn't respect the
 * runtime try/catch around a `require('@react-native-firebase/crashlytics')`
 * — it tries to resolve the module at bundle time and fails the build
 * when the package isn't installed.
 *
 * To enable real crash reporting in v1.1:
 *   1. `npx expo install @react-native-firebase/app @react-native-firebase/crashlytics`
 *   2. Drop GoogleService-Info.plist + google-services.json in the project root
 *   3. Add both Firebase plugins to app.json's `expo.plugins`
 *   4. Replace the stub functions below with the real crashlytics() calls
 *
 * Until then all four functions no-op (or log to dev console). Callers
 * across the app — App.tsx initCrashReporting/setCrashUser, etc. —
 * don't need to change.
 */

export function initCrashReporting(): void {
  // No-op. Real impl: crashlytics().setCrashlyticsCollectionEnabled(!__DEV__)
}

export function setCrashUser(_uid: string | null): void {
  // No-op. Real impl: crashlytics().setUserId(_uid ?? '')
}

export function logHandledError(err: unknown, context?: string): void {
  // Dev-only: still surface in console.error so developer can debug.
  // Production: silently drop (the babel transform-remove-console
  // plugin strips console.log/warn/info/debug but keeps console.error).
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.error(`[crash] handled: ${context ?? ''}`, err);
  }
}

export function breadcrumb(_message: string): void {
  // No-op. Real impl: crashlytics().log(_message)
}
