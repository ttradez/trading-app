import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeeklyRecap } from '../utils/weeklyRecap';

/**
 * Stored weekly recaps, keyed by ISO weekId ("2026-W20"). Each
 * entry keeps the full recap plus a `viewedAt` (null until the
 * user dismisses its modal — drives the auto-popup "show once"
 * logic). The last 12 weeks are kept; older ones are pruned on
 * save so storage stays bounded.
 *
 * Persisted via `zustand/middleware` + AsyncStorage. Firebase sync
 * is a follow-up.
 */

export interface StoredRecap {
  recap: WeeklyRecap;
  viewedAt: string | null;
}

const MAX_RECAPS = 12;

interface RecapState {
  recaps: Record<string, StoredRecap>;

  /** Insert the recap if its week isn't stored yet (idempotent —
   *  never overwrites an existing week, so a re-generate can't
   *  wipe a `viewedAt`). Prunes to the most recent 12 weeks. */
  saveRecap: (recap: WeeklyRecap) => void;
  /** Stamp `viewedAt = now` for a week (called on modal dismiss). */
  markViewed: (weekId: string) => void;
  getRecap: (weekId: string) => StoredRecap | undefined;
  reset: () => void;
}

export const useRecapStore = create<RecapState>()(
  persist(
    (set, get) => ({
      recaps: {},

      saveRecap: (recap) => {
        const existing = get().recaps;
        if (existing[recap.weekId]) return; // never clobber viewedAt
        const next = { ...existing, [recap.weekId]: { recap, viewedAt: null } };
        // Prune: keep the 12 most-recent weekIds (lexical sort is
        // chronological because week numbers are zero-padded).
        const ids = Object.keys(next).sort();
        if (ids.length > MAX_RECAPS) {
          for (const id of ids.slice(0, ids.length - MAX_RECAPS)) {
            delete next[id];
          }
        }
        set({ recaps: next });
      },

      markViewed: (weekId) => {
        const existing = get().recaps[weekId];
        if (!existing) return;
        set((s) => ({
          recaps: {
            ...s.recaps,
            [weekId]: { ...existing, viewedAt: new Date().toISOString() },
          },
        }));
      },

      getRecap: (weekId) => get().recaps[weekId],

      reset: () => set({ recaps: {} }),
    }),
    {
      name: 'weekly-recap-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Recaps newest-first, for the Journal "Weekly Recaps" list. */
export function useRecapList(): StoredRecap[] {
  return useRecapStore((s) =>
    Object.values(s.recaps).sort(
      (a, b) => b.recap.weekStart - a.recap.weekStart,
    )
  );
}
