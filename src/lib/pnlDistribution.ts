/**
 * P&L distribution binner for the Stats histogram. Picks a "nice"
 * bin width off a fixed ladder so the x-axis breakpoints are
 * always human-readable round numbers ($25, $100, etc.) instead
 * of computed widths like $73.42.
 *
 * Bins straddle zero cleanly — no bin spans both positive and
 * negative — so the visual reads as two distinct sides of $0.
 */

export interface TradeForPnL {
  /** Realised P&L in account dollars. */
  pnl: number;
}

export interface Bin {
  rangeLow:  number;
  rangeHigh: number;
  count:     number;
  /** By bin midpoint. Bins on the ladder never straddle zero. */
  sign: 'gain' | 'loss';
}

export interface Distribution {
  bins: Bin[];
  totalTrades: number;
}

const WIDTH_LADDER: ReadonlyArray<number> = [
  10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];

const MIN_BINS = 8;
const MAX_BINS = 12;

export function getPnLDistribution(
  trades: ReadonlyArray<TradeForPnL>,
): Distribution {
  if (trades.length === 0) return { bins: [], totalTrades: 0 };

  // Magnitude of the most extreme P&L on either side.
  let M = 0;
  for (const t of trades) {
    const a = Math.abs(t.pnl);
    if (a > M) M = a;
  }

  // Everyone at exactly $0 — emit a single zero-centered bin.
  if (M === 0) {
    return {
      bins: [{ rangeLow: -1, rangeHigh: 1, count: trades.length, sign: 'gain' }],
      totalTrades: trades.length,
    };
  }

  // Pick the smallest ladder width that lands the symmetric bin
  // count inside [MIN_BINS, MAX_BINS]. Fall back to the widest
  // ladder value if nothing fits (one-shot extreme outliers).
  let W = WIDTH_LADDER[WIDTH_LADDER.length - 1];
  for (const w of WIDTH_LADDER) {
    const symmetricBinCount = Math.ceil(M / w) * 2;
    if (symmetricBinCount >= MIN_BINS && symmetricBinCount <= MAX_BINS) {
      W = w;
      break;
    }
  }

  // Build a symmetric bin range from -lo to +hi stepping W. floor()
  // of a negative quotient gives us the leftmost edge below -M; we
  // negate the result of Math.ceil on +M so both edges line up on
  // a multiple of W.
  const halfBins = Math.ceil(M / W);
  const lo = -halfBins * W;
  const hi =  halfBins * W;

  const bins: Bin[] = [];
  for (let edge = lo; edge < hi; edge += W) {
    bins.push({
      rangeLow:  edge,
      rangeHigh: edge + W,
      count: 0,
      // Midpoint sign — bins never straddle zero given the ladder.
      sign: edge + W / 2 > 0 ? 'gain' : 'loss',
    });
  }

  // Assign each trade to its bin. Left-inclusive, right-exclusive
  // for all bins except the final one, which includes its right
  // edge so a trade equal to +M doesn't fall through.
  for (const t of trades) {
    const last = bins.length - 1;
    let idx = -1;
    for (let i = 0; i < bins.length; i++) {
      const b = bins[i];
      const inBin = i === last
        ? t.pnl >= b.rangeLow && t.pnl <= b.rangeHigh
        : t.pnl >= b.rangeLow && t.pnl <  b.rangeHigh;
      if (inBin) { idx = i; break; }
    }
    if (idx >= 0) bins[idx].count++;
  }

  return { bins, totalTrades: trades.length };
}
