import { BADGES } from '../data/badges';
import { useBadgeStore } from '../store/badgeStore';
import { useBadgeToastStore } from '../store/badgeToastStore';
import { useJournalStore } from '../store/journalStore';
import { useTradeJournalStore } from '../store/tradeJournalStore';
import { useStreakStore } from '../store/streakStore';
import { useWatchlistStore } from '../store/watchlistStore';

/**
 * Badge detection. Every trigger builds a fresh context from the
 * stores and runs `evaluateBadges`, which checks ALL 30 predicates
 * and unlocks any newly-satisfied ones. Re-checking everything on
 * each trigger (30 cheap boolean tests) means a badge is never
 * missed regardless of which trigger fired — robust by design.
 *
 * The named `checkX` wrappers exist for call-site clarity (and to
 * match the documented API). Only `checkTradeCloseBadges` is
 * stateful: it advances/resets `consecutiveWins` exactly once for
 * the just-closed trade BEFORE evaluating.
 */

// The curated tradable set ("Global Trader" = traded them all).
// Mirrors the symbols the daily-setup catalogue uses; documented
// assumption (the backend market list isn't available offline).
const ALL_SYMBOLS = ['NQ', 'ES', 'CL', 'GC'];

export interface BadgeContext {
  tradeCount: number;
  anyWin: boolean;
  consecutiveWins: number;
  maxSinglePnl: number;
  perfectDay: boolean;
  greenWeek: boolean;
  winRate: number;          // 0..1 over all trades
  uniqueSymbols: number;
  tradedAllSymbols: boolean;
  currentStreak: number;
  freezesUsedTotal: number;
  dailySetupsCompleted: number;
  watchlistCount: number;
  journaledCount: number;
}

function localDayKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function computePerfectDay(
  byDay: Map<string, { count: number; allGreen: boolean }>,
): boolean {
  for (const v of byDay.values()) {
    if (v.count >= 3 && v.allGreen) return true;
  }
  return false;
}

function computeGreenWeek(
  byDayPnl: Map<string, number>,
): boolean {
  // Any 7 consecutive calendar days, each with ≥1 trade, net > 0.
  for (const startKey of byDayPnl.keys()) {
    const [y, m, d] = startKey.split('-').map((n) => parseInt(n, 10));
    let sum = 0;
    let ok = true;
    for (let i = 0; i < 7; i++) {
      const day = new Date(y, m - 1, d + i);
      const key = localDayKey(day.getTime());
      const pnl = byDayPnl.get(key);
      if (pnl === undefined) { ok = false; break; }
      sum += pnl;
    }
    if (ok && sum > 0) return true;
  }
  return false;
}

export function buildBadgeContext(): BadgeContext {
  const entries = useJournalStore.getState().entries;
  const badge = useBadgeStore.getState();
  const streak = useStreakStore.getState();
  const watchlist = useWatchlistStore.getState().savedSetups;
  const tjEntries = useTradeJournalStore.getState().entries;

  const tradeCount = entries.length;
  let wins = 0;
  let maxSinglePnl = entries.length ? -Infinity : 0;
  const symbols = new Set<string>();
  const byDay = new Map<string, { count: number; allGreen: boolean }>();
  const byDayPnl = new Map<string, number>();

  for (const e of entries) {
    if (e.pnl > 0) wins++;
    if (e.pnl > maxSinglePnl) maxSinglePnl = e.pnl;
    symbols.add(e.symbol);
    const key = localDayKey(e.closedAt);
    const day = byDay.get(key) ?? { count: 0, allGreen: true };
    day.count += 1;
    if (e.pnl <= 0) day.allGreen = false;
    byDay.set(key, day);
    byDayPnl.set(key, (byDayPnl.get(key) ?? 0) + e.pnl);
  }

  return {
    tradeCount,
    anyWin: wins > 0,
    consecutiveWins: badge.consecutiveWins,
    maxSinglePnl: maxSinglePnl === -Infinity ? 0 : maxSinglePnl,
    perfectDay: computePerfectDay(byDay),
    greenWeek: computeGreenWeek(byDayPnl),
    winRate: tradeCount > 0 ? wins / tradeCount : 0,
    uniqueSymbols: symbols.size,
    tradedAllSymbols: ALL_SYMBOLS.every((s) => symbols.has(s)),
    currentStreak: streak.currentStreak,
    freezesUsedTotal: badge.freezesUsedTotal,
    dailySetupsCompleted: badge.dailySetupsCompleted,
    watchlistCount: watchlist.length,
    journaledCount: Object.keys(tjEntries).length,
  };
}

type Test = (c: BadgeContext) => boolean;

