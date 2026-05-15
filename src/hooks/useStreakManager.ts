import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useStreakStore } from '../store/streakStore';

/**
 * useStreakManager — runs the streak daily-check on mount and on
 * every background → foreground transition. Idempotent: it's safe
 * to mount in more than one place (the check just no-ops if nothing
 * changed).
 *
 * Mounted in `MainTabs` so it activates the moment the user enters
 * the main app post-onboarding. Onboarding screens don't need it —
 * a brand-new user has no `lastCompletedDate` yet, so the daily
 * check would short-circuit anyway.
 *
 * AppState handling exists because the user may keep the app open
 * across a midnight boundary — without it, the badge would show
 * stale state until the next cold start. The 'change' listener
 * fires on background → foreground; performDailyCheck() reads the
 * device clock fresh each call so the date rollover is detected.
 */
export function useStreakManager() {
  const performDailyCheck = useStreakStore((s) => s.performDailyCheck);

  // Stash the latest function in a ref so the AppState handler always
  // sees the live reference even though we deliberately mount the
  // effect once.
  const checkRef = useRef(performDailyCheck);
  checkRef.current = performDailyCheck;

  useEffect(() => {
    checkRef.current();

    const handler = (state: AppStateStatus) => {
      if (state === 'active') {
        checkRef.current();
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, []);
}
