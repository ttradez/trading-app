import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Custom watchlist — user-curated historical setups they want to
 * re-study. The "artifact that belongs to the user" retention
 * lever (Spotify-playlist / Watch-Later psychology).
 *
 * Persisted (zustand/middleware + AsyncStorage). Capped at 50 —
 * `addSetup` returns `false` when the cap is hit so the caller can
 * surface the limit alert (the store never does UI).
 *
 * A saved setup carries everything the chart's preload param needs
 * (symbol + date + timeframe), so tapping a saved card on the
 * dashboard reuses the exact same `dailySetup` navigation
 * mechanism the Daily Mission already uses.
 */

export interface SavedSetup {
  id: string;
  symbol: string;
  /** YYYY-MM-DD (NY-time replay date of the bar that was on screen). */
  date: string;
  timeframe: string;
  label: string | null;
  savedAt: string; // ISO datetime
}

export const WATCHLIST_CAP = 50;

interface WatchlistState {
  savedSetups: SavedSetup[];
  /** Prepend a setup. Returns `false` (no-op) if the 50 cap is
   *  already reached — caller shows the limit alert. */
  addSetup: (s: Omit<SavedSetup, 'id' | 'savedAt'>) => boolean;
  removeSetup: (id: string) => void;
  reset: () => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      savedSetups: [],

      addSetup: (s) => {
        if (get().savedSetups.length >= WATCHLIST_CAP) return false;
        const entry: SavedSetup = {
          ...s,
          id: `wl-${Date.now()}`,
          savedAt: new Date().toISOString(),
        };
        set((state) => ({ savedSetups: [entry, ...state.savedSetups] }));
        return true;
      },

      removeSetup: (id) =>
        set((state) => ({
          savedSetups: state.savedSetups.filter((x) => x.id !== id),
        })),

      reset: () => set({ savedSetups: [] }),
    }),
    {
      name: 'watchlist-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** The saved setup matching this symbol + date, or undefined.
 *  Match ignores timeframe — "that day on that symbol" is one
 *  bookmark regardless of which TF the user is viewing now. */
export function useSavedSetup(
  symbol: string,
  date: string,
): SavedSetup | undefined {
  return useWatchlistStore((s) =>
    s.savedSetups.find((x) => x.symbol === symbol && x.date === date)
  );
}

/** Unix-seconds the chart's `startSession` wants. Anchored to
 *  14:00 UTC (~9:30 AM ET year-round); backend snaps to the
 *  nearest bar. Mirrors `setupStartUnixSeconds` in dailySetups so
 *  saved cards and daily missions preload identically. */
export function savedSetupStartUnixSeconds(date: string): number {
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10));
  return Math.floor(Date.UTC(y, m - 1, d, 14, 0, 0) / 1000);
}
