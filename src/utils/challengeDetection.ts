import { updateChallengeProgress } from '../store/challengeStore';
import { useJournalStore } from '../store/journalStore';
import { useTradeJournalStore } from '../store/tradeJournalStore';
import { useBadgeStore } from '../store/badgeStore';
import { getTodayYMD } from '../store/streakStore';
import { isoWeekId } from './weeklyRecap';
import { useSessionStatsStore, SessionLogEntry } from '../store/sessionStatsStore';

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
  /** Trade id — used to look up the matching JournalEntry for
   *  R:R-based conditions (intendedRR lives on the entry, not the
   *  trade). Optional because legacy call sites may not pass it. */
  id?: string;
  symbol?: string;
  pnl?: number;
  opened_at?: number; // unix seconds
  closed_at?: number;
  r_multiple?: number;
  /** Numeric SL/TP levels from the position at close time. null/
   *  undefined ⇒ the user never set one. Used by the
   *  recordTradeClose call site, not by detectAfterTradeClose
   *  itself — kept on the shape so the type matches what call sites
   *  actually pass in. */
  stop_loss?: number | null;
  take_profit?: number | null;
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
    if (dayPnl > 0) {
      updateChallengeProgress('green_day', 1);
      // Trivial green_week wire (was previously dead): when the day
      // is green AND the local ISO week's running total is also > 0,
      // credit the weekly "end week positive" challenge. Target=1,
      // add-mode → first qualifying close completes it.
      const weekTrades = entries.filter(
        (e) => isoWeekId(new Date(e.closedAt)) === nowWeek,
      );
      const weekPnl = weekTrades.reduce((s, e) => s + e.pnl, 0);
      if (weekPnl > 0) updateChallengeProgress('green_week', 1);
    }
  }
  if (todayTrades.length >= 4) {
    const wr = todayTrades.filter((e) => e.pnl > 0).length / todayTrades.length;
    if (wr > 0.55) updateChallengeProgress('win_rate_55', 1);
  }

  // ── R:R conditions ─────────────────────────────────────────────
  // rr2_realized: a WIN whose realized R-multiple ≥ 2. r_multiple is
  // null when the trade had no planned stop — silently skipped (no
  // progress, no penalty).
  if (won && rMul != null && rMul >= 2) {
    updateChallengeProgress('rr2_realized', 1);
  }

  // plan_rr_kept: a WIN that hit at least its planned R:R, AND the
  // plan called for ≥ 1.5 to begin with. intendedRR is on the journal
  // entry (set by the pre-trade plan capture); look it up by tradeId.
  // Plan-skipped trades have intendedRR = 0 ⇒ filtered out by the
  // ≥ 1.5 gate. No matching entry ⇒ no plan ⇒ skip.
  if (won && rMul != null && t.id) {
    const entry = entries.find((e) => e.tradeId === t.id);
    if (entry && entry.intendedRR >= 1.5 && rMul >= entry.intendedRR) {
      updateChallengeProgress('plan_rr_kept', 1);
    }
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

/**
 * Call from the session-end / recap site (currently the
 * autoStart bookend in TradingScreen — pre-start finalize of any
 * prior run). `record` comes back from `useSessionStatsStore.endSession()`.
 *
 * Session-end conditions:
 *   - green_session                — +1 when record.green AND trades ≥ 3
 *   - tp_sl_full_session           — +1 when record.allTpSl AND trades ≥ 3
 *   - session_under_6_trades       — +1 when 1 ≤ trades ≤ 6 (NO 3-trade gate)
 *   - consecutive_green_sessions   — max-mode, fire the live counter
 *                                    (the store gates its own update on
 *                                    trades ≥ 3, so tiny sessions can't
 *                                    accidentally extend the streak)
 *   - green_sessions_10            — +1 per green session (trades ≥ 3),
 *                                    plain add-counter (target tunable
 *                                    per challenge row)
 *   - pf15_last10                  — +1 when profit factor over the
 *                                    last 10 logged sessions ≥ 1.5
 *                                    (requires ≥ 10 entries AND ≥ 30
 *                                    total trades across them)
 */
export function detectAfterSessionEnd(record: SessionLogEntry): void {
  const stats = useSessionStatsStore.getState();

  // consecutive_green_sessions is max-mode — the store already
  // increments / zeroes the counter based on the >=3-trades gate.
  // Skip the call when the counter is 0 to avoid a noop progress
  // update (max(0, current) is a no-op anyway, but cheap to guard).
  if (stats.consecutiveGreenSessions > 0) {
    updateChallengeProgress('consecutive_green_sessions', stats.consecutiveGreenSessions);
  }

  if (record.trades >= 3) {
    if (record.green) {
      updateChallengeProgress('green_session', 1);
      updateChallengeProgress('green_sessions_10', 1);
    }
    if (record.allTpSl) {
      updateChallengeProgress('tp_sl_full_session', 1);
    }
  }

  if (record.trades >= 1 && record.trades <= 6) {
    updateChallengeProgress('session_under_6_trades', 1);
  }

  // pf15_last10: profit factor across the last 10 logged sessions.
  // sessionLog already includes the just-ended record (endSession
  // appended it before returning), so slicing the tail is correct.
  const lastTen = stats.sessionLog.slice(-10);
  if (lastTen.length >= 10) {
    const totalTrades = lastTen.reduce((s, x) => s + x.trades, 0);
    if (totalTrades >= 30) {
      const grossProfit = lastTen
        .filter((x) => x.pnl > 0)
        .reduce((s, x) => s + x.pnl, 0);
      const grossLoss = Math.abs(
        lastTen.filter((x) => x.pnl < 0).reduce((s, x) => s + x.pnl, 0),
      );
      // Profit factor convention: zero gross loss + positive gross
      // profit ⇒ infinite PF (i.e. clearly meets a 1.5 threshold).
      // Zero of both ⇒ PF = 0 (no edge to credit).
      const pf =
        grossLoss > 0
          ? grossProfit / grossLoss
          : grossProfit > 0
            ? Infinity
            : 0;
      if (pf >= 1.5) updateChallengeProgress('pf15_last10', 1);
    }
  }
}
