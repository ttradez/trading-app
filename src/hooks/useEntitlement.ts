import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  CustomerInfoUpdateListener,
} from 'react-native-purchases';
import { FEATURE_FLAGS } from '../config/featureFlags';

/**
 * useEntitlement — read the user's current "pro" entitlement from
 * RevenueCat and stay subscribed to live updates (purchase / restore
 * / cross-device refresh).
 *
 * iOS-only behavior: on Android the SDK isn't initialized yet
 * (see `initializeRevenueCat` in src/services/revenueCat.ts), so we
 * return defaults (`isPro: false`, `loading: false`) and skip the
 * effect entirely. This keeps callers platform-agnostic without
 * spurious "loading…" states on Android.
 *
 * Mounted by whichever surface needs the entitlement — there is no
 * top-level subscription yet because Phase 2 has no paywall UI or
 * gated features (intentional: avoids holding a listener for nothing).
 */

const PRO_ENTITLEMENT = 'pro';

export interface EntitlementState {
  isPro: boolean;
  loading: boolean;
  customerInfo: CustomerInfo | null;
}

export function useEntitlement(): EntitlementState {
  const [state, setState] = useState<EntitlementState>({
    isPro: false,
    loading: FEATURE_FLAGS.REVENUECAT_ENABLED && Platform.OS === 'ios',
    customerInfo: null,
  });

  useEffect(() => {
    if (!FEATURE_FLAGS.REVENUECAT_ENABLED) return;
    if (Platform.OS !== 'ios') return;
    let cancelled = false;

    const apply = (info: CustomerInfo) => {
      if (cancelled) return;
      setState({
        isPro: !!info.entitlements.active[PRO_ENTITLEMENT],
        loading: false,
        customerInfo: info,
      });
    };

    Purchases.getCustomerInfo()
      .then(apply)
      .catch((err) => {
        if (cancelled) return;
        console.error('[useEntitlement] getCustomerInfo failed', err);
        setState((s) => ({ ...s, loading: false }));
      });

    const listener: CustomerInfoUpdateListener = (info) => apply(info);
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  return state;
}