export const BADGE_TESTS: Record<string, Test> = {
  rookie:           (c) => c.tradeCount >= 1,
  getting_started:  (c) => c.tradeCount >= 10,
  committed:        (c) => c.tradeCount >= 25,
  veteran:          (c) => c.tradeCount >= 50,
  centurion:        (c) => c.tradeCount >= 100,
  market_machine:   (c) => c.tradeCount >= 500,

  first_green:      (c) => c.anyWin,
  hot_hand:         (c) => c.consecutiveWins >= 3,
  on_fire:          (c) => c.consecutiveWins >= 5,
  untouchable:      (c) => c.consecutiveWins >= 10,
  perfect_day:      (c) => c.perfectDay,
  green_week:       (c) => c.greenWeek,
  sharpshooter:     (c) => c.tradeCount >= 20 && c.winRate >= 0.7,
  big_catch:        (c) => c.maxSinglePnl > 1000,
  whale:            (c) => c.maxSinglePnl > 5000,

  day_3:            (c) => c.currentStreak >= 3,
  one_week:         (c) => c.currentStreak >= 7,
  two_weeks:        (c) => c.currentStreak >= 14,
  monthly:          (c) => c.currentStreak >= 30,
  iron_will:        (c) => c.currentStreak >= 60,
  freeze_saver:     (c) => c.freezesUsedTotal >= 1,
  unbreakable:      (c) => c.currentStreak >= 30 && c.freezesUsedTotal === 0,

  explorer:         (c) => c.uniqueSymbols >= 3,
  global_trader:    (c) => c.tradedAllSymbols,
  mission_complete: (c) => c.dailySetupsCompleted >= 5,
  mission_master:   (c) => c.dailySetupsCompleted >= 20,
  bookworm:         (c) => c.watchlistCount >= 10,

  first_page:       (c) => c.journaledCount >= 1,
  dedicated:        (c) => c.journaledCount >= 10,
  self_aware:       (c) => c.journaledCount >= 50,
};

/** Numeric progress for the locked-badge modal, or null for
 *  boolean-only conditions. */
export function getBadgeProgress(
  badgeId: string,
  ctx?: BadgeContext,
): { current: number; target: number } | null {
  const c = ctx ?? buildBadgeContext();
  const p = (current: number, target: number) => ({
    current: Math.min(current, target),
    target,
  });
  switch (badgeId) {
    case 'rookie':           return p(c.tradeCount, 1);
    case 'getting_started':  return p(c.tradeCount, 10);
    case 'committed':        return p(c.tradeCount, 25);
    case 'veteran':          return p(c.tradeCount, 50);
    case 'centurion':        return p(c.tradeCount, 100);
    case 'market_machine':   return p(c.tradeCount, 500);
    case 'hot_hand':         return p(c.consecutiveWins, 3);
    case 'on_fire':          return p(c.consecutiveWins, 5);
    case 'untouchable':      return p(c.consecutiveWins, 10);
    case 'day_3':            return p(c.currentStreak, 3);
    case 'one_week':         return p(c.currentStreak, 7);
    case 'two_weeks':        return p(c.currentStreak, 14);
    case 'monthly':          return p(c.currentStreak, 30);
    case 'iron_will':        return p(c.currentStreak, 60);
    case 'explorer':         return p(c.uniqueSymbols, 3);
    case 'global_trader':    return p(c.uniqueSymbols, ALL_SYMBOLS.length);
    case 'mission_complete': return p(c.dailySetupsCompleted, 5);
    case 'mission_master':   return p(c.dailySetupsCompleted, 20);
    case 'bookworm':         return p(c.watchlistCount, 10);
    case 'first_page':       return p(c.journaledCount, 1);
    case 'dedicated':        return p(c.journaledCount, 10);
    case 'self_aware':       return p(c.journaledCount, 50);
    default:                 return null; // boolean conditions
  }
}

/** Core: unlock every newly-satisfied badge, enqueue toasts for
 *  them, return the new IDs (in catalogue order so multi-unlocks
 *  toast in a sensible sequence). */
export function evaluateBadges(): string[] {
  const ctx = buildBadgeContext();
  const store = useBadgeStore.getState();
  const newly: string[] = [];
  for (const b of BADGES) {
    if (store.isUnlocked(b.id)) continue;
    const test = BADGE_TESTS[b.id];
    if (test && test(ctx)) {
      store.unlockBadge(b.id);
      newly.push(b.id);
    }
  }
  if (newly.length > 0) {
    useBadgeToastStore.getState().enqueue(newly);
  }
  return newly;
}

// ── Named trigger wrappers ─────────────────────────────────────────────────

/** After a trade closes (call once, AFTER the journal popup is
 *  dismissed). Advances/resets the win streak first. */
export function checkTradeCloseBadges(closedPnl: number): string[] {
  const store = useBadgeStore.getState();
  if (closedPnl > 0) store.incrementConsecutiveWins();
  else store.resetConsecutiveWins();
  return evaluateBadges();
}

export function checkStreakBadges(): string[] { return evaluateBadges(); }
export function checkJournalBadges(): string[] { return evaluateBadges(); }
export function checkDailySetupBadges(): string[] { return evaluateBadges(); }
export function checkWatchlistBadges(): string[] { return evaluateBadges(); }
