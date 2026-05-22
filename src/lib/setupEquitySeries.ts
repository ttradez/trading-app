import { TradeForEquity, EquityPoint } from './equitySeries';

/**
 * Per-setup P&L progression — anchored at $0, not at the account
 * starting balance. The Setup Stats screen shows "how this pattern
 * has performed in isolation" rather than "how the account has
 * moved over time," so the natural baseline is zero.
 *
 * Empty array → `[]`. Caller should let the sparkline render its
 * own empty-state placeholder.
 */
export function computeSetupPnLProgression(
  trades: ReadonlyArray<TradeForEquity>,
): EquityPoint[] {
  if (trades.length === 0) return [];
  const sorted = [...trades].sort((a, b) => a.closedAt - b.closedAt);
  const out: EquityPoint[] = [
    { t: sorted[0].closedAt, equity: 0 },
  ];
  let running = 0;
  for (const tr of sorted) {
    running += tr.pnl;
    out.push({ t: tr.closedAt, equity: running });
  }
  return out;
}
