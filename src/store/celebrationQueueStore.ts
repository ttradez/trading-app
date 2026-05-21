import { create } from 'zustand';
import { RankId, SubTier } from '../data/rankConfig';

/**
 * Unified celebration queue (DESIGN_AUDIT retention benchmark —
 * "Celebration moments"). Ephemeral, NOT persisted — a celebration
 * the user never saw isn't worth replaying on next launch (the
 * badge / rank / streak itself is already in the underlying store).
 *
 * Three kinds — `badge`, `rank`, `streak`. Dequeue order is by
 * KIND PRIORITY first (badge → rank → streak), then FIFO within a
 * kind. So when a single action fires all three (e.g. a trade
 * closes a streak day + earns a badge + ranks the user up), they
 * always play in the spec-mandated order regardless of which store
 * subscriber emitted first.
 *
 * Enqueued by `useCelebrationTriggers` from observed store diffs;
 * drained one-at-a-time by `CelebrationHost`.
 */

export interface BadgeCelebration {
  kind: 'badge';
  badgeId: string;
}

export interface RankCelebration {
  kind: 'rank';
  rank: RankId;
  subTier: SubTier;
  label: string;
  /** True = main-rank promotion (e.g. Gambler → Paper Hands); false
   *  = intra-rank sub-tier step (e.g. Gambler I → Gambler II). */
  isPromotion: boolean;
  /** XP delta that pushed the user across the threshold. */
  xpEarned: number;
}

export interface StreakCelebration {
  kind: 'streak';
  count: number;
  /** Day count of the next milestone, or null at the cap. */
  nextMilestone: number | null;
}

export type CelebrationEvent =
  | BadgeCelebration
  | RankCelebration
  | StreakCelebration;

interface QueueState {
  badge: BadgeCelebration[];
  rank: RankCelebration[];
  streak: StreakCelebration[];
  /** Bumped on every enqueue so subscribers can re-read by ref. */
  version: number;

  enqueue: (e: CelebrationEvent) => void;
  dequeue: () => CelebrationEvent | undefined;
  clear: () => void;
}

export const useCelebrationQueueStore = create<QueueState>((set, get) => ({
  badge: [],
  rank: [],
  streak: [],
  version: 0,

  enqueue: (e) =>
    set((s) => {
      // Per-kind FIFO append, plus a dedup guard for badge IDs so a
      // re-evaluate that re-unlocks the same id can't double-fire.
      if (e.kind === 'badge') {
        if (s.badge.some((b) => b.badgeId === e.badgeId)) return s;
        return { badge: [...s.badge, e], version: s.version + 1 };
      }
      if (e.kind === 'rank') {
        return { rank: [...s.rank, e], version: s.version + 1 };
      }
      return { streak: [...s.streak, e], version: s.version + 1 };
    }),

  dequeue: () => {
    const s = get();
    // Priority: badge → rank → streak.
    if (s.badge.length) {
      const [first, ...rest] = s.badge;
      set({ badge: rest });
      return first;
    }
    if (s.rank.length) {
      const [first, ...rest] = s.rank;
      set({ rank: rest });
      return first;
    }
    if (s.streak.length) {
      const [first, ...rest] = s.streak;
      set({ streak: rest });
      return first;
    }
    return undefined;
  },

  clear: () => set({ badge: [], rank: [], streak: [] }),
}));

/** Total pending length across all kinds — convenient for subscribers
 *  that just need to know "is there something to drain?". */
export function useCelebrationQueueLength(): number {
  return useCelebrationQueueStore(
    (s) => s.badge.length + s.rank.length + s.streak.length,
  );
}
