import { updateChallengeProgress } from '../store/challengeStore';
import { useJournalStore } from '../store/journalStore';
import { useTradeJournalStore } from '../store/tradeJournalStore';
import { useBadgeStore } from '../store/badgeStore';
import { getTodayYMD } from '../store/streakStore';

/**
 * Maps app events → challenge progress. Centralised here so the
 * trigger sites stay one-liners and the (fiddly) windowing logic
 * lives in one place.
 *
 * Windowing note (v1, documented): `unique_symbols` uses LIFETIME
 * distinct symbols, not a per-day/week window — generous, never
 * punishing. `consecutive_wins` reads `badgeStore.consecutiveWins`
 * (a real in-a-row counter that resets on a loss). `green_day`
 * and `win_rate_55` window to the device-local current day;
 * `win_rate_55_monthly` to the current month.
 */

const BAR_SECONDS: Record<string, number> = {
  '1m': 60, '2m': 120, '3m': 180, '5m': 300, '15m': 900,
  '30m': 1800, '1H': 3600, '2H': 7200, '4H': 14400, '1D': 86400,
};

function localYMD(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface ClosedTradeShape {
  symbol?: string;
  pnl?: number;
  opened_at?: number; // unix seconds
  closed_at?: number;
}

/** Call AFTER badge `checkTradeCloseBadges` (so `consecutiveWins`
 *  is up to date) and AFTER the trade is in journalStore. */
export function detectAfterTradeClose(
  t: ClosedTradeShape,
  timeframe: string,
): void {
  updateChallengeProgress('trades_placed', 1);

  const pnl = typeof t.pnl === 'number' ? t.pnl : 0;
  const won = pnl > 0;

  // Win-streak challenges (max-mode; 0 on a loss is ignored).
  updateChallengeProgress(
    'consecutive_wins',
    useBadgeStore.getState().consecutiveWins,
  );

  // Hold-duration challenges (timestamp-derived bars).
  const openedSec = typeof t.opened_at === 'number' ? t.opened_at : 0;
  const closedSec = typeof t.closed_at === 'number' ? t.closed_at : openedSec;
  const barSec = BAR_SECONDS[timeframe] ?? 300;
  const holdBars = barSec > 0 ? (closedSec - openedSec) / barSec : 0;
  if (won && holdBars >= 10) updateChallengeProgress('winner_held_10_bars', 1);
  if (!won && holdBars > 0 && holdBars <= 5) {
    updateChallengeProgress('loser_cut_5_bars', 1);
  }

  const entries = useJournalStore.getState().entries;

  // Distinct symbols (lifetime — documented).
  const symbols = new Set(entries.map((e) => e.symbol));
  updateChallengeProgress('unique_symbols', symbols.size);

  // Today's window.
  const today = getTodayYMD();
  const todayTrades = entries.filter((e) => localYMD(e.closedAt) === today);
  if (todayTrades.length >= 3) {
    const dayPnl = todayTrades.reduce((s, e) => s + e.pnl, 0);
    if (dayPnl > 0) updateChallengeProgress('green_day', 1);
  }
  if (todayTrades.length >= 4) {
    const wr = todayTrades.filter((e) => e.pnl > 0).length / todayTrades.length;
    if (wr > 0.55) updateChallengeProgress('win_rate_55', 1);
  }

  // Month window.
  const month = today.slice(0, 7);
  const monthTrades = entries.filter(
    (e) => localYMD(e.closedAt).slice(0, 7) === month,
  );
  if (monthTrades.length >= 30) {
    const wr = monthTrades.filter((e) => e.pnl > 0).length / monthTrades.length;
    if (wr > 0.55) updateChallengeProgress('win_rate_55_monthly', 1);
  }
}

/** Call from the journal modal `onSave` (a grade is always set). */
export function detectAfterJournalSave(
  grade: string,
  emotions: string[],
): void {
  updateChallengeProgress('journal_count', 1);
  if (grade === 'A+' || grade === 'A' || grade === 'B') {
    updateChallengeProgress('grade_ab', 1);
  }
  if (grade === 'A+') updateChallengeProgress('grade_aplus', 1);
  if (emotions.length > 0) {
    updateChallengeProgress('unique_emotions', emotions.length);
  }

  // "Journal every trade today" — all of today's trades have a
  // tradeJournal entry.
  const today = getTodayYMD();
  const entries = useJournalStore.getState().entries;
  const tj = useTradeJournalStore.getState().entries;
  const todayTrades = entries.filter((e) => localYMD(e.closedAt) === today);
  if (
    todayTrades.length > 0 &&
    todayTrades.every((e) => tj[e.tradeId] !== undefined)
  ) {
    updateChallengeProgress('all_journaled', 1);
  }
}

/** Call once per day when the Daily Setup mission completes. */
export function detectDailySetupComplete(): void {
  updateChallengeProgress('daily_setup', 1);
  updateChallengeProgress('daily_setups', 1);
}
