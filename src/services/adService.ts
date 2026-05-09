/**
 * Interstitial ad — STUBBED for development.
 *
 * Real ads require react-native-google-mobile-ads which can't load in Expo Go
 * (no native module) or in web (no native bindings). To enable ads:
 *   1. Build a custom dev client: `eas build --profile development --platform ios|android`
 *   2. Restore the real implementation from git history (see commit 07680c3)
 *   3. Set up real AdMob unit IDs
 *
 * For now this is a no-op so the rest of the app can run in Expo Go and web.
 */

export function useInterstitialAd() {
  const startAdTimer = () => {};
  const stopAdTimer = () => {};
  return { startAdTimer, stopAdTimer };
}
