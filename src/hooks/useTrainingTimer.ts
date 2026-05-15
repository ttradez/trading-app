import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useStreakStore } from '../store/streakStore';
import { useOnboardingStore } from '../store/onboardingStore';

/**
 * useTrainingTimer — ticks while the host screen is mounted AND the
 * app is foregrounded. Each tick credits ~10 s of training time to
 * the streak store. When today's bucket crosses the user's daily
 * goal, the store auto-fires `completeDaily()` and the StreakBadge
 * updates the next time it re-reads state.
 *
 * Mounted in `TradingScreen` (the chart / replay screen). The
 * interval is paused on background and resumed on foreground via
 * AppState so the user can't accumulate "training" time while their
 * phone is locked.
 *
 * On unmount (or pause), any partial interval since the last tick
 * is flushed so brief visits aren't rounded to zero. The minimum
 * partial credited is 1 s to avoid noise from mount-then-unmount
 * thrash.
 */

const TICK_MS      = 10_000;
const TICK_MINUTES = TICK_MS / 60_000;     // 0.16667
const MS_PER_MIN   = 60_000;
const MIN_PARTIAL_MS = 1_000;              // ignore partials under 1 s

export function useTrainingTimer() {
  const addTrainingTime  = useStreakStore((s) => s.addTrainingTime);
  const dailyGoalMinutes = useOnboardingStore((s) => s.dailyTimeGoalMinutes);

  // Refs so the AppState handler + interval callback always see the
  // latest values without forcing the effect to re-mount.
  const addRef   = useRef(addTrainingTime);
  const goalRef  = useRef(dailyGoalMinutes);
  addRef.current  = addTrainingTime;
  goalRef.current = dailyGoalMinutes;

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let lastTickAt = Date.now();

    const tick = () => {
      addRef.current(TICK_MINUTES, goalRef.current);
      lastTickAt = Date.now();
    };

    /** Credit any time since the last tick (or since start) so brief
     *  visits / pre-pause partials aren't lost. */
    const flushPartial = () => {
      const elapsedMs = Date.now() - lastTickAt;
      if (elapsedMs >= MIN_PARTIAL_MS) {
        addRef.current(elapsedMs / MS_PER_MIN, goalRef.current);
      }
      lastTickAt = Date.now();
    };

    const start = () => {
      if (intervalId !== null) return;
      lastTickAt = Date.now();
      intervalId = setInterval(tick, TICK_MS);
    };

    const stop = () => {
      if (intervalId === null) return;
      flushPartial();
      clearInterval(intervalId);
      intervalId = null;
    };

    // Start immediately if foregrounded; the AppState handler covers
    // the case where the screen mounts while the app is backgrounded
    // (unusual, but possible during state restoration).
    if (AppState.currentState === 'active') start();

    const handler = (s: AppStateStatus) => {
      if (s === 'active') start();
      else stop();
    };
    const sub = AppState.addEventListener('change', handler);

    return () => {
      stop();
      sub.remove();
    };
  }, []);
}
