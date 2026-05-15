import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useChallengeStore } from '../store/challengeStore';
import { useXpStore } from '../store/xpStore';

/**
 * Runs `checkExpiry(currentRank)` on app open and on every
 * background → foreground (the date may have rolled while
 * backgrounded). Generates fresh dailies/weekly/monthly when
 * their period has elapsed; expired-incomplete challenges just
 * disappear (no backlog, no shame). Mounted in MainTabs.
 */
export function useChallengeRotation() {
  const checkRef = useRef(() => {
    const rank = useXpStore.getState().currentRank;
    useChallengeStore.getState().checkExpiry(rank);
  });

  useEffect(() => {
    checkRef.current();
    const handler = (s: AppStateStatus) => {
      if (s === 'active') checkRef.current();
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, []);
}
