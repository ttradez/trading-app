import {
  SETUP_LIBRARY, LibrarySetup, getSection,
} from '../data/setupLibrary';
import { JournalEntry } from '../store/journalStore';
import { getMasteryLevel } from './setupMastery';

/**
 * Next-Up recommendation engine for the Learn screen.
 *
 * Priority — surface the setup the user can most usefully act on
 * right now:
 *
 *   1. NEEDS PRACTICE   any setup in `practicing` state (≥ 3 trades,
 *                       PF < 1). The user has the lesson AND enough
 *                       reps to know they don't have edge yet — the
 *                       fix is more reps, not more reading.
 *   2. KEEP GOING       any setup in `learning` state (opened, < 3
 *                       trades). The user started — give them a
 *                       nudge to finish gathering data.
 *   3. NEXT UP          any setup in `untouched` state. New lesson.
 *   4. REVISIT          all 28 setups mastered. Fall back to the
 *                       curated default (Opening Range Breakout) so
 *                       there's always SOMETHING in the hero slot.
 *
 * Within each tier we walk PATH_ORDER (Momentum → Reversal → Range
 * → ICT) so the hero feels purposeful rather than random.
 *
 * TODO(archetype-aware): bias path order by archetype — Scalpers
 * toward Momentum, Position Traders toward Range/ICT. Stub'd so
 * the engine can be swapped without touching LearnScreen.
 */

export type NextUpReason =
  | 'NEEDS PRACTICE'
  | 'KEEP GOING'
  | 'NEXT UP'
  | 'REVISIT';

export interface NextUpResult {
  setup: LibrarySetup;
  reason: NextUpReason;
}

/** Path priority — drives both the search order in `pickNextSetup`
 *  and the on-screen grid order. Exported so the Learn paths grid
 *  shares a single source of truth. */
export const PATH_ORDER: ReadonlyArray<
  | { kind: 'classic'; category: 'momentum' | 'reversal' | 'range' }
  | { kind: 'ict' }
> = [
  { kind: 'classic', category: 'momentum' },
  { kind: 'classic', category: 'reversal' },
  { kind: 'classic', category: 'range' },
  { kind: 'ict' },
];

/** Setups in a given path — used by both the recommendation and
 *  the per-path progress count on the Learn cards. */
export function setupsInPath(
  path: typeof PATH_ORDER[number],
): LibrarySetup[] {
  return SETUP_LIBRARY.filter((s) => {
    if (path.kind === 'ict') return getSection(s) === 'ict';
    return getSection(s) === 'classic' && s.category === path.category;
  });
}

const DEFAULT_REVISIT_ID = 'opening_range_breakout';

/** All setups walked in PATH_ORDER, flattened — the per-tier scan
 *  filters this once instead of looping the four paths each time. */
function setupsInPriorityOrder(): LibrarySetup[] {
  const out: LibrarySetup[] = [];
  for (const path of PATH_ORDER) {
    for (const s of setupsInPath(path)) out.push(s);
  }
  return out;
}

export function pickNextSetup(
  openedSetupIds: ReadonlySet<string>,
  trades: ReadonlyArray<JournalEntry> = [],
): NextUpResult {
  const ordered = setupsInPriorityOrder();

  // Tier 1: practicing — opened, traded, but not yet profitable.
  for (const s of ordered) {
    if (getMasteryLevel(s.id, openedSetupIds, trades) === 'practicing') {
      return { setup: s, reason: 'NEEDS PRACTICE' };
    }
  }

  // Tier 2: learning — opened, fewer than 3 reps.
  for (const s of ordered) {
    if (getMasteryLevel(s.id, openedSetupIds, trades) === 'learning') {
      return { setup: s, reason: 'KEEP GOING' };
    }
  }

  // Tier 3: untouched — the original "open the next lesson" path.
  for (const s of ordered) {
    if (getMasteryLevel(s.id, openedSetupIds, trades) === 'untouched') {
      return { setup: s, reason: 'NEXT UP' };
    }
  }

  // Tier 4: everything mastered → curated revisit. Fall back to the
  // first library entry if the curated id was ever removed.
  const revisit =
    SETUP_LIBRARY.find((s) => s.id === DEFAULT_REVISIT_ID) ??
    SETUP_LIBRARY[0];
  return { setup: revisit, reason: 'REVISIT' };
}
