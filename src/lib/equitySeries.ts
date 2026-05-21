/**
 * Equity-curve series builder for the Stats screen sparkline (and
 * any future chart that needs a running-balance trace). Sorts the
 * input trades by close time, anchors the curve at startingBalance
 * (so the chart shows where the user came from, not just where
 * they are now), and emits one point per closed trade.
 *
 * Pure function; reads nothing from store state. The caller passes
 * the trades + starting balance and decides how to subscribe.
 */

export interface TradeForEquity {
  /** Unix ms — typically `JournalEntry.closedAt`. */
  closedAt: number;
  /** Realised P&L in account dollars. */
  pnl: number;
}

export interface EquityPoint {
  /** Unix ms of the trade close (or starting-anchor placement). */
  t: number;
  /** Cumulative equity = startingBalance + Σ pnl up to this point. */
  equity: number;
}

/**
 * Returns the equity series for the supplied trades.
 *  - Empty trades → returns `[]`. Callers should render an empty
 *    state (the sparkline component handles this internally).
 *  - Otherwise → returns an anchor at `{ t: firstTradeCloseTime,
 *    equity: startingBalance }` followed by one point per trade in
 *    ascending close-time order, with `equity` running-summed.
 */
export function computeEquitySeries(
  trades: ReadonlyArray<TradeForEquity>,
  startingBalance: number,
): EquityPoint[] {
  if (trades.length === 0) return [];
  const sorted = [...trades].sort((a, b) => a.closedAt - b.closedAt);
  const out: EquityPoint[] = [
    { t: sorted[0].closedAt, equity: startingBalance },
  ];
  let equity = startingBalance;
  for (const tr of sorted) {
    equity += tr.pnl;
    out.push({ t: tr.closedAt, equity });
  }
  return out;
}
