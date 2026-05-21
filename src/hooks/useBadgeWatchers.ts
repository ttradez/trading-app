import { useEffect } from 'react';
import { useStreakStore } from '../store/streakStore';
import { useBadgeStore } from '../store/badgeStore';
import { checkStreakBadges, evaluateBadges } from '../utils/badgeChecker';

/**
 * Mounted in MainTabs. Two jobs:
 *
 *  1. On entry, run a full badge evaluation once — picks up
 *     anything already earned from persisted data (streak
 *     milestones, trade volume, journal counts) that hadn't been
 *     detected yet.
 *
 *  2. Subscribe to the streak store and react to changes the
 *     trade/journal/watchlist call-site triggers don't cover:
 *       - `currentStreak` increased → re-evaluate (streak badges).
 *       - `freezesAvailable` decreased → a freeze was consumed;
 *         add the delta to the lifetime `freezesUsedTotal` (drives
 *         Freeze Saver / Unbreakable) then re-evaluate.
 *     `freezesAvailable` can also *increase* (a freeze is earned
 *     every 7 streak days) — only a strict decrease counts as
 *     usage.
 *
 * Streak changes never collide with the journal modal, so a
 * subscription here is safe (unlike trade-close badges, which are
 * fired explicitly after the journal popup is dismissed).
 */
export function useBadgeWatchers() {
  useEffect(() => {
    // Catch up on anything already earned from persisted state.
    evaluateBadges();

    const s0 = useStreakStore.getState();
    let prevStreak = s0.currentStreak;
    let prevFreezes = s0.freezesAvailable;

    const unsub = useStreakStore.subscribe((s) => {
      let touched = false;
      if (s.freezesAvailable < prevFreezes) {
        useBadgeStore.getState().addFreezesUsed(prevFreezes - s.freezesAvailable);
        touched = true;
      }
      if (s.currentStreak > prevStreak) touched = true;
      prevStreak = s.currentStreak;
      prevFreezes = s.freezesAvailable;
      if (touched) checkStreakBadges();
    });

    return unsub;
  }, []);
}
