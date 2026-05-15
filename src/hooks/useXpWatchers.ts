import { useEffect } from 'react';
import { useStreakStore } from '../store/streakStore';
import { useXpStore } from '../store/xpStore';

/**
 * Streak XP, granted by subscribing to the streak store rather
 * than editing `completeDaily` (keeps streakStore free of an
 * xpStore import — no cycle, no behaviour change). `currentStreak`
 * only ever increases via `completeDaily` (+1); freeze-preserved
 * days hold it flat, so an increase event == "daily goal hit".
 *
 * Per completed day:
 *   +25  hit daily time goal
 *   +10 + min(streakDay, 40)  maintain (Day 1 = 11 … Day 40+ = 50)
 *   milestone bonus on day 7/14/30/60/100/365
 *
 * Mounted in MainTabs.
 */

const MILESTONE_XP: Record<number, number> = {
  7: 100,
  14: 200,
  30: 500,
  60: 1000,
  100: 2000,
  365: 5000,
};

export function useXpWatchers() {
  useEffect(() => {
    let prevStreak = useStreakStore.getState().currentStreak;

    const unsub = useStreakStore.subscribe((s) => {
      if (s.currentStreak <= prevStreak) {
        prevStreak = s.currentStreak; // reset / no-op
        return;
      }
      const day = s.currentStreak; // the day just completed
      prevStreak = day;

      const xp = useXpStore.getState();
      xp.addXP(25, 'streak: daily goal');
      xp.addXP(10 + Math.min(day, 40), 'streak: maintain');
      const milestone = MILESTONE_XP[day];
      if (milestone) xp.addXP(milestone, `streak: day ${day} milestone`);
    });

    return unsub;
  }, []);
}
