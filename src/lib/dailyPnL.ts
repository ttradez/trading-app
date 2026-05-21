import { TradeForEquity } from './equitySeries';

/**
 * Daily-P&L aggregation for the Stats calendar heatmap. Grouping
 * key is the trade's close-time calendar day in the DEVICE LOCAL
 * timezone — so a trade closed at 23:55 New York on the 14th sits
 * on day 14 regardless of where the user travels.
 *
 * Tier thresholds live below alongside the bucket function so the
 * heatmap palette + the bucket math stay in one file.
 */

/** Map of day-of-month (1-31) → net P&L for that day. Days with
 *  zero trades are absent from the map (NOT mapped to 0). */
export function getDailyPnL(
  trades: ReadonlyArray<TradeForEquity>,
  year: number,
  month: number, // 0-11, JS Date convention
): { [day: number]: number } {
  const out: { [day: number]: number } = {};
  for (const t of trades) {
    const d = new Date(t.closedAt);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const day = d.getDate();
    out[day] = (out[day] ?? 0) + t.pnl;
  }
  return out;
}

export interface Tier {
  side: 'gain' | 'loss' | 'flat';
  tier: 1 | 2 | 3 | 4;
}

/** Bucket a $ P&L value into a heatmap tier. Threshold semantics
 *  by |pnl|:
 *    < $1    flat (no tint)
 *    < $50   tier 1
 *    $50-200 tier 2
 *    $200-500 tier 3
 *    > $500  tier 4
 */
export function getTier(pnl: number): Tier {
  const abs = Math.abs(pnl);
  if (abs < 1) return { side: 'flat', tier: 1 };
  const side: 'gain' | 'loss' = pnl > 0 ? 'gain' : 'loss';
  if (abs < 50)  return { side, tier: 1 };
  if (abs < 200) return { side, tier: 2 };
  if (abs < 500) return { side, tier: 3 };
  return { side, tier: 4 };
}
