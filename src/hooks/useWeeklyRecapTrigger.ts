import { useCallback, useEffect, useRef, useState } from 'react';
import { useJournalStore } from '../store/journalStore';
import { useStreakStore } from '../store/streakStore';
import { useTradeJournalStore, TradeGrade } from '../store/tradeJournalStore';
import { useRecapStore } from '../store/recapStore';
import { useXpStore } from '../store/xpStore';
import {
  generateWeeklyRecap, isoWeekId, weekBounds, WeeklyRecap, RecapTrade,
} from '../utils/weeklyRecap';

/**
 * useWeeklyRecapTrigger — decides whether to auto-show the Sunday
 * Wrap on app open, and which week's recap.
 *
 * Target-week rule:
 *  - Today is Sunday → recap the CURRENT week (Mon…today). Sunday
 *    is the week's last day, so it's "done enough".
 *  - Today is Mon–Sat → recap the PREVIOUS full week (the catch-up
 *    path: the user missed Sunday). `today − 7 days` always lands
 *    in the prior Mon–Sun week.
 *
 * Show conditions (all must hold):
 *  - That week's recap hasn't been viewed yet.
 *  - The week had ≥1 closed trade.
 *
 * Runs ONCE per mount (= one recap per app open, never stacks).
 * Mounted in MainTabs so it fires when the user enters the main
 * app. Hydration-safe: awaits journalStore's manual hydrate and
 * the persist-middleware stores' rehydration before reading, so a
 * cold start can't mis-decide off empty state.
 */

type PersistApi = {
  hasHydrated: () => boolean;
  onFinishHydration: (cb: () => void) => () => void;
};

function awaitPersist(store: unknown): Promise<void> {
  const p = (store as { persist?: PersistApi }).persist;
  if (!p || p.hasHydrated()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const unsub = p.onFinishHydration(() => { unsub?.(); finish(); });
    setTimeout(finish, 2000); // safety net if the event never fires
  });
}

export function useWeeklyRecapTrigger() {
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let cancelled = false;

    (async () => {
      await useJournalStore.getState().hydrate().catch(() => {});
      await awaitPersist(useRecapStore);
      await awaitPersist(useStreakStore);
      await awaitPersist(useTradeJournalStore);
      if (cancelled) return;

      const now = new Date();
      const ref =
        now.getDay() === 0
          ? now
          : new Date(now.getTime() - 7 * 86_400_000);

      const weekId = isoWeekId(ref);
      const stored = useRecapStore.getState().getRecap(weekId);
      if (stored?.viewedAt) return; // already seen this week's wrap

      const { start, end } = weekBounds(ref);
      const entries = useJournalStore.getState().entries;
      const hasWeekTrades = entries.some(
        (e) => e.closedAt >= start && e.closedAt <= end,
      );
      if (!hasWeekTrades) return;

      let toShow: WeeklyRecap;
      if (stored) {
        // Generated earlier but not yet viewed — preserve the
        // original snapshot (and its generatedAt) rather than
        // regenerating against potentially-changed data.
        toShow = stored.recap;
      } else {
        const tj = useTradeJournalStore.getState().entries;
        const grades: Record<string, TradeGrade | undefined> = {};
        const recapTrades: RecapTrade[] = entries.map((e) => {
          grades[e.tradeId] = tj[e.tradeId]?.grade;
          return {
            tradeId: e.tradeId,
            symbol: e.symbol,
            side: e.side,
            pnl: e.pnl,
            openedAt: e.openedAt,
            closedAt: e.closedAt,
          };
        });
        const streak = useStreakStore.getState();
        toShow = generateWeeklyRecap(
          ref,
          recapTrades,
          {
            currentStreak: streak.currentStreak,
            // Best-effort: the streak store only keeps today's
            // training bucket. A true weekly accumulator is a
            // follow-up (see weeklyRecap.ts).
            totalTrainingMinutes: streak.todayTrainingMinutes,
          },
          grades,
        );
        useRecapStore.getState().saveRecap(toShow);
      }

      if (!cancelled) setRecap(toShow);
    })();

    return () => { cancelled = true; };
  }, []);

  const dismiss = useCallback(() => {
    setRecap((cur) => {
      if (cur) {
        useRecapStore.getState().markViewed(cur.weekId);
        // +25 XP for viewing the weekly wrap (once — the recap is
        // marked viewed and never auto-shows again; Journal-tab
        // re-opens of past recaps don't route through here).
        useXpStore.getState().addXP(25, 'weekly recap');
      }
      return null;
    });
  }, []);

  return { recap, dismiss };
}
