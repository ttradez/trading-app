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

// ── Timeframe clipping ──────────────────────────────────────────────

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Window length in ms keyed by Timeframe. `ALL` returns `null` —
 *  callers should treat it as "no clipping". */
function timeframeWindowMs(tf: Timeframe): number | null {
  switch (tf) {
    case '1D':  return 1 * DAY_MS;
    case '1W':  return 7 * DAY_MS;
    case '1M':  return 30 * DAY_MS;
    case '3M':  return 90 * DAY_MS;
    case '1Y':  return 365 * DAY_MS;
    case 'ALL': return null;
  }
}

/**
 * Clip an equity series to a trailing window ending at `now`.
 *
 * The window-start equity becomes the reference baseline for the
 * clipped view, so the chart's gain/loss signal is RELATIVE to where
 * the user was when the window started — a green month while overall
 * negative still reads as a win for that window.
 *
 * Behaviour:
 *  - `'ALL'`         → returns the input untouched.
 *  - Empty series    → returns `[]`.
 *  - All points pre-window (user hasn't traded in the window) →
 *    returns a flat anchor-pair `[ {windowStart, eq}, {now, eq} ]`
 *    where `eq` is the equity right before the window opened. This
 *    renders as a horizontal line in the sparkline, which is the
 *    right read: "you didn't trade this week" is a real signal.
 *  - Otherwise → returns `[ anchor, ...in-window points ]` where the
 *    anchor's equity is the equity right before the window opened
 *    (the latest pre-window point, or `startingBalance` from the
 *    head anchor of `computeEquitySeries` when nothing precedes).
 *
 * `now` defaults to `new Date()` — accepting an override keeps the
 * function deterministic for tests.
 */
export function filterEquitySeriesByTimeframe(
  series: ReadonlyArray<EquityPoint>,
  timeframe: Timeframe,
  now: Date = new Date(),
): EquityPoint[] {
  if (series.length === 0) return [];
  if (timeframe === 'ALL') return [...series];

  const windowMs = timeframeWindowMs(timeframe);
  if (windowMs === null) return [...series];

  const windowStart = now.getTime() - windowMs;

  // Locate the split — series is already sorted ascending by t.
  let firstInWindowIdx = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i].t >= windowStart) { firstInWindowIdx = i; break; }
  }

  // No in-window points → flat horizontal at the latest pre-window
  // equity. The latest point IS the latest pre-window since we know
  // none are in-window.
  if (firstInWindowIdx === -1) {
    const eq = series[series.length - 1].equity;
    return [
      { t: windowStart, equity: eq },
      { t: now.getTime(), equity: eq },
    ];
  }

  // First in-window point sits exactly on the window edge — use the
  // existing series untouched. Common when the first trade closed
  // shortly after windowStart and our trace anchors there.
  const inWindow = series.slice(firstInWindowIdx);
  if (inWindow[0].t === windowStart) return inWindow;

  // Otherwise prepend a synthetic anchor at windowStart. Anchor
  // equity is the latest pre-window equity — equity is a step
  // function in our model (jumps at trade close), so the "value at
  // windowStart" is simply the equity right before the window opened,
  // not a time-interpolated mix. If there's NO pre-window point at
  // all (window starts before any trade closed) the anchor takes the
  // first in-window equity so the curve doesn't artificially jump.
  const anchorEquity =
    firstInWindowIdx > 0
      ? series[firstInWindowIdx - 1].equity
      : inWindow[0].equity;
  return [{ t: windowStart, equity: anchorEquity }, ...inWindow];
}
