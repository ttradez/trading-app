import { updateChallengeProgress } from '../store/challengeStore';
import { useJournalStore } from '../store/journalStore';
import { useTradeJournalStore } from '../store/tradeJournalStore';
import { useBadgeStore } from '../store/badgeStore';
import { getTodayYMD } from '../store/streakStore';
import { isoWeekId } from './weeklyRecap';

/**
 * STUBBED challenge conditions — wiring deferred (need data points
 * we don't track yet). They are intentionally absent from
 * `DETECTABLE_CONDITIONS` so generation never hands the user one,
 * so there is no progress call to make here. When the tracking
 * lands, add the detection below AND list the condition in
 * `DETECTABLE_CONDITIONS`:
 *
 *  - `consistent_size`        — needs per-session position-size
 *    history + a "sized up after a loss" flag.
 *  - `wait_between_trades`    — needs close→next-open timestamps
 *    (gap ≥ 60s) counted per trade.
 *  - `stop_after_2_losses`    — needs session-end detection plus a
 *    consecutive-loss counter (no trade after 2 in a row).
 *  - `library_setups_practiced` — needs the Setup Library deep-link
 *    to record which library setup id launched the session.
 */

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
  r_multiple?: number;
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
  // Style-agnostic OR clauses: a winner also counts at 2R+, a
  // loser also counts if cut before 1R against you. `r_multiple`
  // is null when no stop was set — then only the bar path applies.
  const rMul = typeof t.r_multiple === 'number' ? t.r_multiple : null;
  if (won && (holdBars >= 10 || (rMul != null && rMul >= 2))) {
    updateChallengeProgress('winner_held_10_bars', 1);
  }
  if (
    !won &&
    ((holdBars > 0 && holdBars <= 5) ||
      (rMul != null && rMul > -1 && rMul < 0))
  ) {
    updateChallengeProgress('loser_cut_5_bars', 1);
  }

  const entries = useJournalStore.getState().entries;

  // Setup Focus (weekly): most-repeated pre-trade setup type among
  // THIS calendar week's planned trades (local device week via the
  // entry's real-time `savedAt`). Max-mode in challengeStore.
  const nowWeek = isoWeekId(new Date());
  const bySetup = new Map<string, number>();
  for (const e of entries) {
    if (!e.planSetupType || e.planSkipped) continue;
    if (isoWeekId(new Date(e.savedAt)) !== nowWeek) continue;
    bySetup.set(e.planSetupType, (bySetup.get(e.planSetupType) ?? 0) + 1);
  }
  const maxSameSetup = bySetup.size
    ? Math.max(...bySetup.values())
    : 0;
  if (maxSameSetup > 0) {
    updateChallengeProgress('same_setup_3x', maxSameSetup);
  }

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

  // Process Over Outcome (daily): graded A/A+ on a LOSING trade.
  // The just-journaled trade is the newest entry (addEntry
  // prepends); check its P&L.
  const latest = entries[0];
  if (
    (grade === 'A' || grade === 'A+') &&
    latest &&
    latest.pnl < 0
  ) {
    updateChallengeProgress('good_grade_on_loss', 1);
  }

  // Full Process (weekly): trades THIS local week that were both
  // planned (pre-trade checklist, not skipped) AND journaled.
  // Max-mode in challengeStore.
  const nowWeek = isoWeekId(new Date());
  const fullProcess = entries.filter(
    (e) =>
      !!e.planSetupType &&
      !e.planSkipped &&
      tj[e.tradeId] !== undefined &&
      isoWeekId(new Date(e.savedAt)) === nowWeek,
  ).length;
  if (fullProcess > 0) {
    updateChallengeProgress('full_process_trades', fullProcess);
  }
}

/** Call once per day when the Daily Setup mission completes. */
export function detectDailySetupComplete(): void {
  updateChallengeProgress('daily_setup', 1);
  updateChallengeProgress('daily_setups', 1);
}
