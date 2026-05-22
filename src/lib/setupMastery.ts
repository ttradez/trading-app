import { JournalEntry } from '../store/journalStore';
import { getSetupStatsById } from './setupPerformance';

/**
 * Mastery model for the Setup Library.
 *
 * A user's relationship with a setup moves through four states:
 *
 *   untouched   → lesson never opened
 *   learning    → lesson opened, < 3 trades placed (not enough data
 *                 to call edge yet)
 *   practicing  → ≥ 3 trades placed but profit-factor < 1.0 (the
 *                 sample is big enough to score, and the user isn't
 *                 net-profitable on it yet — needs more reps)
 *   mastered    → ≥ 3 trades placed AND profit-factor ≥ 1.0 (the
 *                 user has both the lesson AND enough positive-
 *                 expectancy reps to call this setup "owned")
 *
 * The thresholds (3 trades, PF 1.0) match the Stats "By Setup"
 * card's sample floor and the recap's profit-factor signal so the
 * three surfaces tell the same story.
 *
 * Profit factor `'inf'` (winners + zero losers) counts as ≥ 1.
 */

export type MasteryLevel =
  | 'untouched'
  | 'learning'
  | 'practicing'
  | 'mastered';

const MIN_MASTERY_TRADES = 3;

export function getMasteryLevel(
  setupId: string,
  openedSetupIds: ReadonlySet<string>,
  trades: ReadonlyArray<JournalEntry>,
): MasteryLevel {
  if (!openedSetupIds.has(setupId)) return 'untouched';

  const stats = getSetupStatsById(trades, setupId);
  const tradeCount = stats?.tradeCount ?? 0;
  if (tradeCount < MIN_MASTERY_TRADES) return 'learning';

  const pf = stats?.profitFactor;
  // PF === null at sample ≥ 3 means winners-and-zero-losers below
  // the 2-trade PF sample floor never bites here; defensive: treat
  // null as "not yet profitable enough to call mastered".
  if (pf === 'inf') return 'mastered';
  if (typeof pf === 'number' && pf >= 1) return 'mastered';
  return 'practicing';
}

export function isMastered(
  setupId: string,
  openedSetupIds: ReadonlySet<string>,
  trades: ReadonlyArray<JournalEntry>,
): boolean {
  return getMasteryLevel(setupId, openedSetupIds, trades) === 'mastered';
}

export function getMasteredCountForPath(
  pathSetupIds: ReadonlyArray<string>,
  openedSetupIds: ReadonlySet<string>,
  trades: ReadonlyArray<JournalEntry>,
): number {
  let n = 0;
  for (const id of pathSetupIds) {
    if (isMastered(id, openedSetupIds, trades)) n++;
  }
  return n;
}

/** Count setups in `pathSetupIds` whose mastery is `'learning'` or
 *  `'practicing'` — drives the Learn path card's secondary "N in
 *  progress" line. */
export function getInProgressCountForPath(
  pathSetupIds: ReadonlyArray<string>,
  openedSetupIds: ReadonlySet<string>,
  trades: ReadonlyArray<JournalEntry>,
): number {
  let n = 0;
  for (const id of pathSetupIds) {
    const lvl = getMasteryLevel(id, openedSetupIds, trades);
    if (lvl === 'learning' || lvl === 'practicing') n++;
  }
  return n;
}
