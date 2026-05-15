import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Achievement progress. Persisted (zustand/middleware +
 * AsyncStorage). Holds the unlock ledger plus the few stateful
 * counters that can't be re-derived from trade history alone:
 *
 *  - `consecutiveWins` — current win streak (Hot Hand / On Fire /
 *    Untouchable). Mutated exactly once per closed trade by the
 *    trade-close checker; resets on a loss.
 *  - `dailySetupsCompleted` — lifetime daily-mission completions.
 *  - `freezesUsedTotal` — lifetime streak-freeze usage (Freeze
 *    Saver / Unbreakable).
 *
 * `unlockBadge` is idempotent — re-unlocking never re-stamps the
 * timestamp, so a re-evaluate can't make a badge "newly unlocked"
 * twice (the toast fires once).
 */

interface BadgeState {
  unlockedBadges: Record<string, string>; // badgeId → ISO unlockedAt
  consecutiveWins: number;
  dailySetupsCompleted: number;
  freezesUsedTotal: number;

  unlockBadge: (badgeId: string) => void;
  isUnlocked: (badgeId: string) => boolean;
  getUnlockedCount: () => number;

  incrementConsecutiveWins: () => void;
  resetConsecutiveWins: () => void;
  incrementDailySetupsCompleted: () => void;
  addFreezesUsed: (n: number) => void;

  reset: () => void;
}

const INITIAL = {
  unlockedBadges: {} as Record<string, string>,
  consecutiveWins: 0,
  dailySetupsCompleted: 0,
  freezesUsedTotal: 0,
};

export const useBadgeStore = create<BadgeState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      unlockBadge: (badgeId) => {
        if (get().unlockedBadges[badgeId]) return; // idempotent
        set((s) => ({
          unlockedBadges: {
            ...s.unlockedBadges,
            [badgeId]: new Date().toISOString(),
          },
        }));
      },

      isUnlocked: (badgeId) => !!get().unlockedBadges[badgeId],
      getUnlockedCount: () => Object.keys(get().unlockedBadges).length,

      incrementConsecutiveWins: () =>
        set((s) => ({ consecutiveWins: s.consecutiveWins + 1 })),
      resetConsecutiveWins: () => set({ consecutiveWins: 0 }),
      incrementDailySetupsCompleted: () =>
        set((s) => ({ dailySetupsCompleted: s.dailySetupsCompleted + 1 })),
      addFreezesUsed: (n) =>
        set((s) => ({ freezesUsedTotal: s.freezesUsedTotal + Math.max(0, n) })),

      reset: () => set({ ...INITIAL, unlockedBadges: {} }),
    }),
    {
      name: 'badge-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Live unlocked count for the dashboard counter + trophy bar. */
export function useUnlockedCount(): number {
  return useBadgeStore((s) => Object.keys(s.unlockedBadges).length);
}
