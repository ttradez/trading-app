import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tracks which Setup Library setups the user has opened the detail
 * screen for at least once. Drives the Learn screen's "Next Up"
 * recommendation and per-path "N / Total opened" progress counts.
 *
 * Persisted via zustand/middleware + AsyncStorage. Set is
 * serialised as a string[] (the persist middleware can't handle
 * Set natively) and re-hydrated through `partialize` + `merge`.
 */

interface LearnProgressState {
  openedSetupIds: Set<string>;

  /** Mark a setup as opened. Idempotent — repeated opens of the
   *  same setup don't re-write the store. */
  openSetup: (setupId: string) => void;

  /** Convenience read for callers that just need a boolean. */
  hasOpened: (setupId: string) => boolean;

  /** Full reset — wired into the existing "Reset Everything" flow. */
  reset: () => void;
}

export const useLearnProgressStore = create<LearnProgressState>()(
  persist(
    (set, get) => ({
      openedSetupIds: new Set<string>(),

      openSetup: (setupId) => {
        const cur = get().openedSetupIds;
        if (cur.has(setupId)) return; // idempotent — no state churn
        const next = new Set(cur);
        next.add(setupId);
        set({ openedSetupIds: next });
      },

      hasOpened: (setupId) => get().openedSetupIds.has(setupId),

      reset: () => set({ openedSetupIds: new Set<string>() }),
    }),
    {
      name: 'learn-progress-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Set isn't JSON-serialisable — round-trip via an array.
      partialize: (s) => ({
        openedSetupIds: Array.from(s.openedSetupIds),
      }) as unknown as LearnProgressState,
      merge: (persisted, current) => {
        const arr = (persisted as { openedSetupIds?: unknown })
          ?.openedSetupIds;
        return {
          ...current,
          openedSetupIds: Array.isArray(arr)
            ? new Set(arr as string[])
            : new Set<string>(),
        };
      },
    },
  ),
);
