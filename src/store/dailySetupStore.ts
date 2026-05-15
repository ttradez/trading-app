import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayYMD } from './streakStore';

/**
 * Daily-setup completion tracking.
 *
 * The "Today's Mission" card is marked done once the user places
 * (and closes) a trade on the curated scenario's symbol + date.
 * We only need to remember the calendar date on which the user
 * last completed a mission — if that equals today's date, today's
 * mission is done; otherwise the freshly-rotated scenario shows
 * uncompleted. No per-scenario history is kept (the rotation is
 * deterministic by day-of-year, so the date alone is sufficient).
 *
 * Persisted via `zustand/middleware` + AsyncStorage so completion
 * survives an app restart on the same day. Reuses
 * `getTodayYMD()` from streakStore for a single source of truth on
 * "what is today" (device-local).
 */

interface DailySetupState {
  /** YYYY-MM-DD of the day the user last completed a daily mission.
   *  `null` until the first completion ever. */
  lastCompletedSetupDate: string | null;

  /** Mark today's mission complete (idempotent within a day). */
  markCompletedToday: () => void;
  /** Wipe (dev / sign-out). */
  reset: () => void;
}

export const useDailySetupStore = create<DailySetupState>()(
  persist(
    (set) => ({
      lastCompletedSetupDate: null,

      markCompletedToday: () =>
        set({ lastCompletedSetupDate: getTodayYMD() }),

      reset: () => set({ lastCompletedSetupDate: null }),
    }),
    {
      name: 'daily-setup-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Selector hook — true iff the user has completed a mission whose
 *  recorded date equals the current device-local date. Re-renders
 *  the dashboard card the moment `markCompletedToday` lands. */
export function useIsTodaySetupComplete(): boolean {
  return useDailySetupStore(
    (s) => s.lastCompletedSetupDate === getTodayYMD()
  );
}
