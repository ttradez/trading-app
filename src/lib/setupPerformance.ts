import { JournalEntry } from '../store/journalStore';
import {
  LibrarySetup, CATEGORY_LABEL, SETUP_LIBRARY,
} from '../data/setupLibrary';

/**
 * Per-setup aggregator for the Stats "By setup" breakdown.
 *
 * Only counts trades that carry a `setupId` (the Setup Library
 * pattern id). Trades without setup attribution still feed every
 * other Stats aggregate; this view is specifically the per-pattern
 * lens.
 *
 * Sort by net P&L descending — best-performing setups at the top,
 * losers at the bottom. The Stats breakdown renders that order
 * directly so the eye lands on what's working.
 */

export interface SetupStats {
  setupId: string;
  name: string;
  /** Human-readable category label (e.g. "Momentum", "ICT"). */
  category: string;
  tradeCount: number;
  netPnl: number;
  /** 0..100. Set to 0 when tradeCount === 0 (caller filters those). */
  winRate: number;
  /** grossProfit / grossLoss. `'inf'` when there are winners and
   *  zero losers. `null` when below the 2-trade sample floor. */
  profitFactor: number | 'inf' | null;
}

const MIN_PF_SAMPLE = 2;

/** Default catalog — the bundled Setup Library. Callers can pass a
 *  custom catalog for tests / Storybook. */
export function getSetupPerformance(
  trades: ReadonlyArray<JournalEntry>,
  catalog: ReadonlyArray<LibrarySetup> = SETUP_LIBRARY,
): SetupStats[] {
  const byId = new Map<string, LibrarySetup>();
  for (const s of catalog) byId.set(s.id, s);

  // Group trades by setupId (skip trades without attribution).
  const groups = new Map<string, JournalEntry[]>();
  for (const t of trades) {
    if (!t.setupId) continue;
    const list = groups.get(t.setupId);
    if (list) list.push(t);
    else groups.set(t.setupId, [t]);
  }

  const out: SetupStats[] = [];
  for (const [setupId, group] of groups) {
    const setup = byId.get(setupId);
    if (!setup) continue; // orphan id (library entry removed)

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

    out.push({
      setupId,
      name: setup.name,
      category: CATEGORY_LABEL[setup.category] ?? setup.category,
      tradeCount,
      netPnl,
      winRate,
      profitFactor,
    });
  }

  // Sort by net P&L descending. Tie-break by trade count descending
  // so a setup with more reps reads above a one-off with the same P&L.
  out.sort((a, b) =>
    b.netPnl - a.netPnl ||
    b.tradeCount - a.tradeCount,
  );
  return out;
}
