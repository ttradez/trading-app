import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { FEATURE_FLAGS } from '../config/featureFlags';

// iOS public SDK key from app.revenuecat.com. Safe to ship in the
// client bundle (RevenueCat's threat model treats public keys as
// non-secret; the secret key never leaves the dashboard).
const IOS_API_KEY = 'appl_owkLLNlpLuFPhFUTFFxWrdhFHQB';

/**
 * Initialize the RevenueCat SDK exactly once at app launch. Wrapped
 * in try/catch so a misconfigured key (or any other init failure)
 * can't crash the boot — entitlement reads later return `null` and
 * the user is treated as free-tier.
 *
 * Android wiring is deferred until Google Play / RevenueCat Android
 * are set up; this is a no-op on Android so the rest of the call
 * sites (rcLogIn / rcLogOut / useEntitlement) can stay
 * platform-agnostic.
 */
export function initializeRevenueCat(): void {
  if (!FEATURE_FLAGS.REVENUECAT_ENABLED) {
    console.log('[RC] Disabled by feature flag');
    return;
  }
  if (Platform.OS !== 'ios') {
    if (__DEV__) console.warn('[RevenueCat] Skipped — Android initialization deferred until Play Store wiring.');
    return;
  }
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: IOS_API_KEY });
  } catch (err) {
    console.error('[RevenueCat] init failed', err);
  }
}

// Re-export the auth-link helpers so callers don't import Purchases
// directly. Both are iOS-only no-ops on Android, and full no-ops
// when the feature flag is off (the native SDK isn't configured,
// so any Purchases.* call would throw).
export async function rcLogIn(uid: string): Promise<void> {
  if (!FEATURE_FLAGS.REVENUECAT_ENABLED) {
    console.log('[RC] Disabled by feature flag');
    return;
  }
  if (Platform.OS !== 'ios') return;
  try { await Purchases.logIn(uid); } catch (err) { console.error('[RevenueCat] logIn failed', err); }
}

export async function rcLogOut(): Promise<void> {
  if (!FEATURE_FLAGS.REVENUECAT_ENABLED) {
    console.log('[RC] Disabled by feature flag');
    return;
  }
  if (Platform.OS !== 'ios') return;
  try { await Purchases.logOut(); } catch (err) { console.error('[RevenueCat] logOut failed', err); }
}
