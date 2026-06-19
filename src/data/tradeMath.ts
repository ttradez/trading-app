/**
 * Futures contract math — POINT_VALUE / TICK_SIZE / computePnl.
 *
 * Single source of truth for the session-local trading mechanic in
 * Pip. Both the live unrealized P&L readout (every bar
 * advance) AND the realized P&L on close call `computePnl` here, so
 * the two can never drift.
 *
 * Symbols match what `CreateSessionSheet.tsx` exposes today (ES, NQ).
 * Add YM / MES / MNQ entries here when those symbols ship in the
 * session-create wizard.
 */

/** USD profit/loss per 1.00-point move, per 1 contract. */
export const POINT_VALUE: Record<string, number> = {
  ES: 50,
  NQ: 20,
  YM: 5,    // E-mini Dow: $5 per index point
  GC: 100,  // Gold futures: 100 oz contract → $100 per $1 move per oz
};

/** Minimum price increment per symbol. */
export const TICK_SIZE: Record<string, number> = {
  ES: 0.25,
  NQ: 0.25,
  YM: 1.0,  // E-mini Dow ticks in whole points
  GC: 0.10, // Gold ticks in 10-cent increments
};

export type Side = 'long' | 'short';

/**
 * Compute USD P&L for a position at a given price.
 * For unrealized P&L pass the current revealed price.
 * For realized P&L pass the exit price.
 *
 * Long:  (current − entry) × POINT_VALUE × contracts
 * Short: (entry − current) × POINT_VALUE × contracts
 *
 * Falls back to point value 1 for unknown symbols so the readout
 * stays sane in dev rather than throwing.
 */
export function computePnl(args: {
  side: Side;
  entryPrice: number;
  currentPrice: number;
  contracts: number;
  symbol: string;
}): number {
  const { side, entryPrice, currentPrice, contracts, symbol } = args;
  const pv = POINT_VALUE[symbol] ?? 1;
  const delta = side === 'long' ? currentPrice - entryPrice : entryPrice - currentPrice;
  return delta * pv * contracts;
}
