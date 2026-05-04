/**
 * Interstitial ad fires every 6 minutes of active session time.
 * Uses react-native-google-mobile-ads.
 * Replace AD_UNIT_ID with your real AdMob unit before publishing.
 */
import { useEffect, useRef } from 'react';
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

const AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'; // replace before publish

const AD_INTERVAL_MS = 6 * 60 * 1000;

export function useInterstitialAd() {
  const adRef = useRef<InterstitialAd | null>(null);
  const loadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAd = () => {
    const ad = InterstitialAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
    ad.addAdEventListener(AdEventType.LOADED, () => {
      loadedRef.current = true;
    });
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      loadedRef.current = false;
      loadAd(); // preload next
    });
    ad.load();
    adRef.current = ad;
  };

  const showAd = () => {
    if (loadedRef.current && adRef.current) {
      adRef.current.show();
    }
  };

  const startAdTimer = () => {
    loadAd();
    timerRef.current = setInterval(showAd, AD_INTERVAL_MS);
  };

  const stopAdTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return { startAdTimer, stopAdTimer };
}
