import { JournalEntry } from '../store/journalStore';

/**
 * Pure trade-metric formulas + equity-curve construction. Reading-
 * only — never mutates store state. Used by the Dashboard Account
 * hero (equity + delta + sparkline) and Key Metrics row
 * (win rate / profit factor / avg R:R / consistency).
 *
 * Returns `null` when the sample is below the documented minimum
 * for that metric. The Dashboard renders "—" for null values so an
 * under-sampled stat never reads as 0/zero performance.
 */

const MIN_PROFIT_FACTOR_SAMPLE = 3;
const MIN_AVG_RR_SAMPLE        = 3;
const MIN_CONSISTENCY_DAYS     = 5;

/** Local YYYY-MM-DD bucket key for a unix-ms timestamp. */
function dayKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** wins / total × 100. Returns null with zero trades so "0% win
 *  rate" never appears as a defeatist banner on day-one. */
export function winRate(trades: JournalEntry[]): number | null {
  if (trades.length === 0) return null;
  const wins = trades.filter((t) => t.pnl > 0).length;
  return (wins / trades.length) * 100;
}

/** grossProfit / grossLoss. `'inf'` when there are winners and zero
 *  losers (the UI renders the ∞ glyph). Null below the sample floor. */
export function profitFactor(trades: JournalEntry[]): number | 'inf' | null {
  if (trades.length < MIN_PROFIT_FACTOR_SAMPLE) return null;
  let gp = 0;
  let gl = 0;
  for (const t of trades) {
    if (t.pnl > 0) gp += t.pnl;
    else if (t.pnl < 0) gl += -t.pnl;
  }
  if (gl === 0) return gp > 0 ? 'inf' : null;
  return gp / gl;
}

/** Mean of trade.rrAchieved across trades that have it. Reads the
 *  discipline-signal field directly — `rrAchieved = pnl /
 *  intendedRisk` computed at close from the user's pre-trade
 *  plan. Trades without a captured plan (no intendedRisk → null
 *  rrAchieved) are filtered out so we don't read backend r_multiple
 *  as a proxy. Returns null when the sample is below the floor. */
export function avgRR(trades: JournalEntry[]): number | null {
  const withR = trades
    .map((t) => t.rrAchieved)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (withR.length < MIN_AVG_RR_SAMPLE) return null;
  const sum = withR.reduce((a, b) => a + b, 0);
  return sum / withR.length;
}

/** % of calendar trading days that closed net-positive. A "trading
 *  day" is any local day with ≥1 closed trade. Null below the floor. */
export function consistency(trades: JournalEntry[]): number | null {
  if (trades.length === 0) return null;
  const byDay = new Map<string, number>();
  for (const t of trades) {
    const k = dayKey(t.closedAt);
    byDay.set(k, (byDay.get(k) ?? 0) + t.pnl);
  }
  if (byDay.size < MIN_CONSISTENCY_DAYS) return null;
  let positive = 0;
  for (const pnl of byDay.values()) {
    if (pnl > 0) positive++;
  }
  return (positive / byDay.size) * 100;
}

// ── Equity curve ──────────────────────────────────────────────────

export interface EquityPoint {
  /** Trade close timestamp (unix ms). Equal to startBalance's
   *  insertion time for the seed point. */
  time: number;
  /** Account equity at this point: startBalance + cumulative pnl. */
  equity: number;
}

/** Running equity series. Always starts with a seed point at
 *  `startBalance` so the sparkline has a baseline anchor even with
 *  zero trades (caller is expected to short-circuit at 0 anyway). */
export function buildEquityCurve(
  trades: JournalEntry[],
  startBalance: number,
): EquityPoint[] {
  const sorted = [...trades].sort((a, b) => a.closedAt - b.closedAt);
  const first = sorted[0]?.closedAt ?? Date.now();
  const out: EquityPoint[] = [{ time: first, equity: startBalance }];
  let equity = startBalance;
  for (const t of sorted) {
    equity += t.pnl;
    out.push({ time: t.closedAt, equity });
  }
  return out;
}

/** Convenience: total realized P&L (sum of trade.pnl). */
export function totalPnl(trades: JournalEntry[]): number {
  let sum = 0;
  for (const t of trades) sum += t.pnl;
  return sum;
}
