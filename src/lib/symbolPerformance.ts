import { JournalEntry } from '../store/journalStore';

/**
 * Per-symbol aggregator for the Stats "By symbol" breakdown.
 *
 * The app fetches the active markets catalog from the backend at
 * runtime (TradingScreen owns the fetch), so there's no static
 * symbol-name source we can read at module load. For the
 * read-only breakdown we maintain a small hardcoded friendly-name
 * map covering the supported futures family — anything not in
 * the map renders with the symbol code as its own name (no trade
 * is silently dropped).
 */

/** Friendly names for the supported futures family. */
const SYMBOL_NAMES: Record<string, string> = {
  NQ:  'Nasdaq E-mini',
  MNQ: 'Nasdaq Micro',
  ES:  'S&P E-mini',
  MES: 'S&P Micro',
  YM:  'Dow E-mini',
  MYM: 'Dow Micro',
  RTY: 'Russell E-mini',
  M2K: 'Russell Micro',
  CL:  'Crude Oil',
  MCL: 'Micro Crude Oil',
  GC:  'Gold',
  MGC: 'Micro Gold',
  SI:  'Silver',
  NG:  'Natural Gas',
};

export interface SymbolStats {
  symbol: string;
  name: string;
  tradeCount: number;
  netPnl: number;
  /** 0..100. */
  winRate: number;
  /** grossProfit / grossLoss. `'inf'` when winners exist and zero
   *  losers. `null` below the 2-trade sample floor. */
  profitFactor: number | 'inf' | null;
  /** Mean of rrAchieved across trades that have it; null when
   *  no trade carries a captured plan. */
  avgRR: number | null;
}

const MIN_PF_SAMPLE = 2;

/** `symbolCatalog` is an optional override (e.g. tests / future
 *  backend-driven catalog merge). Defaults to the hardcoded
 *  SYMBOL_NAMES above. Anything not in the map is rendered with
 *  the symbol code as the name. */
export function getSymbolPerformance(
  trades: ReadonlyArray<JournalEntry>,
  symbolCatalog: Record<string, string> = SYMBOL_NAMES,
): SymbolStats[] {
  // Group by symbol — skip the empty / falsy symbol string just in
  // case legacy trades sneak through without one.
  const groups = new Map<string, JournalEntry[]>();
  for (const t of trades) {
    if (!t.symbol) continue;
    const list = groups.get(t.symbol);
    if (list) list.push(t);
    else groups.set(t.symbol, [t]);
  }

  const out: SymbolStats[] = [];
  for (const [symbol, group] of groups) {
    const tradeCount = group.length;
    let netPnl = 0;
    let wins = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    for (const t of group) {
      netPnl += t.pnl;
      if (t.pnl > 0) { wins++; grossProfit += t.pnl; }
      else if (t.pnl < 0) { grossLoss += -t.pnl; }
    }
    const winRate = (wins / tradeCount) * 100;

    let profitFactor: number | 'inf' | null;
    if (tradeCount < MIN_PF_SAMPLE) profitFactor = null;
    else if (grossLoss === 0) profitFactor = grossProfit > 0 ? 'inf' : null;
    else profitFactor = grossProfit / grossLoss;

    // Mean rrAchieved over trades that carry it. No rMultiple
    // fallback — discipline signal, plan-captured trades only.
    const rs = group
      .map((t) => t.rrAchieved)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const avgRR = rs.length > 0
      ? rs.reduce((a, b) => a + b, 0) / rs.length
      : null;

    out.push({
      symbol,
      name: symbolCatalog[symbol] ?? symbol,
      tradeCount,
      netPnl,
      winRate,
      profitFactor,
      avgRR,
    });
  }

  // Sort by net P&L descending; tie-break by trade count desc so a
  // higher-rep symbol sits above a one-off with the same net.
  out.sort((a, b) =>
    b.netPnl - a.netPnl ||
    b.tradeCount - a.tradeCount,
  );
  return out;
}
