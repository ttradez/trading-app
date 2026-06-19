import { useEffect } from 'react';
import { useBadgeStore } from '../store/badgeStore';
import { useStreakStore } from '../store/streakStore';
import { useCelebrationStore } from '../store/celebrationStore';
import { useCelebrationQueueStore } from '../store/celebrationQueueStore';

/**
 * Observe-only triggers for the unified celebration queue
 * (DESIGN_AUDIT retention benchmark — "Celebration moments").
 *
 * Uses diffing of previous vs current store values. The underlying
 * badge / rank / streak logic is unchanged — this hook only WATCHES.
 *
 *  - Badge unlocks: diff `badgeStore.unlockedBadges` keys.
 *  - Rank changes:  drain the legacy `celebrationStore.queue` (the
 *    same queue `xpStore.addXP` already populates on a beat
 *    crossing — reusing it preserves the exact `xpEarned` delta
 *    and the sub-tier vs main-rank distinction without re-deriving
 *    them from XP alone).
 *  - Streak milestones: detect a `currentStreak` crossing of any
 *    value in the canonical milestone list.
 *
 * Mounted in `MainTabs` so it runs only after the user is
 * authenticated and the stores have hydrated.
 */

const STREAK_MILESTONES: ReadonlyArray<number> =
  [3, 7, 14, 30, 60, 100, 365];

function nextMilestoneAfter(count: number): number | null {
  for (const m of STREAK_MILESTONES) {
    if (m > count) return m;
  }
  return null;
}

export function useCelebrationTriggers(): void {
  useEffect(() => {
    const enqueue = useCelebrationQueueStore.getState().enqueue;

    // ── Badges ────────────────────────────────────────────────
    // The ledger is a Record<badgeId, isoUnlockedAt>. The initial
    // ref captures whatever is already unlocked at mount so we
    // never re-celebrate persisted unlocks. Idempotency of
    // `unlockBadge` keeps this safe across re-evaluates.
    let prevBadgeKeys = new Set(
      Object.keys(useBadgeStore.getState().unlockedBadges),
    );
    const unsubBadge = useBadgeStore.subscribe((s) => {
      const newKeys = Object.keys(s.unlockedBadges);
      const additions: string[] = [];
      for (const id of newKeys) {
        if (!prevBadgeKeys.has(id)) additions.push(id);
      }
      if (additions.length > 0) {
        for (const id of additions) {
          enqueue({ kind: 'badge', badgeId: id });
        }
      }
      prevBadgeKeys = new Set(newKeys);
    });

    // ── Rank-ups ──────────────────────────────────────────────
    // Drain the legacy celebrationStore: xpStore.addXP enqueues
    // a `CelebrationItem` (with exact xpEarned + the sub-tier vs
    // rank distinction) any time a beat is crossed. We re-route
    // those into the unified queue and let the priority dequeue
    // order them after badges, before streaks.
    const drainLegacyRanks = () => {
      while (true) {
        const item = useCelebrationStore.getState().dequeue();
        if (!item) break;
        enqueue({
          kind: 'rank',
          rank: item.newRank,
          subTier: item.newSubTier,
          label: rankLabel(item.newRank, item.newSubTier),
          isPromotion: item.type === 'rank',
          xpEarned: item.xpEarned,
        });
      }
    };
    drainLegacyRanks(); // catch anything already enqueued pre-mount
    const unsubRank = useCelebrationStore.subscribe(drainLegacyRanks);

    // ── Streak milestones ─────────────────────────────────────
    let prevStreak = useStreakStore.getState().currentStreak;
    const unsubStreak = useStreakStore.subscribe((s) => {
      const cur = s.currentStreak;
      if (cur > prevStreak) {
        for (const m of STREAK_MILESTONES) {
          if (prevStreak < m && cur >= m) {
            enqueue({
              kind: 'streak',
              count: m,
              nextMilestone: nextMilestoneAfter(m),
            });
          }
        }
      }
      prevStreak = cur;
    });

    return () => {
      unsubBadge();
      unsubRank();
      unsubStreak();
    };
  }, []);
}

// ── Helpers ────────────────────────────────────────────────────────

const RANK_NAME = {
  paper: 'Paper',
  unprofitable: 'Unprofitable',
  disciplined: 'Disciplined',
  consistent: 'Consistent',
  profitable: 'Profitable',
  funded: 'Funded',
} as const;
const ROMAN = { 1: 'I', 2: 'II', 3: 'III' } as const;

function rankLabel(
  rank: keyof typeof RANK_NAME,
  subTier: 1 | 2 | 3 | null,
): string {
  // Funded cap (subTier === null): label is just the rank name, no
  // roman numeral.
  return subTier == null
    ? RANK_NAME[rank]
    : `${RANK_NAME[rank]} ${ROMAN[subTier]}`;
}
