import { JournalEntry } from '../store/journalStore';

/**
 * Process-not-outcome stats. Reads the pre-trade discipline flags
 * (checklistPassed) and the post-trade plan-adherence signal
 * (rrAchieved vs intendedRR) captured by the field-population pass.
 *
 *  - getDisciplineRate: % of trades where the user completed every
 *    item in the pre-trade checklist.
 *  - getPlanAdherence: bucketed counts of how each trade played
 *    out against its own plan — hit-target / partial / early-exit
 *    / stopped-out. Unscored trades (missing rrAchieved or
 *    intendedRR) are excluded so the breakdown only reflects
 *    trades the user actually planned.
 */

export interface DisciplineRate {
  /** Percentage (0–100) of trades with checklistPassed === true. */
  rate: number;
  passedCount: number;
  totalCount: number;
}

export function getDisciplineRate(
  trades: ReadonlyArray<JournalEntry>,
): DisciplineRate {
  const totalCount = trades.length;
  if (totalCount === 0) {
    return { rate: 0, passedCount: 0, totalCount: 0 };
  }
  let passedCount = 0;
  for (const t of trades) {
    if (t.checklistPassed) passedCount++;
  }
  return {
    rate: (passedCount / totalCount) * 100,
    passedCount,
    totalCount,
  };
}

export type AdherenceBucket =
  | 'hitTarget'
  | 'partial'
  | 'earlyExit'
  | 'stoppedOut';

export interface PlanAdherence {
  counts: Record<AdherenceBucket, number>;
  /** Trades that carried both a non-null rrAchieved AND a non-zero
   *  intendedRR. Unscored trades are excluded from `counts` and from
   *  this total. */
  totalScored: number;
}

/** Bucket boundary — within 5% of the planned multiple counts as
 *  "hit target." Same fudge factor used on the stop side so a
 *  trade that triggered the stop -1.00R reads "stoppedOut" even
 *  with slippage. */
const TARGET_TOLERANCE = 0.95;
const STOP_TOLERANCE   = -0.95;

export function getPlanAdherence(
  trades: ReadonlyArray<JournalEntry>,
): PlanAdherence {
  const counts: Record<AdherenceBucket, number> = {
    hitTarget: 0,
    partial: 0,
    earlyExit: 0,
    stoppedOut: 0,
  };
  let totalScored = 0;
  for (const t of trades) {
    const r = t.rrAchieved;
    const plan = t.intendedRR;
    if (typeof r !== 'number' || !Number.isFinite(r)) continue;
    if (typeof plan !== 'number' || plan <= 0) continue;
    totalScored++;
    if (r >= plan * TARGET_TOLERANCE) counts.hitTarget++;
    else if (r <= STOP_TOLERANCE)     counts.stoppedOut++;
    else if (r > 0)                    counts.partial++;
    else                               counts.earlyExit++;
  }
  return { counts, totalScored };
}
