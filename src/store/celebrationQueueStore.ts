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
  /** null when the new rank is the Funded cap (no division). */
  subTier: SubTier | null;
  label: string;
  /** True = main-rank promotion (e.g. Paper → Unprofitable); false
   *  = intra-rank sub-tier step (e.g. Paper I → Paper II). */
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

/** Freeze-earned moment (every 7-day streak step). Positive
 *  framing only — "you have a tool" not "you might lose progress". */
export interface FreezeCelebration {
  kind: 'freeze';
  /** The streak day count at which the freeze was earned. */
  atStreak: number;
}

export type CelebrationEvent =
  | BadgeCelebration
  | RankCelebration
  | StreakCelebration
  | FreezeCelebration;

interface QueueState {
  badge: BadgeCelebration[];
  rank: RankCelebration[];
  streak: StreakCelebration[];
  freeze: FreezeCelebration[];
  /** Bumped on every enqueue so subscribers can re-read by ref. */
  version: number;
  /** When true, CelebrationHost holds dequeues — used by
   *  PostTradeSummaryModal so its in-flight summary isn't
   *  interrupted by a queued badge/rank/streak celebration. */
  paused: boolean;

  enqueue: (e: CelebrationEvent) => void;
  dequeue: () => CelebrationEvent | undefined;
  clear: () => void;
  /** Mark the queue paused (CelebrationHost holds presentation
   *  until `resume` is called). Idempotent. */
  pause: () => void;
  /** Unpause — CelebrationHost picks up whatever has queued
   *  while paused and presents in priority order. */
  resume: () => void;
}

export const useCelebrationQueueStore = create<QueueState>((set, get) => ({
  badge: [],
  rank: [],
  streak: [],
  freeze: [],
  version: 0,
  paused: false,

  enqueue: (e) =>
    set((s) => {
      // Per-kind FIFO append, plus dedup guards: badge IDs (a
      // re-evaluate can't double-fire the same unlock) and
      // freeze atStreak (same streak crossing can't double-grant).
      if (e.kind === 'badge') {
        if (s.badge.some((b) => b.badgeId === e.badgeId)) return s;
        return { badge: [...s.badge, e], version: s.version + 1 };
      }
      if (e.kind === 'rank') {
        return { rank: [...s.rank, e], version: s.version + 1 };
      }
      if (e.kind === 'streak') {
        return { streak: [...s.streak, e], version: s.version + 1 };
      }
      if (s.freeze.some((f) => f.atStreak === e.atStreak)) return s;
      return { freeze: [...s.freeze, e], version: s.version + 1 };
    }),

  dequeue: () => {
    const s = get();
    // Priority: badge → rank → streak → freeze. Freeze sits at the
    // bottom so a streak-milestone celebration plays first when both
    // fire from the same 7-day step.
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
    if (s.freeze.length) {
      const [first, ...rest] = s.freeze;
      set({ freeze: rest });
      return first;
    }
    return undefined;
  },

  clear: () => set({ badge: [], rank: [], streak: [], freeze: [] }),
  pause:  () => set({ paused: true }),
  resume: () => set({ paused: false }),
}));

/** Total pending length across all kinds — convenient for subscribers
 *  that just need to know "is there something to drain?". */
export function useCelebrationQueueLength(): number {
  return useCelebrationQueueStore(
    (s) => s.badge.length + s.rank.length + s.streak.length + s.freeze.length,
  );
}
